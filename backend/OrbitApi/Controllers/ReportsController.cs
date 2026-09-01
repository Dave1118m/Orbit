using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing USAID activity-based costing matrices, grant reporting analytics,
    /// burn-rate computations, and multi-dimensional expenditure rollups.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly ICurrencyService _currencyService;

        public ReportsController(OrbitDbContext db, ICurrencyService currencyService)
        {
            _db = db;
            _currencyService = currencyService;
        }

        private int? GetActiveOrganizationId()
        {
            if (Request.Headers.TryGetValue("X-Organization-Id", out var orgIdStr) && int.TryParse(orgIdStr, out var orgId) && orgId > 0)
            {
                var validOrg = _db.Organizations.FirstOrDefault(o => o.Id == orgId && !o.IsDeleted);
                if (validOrg != null) return validOrg.Id;
            }

            if (Request.Query.TryGetValue("orgId", out var queryOrgStr) && int.TryParse(queryOrgStr, out var queryOrgId) && queryOrgId > 0)
            {
                var validOrg = _db.Organizations.FirstOrDefault(o => o.Id == queryOrgId && !o.IsDeleted);
                if (validOrg != null) return validOrg.Id;
            }

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                var userOrgId = _db.OrganizationMembers
                    .Where(om => om.UserId == userId && om.Status == OrgMemberStatus.Active)
                    .Select(om => om.OrganizationId)
                    .FirstOrDefault();
                if (userOrgId > 0 && _db.Organizations.Any(o => o.Id == userOrgId && !o.IsDeleted)) return userOrgId;

                var ownedOrgId = _db.Organizations
                    .Where(o => o.OwnerId == userId && !o.IsDeleted)
                    .Select(o => o.Id)
                    .FirstOrDefault();
                if (ownedOrgId > 0) return ownedOrgId;
            }

            return null;
        }

        /// <summary>
        /// GET /api/v1/reports/projects/{projectId}/usaid-activity-costing
        /// Generates the USAID 2-Dimensional Activity-Based Costing Matrix (Tasks x Chart of Accounts)
        /// </summary>
        [HttpGet("projects/{projectId}/usaid-activity-costing")]
        public async Task<IActionResult> GetUsaidActivityCostingReport(int projectId)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var project = await _db.Projects
                .Include(p => p.Workspace)
                .Include(p => p.Tasks.Where(t => !t.IsDeleted))
                .FirstOrDefaultAsync(p => p.Id == projectId && p.Workspace != null && p.Workspace.OrganizationId == orgId.Value);

            if (project == null) return NotFound("Project not found or not accessible.");

            // Fetch Chart of Accounts for this organization
            var categories = await _db.FinancialCategories
                .Where(fc => fc.OrganizationId == orgId.Value && fc.IsActive)
                .OrderBy(fc => fc.Code)
                .ThenBy(fc => fc.Name)
                .Select(fc => new
                {
                    fc.Id,
                    fc.Name,
                    fc.Code,
                    fc.IsUSAIDAllowable,
                    fc.AccountType
                })
                .ToListAsync();

            // Fetch all expenses logged under this project
            var expenses = await _db.Expenses
                .Include(e => e.FinancialCategory)
                .Where(e => e.ProjectId == projectId && e.ApprovalStatus != ApprovalStatus.Rejected)
                .ToListAsync();

            // Fetch project budget line items
            var projectBudget = await _db.Budgets
                .Include(b => b.LineItems)
                .FirstOrDefaultAsync(b => b.ProjectId == projectId && b.Level == BudgetLevel.Project);

            var tasksList = project.Tasks.Select(t => new
            {
                t.Id,
                t.Title,
                t.Status,
                t.Deadline
            }).ToList();

            var taskIds = tasksList.Select(t => t.Id).ToList();
            var taskBudgets = await _db.Budgets
                .Where(b => b.Level == BudgetLevel.Task && b.TaskId.HasValue && taskIds.Contains(b.TaskId.Value))
                .ToListAsync();

            // Build Matrix: TaskId -> CategoryId -> Sum of Amount
            var cellMatrix = new Dictionary<string, decimal>();
            foreach (var e in expenses)
            {
                var taskIdKey = e.TaskId?.ToString() ?? "unassigned";
                var catIdKey = e.CategoryId?.ToString() ?? "unassigned_cat";
                var cellKey = $"{taskIdKey}_{catIdKey}";

                if (!cellMatrix.ContainsKey(cellKey))
                    cellMatrix[cellKey] = 0m;
                cellMatrix[cellKey] += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
            }

            // Category Level Rollups (Budget vs Actual)
            var categoryRollups = new List<object>();
            foreach (var cat in categories)
            {
                var categoryExpenses = 0m;
                foreach (var e in expenses.Where(e => e.CategoryId == cat.Id))
                {
                    categoryExpenses += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
                }
                var categoryBudgetLine = projectBudget?.LineItems.FirstOrDefault(li => li.CategoryId == cat.Id)?.Amount ?? 0m;
                var remaining = categoryBudgetLine - categoryExpenses;
                var burnRate = categoryBudgetLine > 0 ? (categoryExpenses / categoryBudgetLine) * 100m : 0m;

                categoryRollups.Add(new
                {
                    cat.Id,
                    cat.Name,
                    cat.Code,
                    cat.IsUSAIDAllowable,
                    BudgetAmount = categoryBudgetLine,
                    IncurredSpent = categoryExpenses,
                    RemainingBalance = remaining,
                    BurnRatePercentage = Math.Round(burnRate, 1)
                });
            }

            // Task Level Rollups
            var taskRollups = new List<object>();
            foreach (var t in tasksList)
            {
                var taskExpenses = 0m;
                foreach (var e in expenses.Where(e => e.TaskId == t.Id))
                {
                    taskExpenses += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
                }
                var taskBudgetAmount = taskBudgets.FirstOrDefault(b => b.TaskId == t.Id)?.TotalAmount ?? 0m;
                var remaining = taskBudgetAmount - taskExpenses;
                var burnRate = taskBudgetAmount > 0 ? (taskExpenses / taskBudgetAmount) * 100m : 0m;

                taskRollups.Add(new
                {
                    t.Id,
                    t.Title,
                    t.Status,
                    BudgetAmount = taskBudgetAmount,
                    TotalIncurred = taskExpenses,
                    RemainingBalance = remaining,
                    BurnRatePercentage = Math.Round(burnRate, 1)
                });
            }

            var totalSpent = 0m;
            foreach (var e in expenses)
            {
                totalSpent += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
            }
            var totalBudget = projectBudget?.TotalAmount ?? 0m;

            return Ok(new
            {
                Project = new
                {
                    project.Id,
                    project.Title,
                    project.FundingType,
                    TotalBudget = totalBudget,
                    TotalSpent = totalSpent,
                    RemainingBudget = totalBudget - totalSpent,
                    BurnRatePercentage = totalBudget > 0 ? Math.Round((totalSpent / totalBudget) * 100m, 1) : 0m
                },
                Categories = categories,
                Tasks = tasksList,
                Matrix = cellMatrix,
                CategoryRollups = categoryRollups,
                TaskRollups = taskRollups
            });
        }
    }
}
