using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class BudgetsController : ControllerBase
    {
        private readonly OrbitDbContext _db;

        public BudgetsController(OrbitDbContext db)
        {
            _db = db;
        }

        private int? GetActiveOrganizationId()
        {
            if (Request.Headers.TryGetValue("X-Organization-Id", out var orgIdStr) && int.TryParse(orgIdStr, out var orgId) && orgId > 0)
            {
                var validOrg = _db.Organizations.FirstOrDefault(o => o.Id == orgId && !o.IsDeleted);
                if (validOrg != null) return validOrg.Id;
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                var userOrgId = _db.OrganizationMembers
                    .Where(om => om.UserId == userId && om.Status == OrgMemberStatus.Active)
                    .Select(om => om.OrganizationId)
                    .FirstOrDefault();
                if (userOrgId > 0 && _db.Organizations.Any(o => o.Id == userOrgId && !o.IsDeleted)) return userOrgId;
            }

            var firstOrg = _db.Organizations.FirstOrDefault(o => !o.IsDeleted);
            return firstOrg?.Id;
        }

        private int? GetCurrentUserId()
        {
            var val = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(val, out var id) ? id : null;
        }

        private static BudgetDto MapToDto(Budget b, decimal spentAmount = 0)
        {
            return new BudgetDto
            {
                Id = b.Id,
                Level = b.Level,
                EntityName = GetEntityName(b),
                TotalAmount = b.TotalAmount,
                AllocatedAmount = b.LineItems?.Sum(l => l.Amount) ?? 0,
                SpentAmount = spentAmount,
                Currency = b.Currency,
                FiscalYear = b.FiscalYear > 0 ? b.FiscalYear : DateTime.UtcNow.Year,
                Status = b.Status,
                OrganizationId = b.OrganizationId,
                WorkspaceId = b.WorkspaceId,
                ProjectId = b.ProjectId,
                TaskId = b.TaskId,
                LineItems = b.LineItems?.Select(l => new BudgetLineItemDto
                {
                    Id = l.Id,
                    BudgetId = l.BudgetId,
                    Category = l.Category,
                    Description = l.Description,
                    Amount = l.Amount
                }).ToList() ?? new List<BudgetLineItemDto>()
            };
        }

        private static string GetEntityName(Budget b)
        {
            if (b.Organization != null) return b.Organization.Name;
            if (b.Project != null) return b.Project.Title;
            if (b.Workspace != null) return b.Workspace.Name;
            if (b.Task != null) return b.Task.Title;
            return "Unknown";
        }

        private IQueryable<Budget> BudgetsWithIncludes(int orgId) =>
            _db.Budgets
                .Where(b => b.OrganizationId == orgId)
                .Include(b => b.LineItems)
                .Include(b => b.Organization)
                .Include(b => b.Project)
                .Include(b => b.Workspace)
                .Include(b => b.Task);

        private async Task<decimal> GetSpentAsync(Budget b)
        {
            if (b.ProjectId.HasValue)
            {
                return await _db.Expenses
                    .Where(e => e.ProjectId == b.ProjectId.Value && e.ApprovalStatus != ApprovalStatus.Rejected)
                    .SumAsync(e => e.Amount);
            }
            else if (b.WorkspaceId.HasValue)
            {
                return await _db.Expenses
                    .Where(e => e.Project != null && e.Project.WorkspaceId == b.WorkspaceId.Value && e.ApprovalStatus != ApprovalStatus.Rejected)
                    .SumAsync(e => e.Amount);
            }
            else if (b.TaskId.HasValue)
            {
                return await _db.Expenses
                    .Where(e => e.TaskId == b.TaskId.Value && e.ApprovalStatus != ApprovalStatus.Rejected)
                    .SumAsync(e => e.Amount);
            }
            else if (b.Level == BudgetLevel.Organization || (b.OrganizationId.HasValue && b.OrganizationId.Value > 0))
            {
                var orgId = b.OrganizationId ?? 0;
                return await _db.Expenses
                    .Where(e => ((e.Project != null && e.Project.Workspace != null && e.Project.Workspace.OrganizationId == orgId) ||
                                (e.BankAccount != null && e.BankAccount.OrganizationId == orgId)) &&
                                e.ApprovalStatus != ApprovalStatus.Rejected)
                    .SumAsync(e => e.Amount);
            }
            return 0;
        }

        private async Task EnsureFiscalYearColumnExistsAsync()
        {
            try
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Budgets' AND COLUMN_NAME = 'FiscalYear') " +
                    "ALTER TABLE Budgets ADD FiscalYear INT NOT NULL DEFAULT 2026;");
            }
            catch { }
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<BudgetDto>>> GetBudgets()
        {
            await EnsureFiscalYearColumnExistsAsync();
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var budgets = await BudgetsWithIncludes(orgId.Value).ToListAsync();
            var dtos = new List<BudgetDto>();
            foreach (var b in budgets)
                dtos.Add(MapToDto(b, await GetSpentAsync(b)));
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<BudgetDto>> GetBudget(int id)
        {
            await EnsureFiscalYearColumnExistsAsync();
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var budget = await BudgetsWithIncludes(orgId.Value).FirstOrDefaultAsync(b => b.Id == id);
            if (budget == null) return NotFound();
            return Ok(MapToDto(budget, await GetSpentAsync(budget)));
        }

        [HttpPost]
        public async Task<ActionResult<BudgetDto>> CreateBudget(BudgetCreateDto dto)
        {
            await EnsureFiscalYearColumnExistsAsync();
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest(new { message = "Organization context is required." });

            if (dto.TotalAmount <= 0)
                return BadRequest(new { message = "Budget total amount must be strictly greater than zero." });

            var budget = new Budget
            {
                Level = dto.Level,
                OrganizationId = orgId.Value,
                WorkspaceId = dto.WorkspaceId,
                ProjectId = dto.ProjectId,
                TaskId = dto.TaskId,
                TotalAmount = dto.TotalAmount,
                Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "USD" : dto.Currency.Trim().ToUpper(),
                FiscalYear = dto.FiscalYear > 0 ? dto.FiscalYear : DateTime.UtcNow.Year,
                Status = BudgetStatus.Draft
            };

            _db.Budgets.Add(budget);
            await _db.SaveChangesAsync();

            var created = await BudgetsWithIncludes(orgId.Value).FirstAsync(b => b.Id == budget.Id);
            return CreatedAtAction(nameof(GetBudget), new { id = budget.Id }, MapToDto(created));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> ReviseBudget(int id, [FromBody] BudgetReviseDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest(new { message = "Organization context is required." });
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            if (dto.TotalAmount <= 0)
                return BadRequest(new { message = "Revised budget total amount must be strictly greater than zero." });

            var budget = await _db.Budgets
                .Include(b => b.Revisions)
                .Where(b => b.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (budget == null) return NotFound(new { message = "Budget entity not found." });

            var previousAmount = budget.TotalAmount;

            var revision = new BudgetRevisionLog
            {
                BudgetId = id,
                PreviousAmount = previousAmount,
                NewAmount = dto.TotalAmount,
                ApprovedByUserId = userId.Value,
                DateApproved = DateTime.UtcNow,
                Notes = dto.Notes?.Trim() ?? "Budget revised.",
                VersionNo = budget.Revisions.Count + 1
            };

            budget.TotalAmount = dto.TotalAmount;
            if (!string.IsNullOrWhiteSpace(dto.Currency)) budget.Currency = dto.Currency.Trim().ToUpper();

            _db.BudgetRevisionLogs.Add(revision);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Safely returns / unallocates remaining unspent funds back to parent pool.
        /// Adjusts budget total ceiling to actual spent amount and logs an audit entry.
        /// </summary>
        [HttpPost("{id}/return-remaining")]
        public async Task<ActionResult> ReturnRemainingBudget(int id, [FromBody] BudgetReturnDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var budget = await _db.Budgets
                .Include(b => b.Revisions)
                .Where(b => b.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (budget == null) return NotFound("Budget not found.");

            var spent = await GetSpentAsync(budget);
            var remaining = budget.TotalAmount - spent;

            if (remaining <= 0)
            {
                return BadRequest("No remaining unspent funds available to return.");
            }

            var previousAmount = budget.TotalAmount;
            var newTotal = spent; // Cap budget ceiling to actual spent amount

            var revision = new BudgetRevisionLog
            {
                BudgetId = id,
                PreviousAmount = previousAmount,
                NewAmount = newTotal,
                ApprovedByUserId = userId.Value,
                DateApproved = DateTime.UtcNow,
                Notes = string.IsNullOrWhiteSpace(dto?.Notes) 
                    ? $"Returned remaining unspent budget of ${remaining:N2} {budget.Currency} back to parent pool."
                    : dto.Notes,
                VersionNo = budget.Revisions.Count + 1
            };

            budget.TotalAmount = newTotal;
            budget.Status = BudgetStatus.Closed; // Mark as closed after return

            _db.BudgetRevisionLogs.Add(revision);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Remaining unspent budget successfully returned and logged.",
                returnedAmount = remaining,
                newTotalBudget = newTotal,
                currency = budget.Currency
            });
        }

        [HttpPost("{id}/approve")]
        public async Task<ActionResult> ApproveBudget(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");
            var userId = GetCurrentUserId();
            if (userId == null) return Unauthorized();

            var budget = await _db.Budgets
                .Include(b => b.Revisions)
                .Where(b => b.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (budget == null) return NotFound();

            if (budget.Status == BudgetStatus.Approved || budget.Status == BudgetStatus.Active)
                return BadRequest("Budget is already approved or active.");

            var revision = new BudgetRevisionLog
            {
                BudgetId = id,
                PreviousAmount = budget.TotalAmount,
                NewAmount = budget.TotalAmount,
                ApprovedByUserId = userId.Value,
                DateApproved = DateTime.UtcNow,
                Notes = "Budget approved.",
                VersionNo = budget.Revisions.Count + 1
            };

            budget.Status = BudgetStatus.Approved;

            _db.BudgetRevisionLogs.Add(revision);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Budget approved." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBudget(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var budget = await _db.Budgets
                .Include(b => b.LineItems)
                .Include(b => b.Revisions)
                .Where(b => b.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (budget == null) return NotFound();

            if (budget.LineItems != null && budget.LineItems.Any())
            {
                _db.BudgetLineItems.RemoveRange(budget.LineItems);
            }
            if (budget.Revisions != null && budget.Revisions.Any())
            {
                _db.BudgetRevisionLogs.RemoveRange(budget.Revisions);
            }

            _db.Budgets.Remove(budget);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id}/line-items")]
        public async Task<ActionResult> AddLineItem(int id, BudgetLineItemCreateDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var budget = await _db.Budgets.Where(b => b.OrganizationId == orgId.Value).FirstOrDefaultAsync(b => b.Id == id);
            if (budget == null) return NotFound();

            if (dto.Amount <= 0)
            {
                return BadRequest("Line item amount must be strictly greater than zero.");
            }

            var currentAllocated = await _db.BudgetLineItems.Where(l => l.BudgetId == id).SumAsync(l => l.Amount);
            if (currentAllocated + dto.Amount > budget.TotalAmount)
            {
                return BadRequest($"Adding this line item (${dto.Amount:N2}) would exceed the total budget ceiling (${budget.TotalAmount:N2}). Current allocated: ${currentAllocated:N2}.");
            }

            var lineItem = new BudgetLineItem
            {
                BudgetId = id,
                Category = dto.Category,
                Description = dto.Description,
                Amount = dto.Amount
            };

            _db.BudgetLineItems.Add(lineItem);
            await _db.SaveChangesAsync();

            return Ok(new BudgetLineItemDto
            {
                Id = lineItem.Id,
                BudgetId = lineItem.BudgetId,
                Category = lineItem.Category,
                Description = lineItem.Description,
                Amount = lineItem.Amount
            });
        }

        [HttpPut("{id}/line-items/{lineItemId}")]
        public async Task<IActionResult> UpdateLineItem(int id, int lineItemId, BudgetLineItemCreateDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var budgetExists = await _db.Budgets.AnyAsync(b => b.Id == id && b.OrganizationId == orgId.Value);
            if (!budgetExists) return NotFound();

            var lineItem = await _db.BudgetLineItems.FirstOrDefaultAsync(l => l.Id == lineItemId && l.BudgetId == id);
            if (lineItem == null) return NotFound();

            lineItem.Category = dto.Category;
            lineItem.Description = dto.Description;
            lineItem.Amount = dto.Amount;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}/line-items/{lineItemId}")]
        public async Task<IActionResult> DeleteLineItem(int id, int lineItemId)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var budgetExists = await _db.Budgets.AnyAsync(b => b.Id == id && b.OrganizationId == orgId.Value);
            if (!budgetExists) return NotFound();

            var lineItem = await _db.BudgetLineItems.FirstOrDefaultAsync(l => l.Id == lineItemId && l.BudgetId == id);
            if (lineItem == null) return NotFound();

            _db.BudgetLineItems.Remove(lineItem);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{id}/revisions")]
        public async Task<ActionResult<IEnumerable<BudgetRevisionLogDto>>> GetRevisions(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var exists = await _db.Budgets.AnyAsync(b => b.Id == id && b.OrganizationId == orgId.Value);
            if (!exists) return NotFound();

            var revisions = await _db.BudgetRevisionLogs
                .Where(r => r.BudgetId == id)
                .Include(r => r.ApprovedByUser)
                .OrderBy(r => r.VersionNo)
                .ToListAsync();

            return Ok(revisions.Select(r => new BudgetRevisionLogDto
            {
                Id = r.Id,
                PreviousAmount = r.PreviousAmount,
                NewAmount = r.NewAmount,
                ApprovedByUserId = r.ApprovedByUserId,
                ApprovedByUserName = r.ApprovedByUser?.Name ?? "Unknown",
                DateApproved = r.DateApproved,
                Notes = r.Notes,
                VersionNo = r.VersionNo
            }));
        }

        /// <summary>
        /// GET /api/v1/budgets/project/{projectId}/balancing - Compare total donor allocations vs total budget items
        /// </summary>
        [HttpGet("project/{projectId}/balancing")]
        public async Task<ActionResult<ProjectBudgetBalancingDto>> GetProjectBudgetBalancing(int projectId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound();

            var totalDonorAllocation = await _db.ProjectDonors
                .Where(pd => pd.ProjectId == projectId)
                .SumAsync(pd => (decimal?)pd.AllocatedAmount) ?? 0m;

            var projectBudget = await _db.Budgets
                .Include(b => b.LineItems)
                .FirstOrDefaultAsync(b => b.ProjectId == projectId);

            var totalBudgetItems = projectBudget?.LineItems.Sum(l => l.Amount) ?? projectBudget?.TotalAmount ?? 0m;

            var variance = totalDonorAllocation - totalBudgetItems;
            string status = "Balanced";
            if (totalBudgetItems > totalDonorAllocation)
            {
                status = "Deficit";
            }
            else if (totalDonorAllocation > totalBudgetItems)
            {
                status = "Surplus";
            }

            return Ok(new ProjectBudgetBalancingDto
            {
                ProjectId = projectId,
                ProjectTitle = project.Title,
                FundingType = project.FundingType ?? "SingleDonor",
                TotalDonorAllocation = totalDonorAllocation,
                TotalBudgetItems = totalBudgetItems,
                Variance = variance,
                Status = status
            });
        }

        [HttpGet("projects/{projectId}/export-audit-package")]
        public async Task<IActionResult> ExportAuditPackage(int projectId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound("Project not found");

            var budget = await _db.Budgets
                .Include(b => b.LineItems)
                .Include(b => b.Revisions)
                .FirstOrDefaultAsync(b => b.ProjectId == projectId);

            var expenses = await _db.Expenses
                .Where(e => e.ProjectId == projectId)
                .ToListAsync();

            var donorAllocations = await _db.ProjectDonors
                .Include(pd => pd.Donor)
                .Where(pd => pd.ProjectId == projectId)
                .ToListAsync();

            var postponements = await _db.ProjectPostponements
                .Where(pp => pp.ProjectId == projectId)
                .ToListAsync();

            using (var memoryStream = new System.IO.MemoryStream())
            {
                using (var archive = new System.IO.Compression.ZipArchive(memoryStream, System.IO.Compression.ZipArchiveMode.Create, true))
                {
                    // 1. Audit Summary Text File
                    var summaryEntry = archive.CreateEntry("Audit_Summary.txt");
                    using (var writer = new System.IO.StreamWriter(summaryEntry.Open()))
                    {
                        writer.WriteLine($"=== ORBITDESK FINANCIAL AUDIT SUPPORT PACKAGE ===");
                        writer.WriteLine($"Project Title: {project.Title}");
                        writer.WriteLine($"Project ID: {project.Id}");
                        writer.WriteLine($"Generated At: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
                        writer.WriteLine($"Status: {project.Status}");
                        writer.WriteLine($"Total Project Budget: ${budget?.TotalAmount.ToString("N2") ?? "0.00"}");
                        writer.WriteLine($"Total Approved Expenses: ${expenses.Where(e => e.ApprovalStatus == ApprovalStatus.Approved).Sum(e => e.Amount):N2}");
                        writer.WriteLine($"Total Donor Contributions Allocated: ${donorAllocations.Sum(da => da.AllocatedAmount):N2}");
                        writer.WriteLine($"=================================================");
                    }

                    // 2. Budget Revisions JSON
                    var budgetEntry = archive.CreateEntry("Budgets_And_Revisions.json");
                    using (var writer = new System.IO.StreamWriter(budgetEntry.Open()))
                    {
                        var auditBudgetData = new {
                            ProjectId = project.Id,
                            ProjectTitle = project.Title,
                            TotalBudget = budget?.TotalAmount,
                            BudgetItems = budget?.LineItems.Select(l => new { l.Id, l.Category, l.Description, l.Amount }),
                            VersionHistory = budget?.Revisions.Select(r => new { r.Id, r.VersionNo, r.DateApproved, r.Notes })
                        };
                        writer.Write(System.Text.Json.JsonSerializer.Serialize(auditBudgetData, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                    }

                    // 3. Approved Expenses JSON
                    var expensesEntry = archive.CreateEntry("Expense_Ledger.json");
                    using (var writer = new System.IO.StreamWriter(expensesEntry.Open()))
                    {
                        var auditExpenseData = expenses.Select(e => new {
                            e.Id, e.Description, e.Amount, e.Currency, e.Date, e.ApprovalStatus, e.ApprovedByFinanceOfficerId, e.SignedOffByManagerId, e.AttachmentId
                        });
                        writer.Write(System.Text.Json.JsonSerializer.Serialize(auditExpenseData, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                    }

                    // 4. Donor Allocations & Timeline History JSON
                    var complianceEntry = archive.CreateEntry("Grant_Compliance_Trail.json");
                    using (var writer = new System.IO.StreamWriter(complianceEntry.Open()))
                    {
                        var auditComplianceData = new {
                            Donors = donorAllocations.Select(d => new { d.DonorId, DonorName = d.Donor?.Name, d.AllocatedAmount }),
                            TimelinePostponementLog = postponements.Select(p => new { p.OldEndDate, p.NewEndDate, p.Reason, p.CreatedAt })
                        };
                        writer.Write(System.Text.Json.JsonSerializer.Serialize(auditComplianceData, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
                    }
                }

                return File(memoryStream.ToArray(), "application/zip", $"OrbitDesk_Audit_Package_Project_{projectId}.zip");
            }
        }
    }

    public class ProjectBudgetBalancingDto
    {
        public int ProjectId { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string FundingType { get; set; } = "SingleDonor";
        public decimal TotalDonorAllocation { get; set; }
        public decimal TotalBudgetItems { get; set; }
        public decimal Variance { get; set; }
        public string Status { get; set; } = "Balanced";
    }

    public class BudgetReturnDto
    {
        public string? Notes { get; set; }
    }
}
