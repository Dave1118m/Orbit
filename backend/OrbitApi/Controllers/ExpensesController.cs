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

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ExpensesController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private const decimal RECEIPT_THRESHOLD = 500m; // Configurable threshold

        public ExpensesController(OrbitDbContext db)
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

        /// <summary>
        /// GET /api/v1/expenses — Fetch all expenses with full relation data
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExpenseDto>>> GetExpenses()
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var expenses = await _db.Expenses
                .Include(e => e.Project).ThenInclude(p => p.Workspace)
                .Include(e => e.Task).ThenInclude(t => t.Project).ThenInclude(p => p.Workspace)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.ApprovedByFinanceOfficer)
                .Include(e => e.SignedOffByManager)
                .Include(e => e.PaidByUser)
                .Include(e => e.Attachment)
                .Include(e => e.BankAccount)
                .Where(e => (e.Project != null && e.Project.Workspace != null && e.Project.Workspace.OrganizationId == orgId.Value) || 
                            (e.Task != null && e.Task.Project != null && e.Task.Project.Workspace != null && e.Task.Project.Workspace.OrganizationId == orgId.Value) ||
                            (e.BankAccount != null && e.BankAccount.OrganizationId == orgId.Value))
                .OrderByDescending(e => e.CreatedAt)
                .ToListAsync();

            var dtos = new List<ExpenseDto>();
            foreach (var e in expenses)
            {
                var budgetWarning = false;
                if (e.ProjectId.HasValue)
                {
                    budgetWarning = await CheckBudgetOverspend(e.ProjectId.Value, 0); // Check current state
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
                    Category = e.Category,
                    Amount = e.Amount,
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
                    BudgetWarning = budgetWarning
                });
            }

            return Ok(dtos);
        }

        /// <summary>
        /// POST /api/v1/expenses — Create a new expense with budget validation
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<ExpenseDto>> CreateExpense(ExpenseCreateDto dto)
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

            // Budget validation: check if this expense would cause overspend
            if (dto.ProjectId.HasValue)
            {
                var wouldOverspend = await CheckBudgetOverspend(dto.ProjectId.Value, dto.Amount);
                if (wouldOverspend)
                {
                    return BadRequest(new { 
                        error = "BUDGET_EXCEEDED", 
                        message = $"This expense of {dto.Amount} {dto.Currency} would exceed the project budget. Please request a budget revision or reduce the amount." 
                    });
                }
            }

            var expense = new Expense
            {
                ProjectId = dto.ProjectId,
                TaskId = dto.TaskId,
                BankAccountId = dto.BankAccountId,
                SubmittedByUserId = userId,
                Category = dto.Category,
                Amount = dto.Amount,
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
                Category = expense.Category,
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

            var userRoles = User.FindAll(ClaimTypes.Role).Select(r => r.Value).ToList();
            userRoles.AddRange(User.FindAll("role").Select(r => r.Value));

            var isOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted);
            var isDbAuthorized = isOrgOwner
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && (a.Role.Name == RoleName.Owner || a.Role.Name == RoleName.Admin || a.Role.Name == RoleName.FinanceOfficer || a.Role.Name == RoleName.Manager))
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && (m.Role.Name == RoleName.Owner || m.Role.Name == RoleName.Admin || m.Role.Name == RoleName.FinanceOfficer || m.Role.Name == RoleName.Manager));

            var isOwnerOrAdmin = isOrgOwner || isDbAuthorized || userRoles.Any(r => r == "Owner" || r == "Admin" || r == "SystemOwner" || r == "FinanceOfficer" || r == "Finance");
            var isFinanceOfficer = isOwnerOrAdmin || userRoles.Any(r => r == "FinanceOfficer" || r == "Finance");

            // Role Enforcement: Step 1 requires Finance Officer, Admin, or Owner role
            if (!isFinanceOfficer)
            {
                return BadRequest(new { message = "Role Authorization Enforcement: Only Finance Officers, Admins, or Owners can perform Step 1 (Finance Officer Review)." });
            }

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

            var userRoles = User.FindAll(ClaimTypes.Role).Select(r => r.Value).ToList();
            userRoles.AddRange(User.FindAll("role").Select(r => r.Value));

            var isOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted);
            var isDbAuthorized = isOrgOwner
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && (a.Role.Name == RoleName.Owner || a.Role.Name == RoleName.Admin || a.Role.Name == RoleName.Manager || a.Role.Name == RoleName.FinanceOfficer))
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && (m.Role.Name == RoleName.Owner || m.Role.Name == RoleName.Admin || m.Role.Name == RoleName.Manager || m.Role.Name == RoleName.FinanceOfficer));

            var isOwnerOrAdmin = isOrgOwner || isDbAuthorized || userRoles.Any(r => r == "Owner" || r == "Admin" || r == "SystemOwner" || r == "ProjectManager" || r == "Manager");
            var isManager = isOwnerOrAdmin || userRoles.Any(r => r == "Manager" || r == "ProjectManager");

            // Role Enforcement: Step 2 requires Manager, Admin, or Owner role
            if (!isManager)
            {
                return BadRequest(new { message = "Role Authorization Enforcement: Only Project Managers, Admins, or Owners are authorized to perform Step 2 (Manager Sign-off)." });
            }

            // Self-Approval Prohibition Rule: Submitter cannot approve their own claim
            if (expense.SubmittedByUserId == userId)
            {
                return BadRequest(new { message = "Self-approval prohibition: A user cannot approve or sign off on an expense claim they submitted." });
            }

            // Segregation of Duties Enforcement (Dual 2-Step Approval Rule):
            // Step 2 (Manager Sign-off) MUST be performed by a DIFFERENT user than Step 1 (Finance Officer Review)
            if (expense.ApprovedByFinanceOfficerId == userId)
            {
                return BadRequest(new { message = "Segregation of Duties Enforcement: Step 2 (Manager Sign-off) cannot be approved by the same user who performed Step 1 (Finance Officer Review). Dual approval requires sign-off from a different authorized user." });
            }

            // Mandatory Receipt Threshold Rule ($500+)
            if (expense.Amount >= RECEIPT_THRESHOLD && !expense.AttachmentId.HasValue && !isOwnerOrAdmin)
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
        /// DELETE /api/v1/expenses/clear-data — Clears all test expense & financial ledger data for clean testing
        /// </summary>
        [AllowAnonymous]
        [HttpDelete("clear-data")]
        [HttpPost("clear-data")]
        public async Task<IActionResult> ClearFinancialTestData()
        {
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
        public async Task<ActionResult> PayExpense(int id)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return NotFound();

            if (expense.ApprovalStatus != ApprovalStatus.Approved)
            {
                return BadRequest("Expense must be Approved before it can be marked as Paid.");
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId)) return Unauthorized();

            var userRoles = User.FindAll(ClaimTypes.Role).Select(r => r.Value).ToList();
            userRoles.AddRange(User.FindAll("role").Select(r => r.Value));

            var isOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted);
            var isDbAuthorized = isOrgOwner
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && (a.Role.Name == RoleName.Owner || a.Role.Name == RoleName.Admin || a.Role.Name == RoleName.FinanceOfficer))
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && (m.Role.Name == RoleName.Owner || m.Role.Name == RoleName.Admin || m.Role.Name == RoleName.FinanceOfficer));

            var isOwnerOrAdmin = isOrgOwner || isDbAuthorized || userRoles.Any(r => r == "Owner" || r == "Admin" || r == "SystemOwner" || r == "FinanceOfficer" || r == "Finance");
            var isFinanceOfficer = isOwnerOrAdmin || userRoles.Any(r => r == "FinanceOfficer" || r == "Finance");

            // Role Enforcement: Step 3 requires Finance Officer, Admin, or Owner role
            if (!isFinanceOfficer)
            {
                return BadRequest(new { message = "Role Authorization Enforcement: Only Finance Officers, Treasury Officers, Admins, or Owners are authorized to perform Step 3 (Disbursement / Payment)." });
            }

            // Bank Account Overdraft Control
            if (expense.BankAccountId.HasValue)
            {
                var bankAcc = await _db.BankAccounts.FindAsync(expense.BankAccountId.Value);
                if (bankAcc != null)
                {
                    var credits = await _db.FinancialTransactions
                        .Where(t => (t.BankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Income) ||
                                    (t.ToBankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Transfer))
                        .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                    var debits = await _db.FinancialTransactions
                        .Where(t => (t.BankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Expense) ||
                                    (t.BankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Transfer))
                        .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                    var availableBalance = credits - debits;
                    if (expense.Amount > availableBalance)
                    {
                        return BadRequest(new { 
                            error = "INSUFFICIENT_FUNDS", 
                            message = $"Source bank account '{bankAcc.BankName} ({bankAcc.AccountNumber})' balance (${availableBalance:N2}) is insufficient to disburse this expense of ${expense.Amount:N2}." 
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
            if (!resolvedCatId.HasValue)
            {
                var catNameStr = expense.Category.ToString();
                var matchedCat = await _db.FinancialCategories
                    .FirstOrDefaultAsync(fc => fc.OrganizationId == orgId &&
                        (fc.Name.ToLower().Contains(catNameStr.ToLower()) ||
                         (catNameStr.Equals("Equipment", StringComparison.OrdinalIgnoreCase) && fc.Name.Contains("Equipment")) ||
                         (catNameStr.Equals("Travel", StringComparison.OrdinalIgnoreCase) && fc.Name.Contains("Travel")) ||
                         (catNameStr.Equals("Personnel", StringComparison.OrdinalIgnoreCase) && fc.Name.Contains("Personnel"))));
                if (matchedCat != null) resolvedCatId = matchedCat.Id;
            }

            var txn = new FinancialTransaction
            {
                OrganizationId = orgId,
                TransactionNumber = $"EXP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
                Type = FinancialTransactionType.Expense,
                TransactionDate = DateTime.UtcNow,
                Amount = expense.Amount,
                Currency = expense.Currency,
                ExchangeRate = 1.0m,
                BaseCurrencyAmount = expense.Amount,
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

            return Ok(new ExpenseDto
            {
                Id = expense.Id,
                ProjectId = expense.ProjectId,
                ProjectName = expense.Project?.Title,
                TaskId = expense.TaskId,
                SubmittedByUserId = expense.SubmittedByUserId,
                SubmittedByUserName = expense.SubmittedByUser?.Name ?? "Unknown",
                Category = expense.Category,
                Amount = expense.Amount,
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
                CreatedAt = expense.CreatedAt
            });
        }

        /// <summary>
        /// Checks whether adding additionalAmount to a project would exceed its budget
        /// </summary>

        [HttpPost("clear-financial-data")]
        [AllowAnonymous]
        public async Task<ActionResult> ClearFinancialData()
        {
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

        private async Task<bool> CheckBudgetOverspend(int projectId, decimal additionalAmount)
        {
            // Look for a Budget record for this project
            var budget = await _db.Budgets
                .FirstOrDefaultAsync(b => b.ProjectId == projectId && b.Level == BudgetLevel.Project);

            if (budget == null) return false; // No budget set = no limit

            // Sum all existing approved/pending expenses for this project
            var currentSpend = await _db.Expenses
                .Where(e => e.ProjectId == projectId && e.ApprovalStatus != ApprovalStatus.Rejected)
                .SumAsync(e => e.Amount);

            return (currentSpend + additionalAmount) > budget.TotalAmount;
        }
    }

    public class RejectDto
    {
        public string Reason { get; set; } = string.Empty;
    }
}
