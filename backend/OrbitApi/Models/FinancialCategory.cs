using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OrbitApi.Models;

public class FinancialCategory
{
    [Key]
    public int Id { get; set; }

    public int OrganizationId { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public string? Code { get; set; }

    public string? Description { get; set; }

    public FinancialCategoryType Type { get; set; } = FinancialCategoryType.Expense;

    public int? ParentCategoryId { get; set; }

    public string? Color { get; set; }

    public string? Icon { get; set; }

    public decimal? TargetBudgetLimit { get; set; }

    public bool IsSystem { get; set; }

    public bool IsActive { get; set; } = true;

    public string AccountType { get; set; } = "Expense"; // "Asset", "Liability", "Equity", "Revenue", "Expense"

    public int HierarchyLevel { get; set; } = 3; // Level 1 (Root/Type), Level 2 (Major), Level 3 (Sub), Level 4 (Item)

    public bool IsUSAIDAllowable { get; set; } = true;

    public decimal RequiresReceiptThreshold { get; set; } = 500m;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Organization? Organization { get; set; }

    public FinancialCategory? ParentCategory { get; set; }

    public ICollection<FinancialCategory> SubCategories { get; set; } = new List<FinancialCategory>();

    public ICollection<Expense> Expenses { get; set; } = new List<Expense>();

    public ICollection<BudgetLineItem> BudgetLineItems { get; set; } = new List<BudgetLineItem>();

    public ICollection<DonorContribution> DonorContributions { get; set; } = new List<DonorContribution>();
}
