using Microsoft.EntityFrameworkCore;

namespace OrbitApi.Models;

public class OrbitDbContext : DbContext
{
    public OrbitDbContext(DbContextOptions<OrbitDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RoleAssignment> RoleAssignments => Set<RoleAssignment>();
    public DbSet<AppPermission> Permissions => Set<AppPermission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
    public DbSet<OrganizationInvitation> OrganizationInvitations => Set<OrganizationInvitation>();
    public DbSet<OrganizationPartner> OrganizationPartners => Set<OrganizationPartner>();
    public DbSet<OrganizationCompliance> OrganizationCompliances => Set<OrganizationCompliance>();
    public DbSet<OwnershipTransferRequest> OwnershipTransferRequests => Set<OwnershipTransferRequest>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RevokedToken> RevokedTokens => Set<RevokedToken>();
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
    public DbSet<GrantCondition> GrantConditions => Set<GrantCondition>();
    public DbSet<Volunteer> Volunteers => Set<Volunteer>();
    public DbSet<RiskIssue> RisksIssues => Set<RiskIssue>();
    public DbSet<Indicator> Indicators => Set<Indicator>();
    public DbSet<LogframeGoal> LogframeGoals => Set<LogframeGoal>();
    public DbSet<LogframeOutcome> LogframeOutcomes => Set<LogframeOutcome>();
    public DbSet<LogframeOutput> LogframeOutputs => Set<LogframeOutput>();
    public DbSet<LogframeActivity> LogframeActivities => Set<LogframeActivity>();
    public DbSet<ProjectTeamHistory> ProjectTeamHistories => Set<ProjectTeamHistory>();
    public DbSet<ProjectPostponement> ProjectPostponements => Set<ProjectPostponement>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<ProjectTeam> ProjectTeams => Set<ProjectTeam>();
    public DbSet<TaskMember> TaskMembers => Set<TaskMember>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();
    public DbSet<ProjectDonor> ProjectDonors => Set<ProjectDonor>();
    public DbSet<SavedSearch> SavedSearches => Set<SavedSearch>();
    public DbSet<DonorContribution> DonorContributions => Set<DonorContribution>();
    public DbSet<DonorCommunication> DonorCommunications => Set<DonorCommunication>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<BudgetLineItem> BudgetLineItems => Set<BudgetLineItem>();
    public DbSet<BudgetRevisionLog> BudgetRevisionLogs => Set<BudgetRevisionLog>();
    public DbSet<GrantReportSchedule> GrantReportSchedules => Set<GrantReportSchedule>();
    public DbSet<TaskVolunteer> TaskVolunteers => Set<TaskVolunteer>();
    public DbSet<VolunteerHour> VolunteerHours => Set<VolunteerHour>();
    public DbSet<FinancialCategory> FinancialCategories => Set<FinancialCategory>();
    public DbSet<FinancialTransaction> FinancialTransactions => Set<FinancialTransaction>();
    public DbSet<ContactInquiry> ContactInquiries => Set<ContactInquiry>();

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

        modelBuilder.Entity<DonorContribution>()
            .HasOne(dc => dc.Donor)
            .WithMany(d => d.Contributions)
            .HasForeignKey(dc => dc.DonorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DonorContribution>()
            .HasOne(dc => dc.AllocatedProject)
            .WithMany()
            .HasForeignKey(dc => dc.AllocatedProjectId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DonorContribution>()
            .HasOne(dc => dc.AllocatedTask)
            .WithMany()
            .HasForeignKey(dc => dc.AllocatedTaskId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<DonorContribution>()
            .HasOne(dc => dc.BankAccount)
            .WithMany(ba => ba.Contributions)
            .HasForeignKey(dc => dc.BankAccountId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DonorCommunication>()
            .HasOne(dc => dc.Donor)
            .WithMany(d => d.Communications)
            .HasForeignKey(dc => dc.DonorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DonorCommunication>()
            .HasOne(dc => dc.LoggedByUser)
            .WithMany()
            .HasForeignKey(dc => dc.LoggedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BankAccount>()
            .HasOne(ba => ba.Organization)
            .WithMany()
            .HasForeignKey(ba => ba.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Budget>()
            .HasOne(b => b.Organization)
            .WithMany()
            .HasForeignKey(b => b.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Budget>()
            .HasOne(b => b.Workspace)
            .WithMany()
            .HasForeignKey(b => b.WorkspaceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Budget>()
            .HasOne(b => b.Project)
            .WithMany()
            .HasForeignKey(b => b.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Budget>()
            .HasOne(b => b.Task)
            .WithMany()
            .HasForeignKey(b => b.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BudgetRevisionLog>()
            .HasOne(br => br.ApprovedByUser)
            .WithMany()
            .HasForeignKey(br => br.ApprovedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.SubmittedByUser)
            .WithMany()
            .HasForeignKey(e => e.SubmittedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.ApprovedByFinanceOfficer)
            .WithMany()
            .HasForeignKey(e => e.ApprovedByFinanceOfficerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.SignedOffByManager)
            .WithMany()
            .HasForeignKey(e => e.SignedOffByManagerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.Project)
            .WithMany()
            .HasForeignKey(e => e.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.Task)
            .WithMany()
            .HasForeignKey(e => e.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.Attachment)
            .WithMany()
            .HasForeignKey(e => e.AttachmentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Donor>()
            .HasOne(d => d.Organization)
            .WithMany()
            .HasForeignKey(d => d.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.BankAccount)
            .WithMany(ba => ba.Expenses)
            .HasForeignKey(e => e.BankAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Volunteer>()
            .HasOne(v => v.Organization)
            .WithMany(o => o.Volunteers)
            .HasForeignKey(v => v.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Volunteer>()
            .HasOne(v => v.User)
            .WithMany(u => u.LinkedVolunteers)
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TaskVolunteer>()
            .HasOne(tv => tv.Task)
            .WithMany(t => t.TaskVolunteers)
            .HasForeignKey(tv => tv.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TaskVolunteer>()
            .HasOne(tv => tv.Volunteer)
            .WithMany(v => v.TaskVolunteers)
            .HasForeignKey(tv => tv.VolunteerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<VolunteerHour>()
            .HasOne(vh => vh.Volunteer)
            .WithMany(v => v.VolunteerHours)
            .HasForeignKey(vh => vh.VolunteerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<VolunteerHour>()
            .HasOne(vh => vh.Task)
            .WithMany(t => t.VolunteerHours)
            .HasForeignKey(vh => vh.TaskId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<VolunteerHour>()
            .HasOne(vh => vh.LoggedByUser)
            .WithMany()
            .HasForeignKey(vh => vh.LoggedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Risk & Issue and Logframe FKs ---
        
        modelBuilder.Entity<RiskIssue>()
            .HasOne(r => r.ResolvedByUser)
            .WithMany()
            .HasForeignKey(r => r.ResolvedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<RiskIssue>()
            .HasOne(r => r.Project)
            .WithMany()
            .HasForeignKey(r => r.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LogframeActivity>()
            .HasOne(a => a.LinkedTask)
            .WithMany()
            .HasForeignKey(a => a.LinkedTaskId)
            .OnDelete(DeleteBehavior.NoAction);

        // --- FinancialCategory and FinancialTransaction FKs ---
        modelBuilder.Entity<FinancialCategory>()
            .HasOne(fc => fc.Organization)
            .WithMany(o => o.FinancialCategories)
            .HasForeignKey(fc => fc.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FinancialCategory>()
            .HasOne(fc => fc.ParentCategory)
            .WithMany(fc => fc.SubCategories)
            .HasForeignKey(fc => fc.ParentCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Expense>()
            .HasOne(e => e.FinancialCategory)
            .WithMany(fc => fc.Expenses)
            .HasForeignKey(e => e.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<BudgetLineItem>()
            .HasOne(bli => bli.FinancialCategory)
            .WithMany(fc => fc.BudgetLineItems)
            .HasForeignKey(bli => bli.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DonorContribution>()
            .HasOne(dc => dc.FinancialCategory)
            .WithMany(fc => fc.DonorContributions)
            .HasForeignKey(dc => dc.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<FinancialTransaction>()
            .HasOne(ft => ft.Organization)
            .WithMany()
            .HasForeignKey(ft => ft.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FinancialTransaction>()
            .HasOne(ft => ft.Category)
            .WithMany()
            .HasForeignKey(ft => ft.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<FinancialTransaction>()
            .HasOne(ft => ft.BankAccount)
            .WithMany()
            .HasForeignKey(ft => ft.BankAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FinancialTransaction>()
            .HasOne(ft => ft.ToBankAccount)
            .WithMany()
            .HasForeignKey(ft => ft.ToBankAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        // ─── High-Performance Composite Indexing Strategy ────────────────────────────────
        modelBuilder.Entity<TaskItem>()
            .HasIndex(t => new { t.ProjectId, t.Status, t.IsDeleted })
            .HasDatabaseName("IX_Tasks_ProjectId_Status_IsDeleted");

        modelBuilder.Entity<TaskItem>()
            .HasIndex(t => t.ParentTaskId)
            .HasDatabaseName("IX_Tasks_ParentTaskId");

        modelBuilder.Entity<Project>()
            .HasIndex(p => new { p.WorkspaceId, p.Status, p.IsDeleted })
            .HasDatabaseName("IX_Projects_WorkspaceId_Status_IsDeleted");

        modelBuilder.Entity<Expense>()
            .HasIndex(e => new { e.ProjectId, e.CategoryId, e.ApprovalStatus })
            .HasDatabaseName("IX_Expenses_ProjectId_Category_ApprovalStatus");

        modelBuilder.Entity<Expense>()
            .HasIndex(e => e.BankAccountId)
            .HasDatabaseName("IX_Expenses_BankAccountId");

        modelBuilder.Entity<BudgetLineItem>()
            .HasIndex(b => new { b.BudgetId, b.CategoryId })
            .HasDatabaseName("IX_BudgetLineItems_BudgetId_CategoryId");

        modelBuilder.Entity<FinancialTransaction>()
            .HasIndex(ft => new { ft.BankAccountId, ft.TransactionDate })
            .HasDatabaseName("IX_FinancialTransactions_BankAccountId_Date");

        modelBuilder.Entity<FinancialTransaction>()
            .HasIndex(ft => new { ft.OrganizationId, ft.Type })
            .HasDatabaseName("IX_FinancialTransactions_OrgId_Type");

        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => new { a.Entity, a.Timestamp })
            .HasDatabaseName("IX_AuditLogs_Entity_Timestamp");

        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.PerformedByUserId)
            .HasDatabaseName("IX_AuditLogs_PerformedByUserId");


        modelBuilder.Entity<Notification>()
            .HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt })
            .HasDatabaseName("IX_Notifications_UserId_IsRead_CreatedAt");
    }
}

