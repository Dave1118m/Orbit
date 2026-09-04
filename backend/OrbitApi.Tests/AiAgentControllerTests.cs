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

public class AiAgentControllerTests
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
        var user = new ClaimsPrincipal(identity);
        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        };
    }

    [Fact]
    public async Task GetPersonas_ReturnsOkWithPersonas()
    {
        using var db = CreateInMemoryDb(nameof(GetPersonas_ReturnsOkWithPersonas));
        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(1)
        };

        var result = await controller.GetPersonas(1);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var personas = Assert.IsAssignableFrom<List<AiPersonaDto>>(okResult.Value);
        Assert.NotEmpty(personas);
        Assert.Contains(personas, p => p.RoleName == "Admin");
    }

    [Fact]
    public async Task Chat_EmptyPrompt_ReturnsBadRequest()
    {
        using var db = CreateInMemoryDb(nameof(Chat_EmptyPrompt_ReturnsBadRequest));
        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(1)
        };

        var result = await controller.Chat(new AiChatRequestDto { Prompt = "   " });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Chat_ValidPrompt_ReturnsOkResponse()
    {
        using var db = CreateInMemoryDb(nameof(Chat_ValidPrompt_ReturnsOkResponse));
        var org = new Organization { Id = 1, Name = "Orbit Test Org" };
        db.Organizations.Add(org);
        await db.SaveChangesAsync();

        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(1)
        };

        var result = await controller.Chat(new AiChatRequestDto
        {
            OrganizationId = 1,
            Mode = "chat",
            Prompt = "Hello Orbit"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AiChatResponseDto>(okResult.Value);
        Assert.NotEmpty(response.ResponseText);
    }

    [Fact]
    public async Task SetDelegateStatus_SavesConfigurationInDatabase()
    {
        using var db = CreateInMemoryDb(nameof(SetDelegateStatus_SavesConfigurationInDatabase));
        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var controller = new AiAgentController(aiService, db, toolsService)
        {
            ControllerContext = CreateContextWithUser(1)
        };

        var request = new AiAgentController.DelegateStatusRequest
        {
            OrganizationId = 1,
            RolePersona = "FinanceOfficer",
            IsAgentModeActive = true,
            MaxAutoApprovalAmount = 150m
        };

        var result = await controller.SetDelegateStatus(request);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        var saved = await db.AiDelegateConfigurations.FirstOrDefaultAsync(c => c.UserId == 1 && c.OrganizationId == 1);
        Assert.NotNull(saved);
        Assert.True(saved.IsActive);
        Assert.Equal("FinanceOfficer", saved.RolePersona);
    }
}
