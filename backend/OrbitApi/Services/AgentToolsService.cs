using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System.Text.Json;
using OrbitTaskStatus = OrbitApi.Models.TaskStatus;

namespace OrbitApi.Services;

public class AgentToolsService : IAgentToolsService
{
    private readonly OrbitDbContext _db;
    private readonly ILogger<AgentToolsService> _logger;

    public AgentToolsService(OrbitDbContext db, ILogger<AgentToolsService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public List<object> GetAvailableToolDeclarations(RoleName role, bool isCustomRole = false)
    {
        var tools = new List<object>
        {
            new
            {
                name = "get_organization_overview",
                description = "Retrieves high-level summary KPIs of the organization including active projects, member count, and pending tasks.",
                parameters = new { type = "object", properties = new { } }
            },
            new
            {
                name = "list_projects",
                description = "Lists all projects in the organization with their statuses, funding types, and timelines.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        status = new { type = "string", description = "Optional status filter (e.g. Active, Completed, OnHold)" }
                    }
                }
            },
            new
            {
                name = "search_tasks",
                description = "Searches tasks within the organization by keyword, status, or project.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        query = new { type = "string", description = "Task title keyword" },
                        status = new { type = "string", description = "Optional status (e.g. ToDo, InProgress, InReview, Blocked, Done)" }
                    }
                }
            },
            new
            {
                name = "create_task",
                description = "Creates a new task assigned to a project with priority and deadline.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        projectId = new { type = "integer", description = "The ID of the project" },
                        title = new { type = "string", description = "Title of the task" },
                        description = new { type = "string", description = "Detailed instructions for the task" },
                        priority = new { type = "string", description = "Low, Medium, High, or Urgent" },
                        deadline = new { type = "string", description = "ISO 8601 deadline date (YYYY-MM-DD)" }
                    },
                    required = new[] { "projectId", "title" }
                }
            },
            new
            {
                name = "get_financial_summary",
                description = "Returns financial totals, total expenses by category, and approval metrics.",
                parameters = new { type = "object", properties = new { } }
            },
            new
            {
                name = "list_pending_expenses",
                description = "Retrieves a list of expenses currently pending review and approval.",
                parameters = new { type = "object", properties = new { } }
            },
            new
            {
                name = "approve_or_reject_expense",
                description = "Approves or rejects a submitted expense claim.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        expenseId = new { type = "integer", description = "ID of the expense to review" },
                        action = new { type = "string", description = "'approve' or 'reject'" },
                        notes = new { type = "string", description = "Reason or approval comment" }
                    },
                    required = new[] { "expenseId", "action" }
                }
            },
            new
            {
                name = "list_volunteers_and_tasks",
                description = "Lists active volunteers, logged hours, and background check status.",
                parameters = new { type = "object", properties = new { } }
            },
            new
            {
                name = "list_risk_issues",
                description = "Lists open risk logs and issues across active projects.",
                parameters = new { type = "object", properties = new { } }
            },
            new
            {
                name = "invite_team_member",
                description = "Sends an invitation to a new team member by email.",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        email = new { type = "string", description = "Email address of the invitee" },
                        roleName = new { type = "string", description = "Role to assign (Admin, Manager, FinanceOfficer, Coordinator, Member, Viewer)" }
                    },
                    required = new[] { "email" }
                }
            }
        };

        return tools;
    }

    public async Task<ToolCallResult> ExecuteToolAsync(string toolName, JsonElement arguments, int organizationId, int currentUserId, RoleName currentRole)
    {
        try
        {
            switch (toolName.ToLowerInvariant())
            {
                case "get_organization_overview":
                    return await GetOrganizationOverviewAsync(organizationId);

                case "list_projects":
                    var status = arguments.TryGetProperty("status", out var stEl) ? stEl.GetString() : null;
                    return await ListProjectsAsync(organizationId, status);

                case "search_tasks":
                    var query = arguments.TryGetProperty("query", out var qEl) ? qEl.GetString() : null;
                    var taskStatus = arguments.TryGetProperty("status", out var tstEl) ? tstEl.GetString() : null;
                    return await SearchTasksAsync(organizationId, query, taskStatus);

                case "create_task":
                    return await CreateTaskAsync(organizationId, currentUserId, currentRole, arguments);

                case "get_financial_summary":
                    return await GetFinancialSummaryAsync(organizationId);

                case "list_pending_expenses":
                    return await ListPendingExpensesAsync(organizationId);

                case "approve_or_reject_expense":
                    return await ApproveOrRejectExpenseAsync(organizationId, currentUserId, currentRole, arguments);

                case "list_volunteers_and_tasks":
                    return await ListVolunteersAndTasksAsync(organizationId);

                case "list_risk_issues":
                    return await ListRiskIssuesAsync(organizationId);

                case "invite_team_member":
                    return await InviteTeamMemberAsync(organizationId, currentUserId, currentRole, arguments);

                default:
                    return new ToolCallResult
                    {
                        ToolName = toolName,
                        Success = false,
                        Message = $"Tool '{toolName}' is not recognized."
                    };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing agent tool {ToolName}", toolName);
            return new ToolCallResult
            {
                ToolName = toolName,
                Success = false,
                Message = $"Tool execution error: {ex.Message}"
            };
        }
    }

    private async Task<ToolCallResult> GetOrganizationOverviewAsync(int orgId)
    {
        var org = await _db.Organizations
            .Include(o => o.Workspaces)
            .FirstOrDefaultAsync(o => o.Id == orgId);

        if (org == null)
            return new ToolCallResult { ToolName = "get_organization_overview", Success = false, Message = "Organization not found." };

        var memberCount = await _db.OrganizationMembers.CountAsync(m => m.OrganizationId == orgId);
        var workspaceIds = org.Workspaces.Select(w => w.Id).ToList();

        var projects = await _db.Projects
            .Where(p => workspaceIds.Contains(p.WorkspaceId) && !p.IsDeleted)
            .ToListAsync();

        var projectIds = projects.Select(p => p.Id).ToList();
        var totalTasks = await _db.Tasks.CountAsync(t => projectIds.Contains(t.ProjectId) && !t.IsDeleted);
        var completedTasks = await _db.Tasks.CountAsync(t => projectIds.Contains(t.ProjectId) && !t.IsDeleted && t.Status == OrbitTaskStatus.Done);
        var totalExpenses = await _db.Expenses.Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value)).SumAsync(e => (decimal?)e.Amount) ?? 0;

        return new ToolCallResult
        {
            ToolName = "get_organization_overview",
            Success = true,
            Message = "Overview retrieved successfully.",
            Data = new
            {
                OrganizationName = org.Name,
                Country = org.Country,
                Currency = org.Currency ?? "USD",
                TotalExpenses = totalExpenses,
                ActiveProjectsCount = projects.Count(p => p.Status == ProjectStatus.Active),
                TotalProjectsCount = projects.Count,
                TotalTasksCount = totalTasks,
                CompletedTasksCount = completedTasks,
                MembersCount = memberCount,
                WorkspacesCount = org.Workspaces.Count
            }
        };
    }

    private async Task<ToolCallResult> ListProjectsAsync(int orgId, string? status)
    {
        var org = await _db.Organizations.Include(o => o.Workspaces).FirstOrDefaultAsync(o => o.Id == orgId);
        if (org == null) return new ToolCallResult { ToolName = "list_projects", Success = false, Message = "Org not found." };

        var wsIds = org.Workspaces.Select(w => w.Id).ToList();
        var query = _db.Projects.Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ProjectStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(p => p.Status == parsedStatus);
        }

        var projects = await query.Select(p => new
        {
            p.Id,
            p.Title,
            Status = p.Status.ToString(),
            p.FundingType,
            p.StartDate,
            p.EndDate
        }).ToListAsync();

        return new ToolCallResult
        {
            ToolName = "list_projects",
            Success = true,
            Message = $"Found {projects.Count} projects.",
            Data = projects
        };
    }

    private async Task<ToolCallResult> SearchTasksAsync(int orgId, string? queryText, string? statusText)
    {
        var org = await _db.Organizations.Include(o => o.Workspaces).FirstOrDefaultAsync(o => o.Id == orgId);
        if (org == null) return new ToolCallResult { ToolName = "search_tasks", Success = false, Message = "Org not found." };

        var wsIds = org.Workspaces.Select(w => w.Id).ToList();
        var projectIds = await _db.Projects.Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted).Select(p => p.Id).ToListAsync();

        var query = _db.Tasks.Where(t => projectIds.Contains(t.ProjectId) && !t.IsDeleted);

        if (!string.IsNullOrEmpty(queryText))
        {
            query = query.Where(t => t.Title.Contains(queryText));
        }

        if (!string.IsNullOrEmpty(statusText) && Enum.TryParse<OrbitTaskStatus>(statusText, true, out var parsedStatus))
        {
            query = query.Where(t => t.Status == parsedStatus);
        }

        var tasks = await query.Take(25).Select(t => new
        {
            t.Id,
            t.Title,
            Status = t.Status.ToString(),
            Priority = t.Priority.ToString(),
            t.Deadline,
            ProjectTitle = t.Project != null ? t.Project.Title : "Unassigned"
        }).ToListAsync();

        return new ToolCallResult
        {
            ToolName = "search_tasks",
            Success = true,
            Message = $"Found {tasks.Count} tasks matching criteria.",
            Data = tasks
        };
    }

    private async Task<ToolCallResult> CreateTaskAsync(int orgId, int currentUserId, RoleName currentRole, JsonElement arguments)
    {
        if (currentRole == RoleName.Viewer)
        {
            return new ToolCallResult { ToolName = "create_task", Success = false, Message = "Permission Denied: Viewers cannot create tasks." };
        }

        if (!arguments.TryGetProperty("projectId", out var pIdEl) || !arguments.TryGetProperty("title", out var titleEl))
        {
            return new ToolCallResult { ToolName = "create_task", Success = false, Message = "Missing required parameters (projectId, title)." };
        }

        var projectId = pIdEl.GetInt32();
        var title = titleEl.GetString();
        var desc = arguments.TryGetProperty("description", out var dEl) ? dEl.GetString() : null;

        var priority = PriorityLevel.Medium;
        if (arguments.TryGetProperty("priority", out var prEl) && Enum.TryParse<PriorityLevel>(prEl.GetString(), true, out var p))
        {
            priority = p;
        }

        DateTime? deadline = null;
        if (arguments.TryGetProperty("deadline", out var dlEl) && DateTime.TryParse(dlEl.GetString(), out var dt))
        {
            deadline = dt;
        }

        var project = await _db.Projects
            .Include(p => p.Workspace)
            .FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);

        if (project == null || project.Workspace == null || project.Workspace.OrganizationId != orgId)
        {
            return new ToolCallResult { ToolName = "create_task", Success = false, Message = $"Project with ID {projectId} not found in this organization." };
        }

        var task = new TaskItem
        {
            ProjectId = projectId,
            Title = title ?? "Untitled AI Task",
            Description = desc,
            Priority = priority,
            Deadline = deadline ?? DateTime.UtcNow.AddDays(7),
            Status = OrbitTaskStatus.ToDo
        };

        _db.Tasks.Add(task);

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = project.Workspace?.OrganizationId,
            Action = "AiDelegateCreateTask",
            Entity = "Task",
            PerformedByUserId = currentUserId,
            Timestamp = DateTime.UtcNow,
            NewValues = $"Task '{task.Title}' created by AI Delegate for Project #{projectId}"
        });

        await _db.SaveChangesAsync();

        return new ToolCallResult
        {
            ToolName = "create_task",
            Success = true,
            Message = $"Task '{task.Title}' (ID: #{task.Id}) successfully created for project '{project.Title}'.",
            Data = new { task.Id, task.Title, task.ProjectId, task.Priority, task.Deadline, task.Status }
        };
    }

    private async Task<ToolCallResult> GetFinancialSummaryAsync(int orgId)
    {
        var org = await _db.Organizations.Include(o => o.Workspaces).FirstOrDefaultAsync(o => o.Id == orgId);
        if (org == null) return new ToolCallResult { ToolName = "get_financial_summary", Success = false, Message = "Org not found." };

        var wsIds = org.Workspaces.Select(w => w.Id).ToList();
        var projectIds = await _db.Projects.Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted).Select(p => p.Id).ToListAsync();

        var totalExpenses = await _db.Expenses.Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value)).SumAsync(e => (decimal?)e.Amount) ?? 0;
        var pendingExpenses = await _db.Expenses.Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.ApprovalStatus == ApprovalStatus.Pending).SumAsync(e => (decimal?)e.Amount) ?? 0;
        var approvedExpenses = await _db.Expenses.Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.ApprovalStatus == ApprovalStatus.Approved).SumAsync(e => (decimal?)e.Amount) ?? 0;

        var categoryBreakdown = await _db.Expenses
            .Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.FinancialCategory != null)
            .GroupBy(e => e.FinancialCategory!.Name)
            .Select(g => new { Category = g.Key, Total = g.Sum(e => e.Amount) })
            .ToListAsync();

        return new ToolCallResult
        {
            ToolName = "get_financial_summary",
            Success = true,
            Message = "Financial summary retrieved.",
            Data = new
            {
                TotalExpenses = totalExpenses,
                PendingApprovalAmount = pendingExpenses,
                ApprovedAmount = approvedExpenses,
                CategoryBreakdown = categoryBreakdown
            }
        };
    }

    private async Task<ToolCallResult> ListPendingExpensesAsync(int orgId)
    {
        var org = await _db.Organizations.Include(o => o.Workspaces).FirstOrDefaultAsync(o => o.Id == orgId);
        if (org == null) return new ToolCallResult { ToolName = "list_pending_expenses", Success = false, Message = "Org not found." };

        var wsIds = org.Workspaces.Select(w => w.Id).ToList();
        var projectIds = await _db.Projects.Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted).Select(p => p.Id).ToListAsync();

        var pending = await _db.Expenses
            .Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.ApprovalStatus == ApprovalStatus.Pending)
            .Select(e => new
            {
                e.Id,
                Title = e.Description,
                e.Amount,
                CategoryName = e.FinancialCategory != null ? e.FinancialCategory.Name : "General",
                ProjectTitle = e.Project != null ? e.Project.Title : "Unassigned",
                ExpenseDate = e.Date,
                SubmittedByName = e.SubmittedByUser != null ? e.SubmittedByUser.Name : "User"
            })
            .ToListAsync();

        return new ToolCallResult
        {
            ToolName = "list_pending_expenses",
            Success = true,
            Message = $"Found {pending.Count} pending expenses requiring approval.",
            Data = pending
        };
    }

    private async Task<ToolCallResult> ApproveOrRejectExpenseAsync(int orgId, int currentUserId, RoleName currentRole, JsonElement arguments)
    {
        if (currentRole != RoleName.Owner && currentRole != RoleName.Admin && currentRole != RoleName.FinanceOfficer)
        {
            return new ToolCallResult
            {
                ToolName = "approve_or_reject_expense",
                Success = false,
                Message = $"Permission Denied: Role '{currentRole}' is not authorized to approve or reject expenses. Only Finance Officers, Admins, or Owners can execute financial approvals."
            };
        }

        if (!arguments.TryGetProperty("expenseId", out var expIdEl) || !arguments.TryGetProperty("action", out var actEl))
        {
            return new ToolCallResult { ToolName = "approve_or_reject_expense", Success = false, Message = "Missing required parameters (expenseId, action)." };
        }

        var expenseId = expIdEl.GetInt32();
        var action = actEl.GetString()?.ToLowerInvariant();
        var notes = arguments.TryGetProperty("notes", out var nEl) ? nEl.GetString() : null;

        var expense = await _db.Expenses
            .Include(e => e.Project)
            .ThenInclude(p => p!.Workspace)
            .FirstOrDefaultAsync(e => e.Id == expenseId);

        if (expense == null || expense.Project == null || expense.Project.Workspace == null || expense.Project.Workspace.OrganizationId != orgId)
        {
            return new ToolCallResult { ToolName = "approve_or_reject_expense", Success = false, Message = $"Expense #{expenseId} not found in this organization." };
        }

        if (action == "approve")
        {
            expense.ApprovalStatus = ApprovalStatus.Approved;
            expense.ApprovedByFinanceOfficerId = currentUserId;
            expense.FinanceReviewedAt = DateTime.UtcNow;
        }
        else if (action == "reject")
        {
            expense.ApprovalStatus = ApprovalStatus.Rejected;
            expense.ApprovedByFinanceOfficerId = currentUserId;
            expense.FinanceReviewedAt = DateTime.UtcNow;
            expense.RejectionReason = notes ?? "Rejected by AI Role Delegate.";
        }
        else
        {
            return new ToolCallResult { ToolName = "approve_or_reject_expense", Success = false, Message = "Action must be 'approve' or 'reject'." };
        }

        var expenseOrgId = expense.Project?.Workspace?.OrganizationId ?? expense.BankAccount?.OrganizationId;

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = expenseOrgId,
            Action = $"AiDelegate_{expense.ApprovalStatus}Expense",
            Entity = "Expense",
            PerformedByUserId = currentUserId,
            Timestamp = DateTime.UtcNow,
            NewValues = $"Expense #{expense.Id} ({expense.Description}) {expense.ApprovalStatus} by AI Delegate. Reason: {expense.RejectionReason}"
        });

        await _db.SaveChangesAsync();

        return new ToolCallResult
        {
            ToolName = "approve_or_reject_expense",
            Success = true,
            Message = $"Expense #{expenseId} successfully {expense.ApprovalStatus.ToString().ToLower()}ed.",
            Data = new { expense.Id, expense.ApprovalStatus, expense.RejectionReason }
        };
    }

    private async Task<ToolCallResult> ListVolunteersAndTasksAsync(int orgId)
    {
        var volunteers = await _db.Volunteers
            .Where(v => v.OrganizationId == orgId)
            .Select(v => new
            {
                v.Id,
                v.Name,
                v.Email,
                Status = v.BackgroundCheckStatus.ToString(),
                v.Skills,
                HoursLogged = v.VolunteerHours.Sum(h => h.Hours)
            })
            .ToListAsync();

        return new ToolCallResult
        {
            ToolName = "list_volunteers_and_tasks",
            Success = true,
            Message = $"Retrieved {volunteers.Count} active volunteers.",
            Data = volunteers
        };
    }

    private async Task<ToolCallResult> ListRiskIssuesAsync(int orgId)
    {
        var org = await _db.Organizations.Include(o => o.Workspaces).FirstOrDefaultAsync(o => o.Id == orgId);
        if (org == null) return new ToolCallResult { ToolName = "list_risk_issues", Success = false, Message = "Org not found." };

        var wsIds = org.Workspaces.Select(w => w.Id).ToList();
        var projectIds = await _db.Projects.Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted).Select(p => p.Id).ToListAsync();

        var risks = await _db.RisksIssues
            .Where(r => projectIds.Contains(r.ProjectId))
            .Select(r => new
            {
                r.Id,
                r.Description,
                r.Impact,
                r.Likelihood,
                Status = r.Status.ToString(),
                ProjectTitle = r.Project != null ? r.Project.Title : "Unassigned"
            })
            .ToListAsync();

        return new ToolCallResult
        {
            ToolName = "list_risk_issues",
            Success = true,
            Message = $"Found {risks.Count} risk log items.",
            Data = risks
        };
    }

    private async Task<ToolCallResult> InviteTeamMemberAsync(int orgId, int currentUserId, RoleName currentRole, JsonElement arguments)
    {
        if (currentRole != RoleName.Owner && currentRole != RoleName.Admin)
        {
            return new ToolCallResult
            {
                ToolName = "invite_team_member",
                Success = false,
                Message = $"Permission Denied: Role '{currentRole}' is not authorized to invite members. Only Admins or Owners can send invitations."
            };
        }

        if (!arguments.TryGetProperty("email", out var emailEl))
        {
            return new ToolCallResult { ToolName = "invite_team_member", Success = false, Message = "Email is required to invite a member." };
        }

        var email = emailEl.GetString();
        var roleName = RoleName.Member;
        if (arguments.TryGetProperty("roleName", out var rEl) && Enum.TryParse<RoleName>(rEl.GetString(), true, out var r))
        {
            roleName = r;
        }

        var roleObj = await _db.Roles.FirstOrDefaultAsync(ro => ro.Name == roleName && ro.IsSystemRole)
                   ?? await _db.Roles.FirstOrDefaultAsync();

        var invitation = new OrganizationInvitation
        {
            OrganizationId = orgId,
            Email = email ?? "",
            PreAssignedRoleId = roleObj?.Id ?? 1,
            Token = Guid.NewGuid().ToString("N"),
            Status = InvitationStatus.Pending,
            InvitedByUserId = currentUserId,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        _db.OrganizationInvitations.Add(invitation);

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = orgId,
            Action = "AiDelegateInviteMember",
            Entity = "OrganizationInvitation",
            PerformedByUserId = currentUserId,
            Timestamp = DateTime.UtcNow,
            NewValues = $"Invited {email} as Role #{invitation.PreAssignedRoleId} via AI Delegate"
        });

        await _db.SaveChangesAsync();

        return new ToolCallResult
        {
            ToolName = "invite_team_member",
            Success = true,
            Message = $"Invitation created for {email} with role {roleName}.",
            Data = new { invitation.Id, invitation.Email, invitation.PreAssignedRoleId, invitation.ExpiresAt }
        };
    }
}
