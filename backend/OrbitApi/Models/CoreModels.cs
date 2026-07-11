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
    public decimal? Budget { get; set; }
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
    public decimal? Budget { get; set; }
    public int? DonorId { get; set; }
    public bool IsDeleted { get; set; }

    public Workspace? Workspace { get; set; }
    public Donor? Donor { get; set; }
    public ICollection<ProjectLeadHistory> ProjectLeadHistories { get; set; } = new List<ProjectLeadHistory>();
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();
    public ICollection<BudgetRevision> BudgetRevisions { get; set; } = new List<BudgetRevision>();
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
    public TaskStatus Status { get; set; } = TaskStatus.ToDo;
    public PriorityLevel Priority { get; set; } = PriorityLevel.Medium;
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
    public EntityType EntityType { get; set; } = EntityType.Task;
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
    public EntityType EntityType { get; set; } = EntityType.Task;
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
    [Required]
    public string Name { get; set; } = string.Empty;
    public decimal? Contribution { get; set; }
    public string? AllocatedProject { get; set; }
    public DonorType DonorType { get; set; } = DonorType.Institutional;

    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<ProjectDonor> ProjectDonors { get; set; } = new List<ProjectDonor>();
}

public class Expense
{
    [Key]
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public int? TaskId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "ETB";
    public DateTime Date { get; set; }
    public string Description { get; set; } = string.Empty;
    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Pending;
    public int? ApprovedByFinanceOfficerId { get; set; }
    public int? SignedOffByManagerId { get; set; }

    public Project? Project { get; set; }
    public TaskItem? Task { get; set; }
}

public class BudgetRevision
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int VersionNo { get; set; }
    public int? ApprovedByFinanceOfficerId { get; set; }
    public DateTime? ApprovedDate { get; set; }

    public Project? Project { get; set; }
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
    [Required]
    public string Name { get; set; } = string.Empty;
    public string? Skills { get; set; }
    public string? Availability { get; set; }
    public string BackgroundCheckStatus { get; set; } = "Pending";
}

public class RiskIssue
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public RiskIssueType Type { get; set; } = RiskIssueType.Risk;
    public string Likelihood { get; set; } = string.Empty;
    public string Impact { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public string Status { get; set; } = "Open";
}

public class Indicator
{
    [Key]
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int OutputId { get; set; }
    public string Baseline { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string Actual { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
}

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

    public Organization? Organization { get; set; }
    public Role? PreAssignedRole { get; set; }
    public User? InvitedByUser { get; set; }
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

