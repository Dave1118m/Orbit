using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using OrbitApi.Models;
using OrbitApi.Services;
using Xunit;
using OrbitTaskStatus = OrbitApi.Models.TaskStatus;

namespace OrbitApi.Tests;

public class AiDelegateWorkerServiceTests
{
    private (OrbitDbContext db, IServiceProvider serviceProvider) SetupTestEnvironment(string dbName)
    {
        var services = new ServiceCollection();
        var options = new DbContextOptionsBuilder<OrbitDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;

        var db = new OrbitDbContext(options);
        services.AddScoped(_ => new OrbitDbContext(options));

        return (db, services.BuildServiceProvider());
    }

    [Fact]
    public async Task ProcessActiveDelegatesAsync_AutoApprovesEligibleExpenses_AndLeavesHighAmountsPending()
    {
        var (db, sp) = SetupTestEnvironment(nameof(ProcessActiveDelegatesAsync_AutoApprovesEligibleExpenses_AndLeavesHighAmountsPending));

        // 1. Setup Organization, Workspace, Project
        var org = new Organization { Id = 1, Name = "Relief NGO", Currency = "USD" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "Field HQ" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "Emergency Operations", Status = ProjectStatus.Active };
        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);

        // 2. Setup Active Finance Officer Delegate with limit $100.00
        var delegateConfig = new AiDelegateConfiguration
        {
            Id = 1,
            UserId = 99,
            OrganizationId = 1,
            IsActive = true,
            RolePersona = "FinanceOfficer",
            MaxAutoApprovalAmount = 100.00m,
            AutoApproveVerifiedReceipts = true
        };
        db.AiDelegateConfigurations.Add(delegateConfig);

        // 3. Setup Expenses: One under limit ($45), One over limit ($350)
        var expUnder = new Expense
        {
            Id = 1,
            ProjectId = 1,
            Amount = 45.00m,
            Currency = "USD",
            Description = "Medical gloves pack",
            ApprovalStatus = ApprovalStatus.Pending,
            Date = DateTime.UtcNow
        };
        var expOver = new Expense
        {
            Id = 2,
            ProjectId = 1,
            Amount = 350.00m,
            Currency = "USD",
            Description = "Generator repair part",
            ApprovalStatus = ApprovalStatus.Pending,
            Date = DateTime.UtcNow
        };
        db.Expenses.AddRange(expUnder, expOver);
        await db.SaveChangesAsync();

        // 4. Run Worker Cycle
        var worker = new AiDelegateWorkerService(sp, NullLogger<AiDelegateWorkerService>.Instance);
        await worker.ProcessActiveDelegatesAsync();

        // 5. Verify expUnder is Approved and expOver remains Pending
        using var verifyDb = sp.CreateScope().ServiceProvider.GetRequiredService<OrbitDbContext>();
        var updatedUnder = await verifyDb.Expenses.FindAsync(1);
        var updatedOver = await verifyDb.Expenses.FindAsync(2);

        Assert.NotNull(updatedUnder);
        Assert.Equal(ApprovalStatus.Approved, updatedUnder.ApprovalStatus);
        Assert.Equal(99, updatedUnder.ApprovedByFinanceOfficerId);

        Assert.NotNull(updatedOver);
        Assert.Equal(ApprovalStatus.Pending, updatedOver.ApprovalStatus); // Unchanged

        // 6. Verify Action Log recorded
        var actionLog = await verifyDb.AiDelegateActionLogs.FirstOrDefaultAsync(l => l.EntityId == 1);
        Assert.NotNull(actionLog);
        Assert.Equal("AutoApproveExpense", actionLog.ActionType);
        Assert.Contains("Medical gloves", actionLog.Summary);
        Assert.False(actionLog.WasAcknowledged);
    }

    [Fact]
    public async Task ProcessActiveDelegatesAsync_TriagesUrgentTasksForManagerDelegate()
    {
        var (db, sp) = SetupTestEnvironment(nameof(ProcessActiveDelegatesAsync_TriagesUrgentTasksForManagerDelegate));

        var org = new Organization { Id = 1, Name = "Relief NGO", Currency = "USD" };
        var ws = new Workspace { Id = 1, OrganizationId = 1, Name = "Field HQ" };
        var proj = new Project { Id = 1, WorkspaceId = 1, Title = "Logistics Unit", Status = ProjectStatus.Active };
        db.Organizations.Add(org);
        db.Workspaces.Add(ws);
        db.Projects.Add(proj);

        var delegateConfig = new AiDelegateConfiguration
        {
            Id = 1,
            UserId = 88,
            OrganizationId = 1,
            IsActive = true,
            RolePersona = "Manager",
            AutoTriageTasks = true
        };
        db.AiDelegateConfigurations.Add(delegateConfig);

        var urgentTask = new TaskItem
        {
            Id = 5,
            ProjectId = 1,
            Title = "Dispatch Emergency Vehicle",
            Priority = PriorityLevel.Low,
            Status = OrbitTaskStatus.ToDo,
            Deadline = DateTime.UtcNow.AddHours(24) // Impending within 48h
        };
        db.Tasks.Add(urgentTask);
        await db.SaveChangesAsync();

        var worker = new AiDelegateWorkerService(sp, NullLogger<AiDelegateWorkerService>.Instance);
        await worker.ProcessActiveDelegatesAsync();

        using var verifyDb = sp.CreateScope().ServiceProvider.GetRequiredService<OrbitDbContext>();
        var updatedTask = await verifyDb.Tasks.FindAsync(5);
        Assert.NotNull(updatedTask);
        Assert.Equal(PriorityLevel.High, updatedTask.Priority);

        var actionLog = await verifyDb.AiDelegateActionLogs.FirstOrDefaultAsync(l => l.EntityId == 5 && l.ActionType == "TriageTask");
        Assert.NotNull(actionLog);
        Assert.Contains("Dispatch Emergency Vehicle", actionLog.Summary);
    }
}
