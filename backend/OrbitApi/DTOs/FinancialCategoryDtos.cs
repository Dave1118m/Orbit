using System.ComponentModel.DataAnnotations;
using OrbitApi.Models;

namespace OrbitApi.DTOs;

public class FinancialCategoryDto
{
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public FinancialCategoryType Type { get; set; }
    public int? ParentCategoryId { get; set; }
    public string? ParentCategoryName { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }
    public decimal? TargetBudgetLimit { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int SubCategoriesCount { get; set; }
    public decimal TotalExpensesAmount { get; set; }
    public decimal TotalIncomeAmount { get; set; }
    public List<FinancialCategoryDto> SubCategories { get; set; } = new List<FinancialCategoryDto>();
}

public class CreateFinancialCategoryDto
{
    [Required(ErrorMessage = "Organization ID is required.")]
    public int OrganizationId { get; set; }

    [Required(ErrorMessage = "Category name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Category name must be between 2 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(30, ErrorMessage = "Category code cannot exceed 30 characters.")]
    public string? Code { get; set; }

    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters.")]
    public string? Description { get; set; }

    public FinancialCategoryType Type { get; set; } = FinancialCategoryType.Expense;
    public int? ParentCategoryId { get; set; }

    [StringLength(30, ErrorMessage = "Color string cannot exceed 30 characters.")]
    public string? Color { get; set; }

    [StringLength(50, ErrorMessage = "Icon string cannot exceed 50 characters.")]
    public string? Icon { get; set; }

    [Range(0, 1000000000000.00, ErrorMessage = "Target budget limit cannot be negative.")]
    public decimal? TargetBudgetLimit { get; set; }
}

public class UpdateFinancialCategoryDto
{
    [Required(ErrorMessage = "Category name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Category name must be between 2 and 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [StringLength(30, ErrorMessage = "Category code cannot exceed 30 characters.")]
    public string? Code { get; set; }

    [StringLength(500, ErrorMessage = "Description cannot exceed 500 characters.")]
    public string? Description { get; set; }

    public FinancialCategoryType Type { get; set; } = FinancialCategoryType.Expense;
    public int? ParentCategoryId { get; set; }

    [StringLength(30, ErrorMessage = "Color string cannot exceed 30 characters.")]
    public string? Color { get; set; }

    [StringLength(50, ErrorMessage = "Icon string cannot exceed 50 characters.")]
    public string? Icon { get; set; }

    [Range(0, 1000000000000.00, ErrorMessage = "Target budget limit cannot be negative.")]
    public decimal? TargetBudgetLimit { get; set; }

    public bool IsActive { get; set; } = true;
}
