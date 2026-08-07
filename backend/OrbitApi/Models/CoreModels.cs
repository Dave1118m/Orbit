using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrbitApi.Models;

public class Role
{
    [Key]
    public int Id { get; set; }
    [Required]
    public RoleName Name { get; set; }
    public string? Description { get; set; }

    public ICollection<RoleAssignment> RoleAssignments { get; set; } = new List<RoleAssignment>();
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class RoleAssignment
{
    [Key]
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RoleId { get; set; }
    public ScopeType ScopeType { get; set; }
    public int ScopeId { get; set; }

    public User? User { get; set; }
    public Role? Role { get; set; }
}

public class AppPermission
{
    [Key]
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty; // e.g. "finance.view", "users.manage"
    public string? Description { get; set; }
    
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}

public class RolePermission
{
    [Key]
    public int Id { get; set; }
    public int RoleId { get; set; }
    public int PermissionId { get; set; }
    
    public Role? Role { get; set; }
    public AppPermission? Permission { get; set; }
}

public class Organization
{
    [Key]
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string? RegistrationNumber { get; set; }
    public string? Country { get; set; }
    public int? OwnerId { get; set; }
    public string? Currency { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeletedByUserId { get; set; }
    public string? BackupJson { get; set; }

    public ICollection<Workspace> Workspaces { get; set; } = new List<Workspace>();
    public ICollection<OrganizationMember> Members { get; set; } = new List<OrganizationMember>();
    public ICollection<OrganizationPartner> PartnersInitiated { get; set; } = new List<OrganizationPartner>();
    public ICollection<OrganizationPartner> PartnersReceived { get; set; } = new List<OrganizationPartner>();
    public OrganizationCompliance? Compliance { get; set; }
    public ICollection<Volunteer> Volunteers { get; set; } = new List<Volunteer>();
    public ICollection<FinancialCategory> FinancialCategories { get; set; } = new List<FinancialCategory>();
}

public class User
{
    [Key]
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    [Required]
    public string Email { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public bool MFAEnabled { get; set; }
    public string? PhotoUrl { get; set; }
    public string? PreferredLanguage { get; set; }
    public string? PhoneNumber { get; set; }

    public ICollection<RoleAssignment> RoleAssignments { get; set; } = new List<RoleAssignment>();
    public ICollection<UserInvitation> SentInvitations { get; set; } = new List<UserInvitation>();
    public ICollection<UserInvitation> ReceivedInvitations { get; set; } = new List<UserInvitation>();
    public ICollection<TeamMember> TeamMembers { get; set; } = new List<TeamMember>();
    public ICollection<TaskMember> TaskMembers { get; set; } = new List<TaskMember>();
    public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public ICollection<Volunteer> LinkedVolunteers { get; set; } = new List<Volunteer>();
}

public class RevokedToken
{
    [Key]
    public int Id { get; set; }
    public string TokenId { get; set; } = string.Empty; // Store JTI
    public int UserId { get; set; }
    public DateTime RevokedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    
    public User? User { get; set; }
}

public class UserInvitation
{
    [Key]
    public int Id { get; set; }
    public int UserId { get; set; }
    public int InvitedByUserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;

    public User? User { get; set; }
    public User? InvitedByUser { get; set; }
}

public class Workspace
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public VisibilityLevel Visibility { get; set; } = VisibilityLevel.Private;
    public decimal? BudgetCeiling { get; set; }
    public bool IsArchived { get; set; }

    public Organization? Organization { get; set; }
    public ICollection<Team> Teams { get; set; } = new List<Team>();
    public ICollection<Project> Projects { get; set; } = new List<Project>();
}

public class Team
{
    [Key]
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TeamLeadUserId { get; set; }
    public bool IsArchived { get; set; }

    public Workspace? Workspace { get; set; }
    public ICollection<TeamMember> TeamMembers { get; set; } = new List<TeamMember>();
    public ICollection<ProjectTeam> ProjectTeams { get; set; } = new List<ProjectTeam>();
}

public class Project
{
    [Key]
    public int Id { get; set; }
    public int WorkspaceId { get; set; }
    [Required]
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Planning;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsDeleted { get; set; }
    public string FundingType { get; set; } = "SingleDonor"; // "SingleDonor" or "MultiDonor"

    public Workspace? Workspace { get; set; }
    public ICollection<ProjectLeadHistory> ProjectLeadHistories { get; set; } = new List<ProjectLeadHistory>();
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    public ICollection<ProjectTeamHistory> ProjectTeamHistories { get; set; } = new List<ProjectTeamHistory>();
    public ICollection<ProjectPostponement> ProjectPostponements { get; set; } = new List<ProjectPostponement>();
    public ICollection<ProjectTeam> ProjectTeams { get; set; } = new List<ProjectTeam>();
    public ICollection<ProjectDonor> ProjectDonors { get; set; } = new List<ProjectDonor>();
}

public class ProjectLeadHistory
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int UserId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }

    public Project? Project { get; set; }
}

public class TaskItem
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [Required]
    public string Title { get; set; } = string.Empty;
    [NotMapped]
    public string? Description { get; set; }
    public TaskStatus Status { get; set; } = TaskStatus.ToDo;
    public PriorityLevel Priority { get; set; } = PriorityLevel.Medium;
    [NotMapped]
    public DateTime? StartDate { get; set; }
    public DateTime? Deadline { get; set; }
    public DateTime? CompletedDate { get; set; }
    public int? ParentTaskId { get; set; }
    public bool IsDeleted { get; set; }

    public Project? Project { get; set; }
    public TaskItem? ParentTask { get; set; }
    public ICollection<TaskItem> Subtasks { get; set; } = new List<TaskItem>();
    public ICollection<TaskStatusHistory> StatusHistories { get; set; } = new List<TaskStatusHistory>();
    public ICollection<Subtask> SubtasksChecklist { get; set; } = new List<Subtask>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    public ICollection<TaskMember> TaskMembers { get; set; } = new List<TaskMember>();
    public ICollection<TaskDependency> Dependencies { get; set; } = new List<TaskDependency>();
    public ICollection<TaskDependency> DependedOnBy { get; set; } = new List<TaskDependency>();
    public ICollection<TaskVolunteer> TaskVolunteers { get; set; } = new List<TaskVolunteer>();
    public ICollection<VolunteerHour> VolunteerHours { get; set; } = new List<VolunteerHour>();
}

public class TaskStatusHistory
{
    [Key]
    public int Id { get; set; }
    public int TaskId { get; set; }
    public string OldStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public int ChangedByUserId { get; set; }
    public DateTime ChangedAt { get; set; }

    public TaskItem? Task { get; set; }
}

public class Subtask
{
    [Key]
    public int Id { get; set; }
    public int TaskId { get; set; }
    [Required]
    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }

    public TaskItem? Task { get; set; }
}

public class Comment
{
    [Key]
    public int Id { get; set; }
    public string EntityType { get; set; } = "Task";
    public int EntityId { get; set; }
    public int UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public int? ParentCommentId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? EditedAt { get; set; }

    public Comment? ParentComment { get; set; }
    public ICollection<Comment> Replies { get; set; } = new List<Comment>();
}

public class Attachment
{
    [Key]
    public int Id { get; set; }
    public string EntityType { get; set; } = "Task";
    public int EntityId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string AbsoluteFilePath { get; set; } = string.Empty;
    public MediaType MediaType { get; set; } = MediaType.Document;
    public string MimeType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public bool PreviewEnabled { get; set; }
    public int? UserId { get; set; }

    public User? User { get; set; }
}

public class Notification
{
    [Key]
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Message { get; set; } = string.Empty;
    public NotificationChannel Channel { get; set; } = NotificationChannel.InApp;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? Link { get; set; }
}

public class AuditLog
{
    [Key]
    public int Id { get; set; }
    public string Entity { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public DateTime Timestamp { get; set; }
    public int? PerformedByUserId { get; set; }

    public User? PerformedByUser { get; set; }
}

public class Donor
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public DonorType DonorType { get; set; } = DonorType.Institutional;
    public string? PrimaryContact { get; set; }
    public string? EmailAddress { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Country { get; set; }

    public Organization? Organization { get; set; }
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<ProjectDonor> ProjectDonors { get; set; } = new List<ProjectDonor>();
    public ICollection<DonorContribution> Contributions { get; set; } = new List<DonorContribution>();
    public ICollection<DonorCommunication> Communications { get; set; } = new List<DonorCommunication>();
}

public class DonorContribution
{
    [Key]
    public int Id { get; set; }
    public int DonorId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTime Date { get; set; }
    public ContributionType Type { get; set; } = ContributionType.Cash;
    public ContributionStatus Status { get; set; } = ContributionStatus.Pledged;
    public int? AllocatedProjectId { get; set; }
    public int? AllocatedTaskId { get; set; }
    public int? BankAccountId { get; set; }
    public int? CategoryId { get; set; }
    public string? Notes { get; set; }

    public Donor? Donor { get; set; }
    public Project? AllocatedProject { get; set; }
    public TaskItem? AllocatedTask { get; set; }
    public BankAccount? BankAccount { get; set; }
    public FinancialCategory? FinancialCategory { get; set; }
}

public class DonorCommunication
{
    [Key]
    public int Id { get; set; }
    public int DonorId { get; set; }
    public DateTime Date { get; set; }
    public string Method { get; set; } = "Email";
    public string Notes { get; set; } = string.Empty;
    public int LoggedByUserId { get; set; }

    public Donor? Donor { get; set; }
    public User? LoggedByUser { get; set; }
}

public class BankAccount
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string SwiftCode { get; set; } = string.Empty;
    public string Currency { get; set; } = "USD";
    public bool IsActive { get; set; } = true;

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public Organization? Organization { get; set; }
    public ICollection<DonorContribution> Contributions { get; set; } = new List<DonorContribution>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
}

public class Expense
{
    [Key]
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public int? TaskId { get; set; }
    public int SubmittedByUserId { get; set; }
    public ExpenseCategory Category { get; set; } = ExpenseCategory.Operations;
    public int? CategoryId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "ETB";
    public DateTime Date { get; set; }
    public string Description { get; set; } = string.Empty;
    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Pending;
    public int? ApprovedByFinanceOfficerId { get; set; }
    public DateTime? FinanceReviewedAt { get; set; }
    public int? SignedOffByManagerId { get; set; }
    public DateTime? ManagerSignedOffAt { get; set; }
    public string? RejectionReason { get; set; }
    public int? AttachmentId { get; set; }
    public int? BankAccountId { get; set; }
    public int? PaidByUserId { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public Project? Project { get; set; }
    public TaskItem? Task { get; set; }
    public User? SubmittedByUser { get; set; }
    public User? ApprovedByFinanceOfficer { get; set; }
    public User? SignedOffByManager { get; set; }
    public User? PaidByUser { get; set; }
    public Attachment? Attachment { get; set; }
    public BankAccount? BankAccount { get; set; }
    public FinancialCategory? FinancialCategory { get; set; }
}

public class GrantCondition
{
    [Key]
    public int Id { get; set; }
    public int GrantId { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
}

public class Volunteer
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public int? UserId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Skills { get; set; }
    public string? Availability { get; set; }
    public BackgroundCheckStatus BackgroundCheckStatus { get; set; } = BackgroundCheckStatus.Pending;

    public Organization? Organization { get; set; }
    public User? User { get; set; }
    public ICollection<TaskVolunteer> TaskVolunteers { get; set; } = new List<TaskVolunteer>();
    public ICollection<VolunteerHour> VolunteerHours { get; set; } = new List<VolunteerHour>();
}

public class TaskVolunteer
{
    [Key]
    public int Id { get; set; }
    public int TaskId { get; set; }
    public int VolunteerId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    public TaskItem? Task { get; set; }
    public Volunteer? Volunteer { get; set; }
}

public class VolunteerHour
{
    [Key]
    public int Id { get; set; }
    public int VolunteerId { get; set; }
    public int TaskId { get; set; }
    public decimal Hours { get; set; }
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public int LoggedByUserId { get; set; }
    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Volunteer? Volunteer { get; set; }
    public TaskItem? Task { get; set; }
    public User? LoggedByUser { get; set; }
}

// ─── Risk & Issue Register ────────────────────────────────────────────────────

public class RiskIssue
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public RiskIssueType Type { get; set; } = RiskIssueType.Risk;

    /// <summary>Short summary of the risk or issue</summary>
    [Required]
    public string Description { get; set; } = string.Empty;

    /// <summary>Qualitative likelihood label (e.g. "Unlikely", "Possible")</summary>
    public string Likelihood { get; set; } = string.Empty;

    /// <summary>Qualitative impact label (e.g. "Minor", "Major")</summary>
    public string Impact { get; set; } = string.Empty;

    /// <summary>Numeric likelihood score 1 (Rare) to 5 (Almost Certain)</summary>
    public int LikelihoodScore { get; set; } = 1;

    /// <summary>Numeric impact score 1 (Negligible) to 5 (Catastrophic)</summary>
    public int ImpactScore { get; set; } = 1;

    /// <summary>Steps planned or taken to reduce the risk (Risk type only)</summary>
    public string? MitigationPlan { get; set; }

    public string Owner { get; set; } = string.Empty;

    /// <summary>Open | InProgress | Mitigated | Resolved | Closed</summary>
    public string Status { get; set; } = "Open";

    /// <summary>How the issue was resolved (Issue type only)</summary>
    public string? ResolutionNotes { get; set; }

    public DateTime? ResolvedAt { get; set; }
    public int? ResolvedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project? Project { get; set; }
    public User? ResolvedByUser { get; set; }
}

// ─── Logframe / Results Framework ────────────────────────────────────────────

public enum LogframeLevel { Goal, Outcome, Output, Activity }

public class LogframeGoal
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [Required]
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project? Project { get; set; }
    public ICollection<LogframeOutcome> Outcomes { get; set; } = new List<LogframeOutcome>();
}

public class LogframeOutcome
{
    [Key]
    public int Id { get; set; }
    public int GoalId { get; set; }
    [Required]
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public LogframeGoal? Goal { get; set; }
    public ICollection<LogframeOutput> Outputs { get; set; } = new List<LogframeOutput>();
}

public class LogframeOutput
{
    [Key]
    public int Id { get; set; }
    public int OutcomeId { get; set; }
    [Required]
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public LogframeOutcome? Outcome { get; set; }
    public ICollection<LogframeActivity> Activities { get; set; } = new List<LogframeActivity>();
}

public class LogframeActivity
{
    [Key]
    public int Id { get; set; }
    public int OutputId { get; set; }
    [Required]
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Optional FK to a TaskItem for automatic progress aggregation</summary>
    public int? LinkedTaskId { get; set; }

    public LogframeOutput? Output { get; set; }
    public TaskItem? LinkedTask { get; set; }
}

public class Indicator
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public LogframeLevel Level { get; set; } = LogframeLevel.Output;
    public int EntityId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public string Baseline { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string Actual { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ─── Project / Team History ───────────────────────────────────────────────────

public class ProjectTeamHistory
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int TeamId { get; set; }
    public DateTime AssignedAt { get; set; }
    public DateTime? RemovedAt { get; set; }
    public int? ReplacedByTeamId { get; set; }

    public Project? Project { get; set; }
}

public class ProjectPostponement
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public DateTime OldEndDate { get; set; }
    public DateTime NewEndDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int RequestedByUserId { get; set; }
    public int ApprovedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public Project? Project { get; set; }
}

public class TeamMember
{
    [Key]
    public int Id { get; set; }
    public int TeamId { get; set; }
    public int UserId { get; set; }
    public DateTime JoinedAt { get; set; }

    public Team? Team { get; set; }
    public User? User { get; set; }
}

public class ProjectTeam
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int TeamId { get; set; }
    public DateTime AssignedAt { get; set; }

    public Project? Project { get; set; }
    public Team? Team { get; set; }
}

public class TaskMember
{
    [Key]
    public int Id { get; set; }
    public int TaskId { get; set; }
    public int UserId { get; set; }

    public TaskItem? Task { get; set; }
    public User? User { get; set; }
}

public class TaskDependency
{
    [Key]
    public int Id { get; set; }
    public int TaskId { get; set; }
    public int DependsOnTaskId { get; set; }
    public DependencyType DependencyType { get; set; } = DependencyType.FinishToStart;

    public TaskItem? Task { get; set; }
    public TaskItem? DependsOnTask { get; set; }
}

public class ProjectDonor
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int DonorId { get; set; }
    public decimal AllocatedAmount { get; set; }
    public decimal CoFundingPercentage { get; set; } = 100m;

    public Project? Project { get; set; }
    public Donor? Donor { get; set; }
}

public class OrganizationMember
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public int UserId { get; set; }
    public int RoleId { get; set; }
    public OrgMemberStatus Status { get; set; } = OrgMemberStatus.Active;
    public DateTime JoinedAt { get; set; }

    public Organization? Organization { get; set; }
    public User? User { get; set; }
    public Role? Role { get; set; }
}

public class OrganizationInvitation
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public int PreAssignedRoleId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public int InvitedByUserId { get; set; }
    public int? UserId { get; set; } // Link to user account created for invitation

    public Organization? Organization { get; set; }
    public Role? PreAssignedRole { get; set; }
    public User? InvitedByUser { get; set; }
    public User? User { get; set; }
}

public class OrganizationPartner
{
    [Key]
    public int Id { get; set; }
    public int InitiatorOrgId { get; set; }
    public int PartnerOrgId { get; set; }
    public DateTime LinkedAt { get; set; }
    public int LinkedByUserId { get; set; }
    public string? Notes { get; set; }

    public Organization? InitiatorOrg { get; set; }
    public Organization? PartnerOrg { get; set; }
    public User? LinkedByUser { get; set; }
}

public class OrganizationCompliance
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public string? RegistrationDocPath { get; set; }
    public TaxExemptStatus TaxExemptStatus { get; set; } = TaxExemptStatus.NotApplicable;
    public string? TaxExemptDocPath { get; set; }
    public DateTime? RegistrationRenewalDate { get; set; }
    public DateTime? TaxExemptRenewalDate { get; set; }
    [NotMapped]
    public DateTime? ClosedPeriodEndDate { get; set; }
    public DateTime? LastReminderSentAt { get; set; }

    public Organization? Organization { get; set; }
}

public class OwnershipTransferRequest
{
    [Key]
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public int FromUserId { get; set; }
    public int ToUserId { get; set; }
    public string ConfirmationToken { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public OwnershipTransferStatus Status { get; set; } = OwnershipTransferStatus.Pending;

    public Organization? Organization { get; set; }
    public User? FromUser { get; set; }
    public User? ToUser { get; set; }
}

public class SavedSearch
{
    [Key]
    public int Id { get; set; }
    public int UserId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    /// <summary>JSON-serialized query params: { q, type, status, dateFrom, dateTo, assignee }</summary>
    public string QueryJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}

public class Budget
{
    [Key]
    public int Id { get; set; }
    public BudgetLevel Level { get; set; } = BudgetLevel.Project;

    public int? OrganizationId { get; set; }
    public int? WorkspaceId { get; set; }
    public int? ProjectId { get; set; }
    public int? TaskId { get; set; }

    public decimal TotalAmount { get; set; }
    public string Currency { get; set; } = "USD";
    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    public BudgetStatus Status { get; set; } = BudgetStatus.Draft;

    public Organization? Organization { get; set; }
    public Workspace? Workspace { get; set; }
    public Project? Project { get; set; }
    public TaskItem? Task { get; set; }

    public ICollection<BudgetLineItem> LineItems { get; set; } = new List<BudgetLineItem>();
    public ICollection<BudgetRevisionLog> Revisions { get; set; } = new List<BudgetRevisionLog>();
}

public class BudgetLineItem
{
    [Key]
    public int Id { get; set; }
    public int BudgetId { get; set; }
    public BudgetCategory Category { get; set; } = BudgetCategory.Other;
    public int? CategoryId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public Budget? Budget { get; set; }
    public FinancialCategory? FinancialCategory { get; set; }
}

public class BudgetRevisionLog
{
    [Key]
    public int Id { get; set; }
    public int BudgetId { get; set; }
    public decimal PreviousAmount { get; set; }
    public decimal NewAmount { get; set; }
    public int ApprovedByUserId { get; set; }
    public DateTime DateApproved { get; set; }
    public string Notes { get; set; } = string.Empty;
    public int VersionNo { get; set; }

    public Budget? Budget { get; set; }
    public User? ApprovedByUser { get; set; }
}

public class GrantReportSchedule
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? DonorId { get; set; }
    public ReportType ReportType { get; set; } = ReportType.Financial;
    public DateTime DeadlineDate { get; set; }
    public ReportStatus Status { get; set; } = ReportStatus.Pending;
    public DateTime? SubmittedDate { get; set; }

    public Project? Project { get; set; }
    public Donor? Donor { get; set; }
}

public class ContactInquiry
{
    [Key]
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;
    public string Subject { get; set; } = "General Inquiry";
    [Required]
    public string Message { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsResolved { get; set; } = false;
    public string? AdminNotes { get; set; }
    public string? ReplyMessage { get; set; }
    public DateTime? RepliedAt { get; set; }
    public string? RepliedByUserName { get; set; }
}
