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

public enum ApprovalStatus
{
    Pending,
    Approved,
    Rejected
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
