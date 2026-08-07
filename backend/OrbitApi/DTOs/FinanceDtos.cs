using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using OrbitApi.Models;

namespace OrbitApi.DTOs
{
    public class DonorDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DonorType DonorType { get; set; }
        public string? PrimaryContact { get; set; }
        public string? EmailAddress { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Country { get; set; }
        
        public decimal TotalPledged { get; set; }
        public decimal TotalReceived { get; set; }
        public int ActiveGrantsCount { get; set; }

        public List<ProjectDonorDto> LinkedProjects { get; set; } = new();
    }

    public class ProjectDonorDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public int DonorId { get; set; }
        public string DonorName { get; set; } = string.Empty;
        public decimal AllocatedAmount { get; set; }
        public decimal CoFundingPercentage { get; set; } = 100m;
    }

    public class DonorCreateDto
    {
        [Required(ErrorMessage = "Donor name is required.")]
        [StringLength(200, MinimumLength = 2, ErrorMessage = "Donor name must be between 2 and 200 characters.")]
        public string Name { get; set; } = string.Empty;

        public DonorType DonorType { get; set; }

        [StringLength(150, ErrorMessage = "Primary contact cannot exceed 150 characters.")]
        public string? PrimaryContact { get; set; }

        [StringLength(150, ErrorMessage = "Email cannot exceed 150 characters.")]
        public string? EmailAddress { get; set; }

        [StringLength(50, ErrorMessage = "Phone number cannot exceed 50 characters.")]
        public string? PhoneNumber { get; set; }

        [StringLength(100, ErrorMessage = "Country name cannot exceed 100 characters.")]
        public string? Country { get; set; }
    }

    public class BankAccountDto
    {
        public int Id { get; set; }
        public int OrganizationId { get; set; }
        public string BankName { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string AccountNumber { get; set; } = string.Empty;
        public string SwiftCode { get; set; } = string.Empty;
        public string Currency { get; set; } = "USD";
        public bool IsActive { get; set; }

        // Real balance = TotalReceived - TotalExpended
        public decimal CurrentBalance { get; set; }
        public decimal TotalReceived { get; set; }
        public decimal TotalExpended { get; set; }
    }

    public class BankAccountUpdateDto
    {
        [Required(ErrorMessage = "Bank name is required.")]
        [StringLength(150, MinimumLength = 2, ErrorMessage = "Bank name must be between 2 and 150 characters.")]
        public string BankName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account name is required.")]
        [StringLength(150, MinimumLength = 2, ErrorMessage = "Account name must be between 2 and 150 characters.")]
        public string AccountName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account number is required.")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Account number must be between 3 and 50 characters.")]
        public string AccountNumber { get; set; } = string.Empty;

        [StringLength(20, ErrorMessage = "SWIFT/BIC code cannot exceed 20 characters.")]
        public string SwiftCode { get; set; } = string.Empty;

        [Required(ErrorMessage = "Currency is required.")]
        [StringLength(10, MinimumLength = 3, ErrorMessage = "Currency code must be 3 characters.")]
        [RegularExpression(@"^[A-Za-z]{3}$", ErrorMessage = "Currency must be a valid 3-letter ISO code.")]
        public string Currency { get; set; } = "USD";

        public bool IsActive { get; set; }
    }

    public class BankAccountTransactionDto
    {
        public string Type { get; set; } = string.Empty; // "Deposit" or "Withdrawal"
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime Date { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? DonorName { get; set; }
        public string? ProjectName { get; set; }
        public string? ExpenseCategory { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class BankAccountCreateDto
    {
        [Required(ErrorMessage = "Bank name is required.")]
        [StringLength(150, MinimumLength = 2, ErrorMessage = "Bank name must be between 2 and 150 characters.")]
        public string BankName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account name is required.")]
        [StringLength(150, MinimumLength = 2, ErrorMessage = "Account name must be between 2 and 150 characters.")]
        public string AccountName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Account number is required.")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Account number must be between 3 and 50 characters.")]
        public string AccountNumber { get; set; } = string.Empty;

        [StringLength(20, ErrorMessage = "SWIFT/BIC code cannot exceed 20 characters.")]
        public string SwiftCode { get; set; } = string.Empty;

        [Required(ErrorMessage = "Currency is required.")]
        [StringLength(10, MinimumLength = 3, ErrorMessage = "Currency code must be 3 characters.")]
        [RegularExpression(@"^[A-Za-z]{3}$", ErrorMessage = "Currency must be a valid 3-letter ISO code.")]
        public string Currency { get; set; } = "USD";
    }
    public class BudgetDto
    {
        public int Id { get; set; }
        public BudgetLevel Level { get; set; }
        public string EntityName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public decimal AllocatedAmount { get; set; } // Sum of line items
        public decimal SpentAmount { get; set; }     // Sum of non-rejected expenses
        public string Currency { get; set; } = "USD";
        public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
        public BudgetStatus Status { get; set; }

        public int? OrganizationId { get; set; }
        public int? WorkspaceId { get; set; }
        public int? ProjectId { get; set; }
        public int? TaskId { get; set; }

        public List<BudgetLineItemDto> LineItems { get; set; } = new();
    }

    public class BudgetReviseDto
    {
        public decimal TotalAmount { get; set; }
        public string? Currency { get; set; }
        public string? Notes { get; set; }
    }

    public class BudgetCreateDto
    {
        public BudgetLevel Level { get; set; }
        public int? OrganizationId { get; set; }
        public int? WorkspaceId { get; set; }
        public int? ProjectId { get; set; }
        public int? TaskId { get; set; }
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; } = "USD";
        public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    }

    public class BudgetLineItemDto
    {
        public int Id { get; set; }
        public int BudgetId { get; set; }
        public BudgetCategory Category { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public class BudgetLineItemCreateDto
    {
        public BudgetCategory Category { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public class BudgetRevisionLogDto
    {
        public int Id { get; set; }
        public decimal PreviousAmount { get; set; }
        public decimal NewAmount { get; set; }
        public int ApprovedByUserId { get; set; }
        public string ApprovedByUserName { get; set; } = string.Empty;
        public DateTime DateApproved { get; set; }
        public string Notes { get; set; } = string.Empty;
        public int VersionNo { get; set; }
    }

    public class ExpenseDto
    {
        public int Id { get; set; }
        public int? ProjectId { get; set; }
        public string? ProjectName { get; set; }
        public int? TaskId { get; set; }
        public string? TaskName { get; set; }
        public int SubmittedByUserId { get; set; }
        public string SubmittedByUserName { get; set; } = string.Empty;
        public ExpenseCategory Category { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "ETB";
        public DateTime Date { get; set; }
        public string Description { get; set; } = string.Empty;
        public ApprovalStatus ApprovalStatus { get; set; }
        public int? ApprovedByFinanceOfficerId { get; set; }
        public string? FinanceOfficerName { get; set; }
        public DateTime? FinanceReviewedAt { get; set; }
        public int? SignedOffByManagerId { get; set; }
        public string? ManagerName { get; set; }
        public DateTime? ManagerSignedOffAt { get; set; }

        public int? PaidByUserId { get; set; }
        public string? PaidUserName { get; set; }
        public DateTime? PaidAt { get; set; }

        public string? RejectionReason { get; set; }
        public int? AttachmentId { get; set; }
        public string? AttachmentFileName { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool BudgetWarning { get; set; } // True if expense pushes project over budget
    }

    public class ExpenseCreateDto
    {
        public int? ProjectId { get; set; }
        public int? TaskId { get; set; }
        public int? BankAccountId { get; set; }

        public ExpenseCategory Category { get; set; }

        [Required(ErrorMessage = "Expense amount is required.")]
        [Range(0.01, 1000000000000.00, ErrorMessage = "Expense amount must be strictly greater than zero ($0.01 or more).")]
        public decimal Amount { get; set; }

        [Required(ErrorMessage = "Currency is required.")]
        [StringLength(10, MinimumLength = 3, ErrorMessage = "Currency code must be 3 characters.")]
        [RegularExpression(@"^[A-Za-z]{3}$", ErrorMessage = "Currency must be a valid 3-letter ISO code.")]
        public string Currency { get; set; } = "ETB";

        public DateTime Date { get; set; }

        [Required(ErrorMessage = "Expense description is required.")]
        [StringLength(500, MinimumLength = 2, ErrorMessage = "Description must be between 2 and 500 characters.")]
        public string Description { get; set; } = string.Empty;
    }

    public class ExpenseAttachReceiptDto
    {
        public int AttachmentId { get; set; }
    }

    public class GrantReportScheduleDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string ProjectName { get; set; } = string.Empty;
        public int? DonorId { get; set; }
        public string? DonorName { get; set; }
        public ReportType ReportType { get; set; }
        public DateTime DeadlineDate { get; set; }
        public ReportStatus Status { get; set; }
        public DateTime? SubmittedDate { get; set; }
    }

    public class CreateGrantReportScheduleRequest
    {
        public int ProjectId { get; set; }
        public int? DonorId { get; set; }
        public ReportType ReportType { get; set; } = ReportType.Financial;
        public DateTime DeadlineDate { get; set; }
    }

    public class AuditLogDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        public DateTime Timestamp { get; set; }
        public string Details { get; set; } = string.Empty;
    }

    public class DonorContributionDto
    {
        public int Id { get; set; }
        public int DonorId { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime Date { get; set; }
        public ContributionType Type { get; set; }
        public ContributionStatus Status { get; set; }
        public int? AllocatedProjectId { get; set; }
        public string? AllocatedProjectName { get; set; }
        public int? AllocatedTaskId { get; set; }
        public string? AllocatedTaskName { get; set; }
        public int? BankAccountId { get; set; }
        public string? BankAccountName { get; set; }
        public string? Notes { get; set; }
    }

    public class DonorContributionCreateDto
    {
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime Date { get; set; }
        public ContributionType Type { get; set; }
        public ContributionStatus Status { get; set; }
        public int? AllocatedProjectId { get; set; }
        public int? AllocatedTaskId { get; set; }
        public int? BankAccountId { get; set; }
        public string? Notes { get; set; }
    }

    public class LinkProjectDto
    {
        public int ProjectId { get; set; }
        public decimal AllocatedAmount { get; set; }
    }

    public class DonorCommunicationDto
    {
        public int Id { get; set; }
        public int DonorId { get; set; }
        public DateTime Date { get; set; }
        public string Method { get; set; } = "Email";
        public string Notes { get; set; } = string.Empty;
        public int LoggedByUserId { get; set; }
        public string LoggedByUserName { get; set; } = string.Empty;
    }

    public class DonorCommunicationCreateDto
    {
        public DateTime Date { get; set; } = DateTime.UtcNow;
        public string Method { get; set; } = "Email";
        public string Notes { get; set; } = string.Empty;
    }
}
