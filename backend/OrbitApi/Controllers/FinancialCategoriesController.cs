using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers;

/// <summary>
/// Chart of Accounts (CoA) and Financial Categories Controller managing account classification structures,
/// hierarchical categories, USAID allowability flags, and target budget limits.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Route("api/[controller]")]
[Authorize]
public class FinancialCategoriesController : ControllerBase
{
    private readonly OrbitDbContext _context;
    private readonly ICurrencyService _currencyService;

    public FinancialCategoriesController(OrbitDbContext context, ICurrencyService currencyService)
    {
        _context = context;
        _currencyService = currencyService;
    }

    private int? GetActiveOrganizationId()
    {
        if (Request.Headers.TryGetValue("X-Organization-Id", out var orgIdStr) && int.TryParse(orgIdStr, out var orgId))
        {
            return orgId;
        }
        var firstOrg = _context.Organizations.FirstOrDefault(o => !o.IsDeleted);
        return firstOrg?.Id ?? 0;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        var orgId = GetActiveOrganizationId();
        if (!orgId.HasValue) return Ok(new List<FinancialCategoryDto>());
        return await GetByOrganization(orgId.Value, includeInactive);
    }

    [HttpGet("flat")]
    public async Task<IActionResult> GetFlatAll([FromQuery] FinancialCategoryType? type = null)
    {
        var orgId = GetActiveOrganizationId();
        if (!orgId.HasValue) return Ok(new List<object>());
        return await GetFlatByOrganization(orgId.Value, type);
    }

    /// <summary>
    /// Gets all financial categories for an organization, formatted hierarchically.
    /// Auto-seeds standard default categories if none exist for the organization.
    /// </summary>
    [HttpGet("organization/{orgId}")]
    public async Task<IActionResult> GetByOrganization(int orgId, [FromQuery] bool includeInactive = false)
    {
        var org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == orgId && !o.IsDeleted);
        if (org == null)
        {
            org = await _context.Organizations.FirstOrDefaultAsync(o => !o.IsDeleted);
            if (org == null)
                return Ok(new List<FinancialCategoryDto>());
            orgId = org.Id;
        }
        var existingCount = await _context.FinancialCategories.CountAsync(c => c.OrganizationId == orgId);
        var hasHierarchical = await _context.FinancialCategories.AnyAsync(c => c.OrganizationId == orgId && c.ParentCategoryId != null);
        
        if (existingCount == 0 || hasHierarchical)
        {
            await SeedStandardCoATemplate(orgId);
        }

        var query = _context.FinancialCategories
            .Where(c => c.OrganizationId == orgId);

        if (!includeInactive)
        {
            query = query.Where(c => c.IsActive);
        }

        var allCategories = await query
            .Include(c => c.Expenses)
            .Include(c => c.DonorContributions)
            .Include(c => c.SubCategories)
            .ToListAsync();

        var allTransactions = await _context.FinancialTransactions
            .Where(t => t.OrganizationId == orgId && t.CategoryId.HasValue)
            .ToListAsync();

        var parentCategories = allCategories
            .Where(c => c.ParentCategoryId == null)
            .OrderBy(c => c.Code ?? c.Name)
            .ToList();

        var dtos = new List<FinancialCategoryDto>();
        foreach (var p in parentCategories)
        {
            dtos.Add(await MapToDtoAsync(p, allCategories, allTransactions));
        }

        return Ok(dtos);
    }

    /// <summary>
    /// Gets a flat list of all active categories (including subcategories) for dropdown pickers.
    /// </summary>
    [HttpGet("organization/{orgId}/flat")]
    public async Task<IActionResult> GetFlatByOrganization(int orgId, [FromQuery] FinancialCategoryType? type = null)
    {
        var existingCount = await _context.FinancialCategories.CountAsync(c => c.OrganizationId == orgId);
        if (existingCount == 0)
        {
            await SeedStandardCoATemplate(orgId);
        }

        var query = _context.FinancialCategories
            .Where(c => c.OrganizationId == orgId && c.IsActive);

        if (type.HasValue)
        {
            query = query.Where(c => c.Type == type.Value || c.Type == FinancialCategoryType.Both);
        }

        var categories = await query
            .Include(c => c.ParentCategory)
            .OrderBy(c => c.ParentCategoryId.HasValue ? 1 : 0)
            .ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.OrganizationId,
                c.Name,
                c.Code,
                c.Type,
                c.ParentCategoryId,
                ParentCategoryName = c.ParentCategory != null ? c.ParentCategory.Name : null,
                FullName = c.ParentCategory != null ? $"{c.ParentCategory.Name} > {c.Name}" : c.Name,
                c.Color,
                c.Icon,
                c.TargetBudgetLimit,
                c.IsSystem
            })
            .ToListAsync();

        return Ok(categories);
    }

    /// <summary>
    /// Gets a single category by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var category = await _context.FinancialCategories
            .Include(c => c.ParentCategory)
            .Include(c => c.SubCategories)
            .Include(c => c.Expenses)
            .Include(c => c.DonorContributions)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(new { message = "Category not found" });

        var allCategories = await _context.FinancialCategories
            .Where(c => c.OrganizationId == category.OrganizationId)
            .ToListAsync();

        var dto = await MapToDtoAsync(category, allCategories);
        return Ok(dto);
    }

    /// <summary>
    /// Creates a new financial category or subcategory.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFinancialCategoryDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (dto.OrganizationId <= 0 || !await _context.Organizations.AnyAsync(o => o.Id == dto.OrganizationId && !o.IsDeleted))
        {
            var activeOrg = await _context.Organizations.FirstOrDefaultAsync(o => !o.IsDeleted);
            if (activeOrg == null)
                return BadRequest(new { message = "No active organization found." });
            dto.OrganizationId = activeOrg.Id;
        }

        var nameTrimmed = dto.Name.Trim();
        if (nameTrimmed.Length < 2)
            return BadRequest(new { message = "Category name must be at least 2 characters long." });
        if (nameTrimmed.Length > 100)
            return BadRequest(new { message = "Category name cannot exceed 100 characters." });

        var isNameDuplicate = await _context.FinancialCategories
            .AnyAsync(c => c.OrganizationId == dto.OrganizationId && c.Name.ToLower() == nameTrimmed.ToLower());
        if (isNameDuplicate)
            return BadRequest(new { message = $"A financial category named '{nameTrimmed}' already exists in this organization." });

        if (!string.IsNullOrWhiteSpace(dto.Code))
        {
            var codeTrimmed = dto.Code.Trim();
            var isCodeDuplicate = await _context.FinancialCategories
                .AnyAsync(c => c.OrganizationId == dto.OrganizationId && c.Code != null && c.Code.ToLower() == codeTrimmed.ToLower());
            if (isCodeDuplicate)
                return BadRequest(new { message = $"A financial category code '{codeTrimmed}' already exists in this organization." });
        }

        if (dto.ParentCategoryId.HasValue)
        {
            var parentExists = await _context.FinancialCategories
                .AnyAsync(c => c.Id == dto.ParentCategoryId.Value && c.OrganizationId == dto.OrganizationId);
            if (!parentExists)
                return BadRequest(new { message = "Parent category not found or belongs to another organization" });
        }

        var category = new FinancialCategory
        {
            OrganizationId = dto.OrganizationId,
            Name = nameTrimmed,
            Code = dto.Code?.Trim(),
            Description = dto.Description?.Trim(),
            Type = dto.Type,
            ParentCategoryId = dto.ParentCategoryId,
            Color = string.IsNullOrWhiteSpace(dto.Color) ? "#6366F1" : dto.Color,
            Icon = string.IsNullOrWhiteSpace(dto.Icon) ? "Folder" : dto.Icon,
            TargetBudgetLimit = dto.TargetBudgetLimit < 0 ? 0 : dto.TargetBudgetLimit,
            IsSystem = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.FinancialCategories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, await MapToDtoAsync(category, new List<FinancialCategory>()));
    }

    /// <summary>
    /// Updates an existing financial category.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateFinancialCategoryDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var category = await _context.FinancialCategories.FindAsync(id);
        if (category == null)
            return NotFound(new { message = "Category not found" });

        var nameTrimmed = dto.Name.Trim();
        if (nameTrimmed.Length < 2)
            return BadRequest(new { message = "Category name must be at least 2 characters long." });
        if (nameTrimmed.Length > 100)
            return BadRequest(new { message = "Category name cannot exceed 100 characters." });

        var isNameDuplicate = await _context.FinancialCategories
            .AnyAsync(c => c.OrganizationId == category.OrganizationId && c.Id != id && c.Name.ToLower() == nameTrimmed.ToLower());
        if (isNameDuplicate)
            return BadRequest(new { message = $"Another financial category named '{nameTrimmed}' already exists in this organization." });

        if (!string.IsNullOrWhiteSpace(dto.Code))
        {
            var codeTrimmed = dto.Code.Trim();
            var isCodeDuplicate = await _context.FinancialCategories
                .AnyAsync(c => c.OrganizationId == category.OrganizationId && c.Id != id && c.Code != null && c.Code.ToLower() == codeTrimmed.ToLower());
            if (isCodeDuplicate)
                return BadRequest(new { message = $"Another financial category code '{codeTrimmed}' already exists in this organization." });
        }

        if (dto.ParentCategoryId.HasValue && dto.ParentCategoryId.Value != category.ParentCategoryId)
        {
            if (dto.ParentCategoryId.Value == id)
                return BadRequest(new { message = "Category cannot be its own parent" });

            var parentExists = await _context.FinancialCategories
                .AnyAsync(c => c.Id == dto.ParentCategoryId.Value && c.OrganizationId == category.OrganizationId);
            if (!parentExists)
                return BadRequest(new { message = "Parent category not found" });
        }

        category.Name = nameTrimmed;
        category.Code = dto.Code?.Trim();
        category.Description = dto.Description?.Trim();
        category.Type = dto.Type;
        category.ParentCategoryId = dto.ParentCategoryId;
        category.Color = string.IsNullOrWhiteSpace(dto.Color) ? category.Color : dto.Color;
        category.Icon = string.IsNullOrWhiteSpace(dto.Icon) ? category.Icon : dto.Icon;
        category.TargetBudgetLimit = dto.TargetBudgetLimit < 0 ? 0 : dto.TargetBudgetLimit;
        category.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();

        return Ok(await MapToDtoAsync(category, new List<FinancialCategory>()));
    }

    /// <summary>
    /// Deletes or deactivates a category.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _context.FinancialCategories
            .Include(c => c.SubCategories)
            .Include(c => c.Expenses)
            .Include(c => c.BudgetLineItems)
            .Include(c => c.DonorContributions)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category == null)
            return NotFound(new { message = "Category not found" });

        bool inUse = category.Expenses.Any() || category.BudgetLineItems.Any() || category.DonorContributions.Any() || category.SubCategories.Any();

        if (category.IsSystem || inUse)
        {
            category.IsActive = false;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Category is in use or system category; deactivated successfully instead of deletion." });
        }

        _context.FinancialCategories.Remove(category);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Category deleted successfully" });
    }

    /// <summary>
    /// Explicit endpoint to seed default financial categories for an organization.
    /// </summary>
    [HttpPost("organization/{orgId}/seed")]
    public async Task<IActionResult> SeedCategories(int orgId)
    {
        var seeded = await SeedDefaultCategoriesAsync(orgId);
        return Ok(new { message = $"Seeded {seeded.Count} default financial categories", categories = seeded });
    }

    private async Task<List<FinancialCategory>> SeedDefaultCategoriesAsync(int orgId)
    {
        var defaults = new List<(string Name, string Code, FinancialCategoryType Type, string Color, string Icon, List<(string Name, string Code)> Subcats)>
        {
            ("Operations & Administration", "1000", FinancialCategoryType.Expense, "#4F46E5", "Briefcase", new List<(string, string)>
            {
                ("Office Supplies & Stationery", "1010"),
                ("Utilities & Rent", "1020"),
                ("Communication & Internet", "1030"),
                ("Software & IT Licenses", "1040")
            }),
            ("Personnel & Payroll", "2000", FinancialCategoryType.Expense, "#059669", "Users", new List<(string, string)>
            {
                ("Salaries & Wages", "2010"),
                ("Staff Benefits & Insurance", "2020"),
                ("Consultants & Contractors", "2030")
            }),
            ("Travel & Logistics", "3000", FinancialCategoryType.Expense, "#D97706", "Truck", new List<(string, string)>
            {
                ("Local Transport & Fuel", "3010"),
                ("Flight & Accommodations", "3020"),
                ("Per Diem & Meals", "3030")
            }),
            ("Equipment & Assets", "4000", FinancialCategoryType.Expense, "#DC2626", "Monitor", new List<(string, string)>
            {
                ("IT & Hardware Procurement", "4010"),
                ("Office Furniture", "4020"),
                ("Maintenance & Repairs", "4030")
            }),
            ("Program & Training", "5000", FinancialCategoryType.Expense, "#9333EA", "BookOpen", new List<(string, string)>
            {
                ("Workshops & Seminars", "5010"),
                ("Training Materials", "5020"),
                ("Community Outreach", "5030")
            }),
            ("Grants & Donor Funding", "6000", FinancialCategoryType.Income, "#16A34A", "Gift", new List<(string, string)>
            {
                ("Institutional Grants", "6010"),
                ("Individual Donations", "6020"),
                ("Corporate Sponsorships", "6030")
            }),
            ("Other / Miscellaneous", "9000", FinancialCategoryType.Both, "#64748B", "Folder", new List<(string, string)>())
        };

        var createdList = new List<FinancialCategory>();

        foreach (var def in defaults)
        {
            var parent = new FinancialCategory
            {
                OrganizationId = orgId,
                Name = def.Name,
                Code = def.Code,
                Type = def.Type,
                Color = def.Color,
                Icon = def.Icon,
                IsSystem = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.FinancialCategories.Add(parent);
            await _context.SaveChangesAsync();
            createdList.Add(parent);

            foreach (var sub in def.Subcats)
            {
                var subcat = new FinancialCategory
                {
                    OrganizationId = orgId,
                    ParentCategoryId = parent.Id,
                    Name = sub.Name,
                    Code = sub.Code,
                    Type = def.Type,
                    Color = def.Color,
                    Icon = def.Icon,
                    IsSystem = true,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.FinancialCategories.Add(subcat);
                createdList.Add(subcat);
            }
        }

        await _context.SaveChangesAsync();
        return createdList;
    }

    private async Task<FinancialCategoryDto> MapToDtoAsync(FinancialCategory category, List<FinancialCategory> allCategories, List<FinancialTransaction>? allTransactions = null)
    {
        var subcats = new List<FinancialCategoryDto>();
        foreach (var s in allCategories.Where(c => c.ParentCategoryId == category.Id).OrderBy(c => c.Name))
        {
            subcats.Add(await MapToDtoAsync(s, allCategories, allTransactions));
        }

        // Avoid double counting: When an expense is Paid, it generates a transaction. 
        // Adding them together doubles the amount. Instead, we take the highest value 
        // (or just rely on the entities as the primary source of incurred costs).
        var expFromEntities = 0m;
        if (category.Expenses != null)
        {
            foreach (var e in category.Expenses.Where(e => e.ApprovalStatus != ApprovalStatus.Rejected))
            {
                expFromEntities += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
            }
        }
        
        var expFromTxns = 0m;
        if (allTransactions != null)
        {
            foreach (var t in allTransactions.Where(t => t.CategoryId == category.Id && t.Type == FinancialTransactionType.Expense))
            {
                expFromTxns += await _currencyService.ConvertAsync(t.Amount, t.Currency, "USD");
            }
        }

        var incFromEntities = 0m;
        if (category.DonorContributions != null)
        {
            foreach (var d in category.DonorContributions)
            {
                incFromEntities += await _currencyService.ConvertAsync(d.Amount, d.Currency, "USD");
            }
        }

        var incFromTxns = 0m;
        if (allTransactions != null)
        {
            foreach (var t in allTransactions.Where(t => t.CategoryId == category.Id && t.Type == FinancialTransactionType.Income))
            {
                incFromTxns += await _currencyService.ConvertAsync(t.Amount, t.Currency, "USD");
            }
        }

        var finalExpenses = Math.Max(expFromEntities, expFromTxns);
        var finalIncome = Math.Max(incFromEntities, incFromTxns);

        return new FinancialCategoryDto
        {
            Id = category.Id,
            OrganizationId = category.OrganizationId,
            Name = category.Name,
            Code = category.Code,
            Description = category.Description,
            Type = category.Type,
            ParentCategoryId = category.ParentCategoryId,
            ParentCategoryName = category.ParentCategory?.Name,
            Color = category.Color,
            Icon = category.Icon,
            TargetBudgetLimit = category.TargetBudgetLimit,
            IsSystem = category.IsSystem,
            IsActive = category.IsActive,
            CreatedAt = category.CreatedAt,
            SubCategoriesCount = subcats.Count,
            TotalExpensesAmount = finalExpenses,
            TotalIncomeAmount = finalIncome,
            SubCategories = subcats
        };
    }

    /// <summary>
    /// POST /api/v1/FinancialCategories/organization/{orgId}/seed-standard-coa
    /// Manually populates/resets the Standard 4-Level NGO Chart of Accounts for an organization.
    /// </summary>
    [HttpPost("organization/{orgId}/seed-standard-coa")]
    public async Task<IActionResult> SeedStandardCoA(int orgId)
    {
        var org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == orgId && !o.IsDeleted);
        if (org == null) return NotFound("Organization not found.");

        await SeedStandardCoATemplate(orgId);
        return Ok(new { message = "Standard 4-Level NGO Chart of Accounts initialized successfully." });
    }

    private async Task SeedStandardCoATemplate(int orgId)
    {
        var existing = await _context.FinancialCategories.Where(c => c.OrganizationId == orgId).ToListAsync();
        foreach (var c in existing) c.ParentCategoryId = null;
        await _context.SaveChangesAsync();
        _context.FinancialCategories.RemoveRange(existing);
        await _context.SaveChangesAsync();

        var catPersonnel = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Personnel", Code = "5100", Description = "All staff salaries", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#4F46E5", IsSystem = true };
        var catFringe = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Fringe Benefits", Code = "5150", Description = "Insurance, taxes, pensions", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#4338CA", IsSystem = true };
        var catTravel = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Travel", Code = "5200", Description = "Flights, hotels, per diem", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#2563EB", IsSystem = true };
        var catEquipment = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Equipment", Code = "5300", Description = "High-value assets", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#0891B2", IsSystem = true };
        var catSupplies = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Supplies", Code = "5400", Description = "Office and project materials", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#0D9488", IsSystem = true };
        var catContractual = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Contractual", Code = "5500", Description = "Consultants and sub-awards", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#059669", IsSystem = true };
        var catOther = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Other Direct Costs", Code = "5600", Description = "Rent, utilities, comms", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#EA580C", IsSystem = true };
        var catIndirect = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Indirect Costs", Code = "5700", Description = "Overhead/NICRA", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = true, Color = "#7C3AED", IsSystem = true };
        var catUnallowable = new FinancialCategory { OrganizationId = orgId, ParentCategoryId = null, Name = "Unallowable Costs", Code = "5900", Description = "Alcohol, fines, entertainment", Type = FinancialCategoryType.Expense, AccountType = "Expense", HierarchyLevel = 1, IsUSAIDAllowable = false, Color = "#991B1B", IsSystem = true };

        _context.FinancialCategories.AddRange(catPersonnel, catFringe, catTravel, catEquipment, catSupplies, catContractual, catOther, catIndirect, catUnallowable);
        await _context.SaveChangesAsync();
    }
}
