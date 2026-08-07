using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrbitApi.Models;

public enum FinancialTransactionType
{
    Expense,
    Income,
    Transfer,
    Adjustment
}

public class FinancialTransaction
{
    [Key]
    public int Id { get; set; }

    public int OrganizationId { get; set; }

    public string TransactionNumber { get; set; } = string.Empty;

    public FinancialTransactionType Type { get; set; } = FinancialTransactionType.Expense;

    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = "USD";

    public decimal ExchangeRate { get; set; } = 1.0m;

    public decimal BaseCurrencyAmount { get; set; }

    public int? CategoryId { get; set; }

    public int? BankAccountId { get; set; }

    public int? ToBankAccountId { get; set; }

    [Timestamp]
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public int? ProjectId { get; set; }

    public int? TaskId { get; set; }

    public int? ExpenseId { get; set; }

    public int? DonorContributionId { get; set; }

    public string? PayeeOrPayer { get; set; }

    public string Description { get; set; } = string.Empty;

    public string? ReferenceNumber { get; set; }

    public int CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Organization? Organization { get; set; }
    public FinancialCategory? Category { get; set; }
    public BankAccount? BankAccount { get; set; }
    public BankAccount? ToBankAccount { get; set; }
    public Project? Project { get; set; }
    public TaskItem? Task { get; set; }
    public Expense? Expense { get; set; }
    public DonorContribution? DonorContribution { get; set; }
    public User? CreatedByUser { get; set; }
}
