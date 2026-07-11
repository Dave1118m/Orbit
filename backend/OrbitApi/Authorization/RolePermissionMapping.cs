using OrbitApi.Models;
using System.Collections.Concurrent;

namespace OrbitApi.Authorization;

public static class RolePermissionMapping
{
    // default mapping; can be loaded from DB/config in future
    public static readonly IReadOnlyDictionary<RoleName, Permission[]> Defaults = new Dictionary<RoleName, Permission[]>
    {
        [RoleName.Owner] = Enum.GetValues<Permission>(),
        [RoleName.Admin] = new[] {
            Permission.OrganizationManage, Permission.OrganizationView, Permission.OrganizationInvite, Permission.OrganizationRestore, Permission.OrganizationManagePartners, Permission.OrganizationManageCompliance, Permission.WorkspaceCreate, Permission.WorkspaceEdit, Permission.WorkspaceDelete, Permission.WorkspaceView,
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectDelete, Permission.ProjectView, Permission.ProjectAssignTeam,
            Permission.TeamCreate, Permission.TeamEdit, Permission.TeamDelete, Permission.TeamManageMembers, Permission.TeamAssignProject, Permission.TeamView,
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskDelete, Permission.TaskView,
            Permission.ExpenseApprove, Permission.BudgetEdit,
            Permission.UserManage, Permission.UserInvite,
            Permission.ViewReports
        },
        [RoleName.Coordinator] = new[] {
            Permission.WorkspaceCreate, Permission.WorkspaceEdit, Permission.WorkspaceView,
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectView, Permission.ProjectAssignTeam,
            Permission.TeamCreate, Permission.TeamEdit, Permission.TeamView, Permission.TeamManageMembers,
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskView,
            Permission.ViewReports
        },
        [RoleName.Manager] = new[] {
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectView, Permission.ProjectAssignTeam,
            Permission.TeamView, Permission.TaskCreate, Permission.TaskEdit, Permission.TaskView, Permission.ViewReports
        },
        [RoleName.FinanceOfficer] = new[] {
            Permission.ExpenseApprove, Permission.BudgetEdit, Permission.ViewReports
        },
        [RoleName.Member] = new[] {
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskView, Permission.TeamView, Permission.ProjectView
        },
        [RoleName.Viewer] = new[] {
            Permission.TaskView, Permission.TeamView, Permission.ProjectView, Permission.WorkspaceView, Permission.OrganizationView, Permission.ViewReports
        }
    };
}
