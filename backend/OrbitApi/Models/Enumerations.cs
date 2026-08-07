namespace OrbitApi.Models;

public enum RoleName
{
    Owner,
    Admin,
    Coordinator,
    Manager,
    FinanceOfficer,
    Member,
    Viewer
}

public enum ScopeType
{
    Organization,
    Workspace,
    Project
}

public enum ProjectStatus
{
    Planning,
    Active,
    OnHold,
    Completed,
    Cancelled,
    Archived
}

public enum TaskStatus
{
    ToDo,
    InProgress,
    InReview,
    Blocked,
    Done
}

public enum PriorityLevel
{
    Low,
    Medium,
    High,
    Urgent
}

public enum MediaType
{
    Image,
    Video,
    Document,
    Audio,
    Other
}

public static class EntityType
{
    public const string Project = "Project";
    public const string Task = "Task";
}

public enum VisibilityLevel
{
    Public,
    Private,
    Restricted
}

public enum DonorType
{
    Institutional,
    Foundation,
    Individual,
    Corporate
}

public enum ContributionType
{
    Cash,
    InKind,
    Equipment,
    Services
}

public enum ContributionStatus
{
    Pledged,
    Received
}

public enum ApprovalStatus
{
    Pending,
    FinanceReviewed,
    Approved,
    Rejected,
    Paid
}

public enum FinancialCategoryType
{
    Expense,
    Income,
    Both
}

public enum ExpenseCategory
{
    Personnel,
    Equipment,
    Operations,
    Training,
    Supplies,
    Travel
}

public enum ReportType
{
    Financial,
    Narrative,
    Audit
}

public enum ReportStatus
{
    Pending,
    Submitted,
    Overdue
}

public enum NotificationChannel
{
    InApp,
    Email,
    Sms
}

public enum DependencyType
{
    FinishToStart,
    StartToStart
}

public enum RiskIssueType
{
    Risk,
    Issue
}

public enum InvitationStatus
{
    Pending,
    Accepted,
    Expired
}

public enum OrgMemberStatus
{
    Invited,
    Active,
    Removed
}

public enum OwnershipTransferStatus
{
    Pending,
    Confirmed,
    Cancelled
}

public enum TaxExemptStatus
{
    NotApplicable,
    Pending,
    Approved,
    Expired
}

public enum BudgetLevel
{
    Organization,
    Workspace,
    Project,
    Task
}

public enum BudgetCategory
{
    Personnel,
    Travel,
    Supplies,
    Overhead,
    Equipment,
    Other
}

public enum BudgetStatus
{
    Draft,
    PendingApproval,
    Approved,
    Active,
    Closed
}

public enum BackgroundCheckStatus
{
    Pending,
    Passed,
    Failed,
    NotRequired
}
