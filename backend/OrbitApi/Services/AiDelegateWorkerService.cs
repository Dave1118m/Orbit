using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitTaskStatus = OrbitApi.Models.TaskStatus;

namespace OrbitApi.Services;

public class AiDelegateWorkerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AiDelegateWorkerService> _logger;
    private readonly TimeSpan _pollInterval = TimeSpan.FromSeconds(60);

    public AiDelegateWorkerService(
        IServiceProvider serviceProvider,
        ILogger<AiDelegateWorkerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("AiDelegateWorkerService started.");

        // Brief delay on startup before first run
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessActiveDelegatesAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Error occurred during AI Delegate background processing cycle.");
            }

            try
            {
                await Task.Delay(_pollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("AiDelegateWorkerService stopped.");
    }

    public async Task ProcessActiveDelegatesAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();

        var activeConfigs = await db.AiDelegateConfigurations
            .Where(c => c.IsActive)
            .ToListAsync(cancellationToken);

        if (!activeConfigs.Any()) return;

        foreach (var config in activeConfigs)
        {
            try
            {
                await ProcessDelegateForConfigAsync(db, config, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed delegate processing for User {UserId} in Org {OrgId}", config.UserId, config.OrganizationId);
            }
        }
    }

    private async Task ProcessDelegateForConfigAsync(OrbitDbContext db, AiDelegateConfiguration config, CancellationToken cancellationToken)
    {
        var org = await db.Organizations
            .Include(o => o.Workspaces)
            .FirstOrDefaultAsync(o => o.Id == config.OrganizationId, cancellationToken);

        if (org == null) return;

        var wsIds = org.Workspaces.Select(w => w.Id).ToList();
        var projectIds = await db.Projects
            .Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted)
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);

        if (!projectIds.Any()) return;

        // 1. Finance / Admin / Owner auto-approval delegation
        var isFinanceOrAdmin = config.RolePersona == "FinanceOfficer"
                            || config.RolePersona == "Finance"
                            || config.RolePersona == "Admin"
                            || config.RolePersona == "Owner";

        if (isFinanceOrAdmin && config.AutoApproveVerifiedReceipts)
        {
            var pendingExpenses = await db.Expenses
                .Where(e => e.ProjectId != null
                         && projectIds.Contains(e.ProjectId.Value)
                         && e.ApprovalStatus == ApprovalStatus.Pending
                         && e.Amount <= config.MaxAutoApprovalAmount)
                .Take(10)
                .ToListAsync(cancellationToken);

            foreach (var exp in pendingExpenses)
            {
                // Enforce $500 threshold receipt rule: if over $500, must have attachment
                if (exp.Amount > 500 && exp.AttachmentId == null)
                {
                    continue; // Skip claims missing mandatory receipts
                }

                exp.ApprovalStatus = ApprovalStatus.Approved;
                exp.ApprovedByFinanceOfficerId = config.UserId;
                exp.FinanceReviewedAt = DateTime.UtcNow;

                db.AuditLogs.Add(new AuditLog
                {
                    OrganizationId = config.OrganizationId,
                    Action = "AiDelegateAutoApproveExpense",
                    Entity = "Expense",
                    PerformedByUserId = config.UserId,
                    Timestamp = DateTime.UtcNow,
                    NewValues = $"Auto-approved by {config.RolePersona}: Expense #{exp.Id} ({exp.Description}) for {exp.Amount:N2} {exp.Currency}"
                });

                db.AiDelegateActionLogs.Add(new AiDelegateActionLog
                {
                    UserId = config.UserId,
                    OrganizationId = config.OrganizationId,
                    ActionType = "AutoApproveExpense",
                    Entity = "Expense",
                    EntityId = exp.Id,
                    Summary = $"Auto-approved expense #{exp.Id} ('{exp.Description}') for {exp.Amount:N2} {exp.Currency} (Policy limit: ${config.MaxAutoApprovalAmount:N2})",
                    Timestamp = DateTime.UtcNow,
                    WasAcknowledged = false
                });

                _logger.LogInformation("AI Delegate auto-approved expense #{ExpenseId} on behalf of User {UserId}", exp.Id, config.UserId);
            }
        }

        // 2. Manager / Coordinator / Admin / Owner auto-triage delegation
        var isManagerOrCoord = config.RolePersona == "Manager"
                            || config.RolePersona == "Coordinator"
                            || config.RolePersona == "Admin"
                            || config.RolePersona == "Owner";

        if (isManagerOrCoord && config.AutoTriageTasks)
        {
            var urgentDeadlineThreshold = DateTime.UtcNow.AddDays(2);
            var urgentTasks = await db.Tasks
                .Where(t => projectIds.Contains(t.ProjectId)
                         && !t.IsDeleted
                         && t.Status == OrbitTaskStatus.ToDo
                         && (t.Priority == PriorityLevel.Low || t.Priority == PriorityLevel.Medium)
                         && t.Deadline != null
                         && t.Deadline <= urgentDeadlineThreshold)
                .Take(5)
                .ToListAsync(cancellationToken);

            foreach (var t in urgentTasks)
            {
                t.Priority = PriorityLevel.High;

                db.AuditLogs.Add(new AuditLog
                {
                    OrganizationId = config.OrganizationId,
                    Action = "AiDelegateTriageTask",
                    Entity = "Task",
                    PerformedByUserId = config.UserId,
                    Timestamp = DateTime.UtcNow,
                    NewValues = $"Elevated priority to High for Task #{t.Id} ('{t.Title}') due to impending deadline {t.Deadline:yyyy-MM-dd}"
                });

                db.AiDelegateActionLogs.Add(new AiDelegateActionLog
                {
                    UserId = config.UserId,
                    OrganizationId = config.OrganizationId,
                    ActionType = "TriageTask",
                    Entity = "Task",
                    EntityId = t.Id,
                    Summary = $"Elevated task '{t.Title}' (#{t.Id}) to High Priority due to deadline on {t.Deadline:MMM dd}",
                    Timestamp = DateTime.UtcNow,
                    WasAcknowledged = false
                });

                _logger.LogInformation("AI Delegate elevated task #{TaskId} to High priority on behalf of User {UserId}", t.Id, config.UserId);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
