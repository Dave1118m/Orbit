namespace OrbitApi.Authorization;

public enum Permission
{
    // Organization
    OrganizationManage,
    OrganizationView,
    OrganizationInvite,
    OrganizationTransferOwnership,
    OrganizationRestore,
    OrganizationManagePartners,
    OrganizationManageCompliance,

    // Workspace
    WorkspaceCreate,
    WorkspaceEdit,
    WorkspaceDelete,
    WorkspaceView,

    // Project
    ProjectCreate,
    ProjectEdit,
    ProjectDelete,
    ProjectView,
    ProjectAssignTeam,
    ProjectPostpone,

    // Team
    TeamCreate,
    TeamEdit,
    TeamDelete,
    TeamManageMembers,
    TeamAssignProject,
    TeamView,

    // Tasks
    TaskCreate,
    TaskEdit,
    TaskDelete,
    TaskView,

    // Finance
    ExpenseApprove,
    BudgetEdit,

    // Users
    UserManage,
    UserInvite,

    // Reports
    ViewReports
}
