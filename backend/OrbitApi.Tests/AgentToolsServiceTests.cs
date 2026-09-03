using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OrbitApi.Models;
using OrbitApi.Services;
using Xunit;
using OrbitTaskStatus = OrbitApi.Models.TaskStatus;

namespace OrbitApi.Tests;

public class AgentToolsServiceTests
{
    private OrbitDbContext CreateInMemoryDb(string dbName)
    {
        var options = new DbContextOptionsBuilder<OrbitDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new OrbitDbContext(options);
    }

    [Fact]
    public void GetAvailableToolDeclarations_ReturnsStandardTools()
    {
        using var db = CreateInMemoryDb(nameof(GetAvailableToolDeclarations_ReturnsStandardTools));
        var service = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);

        var tools = service.GetAvailableToolDeclarations(RoleName.Admin);

        Assert.NotNull(tools);
        Assert.NotEmpty(tools);
        Assert.Contains(tools, t => t.ToString()!.Contains("create_task"));
        Assert.Contains(tools, t => t.ToString()!.Contains("get_financial_summary"));
        Assert.Contains(tools, t => t.ToString()!.Contains("approve_or_reject_expense"));
    }

    [Fact]
    public async Task CreateTaskAsync_CreatesTaskAndAuditLog()
    {
        using var db = CreateInMemoryDb(nameof(CreateTaskAsync_CreatesTaskAndAuditLog));
        var org = new Organization { Id = 1, Name = "Test NGO" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "Main Workspace" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "Clean Water Initiative", Status = ProjectStatus.Active };
        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);
        await db.SaveChangesAsync();

        var service = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var argsJson = JsonSerializer.Serialize(new
        {
            projectId = 1,
            title = "Install Water Purifier Unit 4",
            description = "Field installation",
            priority = "High",
            deadline = DateTime.UtcNow.AddDays(3).ToString("yyyy-MM-dd")
        });
        using var doc = JsonDocument.Parse(argsJson);

        var result = await service.ExecuteToolAsync("create_task", doc.RootElement, 1, 99, RoleName.Manager);

        Assert.True(result.Success);
        Assert.Contains("successfully created", result.Message);

        var createdTask = await db.Tasks.FirstOrDefaultAsync(t => t.Title == "Install Water Purifier Unit 4");
        Assert.NotNull(createdTask);
        Assert.Equal(PriorityLevel.High, createdTask.Priority);
        Assert.Equal(OrbitTaskStatus.ToDo, createdTask.Status);

        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "AiDelegateCreateTask");
        Assert.NotNull(audit);
        Assert.Equal(99, audit.PerformedByUserId);
    }

    [Fact]
    public async Task ApproveOrRejectExpenseAsync_ApprovesExpenseCorrectly()
    {
        using var db = CreateInMemoryDb(nameof(ApproveOrRejectExpenseAsync_ApprovesExpenseCorrectly));
        var org = new Organization { Id = 1, Name = "Org1" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "Ws1" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "Health Camp", Status = ProjectStatus.Active };
        var expense = new Expense
        {
            Id = 10,
            ProjectId = 1,
            Amount = 350.00m,
            Description = "Medical supplies",
            ApprovalStatus = ApprovalStatus.Pending,
            Date = DateTime.UtcNow
        };
        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);
        db.Expenses.Add(expense);
        await db.SaveChangesAsync();

        var service = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var argsJson = JsonSerializer.Serialize(new
        {
            expenseId = 10,
            action = "approve",
            notes = "Receipts verified"
        });
        using var doc = JsonDocument.Parse(argsJson);

        var result = await service.ExecuteToolAsync("approve_or_reject_expense", doc.RootElement, 1, 42, RoleName.FinanceOfficer);

        Assert.True(result.Success);
        var updated = await db.Expenses.FindAsync(10);
        Assert.NotNull(updated);
        Assert.Equal(ApprovalStatus.Approved, updated.ApprovalStatus);
        Assert.Equal(42, updated.ApprovedByFinanceOfficerId);

        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.Action == "AiDelegate_ApprovedExpense");
        Assert.NotNull(audit);
        Assert.Equal(42, audit.PerformedByUserId);
    }

    [Fact]
    public async Task ApproveOrRejectExpenseAsync_MemberRole_ReturnsPermissionDenied()
    {
        using var db = CreateInMemoryDb(nameof(ApproveOrRejectExpenseAsync_MemberRole_ReturnsPermissionDenied));
        var service = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var argsJson = JsonSerializer.Serialize(new { expenseId = 10, action = "approve" });
        using var doc = JsonDocument.Parse(argsJson);

        var result = await service.ExecuteToolAsync("approve_or_reject_expense", doc.RootElement, 1, 99, RoleName.Member);

        Assert.False(result.Success);
        Assert.Contains("Permission Denied", result.Message);
    }

    [Fact]
    public async Task CreateTaskAsync_ViewerRole_ReturnsPermissionDenied()
    {
        using var db = CreateInMemoryDb(nameof(CreateTaskAsync_ViewerRole_ReturnsPermissionDenied));
        var service = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var argsJson = JsonSerializer.Serialize(new { projectId = 1, title = "Should Fail" });
        using var doc = JsonDocument.Parse(argsJson);

        var result = await service.ExecuteToolAsync("create_task", doc.RootElement, 1, 99, RoleName.Viewer);

        Assert.False(result.Success);
        Assert.Contains("Permission Denied", result.Message);
    }

    [Fact]
    public async Task GetFinancialSummaryAsync_CalculatesCorrectTotals()
    {
        using var db = CreateInMemoryDb(nameof(GetFinancialSummaryAsync_CalculatesCorrectTotals));
        var org = new Organization { Id = 1, Name = "Org1" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "Ws1" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "P1" };
        var cat = new FinancialCategory { Id = 1, OrganizationId = 1, Name = "Logistics" };

        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);
        db.FinancialCategories.Add(cat);

        db.Expenses.AddRange(
            new Expense { Id = 1, ProjectId = 1, Amount = 100, CategoryId = 1, ApprovalStatus = ApprovalStatus.Approved, Date = DateTime.UtcNow },
            new Expense { Id = 2, ProjectId = 1, Amount = 200, CategoryId = 1, ApprovalStatus = ApprovalStatus.Pending, Date = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var service = new AgentToolsService(db, NullLogger<AgentToolsService>.Instance);
        var result = await service.ExecuteToolAsync("get_financial_summary", default, 1, 1, RoleName.FinanceOfficer);

        Assert.True(result.Success);
        Assert.NotNull(result.Data);
    }
}
