using Microsoft.EntityFrameworkCore;

namespace OrbitApi.Models;

public class OrbitDbContext : DbContext
{
    public OrbitDbContext(DbContextOptions<OrbitDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
    public DbSet<OrganizationInvitation> OrganizationInvitations => Set<OrganizationInvitation>();
    public DbSet<OrganizationPartner> OrganizationPartners => Set<OrganizationPartner>();
    public DbSet<OrganizationCompliance> OrganizationCompliances => Set<OrganizationCompliance>();
    public DbSet<OwnershipTransferRequest> OwnershipTransferRequests => Set<OwnershipTransferRequest>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserInvitation> UserInvitations => Set<UserInvitation>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectLeadHistory> ProjectLeadHistories => Set<ProjectLeadHistory>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<TaskStatusHistory> TaskStatusHistories => Set<TaskStatusHistory>();
    public DbSet<Subtask> Subtasks => Set<Subtask>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Donor> Donors => Set<Donor>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<BudgetRevision> BudgetRevisions => Set<BudgetRevision>();
    public DbSet<GrantCondition> GrantConditions => Set<GrantCondition>();
    public DbSet<Volunteer> Volunteers => Set<Volunteer>();
    public DbSet<RiskIssue> RisksIssues => Set<RiskIssue>();
    public DbSet<Indicator> Indicators => Set<Indicator>();
    public DbSet<ProjectTeamHistory> ProjectTeamHistories => Set<ProjectTeamHistory>();
    public DbSet<ProjectPostponement> ProjectPostponements => Set<ProjectPostponement>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<ProjectTeam> ProjectTeams => Set<ProjectTeam>();
    public DbSet<TaskMember> TaskMembers => Set<TaskMember>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();
    public DbSet<ProjectDonor> ProjectDonors => Set<ProjectDonor>();
    public DbSet<SavedSearch> SavedSearches => Set<SavedSearch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<RoleAssignment>()
            .HasOne(ra => ra.Role)
            .WithMany(r => r.RoleAssignments)
            .HasForeignKey(ra => ra.RoleId);

        modelBuilder.Entity<RoleAssignment>()
            .HasOne(ra => ra.User)
            .WithMany(u => u.RoleAssignments)
            .HasForeignKey(ra => ra.UserId);

        modelBuilder.Entity<UserInvitation>()
            .HasOne(ui => ui.InvitedByUser)
            .WithMany(u => u.SentInvitations)
            .HasForeignKey(ui => ui.InvitedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserInvitation>()
            .HasOne(ui => ui.User)
            .WithMany(u => u.ReceivedInvitations)
            .HasForeignKey(ui => ui.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Workspace>()
            .HasOne(w => w.Organization)
            .WithMany(o => o.Workspaces)
            .HasForeignKey(w => w.OrganizationId);

        modelBuilder.Entity<OrganizationMember>()
            .HasOne(om => om.Organization)
            .WithMany(o => o.Members)
            .HasForeignKey(om => om.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrganizationPartner>()
            .HasOne(op => op.InitiatorOrg)
            .WithMany(o => o.PartnersInitiated)
            .HasForeignKey(op => op.InitiatorOrgId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrganizationPartner>()
            .HasOne(op => op.PartnerOrg)
            .WithMany(o => o.PartnersReceived)
            .HasForeignKey(op => op.PartnerOrgId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrganizationCompliance>()
            .HasOne(oc => oc.Organization)
            .WithOne(o => o.Compliance)
            .HasForeignKey<OrganizationCompliance>(oc => oc.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OwnershipTransferRequest>()
            .HasOne(otr => otr.Organization)
            .WithMany()
            .HasForeignKey(otr => otr.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OwnershipTransferRequest>()
            .HasOne(otr => otr.FromUser)
            .WithMany()
            .HasForeignKey(otr => otr.FromUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OwnershipTransferRequest>()
            .HasOne(otr => otr.ToUser)
            .WithMany()
            .HasForeignKey(otr => otr.ToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrganizationMember>()
            .HasOne(om => om.User)
            .WithMany()
            .HasForeignKey(om => om.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrganizationInvitation>()
            .HasOne(oi => oi.InvitedByUser)
            .WithMany()
            .HasForeignKey(oi => oi.InvitedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrganizationPartner>()
            .HasOne(op => op.LinkedByUser)
            .WithMany()
            .HasForeignKey(op => op.LinkedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Team>()
            .HasOne(t => t.Workspace)
            .WithMany(w => w.Teams)
            .HasForeignKey(t => t.WorkspaceId);

        modelBuilder.Entity<Project>()
            .HasOne(p => p.Workspace)
            .WithMany(w => w.Projects)
            .HasForeignKey(p => p.WorkspaceId);

        modelBuilder.Entity<Project>()
            .HasOne(p => p.Donor)
            .WithMany(d => d.Projects)
            .HasForeignKey(p => p.DonorId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ProjectLeadHistory>()
            .HasOne(plh => plh.Project)
            .WithMany(p => p.ProjectLeadHistories)
            .HasForeignKey(plh => plh.ProjectId);

        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.Project)
            .WithMany(p => p.Tasks)
            .HasForeignKey(t => t.ProjectId);

        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.ParentTask)
            .WithMany(t => t.Subtasks)
            .HasForeignKey(t => t.ParentTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TaskStatusHistory>()
            .HasOne(tsh => tsh.Task)
            .WithMany(t => t.StatusHistories)
            .HasForeignKey(tsh => tsh.TaskId);

        modelBuilder.Entity<Subtask>()
            .HasOne(s => s.Task)
            .WithMany(t => t.SubtasksChecklist)
            .HasForeignKey(s => s.TaskId);

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.ParentComment)
            .WithMany(c => c.Replies)
            .HasForeignKey(c => c.ParentCommentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Attachment>()
            .HasOne(a => a.User)
            .WithMany(u => u.Attachments)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<AuditLog>()
            .HasOne(a => a.PerformedByUser)
            .WithMany(u => u.AuditLogs)
            .HasForeignKey(a => a.PerformedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.Project)
            .WithMany(p => p.Expenses)
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.Task)
            .WithMany(t => t.Expenses)
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<BudgetRevision>()
            .HasOne(br => br.Project)
            .WithMany(p => p.BudgetRevisions)
            .HasForeignKey(br => br.ProjectId);

        modelBuilder.Entity<ProjectTeamHistory>()
            .HasOne(pth => pth.Project)
            .WithMany(p => p.ProjectTeamHistories)
            .HasForeignKey(pth => pth.ProjectId);

        modelBuilder.Entity<ProjectPostponement>()
            .HasOne(pp => pp.Project)
            .WithMany(p => p.ProjectPostponements)
            .HasForeignKey(pp => pp.ProjectId);

        modelBuilder.Entity<TeamMember>()
            .HasOne(tm => tm.Team)
            .WithMany(t => t.TeamMembers)
            .HasForeignKey(tm => tm.TeamId);

        modelBuilder.Entity<TeamMember>()
            .HasOne(tm => tm.User)
            .WithMany(u => u.TeamMembers)
            .HasForeignKey(tm => tm.UserId);

        modelBuilder.Entity<ProjectTeam>()
            .HasOne(pt => pt.Project)
            .WithMany(p => p.ProjectTeams)
            .HasForeignKey(pt => pt.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProjectTeam>()
            .HasOne(pt => pt.Team)
            .WithMany(t => t.ProjectTeams)
            .HasForeignKey(pt => pt.TeamId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TaskMember>()
            .HasOne(tm => tm.Task)
            .WithMany(t => t.TaskMembers)
            .HasForeignKey(tm => tm.TaskId);

        modelBuilder.Entity<TaskMember>()
            .HasOne(tm => tm.User)
            .WithMany(u => u.TaskMembers)
            .HasForeignKey(tm => tm.UserId);

        modelBuilder.Entity<TaskDependency>()
            .HasOne(td => td.Task)
            .WithMany(t => t.Dependencies)
            .HasForeignKey(td => td.TaskId);

        modelBuilder.Entity<TaskDependency>()
            .HasOne(td => td.DependsOnTask)
            .WithMany(t => t.DependedOnBy)
            .HasForeignKey(td => td.DependsOnTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProjectDonor>()
            .HasOne(pd => pd.Project)
            .WithMany(p => p.ProjectDonors)
            .HasForeignKey(pd => pd.ProjectId);

        modelBuilder.Entity<ProjectDonor>()
            .HasOne(pd => pd.Donor)
            .WithMany(d => d.ProjectDonors)
            .HasForeignKey(pd => pd.DonorId);
    }
}
