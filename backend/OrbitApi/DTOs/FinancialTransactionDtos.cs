using System.ComponentModel.DataAnnotations;
using OrbitApi.Models;

namespace OrbitApi.DTOs;

public class FinancialTransactionDto
{
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public FinancialTransactionType Type { get; set; }
    public DateTime TransactionDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public decimal ExchangeRate { get; set; }
    public decimal BaseCurrencyAmount { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string? CategoryColor { get; set; }
    public int? BankAccountId { get; set; }
    public string? BankAccountName { get; set; }
    public int? ToBankAccountId { get; set; }
    public string? ToBankAccountName { get; set; }
    public int? ProjectId { get; set; }
    public string? ProjectTitle { get; set; }
    public int? TaskId { get; set; }
    public int? ExpenseId { get; set; }
    public int? DonorContributionId { get; set; }
    public string? PayeeOrPayer { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceNumber { get; set; }
    public int CreatedByUserId { get; set; }
    public string? CreatedByUserName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateTransactionDto
{
    [Required(ErrorMessage = "Organization ID is required.")]
    public int OrganizationId { get; set; }

    public FinancialTransactionType Type { get; set; } = FinancialTransactionType.Expense;

    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    [Required(ErrorMessage = "Transaction amount is required.")]
    [Range(0.01, 1000000000000.00, ErrorMessage = "Transaction amount must be strictly greater than zero ($0.01 or more).")]
    public decimal Amount { get; set; }

    [Required(ErrorMessage = "Currency is required.")]
    [StringLength(10, MinimumLength = 3, ErrorMessage = "Currency code must be 3 characters.")]
    [RegularExpression(@"^[A-Za-z]{3}$", ErrorMessage = "Currency must be a valid 3-letter ISO code.")]
    public string Currency { get; set; } = "USD";

    [Range(0.000001, 1000000.0, ErrorMessage = "Exchange rate must be greater than zero.")]
    public decimal ExchangeRate { get; set; } = 1.0m;

    public int? CategoryId { get; set; }
    public int? BankAccountId { get; set; }
    public int? ProjectId { get; set; }
    public int? TaskId { get; set; }
    public int? ExpenseId { get; set; }
    public int? DonorContributionId { get; set; }

    [StringLength(250, ErrorMessage = "Payee/Payer name cannot exceed 250 characters.")]
    public string? PayeeOrPayer { get; set; }

    [Required(ErrorMessage = "Transaction description is required.")]
    [StringLength(500, MinimumLength = 2, ErrorMessage = "Description must be between 2 and 500 characters.")]
    public string Description { get; set; } = string.Empty;

    [StringLength(100, ErrorMessage = "Reference number cannot exceed 100 characters.")]
    public string? ReferenceNumber { get; set; }
}

public class FinancialBankTransferDto
{
    [Required(ErrorMessage = "Organization ID is required.")]
    public int OrganizationId { get; set; }

    [Required(ErrorMessage = "Source bank account is required.")]
    public int FromBankAccountId { get; set; }

    [Required(ErrorMessage = "Target bank account is required.")]
    public int ToBankAccountId { get; set; }

    [Required(ErrorMessage = "Transfer amount is required.")]
    [Range(0.01, 1000000000000.00, ErrorMessage = "Transfer amount must be strictly greater than zero ($0.01 or more).")]
    public decimal Amount { get; set; }

    [Required(ErrorMessage = "Currency is required.")]
    [StringLength(10, MinimumLength = 3, ErrorMessage = "Currency code must be 3 characters.")]
    [RegularExpression(@"^[A-Za-z]{3}$", ErrorMessage = "Currency must be a valid 3-letter ISO code.")]
    public string Currency { get; set; } = "USD";

    [Range(0.000001, 1000000.0, ErrorMessage = "Exchange rate must be greater than zero.")]
    public decimal ExchangeRate { get; set; } = 1.0m;

    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    [Required(ErrorMessage = "Transfer description is required.")]
    [StringLength(500, MinimumLength = 2, ErrorMessage = "Description must be between 2 and 500 characters.")]
    public string Description { get; set; } = "Inter-account bank transfer";

    [StringLength(100, ErrorMessage = "Reference number cannot exceed 100 characters.")]
    public string? ReferenceNumber { get; set; }
}

public class FinancialSummaryDto
{
    public decimal TotalIncome { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal NetCashFlow { get; set; }
    public int TotalTransactionsCount { get; set; }
    public List<BankAccountBalanceDto> BankAccounts { get; set; } = new List<BankAccountBalanceDto>();
}

public class BankAccountBalanceDto
{
    public int Id { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string Currency { get; set; } = "USD";
    public decimal CalculatedBalance { get; set; }
}

public class PagedResultDto<T>
{
    public List<T> Items { get; set; } = new List<T>();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
