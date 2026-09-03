using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using OrbitApi.Models;
using OrbitApi.Services;
using Xunit;

namespace OrbitApi.Tests;

public class AiAgentServiceTests
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

    [Fact]
    public async Task GetUserAvailablePersonasAsync_ReturnsStandardAndCustomRoles()
    {
        using var db = CreateInMemoryDb(nameof(GetUserAvailablePersonasAsync_ReturnsStandardAndCustomRoles));
        db.Roles.Add(new Role
        {
            Id = 101,
            OrganizationId = 1,
            Name = RoleName.Member,
            CustomTitle = "Field Logistics Specialist",
            Description = "Coordinates dispatch units",
            IsSystemRole = false
        });
        await db.SaveChangesAsync();

        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var personas = await aiService.GetUserAvailablePersonasAsync(1, 1);

        Assert.NotNull(personas);
        Assert.True(personas.Count >= 8); // 7 system personas + 1 custom role
        Assert.Contains(personas, p => p.RoleName == "Owner" && p.DisplayTitle == "Owner");
        Assert.Contains(personas, p => p.RoleName == "Admin" && p.DisplayTitle == "Admin");
        Assert.Contains(personas, p => p.RoleName == "Manager" && p.DisplayTitle == "Manager");
        Assert.Contains(personas, p => p.RoleName == "FinanceOfficer" && p.DisplayTitle == "Finance");
        Assert.Contains(personas, p => p.RoleName == "Coordinator" && p.DisplayTitle == "Coordinator");
        Assert.Contains(personas, p => p.RoleName == "Member" && p.DisplayTitle == "Member");
        Assert.Contains(personas, p => p.RoleName == "Viewer" && p.DisplayTitle == "Viewer");
        Assert.Contains(personas, p => p.DisplayTitle == "Field Logistics Specialist" && p.IsCustomRole);
    }

    [Fact]
    public async Task ProcessAgentChatAsync_InChatMode_ReturnsContextAwareAnswer_WithoutMarkdownJunk()
    {
        using var db = CreateInMemoryDb(nameof(ProcessAgentChatAsync_InChatMode_ReturnsContextAwareAnswer_WithoutMarkdownJunk));
        var org = new Organization { Id = 1, Name = "Global Relief Network", Currency = "USD" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "HQ" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "Emergency Response", Status = ProjectStatus.Active };
        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);
        await db.SaveChangesAsync();

        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        // Configuration without external API key to exercise context-aware fallback
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var request = new AiChatRequestDto
        {
            OrganizationId = 1,
            Mode = "chat",
            Prompt = "give me a system overview and status",
            RolePersona = "Admin"
        };

        var response = await aiService.ProcessAgentChatAsync(request, 1, RoleName.Owner);

        Assert.NotNull(response);
        Assert.Equal("Orbit Assistant", response.RolePersona);
        Assert.NotEmpty(response.ResponseText);
        // Verify plain formatting (no raw markdown hashtags or asterisks)
        Assert.DoesNotContain("###", response.ResponseText);
        Assert.DoesNotContain("**", response.ResponseText);
        // Verify live context was included
        Assert.Contains("Global Relief Network", response.ResponseText);
    }

    [Fact]
    public async Task ProcessAgentChatAsync_InDelegateMode_ExecutesSemanticAction()
    {
        using var db = CreateInMemoryDb(nameof(ProcessAgentChatAsync_InDelegateMode_ExecutesSemanticAction));
        var org = new Organization { Id = 1, Name = "Global Relief Network", Currency = "USD" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "HQ" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "Shelter Build", Status = ProjectStatus.Active };
        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);
        await db.SaveChangesAsync();

        var toolsService = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var config = new ConfigurationBuilder().Build();
        var aiService = new AiAgentService(db, toolsService, config, new DummyHttpClientFactory(), NullLogger<AiAgentService>.Instance);

        var request = new AiChatRequestDto
        {
            OrganizationId = 1,
            Mode = "delegate",
            RolePersona = "Manager",
            Prompt = "create task Distribute Blankets to Sector 7"
        };

        var response = await aiService.ProcessAgentChatAsync(request, 1, RoleName.Manager);

        Assert.NotNull(response);
        Assert.Equal("Manager", response.RolePersona);
        Assert.NotEmpty(response.ExecutedActions);
        Assert.Equal("create_task", response.ExecutedActions[0].ToolName);
        Assert.True(response.ExecutedActions[0].Success);

        // Verify task in DB
        var taskInDb = await db.Tasks.FirstOrDefaultAsync(t => t.Title.Contains("Distribute Blankets"));
        Assert.NotNull(taskInDb);
    }
}
