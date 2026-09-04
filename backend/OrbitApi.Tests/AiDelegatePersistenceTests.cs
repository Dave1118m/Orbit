using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using OrbitApi.Controllers;
using OrbitApi.Models;
using OrbitApi.Services;
using System.Security.Claims;
using Xunit;

namespace OrbitApi.Tests;

public class AiDelegatePersistenceTests
{
    private class DummyHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new HttpClient();
    }

    private OrbitDbContext CreateInMemoryDb(string dbName)
    {
        var options = new DbContextOptionsBuilder<OrbitDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new OrbitDbContext(options);
    }

    private ControllerContext CreateContextWithUser(int userId)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("sub", userId.ToString())
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
    }

    [Fact]
    public async Task SetDelegateStatus_PersistsConfigurationAndAuditLog()
    {
        using var db = CreateInMemoryDb(nameof(SetDelegateStatus_PersistsConfigurationAndAuditLog));
        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(7)
        };

        var request = new AiAgentController.DelegateStatusRequest
        {
            OrganizationId = 1,
            RolePersona = "FinanceOfficer",
            IsAgentModeActive = true,
            MaxAutoApprovalAmount = 250.00m,
            AutoReplyMessage = "In field operations.",
            AutoApproveVerifiedReceipts = true,
            AutoTriageTasks = true
        };

        var result = await controller.SetDelegateStatus(request);
        var okResult = Assert.IsType<OkObjectResult>(result);

        // Verify entity persisted in database
        var savedConfig = await db.AiDelegateConfigurations
            .FirstOrDefaultAsync(c => c.UserId == 7 && c.OrganizationId == 1);

        Assert.NotNull(savedConfig);
        Assert.True(savedConfig.IsActive);
        Assert.Equal("FinanceOfficer", savedConfig.RolePersona);
        Assert.Equal(250.00m, savedConfig.MaxAutoApprovalAmount);
        Assert.Equal("In field operations.", savedConfig.AutoReplyMessage);
        Assert.NotNull(savedConfig.ActivatedAt);

        // Verify Audit Log
        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "AiDelegateActivated");
        Assert.NotNull(audit);
        Assert.Equal(7, audit.PerformedByUserId);
    }

    [Fact]
    public async Task GetDelegateStatus_ReturnsPersistedState()
    {
        using var db = CreateInMemoryDb(nameof(GetDelegateStatus_ReturnsPersistedState));
        db.AiDelegateConfigurations.Add(new AiDelegateConfiguration
        {
            UserId = 5,
            OrganizationId = 2,
            IsActive = true,
            RolePersona = "Manager",
            MaxAutoApprovalAmount = 150m,
            AutoReplyMessage = "Traveling until Friday"
        });
        await db.SaveChangesAsync();

        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(5)
        };

        var result = await controller.GetDelegateStatus(orgId: 2);
        var okResult = Assert.IsType<OkObjectResult>(result);

        var doc = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(okResult.Value));
        Assert.True(doc.RootElement.GetProperty("isAgentModeActive").GetBoolean());
        Assert.Equal("Manager", doc.RootElement.GetProperty("rolePersona").GetString());
        Assert.Equal(150m, doc.RootElement.GetProperty("maxAutoApprovalAmount").GetDecimal());
        Assert.Equal("Traveling until Friday", doc.RootElement.GetProperty("autoReplyMessage").GetString());
    }

    [Fact]
    public async Task HandoffWorkflow_ListsUnacknowledgedAndAcknowledgesThem()
    {
        using var db = CreateInMemoryDb(nameof(HandoffWorkflow_ListsUnacknowledgedAndAcknowledgesThem));
        db.AiDelegateActionLogs.AddRange(
            new AiDelegateActionLog
            {
                Id = 1,
                UserId = 3,
                OrganizationId = 1,
                ActionType = "AutoApproveExpense",
                Entity = "Expense",
                EntityId = 10,
                Summary = "Auto-approved $45 office supply",
                WasAcknowledged = false
            },
            new AiDelegateActionLog
            {
                Id = 2,
                UserId = 3,
                OrganizationId = 1,
                ActionType = "TriageTask",
                Entity = "Task",
                EntityId = 20,
                Summary = "Elevated task to High priority",
                WasAcknowledged = false
            }
        );
        await db.SaveChangesAsync();

        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(3)
        };

        // 1. Get handoff
        var handoffResult = await controller.GetDelegateHandoff(orgId: 1);
        var okHandoff = Assert.IsType<OkObjectResult>(handoffResult);
        var handoffDoc = System.Text.Json.JsonDocument.Parse(System.Text.Json.JsonSerializer.Serialize(okHandoff.Value));
        Assert.Equal(2, handoffDoc.RootElement.GetProperty("totalUnacknowledged").GetInt32());
        Assert.Equal(1, handoffDoc.RootElement.GetProperty("autoApprovedCount").GetInt32());
        Assert.Equal(1, handoffDoc.RootElement.GetProperty("tasksTriagedCount").GetInt32());

        // 2. Acknowledge handoff
        var ackResult = await controller.AcknowledgeHandoff(new AiAgentController.AcknowledgeHandoffRequest
        {
            OrganizationId = 1
        });
        Assert.IsType<OkObjectResult>(ackResult);

        // 3. Verify in DB
        var remaining = await db.AiDelegateActionLogs.CountAsync(l => l.UserId == 3 && !l.WasAcknowledged);
        Assert.Equal(0, remaining);
    }
}
