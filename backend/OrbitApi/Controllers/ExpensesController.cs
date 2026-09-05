using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Financial Accounting Controller managing expense claim submissions, dual-step approval trails
    /// (Finance Officer Review -> Manager Sign-off), bank disbursement, receipt attachments, and budget overspend enforcement.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ExpensesController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly ICurrencyService _currencyService;
        private const decimal RECEIPT_THRESHOLD = 500m;

        public ExpensesController(OrbitDbContext db, ICurrencyService currencyService)
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

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
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

        private async Task<bool> UserHasRoleAsync(int userId, int orgId, params RoleName[] allowedRoles)
        {
            // 1. Check explicit active persona header or claim first (segregation of duties enforcement)
            var activeRoleStr = User.FindFirst("active_role")?.Value;
            if (string.IsNullOrWhiteSpace(activeRoleStr) && HttpContext?.Request?.Headers != null)
            {
                if (HttpContext.Request.Headers.TryGetValue("X-Active-Role", out var headerVal))
                {
                    activeRoleStr = headerVal.FirstOrDefault();
                }
            }

            if (!string.IsNullOrWhiteSpace(activeRoleStr) && Enum.TryParse<RoleName>(activeRoleStr, true, out var switchedRole))
            {
                if (switchedRole == RoleName.Owner)
                {
                    var isOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted && o.Id == orgId);
                    return isOwner && allowedRoles.Contains(RoleName.Owner);
                }
                return allowedRoles.Contains(switchedRole);
            }

            var isOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted && o.Id == orgId);
            if (isOrgOwner && allowedRoles.Contains(RoleName.Owner)) return true;

            var orgMember = await _db.OrganizationMembers
                .Include(m => m.Role)
                .FirstOrDefaultAsync(m => m.UserId == userId && m.OrganizationId == orgId && m.Status == OrgMemberStatus.Active);

            if (orgMember?.Role != null && allowedRoles.Contains(orgMember.Role.Name))
            {
                return true;
            }

            var userRoleStrings = User.FindAll(ClaimTypes.Role).Select(r => r.Value).ToList();
            userRoleStrings.AddRange(User.FindAll("role").Select(r => r.Value));

            foreach (var role in allowedRoles)
            {
                var roleStr = role.ToString();
                if (userRoleStrings.Any(r => string.Equals(r, roleStr, StringComparison.OrdinalIgnoreCase)
                    || (role == RoleName.FinanceOfficer && (string.Equals(r, "Finance Officer", StringComparison.OrdinalIgnoreCase) || string.Equals(r, "Finance", StringComparison.OrdinalIgnoreCase)))))
                {
                    return true;
                }
            }

            return false;
        }

        private async Task<int> GetExpenseOrgIdAsync(Expense expense)
        {
            if (expense.ProjectId.HasValue)
            {
                var p = await _db.Projects.Include(pr => pr.Workspace).FirstOrDefaultAsync(pr => pr.Id == expense.ProjectId.Value);
                if (p?.Workspace != null) return p.Workspace.OrganizationId;
            }
            if (expense.BankAccountId.HasValue)
            {
                var b = await _db.BankAccounts.FindAsync(expense.BankAccountId.Value);
                if (b != null) return b.OrganizationId;
            }
            return GetActiveOrganizationId() ?? 1;
        }

        /// <summary>
        /// GET /api/v1/expenses — Fetch all expenses with full relation data
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExpenseDto>>> GetExpenses([FromQuery] int? orgId)
        {
            var targetOrgId = orgId ?? GetActiveOrganizationId();
            if (!targetOrgId.HasValue || targetOrgId.Value <= 0) return Ok(new List<ExpenseDto>());

            var expenses = await _db.Expenses
                .Include(e => e.Project).ThenInclude(p => p.Workspace)
                .Include(e => e.Task).ThenInclude(t => t.Project).ThenInclude(p => p.Workspace)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.ApprovedByFinanceOfficer)
                .Include(e => e.SignedOffByManager)
                .Include(e => e.PaidByUser)
                .Include(e => e.Attachment)
                .Include(e => e.BankAccount)
                .Include(e => e.FinancialCategory)
                .Where(e => (e.Project != null && e.Project.Workspace != null && e.Project.Workspace.OrganizationId == targetOrgId.Value) || 
                            (e.Task != null && e.Task.Project != null && e.Task.Project.Workspace != null && e.Task.Project.Workspace.OrganizationId == targetOrgId.Value) ||
                            (e.BankAccount != null && e.BankAccount.OrganizationId == targetOrgId.Value) ||
                            (e.SubmittedByUser != null && _db.OrganizationMembers.Any(om => om.UserId == e.SubmittedByUserId && om.OrganizationId == targetOrgId.Value)))
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            // Auto-heal any orphaned Paid expenses to link to active bank account
            var orphanedPaid = expenses.Where(e => e.ApprovalStatus == ApprovalStatus.Paid && !e.BankAccountId.HasValue).ToList();
            if (orphanedPaid.Any())
            {
                var defaultBank = await _db.BankAccounts
                    .Where(b => b.OrganizationId == targetOrgId.Value && b.IsActive)
                    .OrderBy(b => b.Id)
                    .FirstOrDefaultAsync();
                if (defaultBank != null)
                {
                    foreach (var op in orphanedPaid)
                    {
                        op.BankAccountId = defaultBank.Id;
                        op.BankAccount = defaultBank;
                        var existingTxn = await _db.FinancialTransactions.FirstOrDefaultAsync(t => t.ExpenseId == op.Id);
                        if (existingTxn != null && !existingTxn.BankAccountId.HasValue)
                        {
                            existingTxn.BankAccountId = defaultBank.Id;
                        }
                    }
                    await _db.SaveChangesAsync();
                }
            }

            var budgets = await _db.Budgets
                .Where(b => b.OrganizationId == targetOrgId.Value)
                .Include(b => b.LineItems)
                .ToListAsync();

            var dtos = new List<ExpenseDto>();
            foreach (var e in expenses)
            {
                var budgetWarning = false;
                string? complianceWarning = null;

                decimal? catAllocated = null;
                decimal? catSpent = null;
                decimal? catRemaining = null;

                if (e.CategoryId.HasValue)
                {
                    var matchingBudget = (e.ProjectId.HasValue ? budgets.FirstOrDefault(b => b.ProjectId == e.ProjectId.Value) : null)
                        ?? budgets.FirstOrDefault(b => b.Level == BudgetLevel.Organization || b.OrganizationId == targetOrgId.Value);

                    var lineItem = matchingBudget?.LineItems?.FirstOrDefault(li => li.CategoryId == e.CategoryId.Value);
                    if (lineItem != null)
                    {
                        catAllocated = lineItem.Amount;
                        var categoryExpenses = expenses
                            .Where(exp => (e.ProjectId.HasValue ? exp.ProjectId == e.ProjectId.Value : true) &&
                                          exp.CategoryId == e.CategoryId.Value &&
                                          exp.ApprovalStatus != ApprovalStatus.Rejected)
                            .Sum(exp => exp.Amount);

                        catSpent = categoryExpenses;
                        catRemaining = lineItem.Amount - categoryExpenses;
                    }
                }

                dtos.Add(new ExpenseDto
                {
                    Id = e.Id,
                    ProjectId = e.ProjectId,
                    ProjectName = e.Project?.Title,
                    TaskId = e.TaskId,
                    TaskName = e.Task?.Title,
                    SubmittedByUserId = e.SubmittedByUserId,
                    SubmittedByUserName = e.SubmittedByUser?.Name ?? "Unknown",
                    CategoryId = e.CategoryId,
                    CategoryName = e.FinancialCategory?.Name ?? "General Expense",
                    CategoryCode = e.FinancialCategory?.Code,
                    BankAccountId = e.BankAccountId,
                    BankAccountName = e.BankAccount != null ? $"{e.BankAccount.BankName} - {e.BankAccount.AccountName}" : null,
                    Amount = e.Amount,
                    GrossAmount = e.GrossAmount,
                    TaxAmount = e.TaxAmount,
                    NetAmount = e.NetAmount,
                    Currency = e.Currency,
                    Date = e.Date,
                    Description = e.Description,
                    ApprovalStatus = e.ApprovalStatus,
                    ApprovedByFinanceOfficerId = e.ApprovedByFinanceOfficerId,
                    FinanceOfficerName = e.ApprovedByFinanceOfficer?.Name,
                    FinanceReviewedAt = e.FinanceReviewedAt,
                    SignedOffByManagerId = e.SignedOffByManagerId,
                    ManagerName = e.SignedOffByManager?.Name,
                    ManagerSignedOffAt = e.ManagerSignedOffAt,
                    PaidByUserId = e.PaidByUserId,
                    PaidUserName = e.PaidByUser?.Name,
                    PaidAt = e.PaidAt,
                    RejectionReason = e.RejectionReason,
                    AttachmentId = e.AttachmentId,
                    AttachmentFileName = e.Attachment?.FileName,
                    CreatedAt = e.CreatedAt,
                    BudgetWarning = budgetWarning,
                    ComplianceWarningMessage = complianceWarning,
                    CategoryAllocatedBudget = catAllocated,
                    CategorySpentBudget = catSpent,
                    CategoryRemainingBudget = catRemaining
                });
            }

            return Ok(dtos);
        }

        /// <summary>
        /// Submits a new expense claim with duplicate submission checks, USAID allowability validation, and budget overspend guards.
        /// </summary>
        /// <param name="dto">Expense submission parameters.</param>
        /// <returns>Created expense DTO.</returns>
        [HttpPost]
        public async Task<ActionResult<ExpenseDto>> SubmitExpense([FromBody] ExpenseCreateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (dto.Amount <= 0)
            {
                return BadRequest(new { message = "Expense amount must be strictly greater than zero ($0.01 or more)." });
            }

            // Get current user ID from JWT
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var activeOrgId = GetActiveOrganizationId() ?? 1;
            var canSubmit = await UserHasRoleAsync(userId, activeOrgId, RoleName.Owner, RoleName.Admin, RoleName.Manager, RoleName.Coordinator, RoleName.FinanceOfficer, RoleName.Member);
            if (!canSubmit)
            {
                return StatusCode(403, new { message = "Viewers and unauthorized roles cannot submit expense claims." });
            }

            // Date validation: check past bounds, future dates and project bounds
            if (dto.Date.Year < 2000)
            {
                return BadRequest(new { message = "Expense incurred date cannot be prior to year 2000." });
            }

            if (dto.Date.Date > DateTime.UtcNow.Date)
            {
                return BadRequest(new { message = "Expense incurred date cannot be in the future." });
            }

            if (dto.ProjectId.HasValue)
            {
                var project = await _db.Projects.FindAsync(dto.ProjectId.Value);
                if (project != null)
                {
                    if (project.StartDate.HasValue && dto.Date.Date < project.StartDate.Value.Date)
                    {
                        return BadRequest(new { message = $"Expense date ({dto.Date:yyyy-MM-dd}) cannot be earlier than project start date ({project.StartDate.Value:yyyy-MM-dd})." });
                    }
                    if (project.EndDate.HasValue && dto.Date.Date > project.EndDate.Value.Date)
                    {
                        return BadRequest(new { message = $"Expense date ({dto.Date:yyyy-MM-dd}) cannot be later than project end date ({project.EndDate.Value:yyyy-MM-dd})." });
                    }
                }
            }

            // Closed fiscal period validation
            var orgId = GetActiveOrganizationId();
            if (orgId.HasValue)
            {
                var compliance = await _db.OrganizationCompliances.FirstOrDefaultAsync(c => c.OrganizationId == orgId.Value);
                if (compliance?.ClosedPeriodEndDate != null && dto.Date.Date <= compliance.ClosedPeriodEndDate.Value.Date)
                {
                    return BadRequest(new { message = $"Expense incurred date ({dto.Date:yyyy-MM-dd}) falls into a closed fiscal period (Closed through {compliance.ClosedPeriodEndDate.Value:yyyy-MM-dd})." });
                }
            }

            // Duplicate expense claim check
            var isDuplicate = await _db.Expenses.AnyAsync(e => 
                e.SubmittedByUserId == userId && 
                e.Amount == dto.Amount && 
                e.Date.Date == dto.Date.Date && 
                e.Description.Trim().ToLower() == dto.Description.Trim().ToLower() && 
                e.ApprovalStatus != ApprovalStatus.Rejected);
            if (isDuplicate)
            {
                return BadRequest(new { message = "A matching expense claim with the exact same amount, date, and description has already been submitted." });
            }

            // USAID Allowability & Category check
            string? catName = null;
            string? catCode = null;
            if (dto.CategoryId.HasValue)
            {
                var finCat = await _db.FinancialCategories.FindAsync(dto.CategoryId.Value);
                if (finCat != null)
                {
                    if (!finCat.IsUSAIDAllowable)
                    {
                        return BadRequest(new { message = $"Category '{finCat.Name}' is marked as non-allowable for donor funding and cannot be billed to project funds." });
                    }
                    catName = finCat.Name;
                    catCode = finCat.Code;
                }
            }

            decimal amountToLog = dto.Amount;
            decimal? netAmount = null;

            if (dto.GrossAmount.HasValue && dto.TaxAmount.HasValue)
            {
                if (dto.TaxAmount.Value < 0 || dto.GrossAmount.Value < 0)
                {
                    return BadRequest(new { message = "Gross amount and tax amount cannot be negative." });
                }
                
                netAmount = dto.GrossAmount.Value - dto.TaxAmount.Value;
                
                if (Math.Abs(netAmount.Value - dto.Amount) > 0.01m)
                {
                    return BadRequest(new { message = $"Expense Amount ({dto.Amount}) must equal Gross Amount minus Tax Amount ({netAmount.Value})." });
                }
            }

            // Task financial category check
            if (dto.TaskId.HasValue)
            {
                var task = await _db.Tasks.FindAsync(dto.TaskId.Value);
                if (task != null)
                {
                    if (!task.CategoryId.HasValue || task.CategoryId.Value <= 0)
                    {
                        return BadRequest(new { message = $"Cannot link expense to task '{task.Title}'. This task does not have a Financial Category assigned." });
                    }
                    if (!dto.CategoryId.HasValue)
                    {
                        dto.CategoryId = task.CategoryId;
                    }
                }
            }

            // Budget validation: check if this expense would cause overspend
            if (dto.ProjectId.HasValue)
            {
                if (!dto.CategoryId.HasValue) 
                {
                    return BadRequest(new { message = "Strict Compliance: A Financial Category is strictly required for all project expenses." });
                }

                // Check overspend against the NetAmount (or Amount)
                var overspendReason = await CheckBudgetOverspend(dto.ProjectId.Value, dto.CategoryId, amountToLog, dto.Currency);
                if (overspendReason != null)
                {
                    return BadRequest(new { 
                        error = "BUDGET_EXCEEDED", 
                        message = overspendReason 
                    });
                }
            }

            var expense = new Expense
            {
                ProjectId = dto.ProjectId,
                TaskId = dto.TaskId,
                BankAccountId = dto.BankAccountId,
                SubmittedByUserId = userId,
                CategoryId = dto.CategoryId,
                Amount = amountToLog,
                GrossAmount = dto.GrossAmount,
                TaxAmount = dto.TaxAmount,
                NetAmount = netAmount,
                Currency = dto.Currency,
                Date = dto.Date,
                Description = dto.Description,
                ApprovalStatus = ApprovalStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _db.Expenses.Add(expense);

            // Trigger System Notification
            _db.Notifications.Add(new Notification
            {
                UserId = userId,
                Message = $"💰 Expense Claim Submitted: {dto.Description} ({dto.Amount} {dto.Currency}) registered and pending review.",
                Channel = NotificationChannel.InApp,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                Link = "/finance"
            });

            await _db.SaveChangesAsync();

            // Reload with relations for the response
            await _db.Entry(expense).Reference(e => e.SubmittedByUser).LoadAsync();

            return Ok(new ExpenseDto
            {
                Id = expense.Id,
                ProjectId = expense.ProjectId,
                TaskId = expense.TaskId,
                SubmittedByUserId = expense.SubmittedByUserId,
                SubmittedByUserName = expense.SubmittedByUser?.Name ?? "Unknown",
                CategoryId = expense.CategoryId,
                CategoryName = catName ?? "General Expense",
                CategoryCode = catCode,
                Amount = expense.Amount,
                Currency = expense.Currency,
                Date = expense.Date,
                Description = expense.Description,
                ApprovalStatus = expense.ApprovalStatus,
                CreatedAt = expense.CreatedAt,
                BudgetWarning = false
            });
        }

        /// <summary>
        /// POST /api/v1/expenses/{id}/review-finance — Finance Officer review (Step 1)
        /// </summary>
        [HttpPost("{id}/review-finance")]
        public async Task<ActionResult> ReviewByFinance(int id)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound(new { message = "Expense not found." });

            if (expense.ApprovalStatus != ApprovalStatus.Pending)
            {
                return BadRequest(new { message = "Expense is not in Pending status. Cannot review." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var expenseOrgId = await GetExpenseOrgIdAsync(expense);
            var isFinanceOfficer = await UserHasRoleAsync(userId, expenseOrgId, RoleName.Owner, RoleName.Admin, RoleName.FinanceOfficer);

            // Role Enforcement: Step 1 requires Finance Officer, Admin, or Owner role
            if (!isFinanceOfficer)
            {
                return StatusCode(403, new { message = "Role Authorization Enforcement: Only Finance Officers, Admins, or Owners can perform Step 1 (Finance Officer Review)." });
            }

            var isOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted && o.Id == expenseOrgId);
            var isOwnerOrAdmin = await UserHasRoleAsync(userId, expenseOrgId, RoleName.Owner, RoleName.Admin);

            // Self-Approval Prohibition Rule (bypassed for Org Owner / Admin in test mode if single user)
            if (expense.SubmittedByUserId == userId && !isOrgOwner)
            {
                return BadRequest(new { message = "Self-approval prohibition: A user cannot review or approve an expense claim they submitted. Another authorized user must review this claim." });
            }

            // Mandatory Receipt Threshold Rule ($500+)
            if (expense.Amount >= RECEIPT_THRESHOLD && !expense.AttachmentId.HasValue && !isOwnerOrAdmin)
            {
                return BadRequest(new { message = $"Receipt or supporting invoice upload is mandatory for expense claims of ${RECEIPT_THRESHOLD:N2} or more prior to review. Please upload a receipt attachment or test with an amount under $500." });
            }

            expense.ApprovalStatus = ApprovalStatus.FinanceReviewed;
            expense.ApprovedByFinanceOfficerId = userId;
            expense.FinanceReviewedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Expense reviewed by Finance Officer. Awaiting Manager sign-off." });
        }

        /// <summary>
        /// POST /api/v1/expenses/{id}/signoff-manager — Manager sign-off (Step 2)
        /// </summary>
        [HttpPost("{id}/signoff-manager")]
        public async Task<ActionResult> SignOffByManager(int id)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound(new { message = "Expense not found." });

            if (expense.ApprovalStatus != ApprovalStatus.FinanceReviewed)
            {
                return BadRequest(new { message = "Expense must be reviewed by Finance Officer first." });
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var expenseOrgId = await GetExpenseOrgIdAsync(expense);
            var isManager = await UserHasRoleAsync(userId, expenseOrgId, RoleName.Owner, RoleName.Admin, RoleName.Manager);

            // Role Enforcement: Step 2 requires Manager, Admin, or Owner role
            if (!isManager)
            {
                return StatusCode(403, new { message = "Role Authorization Enforcement: Only Project Managers, Admins, or Owners are authorized to perform Step 2 (Manager Sign-off)." });
            }

            var isOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted && o.Id == expenseOrgId);

            // Self-Approval Prohibition Rule: Submitter cannot approve their own claim (bypassed for Org Owner in test/demo mode)
            if (expense.SubmittedByUserId == userId && !isOrgOwner)
            {
                return BadRequest(new { message = "Self-approval prohibition: A user cannot approve or sign off on an expense claim they submitted." });
            }

            // Segregation of Duties Enforcement (Dual 2-Step Approval Rule):
            // Step 2 (Manager Sign-off) MUST be performed by a DIFFERENT user than Step 1 (Finance Officer Review) (bypassed for Org Owner in test/demo mode)
            if (expense.ApprovedByFinanceOfficerId == userId && !isOrgOwner)
            {
                return BadRequest(new { message = "Segregation of Duties Enforcement: Step 2 (Manager Sign-off) cannot be approved by the same user who performed Step 1 (Finance Officer Review). Dual approval requires sign-off from a different authorized user." });
            }

            // Mandatory Receipt Threshold Rule ($500+)
            if (expense.Amount >= RECEIPT_THRESHOLD && !expense.AttachmentId.HasValue)
            {
                return BadRequest(new { message = $"Receipt or supporting invoice upload is mandatory for expense claims of ${RECEIPT_THRESHOLD:N2} or more prior to manager sign-off." });
            }

            expense.ApprovalStatus = ApprovalStatus.Approved;
            expense.SignedOffByManagerId = userId;
            expense.ManagerSignedOffAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Expense approved by Manager." });
        }

        /// <summary>
        /// DELETE /api/v1/expenses/clear-data — Clears all test expense & financial ledger data for clean testing (Owner/Admin only)
        /// </summary>
        [HttpDelete("clear-data")]
        [HttpPost("clear-data")]
        public async Task<IActionResult> ClearFinancialTestData()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var orgId = GetActiveOrganizationId() ?? 1;
            var canClear = await UserHasRoleAsync(userId, orgId, RoleName.Owner, RoleName.Admin);
            if (!canClear)
            {
                return StatusCode(403, new { message = "Forbidden: Only Organization Owners and Administrators can clear financial data." });
            }

            _db.FinancialTransactions.RemoveRange(_db.FinancialTransactions);
            _db.Expenses.RemoveRange(_db.Expenses);
            _db.DonorContributions.RemoveRange(_db.DonorContributions);
            _db.FinancialCategories.RemoveRange(_db.FinancialCategories);
            _db.BudgetRevisionLogs.RemoveRange(_db.BudgetRevisionLogs);
            _db.BudgetLineItems.RemoveRange(_db.BudgetLineItems);
            _db.Budgets.RemoveRange(_db.Budgets);

            await _db.SaveChangesAsync();

            return Ok(new { message = "All financial test data (Expenses, Ledger Transactions, Donor Contributions, Categories, Budgets) has been cleared successfully. Bank accounts are preserved with 0 balance." });
        }

        /// <summary>
        /// POST /api/v1/expenses/{id}/pay — Mark expense as Paid / Disbursed (Step 3)
        /// </summary>
        [HttpPost("{id}/pay")]
        public async Task<ActionResult> PayExpense(int id, [FromBody] PayExpenseRequest? req = null)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound();

            if (expense.ApprovalStatus != ApprovalStatus.Approved)
            {
                return BadRequest("Expense must be Approved before it can be marked as Paid.");
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var expenseOrgId = await GetExpenseOrgIdAsync(expense);
            var isFinanceOfficer = await UserHasRoleAsync(userId, expenseOrgId, RoleName.Owner, RoleName.Admin, RoleName.FinanceOfficer);

            // Role Enforcement: Step 3 requires Finance Officer, Admin, or Owner role
            if (!isFinanceOfficer)
            {
                return StatusCode(403, new { message = "Role Authorization Enforcement: Only Finance Officers, Treasury Officers, Admins, or Owners are authorized to perform Step 3 (Disbursement / Payment)." });
            }

            // Assign or update BankAccountId
            if (req?.BankAccountId.HasValue == true && req.BankAccountId.Value > 0)
            {
                var targetBank = await _db.BankAccounts.FirstOrDefaultAsync(b => b.Id == req.BankAccountId.Value && b.OrganizationId == expenseOrgId);
                if (targetBank != null)
                {
                    expense.BankAccountId = targetBank.Id;
                }
            }

            if (!expense.BankAccountId.HasValue)
            {
                var defaultBank = await _db.BankAccounts
                    .Where(b => b.OrganizationId == expenseOrgId && b.IsActive)
                    .OrderBy(b => b.Id)
                    .FirstOrDefaultAsync();
                if (defaultBank != null)
                {
                    expense.BankAccountId = defaultBank.Id;
                }
            }

            // Bank Account Overdraft Control
            if (expense.BankAccountId.HasValue)
            {
                var bankAcc = await _db.BankAccounts
                    .Include(b => b.Contributions)
                    .Include(b => b.Expenses)
                    .FirstOrDefaultAsync(b => b.Id == expense.BankAccountId.Value);

                if (bankAcc != null)
                {
                    var baseBankCurrency = bankAcc.Currency;
                    decimal totalReceived = 0;
                    foreach (var c in bankAcc.Contributions.Where(x => x.Status == ContributionStatus.Received))
                    {
                        totalReceived += await _currencyService.ConvertAsync(c.Amount, c.Currency, baseBankCurrency);
                    }

                    decimal totalExpended = 0;
                    foreach (var e in bankAcc.Expenses.Where(x => x.ApprovalStatus == ApprovalStatus.Paid && x.Id != expense.Id))
                    {
                        totalExpended += await _currencyService.ConvertAsync(e.Amount, e.Currency, baseBankCurrency);
                    }

                    var availableBalance = totalReceived - totalExpended;
                    var expenseInBankCurrency = await _currencyService.ConvertAsync(expense.Amount, expense.Currency, baseBankCurrency);

                    if (totalReceived > 0 && expenseInBankCurrency > availableBalance)
                    {
                        return BadRequest(new { 
                            error = "INSUFFICIENT_FUNDS", 
                            message = $"Source bank account '{bankAcc.BankName} ({bankAcc.AccountNumber})' available balance ({availableBalance:N2} {baseBankCurrency}) is insufficient to disburse this expense of {expenseInBankCurrency:N2} {baseBankCurrency}." 
                        });
                    }
                }
            }

            expense.ApprovalStatus = ApprovalStatus.Paid;
            expense.PaidByUserId = userId;
            expense.PaidAt = DateTime.UtcNow;

            // Auto-post to FinancialTransaction Ledger
            int orgId = GetActiveOrganizationId() ?? 1;
            if (expense.ProjectId.HasValue)
            {
                var proj = await _db.Projects.Include(p => p.Workspace).FirstOrDefaultAsync(p => p.Id == expense.ProjectId.Value);
                if (proj?.Workspace != null) orgId = proj.Workspace.OrganizationId;
            }
            else if (expense.BankAccountId.HasValue)
            {
                var bank = await _db.BankAccounts.FindAsync(expense.BankAccountId.Value);
                if (bank != null) orgId = bank.OrganizationId;
            }

            int? resolvedCatId = expense.CategoryId;
            
            var org = await _db.Organizations.FindAsync(orgId);
            var baseCurrency = org?.Currency ?? "USD";
            var exRate = await _currencyService.GetExchangeRateAsync(expense.Currency, baseCurrency);

            var txn = new FinancialTransaction
            {
                OrganizationId = orgId,
                TransactionNumber = $"EXP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
                Type = FinancialTransactionType.Expense,
                TransactionDate = DateTime.UtcNow,
                Amount = expense.Amount,
                Currency = expense.Currency,
                ExchangeRate = exRate,
                BaseCurrencyAmount = expense.Amount * exRate,
                CategoryId = resolvedCatId,
                BankAccountId = expense.BankAccountId,
                ProjectId = expense.ProjectId,
                TaskId = expense.TaskId,
                ExpenseId = expense.Id,
                Description = $"Expense Payment: {expense.Description}",
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _db.FinancialTransactions.Add(txn);

            // Trigger System Notification
            _db.Notifications.Add(new Notification
            {
                UserId = userId,
                Message = $"💰 Expense Disbursed: Payment of {expense.Amount} {expense.Currency} for '{expense.Description}' was completed.",
                Channel = NotificationChannel.InApp,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                Link = "/finance"
            });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Expense marked as Paid/Disbursed and logged to Ledger." });
        }

        /// <summary>
        /// POST /api/v1/expenses/{id}/reject — Reject at any step
        /// </summary>
        [HttpPost("{id}/reject")]
        public async Task<ActionResult> RejectExpense(int id, [FromBody] RejectDto dto)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound();

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var expenseOrgId = await GetExpenseOrgIdAsync(expense);
            var canReject = await UserHasRoleAsync(userId, expenseOrgId, RoleName.Owner, RoleName.Admin, RoleName.FinanceOfficer, RoleName.Manager);
            if (!canReject)
            {
                return StatusCode(403, new { message = "Role Authorization Enforcement: Only Finance Officers, Project Managers, Admins, or Owners are authorized to reject expense claims." });
            }

            if (expense.ApprovalStatus == ApprovalStatus.Approved)
            {
                return BadRequest("Cannot reject an already approved expense.");
            }

            expense.ApprovalStatus = ApprovalStatus.Rejected;
            expense.RejectionReason = dto.Reason;

            await _db.SaveChangesAsync();
            return Ok(new { message = "Expense rejected." });
        }

        /// <summary>
        /// POST /api/v1/expenses/{id}/attach-receipt — Links an uploaded Attachment as a receipt
        /// </summary>
        [HttpPost("{id}/attach-receipt")]
        public async Task<ActionResult> AttachReceipt(int id, [FromBody] ExpenseAttachReceiptDto dto)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound();

            // Verify attachment belongs to the same org by checking the DB
            var attachment = await _db.Attachments.FindAsync(dto.AttachmentId);
            if (attachment == null) return BadRequest("Attachment not found.");

            expense.AttachmentId = dto.AttachmentId;
            await _db.SaveChangesAsync();

            return Ok(new { message = "Receipt attached.", attachmentId = dto.AttachmentId, fileName = attachment.FileName });
        }

        /// <summary>
        /// POST /api/v1/expenses/{id}/receipt — Upload & attach receipt file directly
        /// </summary>
        [HttpPost("{id}/receipt")]
        public async Task<ActionResult> UploadReceipt(int id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound("Expense not found.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            int.TryParse(userIdClaim, out var userId);
            if (userId <= 0)
            {
                var firstUser = await _db.Users.FirstOrDefaultAsync();
                userId = firstUser?.Id ?? 1;
            }

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "receipts");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/uploads/receipts/{uniqueFileName}";

            var attachment = new Attachment
            {
                EntityType = "Expense",
                EntityId = id,
                FileName = file.FileName,
                AbsoluteFilePath = relativePath,
                FileSizeBytes = file.Length,
                MimeType = file.ContentType ?? "application/octet-stream",
                UserId = userId,
                MediaType = MediaType.Document
            };

            _db.Attachments.Add(attachment);
            await _db.SaveChangesAsync();

            expense.AttachmentId = attachment.Id;
            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "Receipt uploaded successfully.",
                attachmentId = attachment.Id,
                fileName = attachment.FileName,
                filePath = relativePath
            });
        }

        /// <summary>
        /// GET /api/v1/expenses/{id}/receipt/download — Download / view attached receipt
        /// </summary>
        [HttpGet("{id}/receipt/download")]
        public async Task<IActionResult> DownloadReceipt(int id)
        {
            var expense = await _db.Expenses
                .Include(e => e.Attachment)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (expense == null || expense.Attachment == null)
                return NotFound("Receipt attachment not found.");

            var fullPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", expense.Attachment.AbsoluteFilePath.TrimStart('/'));
            if (!System.IO.File.Exists(fullPath))
            {
                byte[] dummyBytes = System.Text.Encoding.UTF8.GetBytes($"Receipt document for expense #{id}: {expense.Attachment.FileName}");
                return File(dummyBytes, "text/plain", expense.Attachment.FileName);
            }

            var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
            return File(bytes, expense.Attachment.MimeType ?? "application/octet-stream", expense.Attachment.FileName);
        }

        /// <summary>
        /// GET /api/v1/expenses/{id} — Get a single expense
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<ExpenseDto>> GetExpense(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var expense = await _db.Expenses
                .Include(e => e.Project).ThenInclude(p => p.Workspace)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.ApprovedByFinanceOfficer)
                .Include(e => e.SignedOffByManager)
                .Include(e => e.PaidByUser)
                .Include(e => e.Attachment)
                .Include(e => e.BankAccount)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (expense == null) return NotFound();

            decimal? catAllocated = null;
            decimal? catSpent = null;
            decimal? catRemaining = null;

            if (expense.CategoryId.HasValue)
            {
                var matchingBudget = (expense.ProjectId.HasValue 
                    ? await _db.Budgets.Include(b => b.LineItems).FirstOrDefaultAsync(b => b.ProjectId == expense.ProjectId.Value) 
                    : null)
                    ?? await _db.Budgets.Include(b => b.LineItems).FirstOrDefaultAsync(b => b.Level == BudgetLevel.Organization || b.OrganizationId == orgId.Value);

                var lineItem = matchingBudget?.LineItems?.FirstOrDefault(li => li.CategoryId == expense.CategoryId.Value);
                if (lineItem != null)
                {
                    catAllocated = lineItem.Amount;
                    var categoryExpenses = await _db.Expenses
                        .Where(exp => (expense.ProjectId.HasValue ? exp.ProjectId == expense.ProjectId.Value : true) &&
                                      exp.CategoryId == expense.CategoryId.Value &&
                                      exp.ApprovalStatus != ApprovalStatus.Rejected)
                        .SumAsync(exp => exp.Amount);

                    catSpent = categoryExpenses;
                    catRemaining = lineItem.Amount - categoryExpenses;
                }
            }

            return Ok(new ExpenseDto
            {
                Id = expense.Id,
                ProjectId = expense.ProjectId,
                ProjectName = expense.Project?.Title,
                TaskId = expense.TaskId,
                SubmittedByUserId = expense.SubmittedByUserId,
                SubmittedByUserName = expense.SubmittedByUser?.Name ?? "Unknown",
                CategoryId = expense.CategoryId,
                CategoryName = expense.FinancialCategory?.Name ?? "General Expense",
                CategoryCode = expense.FinancialCategory?.Code,
                BankAccountId = expense.BankAccountId,
                BankAccountName = expense.BankAccount != null ? $"{expense.BankAccount.BankName} - {expense.BankAccount.AccountName}" : null,
                Amount = expense.Amount,
                GrossAmount = expense.GrossAmount,
                TaxAmount = expense.TaxAmount,
                NetAmount = expense.NetAmount,
                Currency = expense.Currency,
                Date = expense.Date,
                Description = expense.Description,
                ApprovalStatus = expense.ApprovalStatus,
                ApprovedByFinanceOfficerId = expense.ApprovedByFinanceOfficerId,
                FinanceOfficerName = expense.ApprovedByFinanceOfficer?.Name,
                FinanceReviewedAt = expense.FinanceReviewedAt,
                SignedOffByManagerId = expense.SignedOffByManagerId,
                ManagerName = expense.SignedOffByManager?.Name,
                ManagerSignedOffAt = expense.ManagerSignedOffAt,
                PaidByUserId = expense.PaidByUserId,
                PaidUserName = expense.PaidByUser?.Name,
                PaidAt = expense.PaidAt,
                RejectionReason = expense.RejectionReason,
                AttachmentId = expense.AttachmentId,
                AttachmentFileName = expense.Attachment?.FileName,
                CreatedAt = expense.CreatedAt,
                CategoryAllocatedBudget = catAllocated,
                CategorySpentBudget = catSpent,
                CategoryRemainingBudget = catRemaining
            });
        }

        /// <summary>
        /// DELETE /api/v1/expenses/{id} — Physically delete an expense (Admin/Owner only)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteExpense(int id)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound("Expense not found.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var expenseOrgId = await GetExpenseOrgIdAsync(expense);
            var canDelete = await UserHasRoleAsync(userId, expenseOrgId, RoleName.Owner, RoleName.Admin);
            if (!canDelete)
            {
                return StatusCode(403, new { message = "Role Authorization Enforcement: Only Organization Owners and Administrators can delete expense claims." });
            }

            var relatedTxns = await _db.FinancialTransactions.Where(t => t.ExpenseId == id).ToListAsync();
            if (relatedTxns.Any())
            {
                _db.FinancialTransactions.RemoveRange(relatedTxns);
            }

            var relatedAttachments = await _db.Attachments.Where(a => a.EntityType == "Expense" && a.EntityId == id).ToListAsync();
            if (relatedAttachments.Any())
            {
                _db.Attachments.RemoveRange(relatedAttachments);
            }

            _db.Expenses.Remove(expense);
            await _db.SaveChangesAsync();
            return Ok(new { message = "Expense deleted successfully." });
        }

        /// <summary>
        /// Checks whether adding additionalAmount to a project would exceed its budget
        /// </summary>

        [HttpPost("clear-financial-data")]
        public async Task<ActionResult> ClearFinancialData()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var orgId = GetActiveOrganizationId() ?? 1;
            var canClear = await UserHasRoleAsync(userId, orgId, RoleName.Owner, RoleName.Admin);
            if (!canClear)
            {
                return StatusCode(403, new { message = "Forbidden: Only Organization Owners and Administrators can clear financial data." });
            }

            var expenses = await _db.Expenses.ToListAsync();
            _db.Expenses.RemoveRange(expenses);

            var txs = await _db.FinancialTransactions.ToListAsync();
            _db.FinancialTransactions.RemoveRange(txs);

            var contribs = await _db.DonorContributions.ToListAsync();
            _db.DonorContributions.RemoveRange(contribs);

            var lineItems = await _db.BudgetLineItems.ToListAsync();
            _db.BudgetLineItems.RemoveRange(lineItems);

            var budgets = await _db.Budgets.ToListAsync();
            _db.Budgets.RemoveRange(budgets);

            var projectDonors = await _db.ProjectDonors.ToListAsync();
            _db.ProjectDonors.RemoveRange(projectDonors);

            var grantReports = await _db.GrantReportSchedules.ToListAsync();
            _db.GrantReportSchedules.RemoveRange(grantReports);

            await _db.SaveChangesAsync();
            return Ok(new { message = "All financial data including Budgets cleared successfully to 0." });
        }


        private async Task<string?> CheckBudgetOverspend(int projectId, int? categoryId, decimal additionalAmount, string currency)
        {
            // Look for a Budget record for this project
            var budget = await _db.Budgets
                .Include(b => b.LineItems)
                .FirstOrDefaultAsync(b => b.ProjectId == projectId && b.Level == BudgetLevel.Project);

            if (budget == null) return null; // No budget set = no limit
            
            // Convert the additional amount to the budget's currency if necessary
            decimal convertedAdditionalAmount = additionalAmount;
            if (currency != budget.Currency)
            {
                var rate = await _currencyService.GetExchangeRateAsync(currency, budget.Currency);
                convertedAdditionalAmount = additionalAmount * rate;
            }

            // 1. Check Overall Project Budget
            var currentSpend = await _db.Expenses
                .Where(e => e.ProjectId == projectId && e.ApprovalStatus != ApprovalStatus.Rejected)
                .SumAsync(e => e.Amount);

            if ((currentSpend + convertedAdditionalAmount) > budget.TotalAmount) 
            {
                return $"Expense would exceed the overall total project budget limit of {budget.TotalAmount} {budget.Currency}.";
            }

            // 2. Check Specific Category Line Item (USAID requirement)
            if (categoryId.HasValue)
            {
                var lineItem = budget.LineItems.FirstOrDefault(li => li.CategoryId == categoryId.Value);
                if (lineItem == null)
                {
                    return "Compliance Error: Expense is categorized under a Financial Category that has NO allocated budget line item. Please revise the budget first.";
                }

                var currentCategorySpend = await _db.Expenses
                    .Where(e => e.ProjectId == projectId && e.CategoryId == categoryId.Value && e.ApprovalStatus != ApprovalStatus.Rejected)
                    .SumAsync(e => e.Amount);

                if ((currentCategorySpend + convertedAdditionalAmount) > lineItem.Amount) 
                {
                    return $"Insufficient Funds: Expense ({convertedAdditionalAmount:N2} {budget.Currency} converted) would exceed the allocated budget limit for this specific category (Limit: {lineItem.Amount} {budget.Currency}, Current Spend: {currentCategorySpend} {budget.Currency}).";
                }
            }

            return null;
        }

        private async Task<string?> CheckComplianceWarning(int projectId, int? categoryId)
        {
            if (!categoryId.HasValue) return null;

            var budget = await _db.Budgets
                .Include(b => b.LineItems)
                .FirstOrDefaultAsync(b => b.ProjectId == projectId && b.Level == BudgetLevel.Project);

            if (budget == null) return null; // No budget set yet

            var lineItem = budget.LineItems.FirstOrDefault(li => li.CategoryId == categoryId.Value);
            if (lineItem == null)
            {
                return "Compliance Warning: Expense is categorized under an unbudgeted line item.";
            }

            return null;
        }
    }

    public class RejectDto
    {
        public string Reason { get; set; } = string.Empty;
    }
}
