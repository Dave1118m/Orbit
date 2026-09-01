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

using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing organizational bank accounts, treasury balances,
    /// account number validations, inter-account transfers, and unified transaction ledgers.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class BankAccountsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly ICurrencyService _currencyService;

        public BankAccountsController(OrbitDbContext db, ICurrencyService currencyService)
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

        private string ValidateEthiopianBankAccount(string bankName, string accountNumber)
        {
            if (string.IsNullOrWhiteSpace(accountNumber)) return "Account number is required.";
            if (!accountNumber.All(char.IsDigit)) return "Account number must contain only digits.";

            if (accountNumber.Length < 6 || accountNumber.Length > 20)
            {
                return "Bank account numbers must be between 6 and 20 digits.";
            }

            return null;
        }

        private async Task<BankAccountDto> MapToDtoAsync(BankAccount b)
        {
            var baseCurrency = b.Currency; // Bank accounts have their own base currency for their own balances
            
            decimal totalReceived = 0;
            foreach (var c in b.Contributions.Where(x => x.Status == ContributionStatus.Received))
            {
                totalReceived += await _currencyService.ConvertAsync(c.Amount, c.Currency, baseCurrency);
            }

            decimal totalExpended = 0;
            foreach (var e in b.Expenses.Where(x => x.ApprovalStatus == ApprovalStatus.Paid))
            {
                totalExpended += await _currencyService.ConvertAsync(e.Amount, e.Currency, baseCurrency);
            }

            return new BankAccountDto
            {
                Id = b.Id,
                OrganizationId = b.OrganizationId,
                BankName = b.BankName,
                AccountName = b.AccountName,
                AccountNumber = b.AccountNumber,
                Currency = b.Currency,
                IsActive = b.IsActive,
                TotalReceived = totalReceived,
                TotalExpended = totalExpended,
                CurrentBalance = totalReceived - totalExpended
            };
        }

        /// <summary>
        /// Retrieves all bank accounts for the active organization with real-time balance calculations.
        /// </summary>
        /// <returns>Collection of bank account DTOs.</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<BankAccountDto>>> GetBankAccounts()
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var accounts = await _db.BankAccounts
                .Where(b => b.OrganizationId == orgId.Value)
                .Include(b => b.Contributions)
                .Include(b => b.Expenses)
                .ToListAsync();

            var dtos = new List<BankAccountDto>();
            foreach (var a in accounts)
            {
                dtos.Add(await MapToDtoAsync(a));
            }

            return Ok(dtos);
        }

        /// <summary>
        /// Retrieves a single bank account by ID with current balance metrics.
        /// </summary>
        /// <param name="id">Bank account ID.</param>
        /// <returns>Bank account DTO.</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<BankAccountDto>> GetBankAccount(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var account = await _db.BankAccounts
                .Where(b => b.OrganizationId == orgId.Value)
                .Include(b => b.Contributions)
                .Include(b => b.Expenses)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (account == null) return NotFound();

            return Ok(await MapToDtoAsync(account));
        }

        /// <summary>
        /// Registers a new bank account for the organization with format validation.
        /// </summary>
        /// <param name="dto">Bank account creation payload.</param>
        /// <returns>Created bank account DTO.</returns>
        [HttpPost]
        public async Task<ActionResult<BankAccountDto>> CreateBankAccount(BankAccountCreateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest(new { message = "Organization context is required." });

            var bankName = dto.BankName.Trim();
            var accountName = dto.AccountName.Trim();
            var accountNumber = dto.AccountNumber.Trim();
            var currency = string.IsNullOrWhiteSpace(dto.Currency) ? "USD" : dto.Currency.Trim().ToUpper();

            // Duplicate Account Number Validation
            var isDuplicate = await _db.BankAccounts
                .AnyAsync(b => b.OrganizationId == orgId.Value && b.AccountNumber.ToLower() == accountNumber.ToLower());
            if (isDuplicate)
            {
                return BadRequest(new { message = $"A bank account with number '{accountNumber}' already exists in your organization." });
            }

            var validationError = ValidateEthiopianBankAccount(bankName, accountNumber);
            if (validationError != null)
            {
                return BadRequest(new { message = validationError });
            }

            var account = new BankAccount
            {
                OrganizationId = orgId.Value,
                BankName = bankName,
                AccountName = accountName,
                AccountNumber = accountNumber,
                Currency = currency,
                IsActive = true
            };

            _db.BankAccounts.Add(account);
            await _db.SaveChangesAsync();

            var created = await _db.BankAccounts
                .Where(b => b.Id == account.Id)
                .Include(b => b.Contributions)
                .Include(b => b.Expenses)
                .FirstAsync();

            return Ok(await MapToDtoAsync(created));
        }

        /// <summary>
        /// Updates bank account details or active status.
        /// </summary>
        /// <param name="id">Bank account ID.</param>
        /// <param name="dto">Updated fields.</param>
        /// <returns>NoContent on success.</returns>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBankAccount(int id, BankAccountUpdateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest(new { message = "Organization context is required." });

            var account = await _db.BankAccounts
                .Where(b => b.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (account == null) return NotFound(new { message = "Bank account not found." });

            var accountNumber = dto.AccountNumber.Trim();

            // Duplicate Account Number Validation
            var isDuplicate = await _db.BankAccounts
                .AnyAsync(b => b.OrganizationId == orgId.Value && b.Id != id && b.AccountNumber.ToLower() == accountNumber.ToLower());
            if (isDuplicate)
            {
                return BadRequest(new { message = $"Another bank account with number '{accountNumber}' already exists in your organization." });
            }

            var bankName = dto.BankName.Trim();
            var validationError = ValidateEthiopianBankAccount(bankName, accountNumber);
            if (validationError != null)
            {
                return BadRequest(new { message = validationError });
            }

            account.BankName = dto.BankName.Trim();
            account.AccountName = dto.AccountName.Trim();
            account.AccountNumber = accountNumber;
            account.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "USD" : dto.Currency.Trim().ToUpper();
            account.IsActive = dto.IsActive;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Deletes a bank account and unlinks dependent transactions.
        /// </summary>
        /// <param name="id">Bank account ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBankAccount(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var account = await _db.BankAccounts
                .Where(b => b.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(b => b.Id == id);

            if (account == null) return NotFound();

            // Unlink related contributions and expenses to avoid FK constraint failure
            var contributions = await _db.DonorContributions.Where(c => c.BankAccountId == id).ToListAsync();
            foreach (var c in contributions) c.BankAccountId = null;

            var expenses = await _db.Expenses.Where(e => e.BankAccountId == id).ToListAsync();
            foreach (var e in expenses) e.BankAccountId = null;

            _db.BankAccounts.Remove(account);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Inter-account fund transfer between internal bank accounts
        /// </summary>
        [HttpPost("transfer")]
        public async Task<ActionResult> TransferFunds([FromBody] BankTransferDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var fromAccount = await _db.BankAccounts.FirstOrDefaultAsync(b => b.Id == dto.FromBankAccountId && b.OrganizationId == orgId.Value);
            var toAccount = await _db.BankAccounts.FirstOrDefaultAsync(b => b.Id == dto.ToBankAccountId && b.OrganizationId == orgId.Value);

            if (fromAccount == null || toAccount == null) return BadRequest("Source or target bank account not found.");
            if (fromAccount.Id == toAccount.Id) return BadRequest("Source and target bank accounts must be different.");

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
            int.TryParse(userIdClaim, out var userId);
            if (userId <= 0)
            {
                var validMember = await _db.OrganizationMembers.FirstOrDefaultAsync(m => m.OrganizationId == orgId.Value);
                userId = validMember?.UserId ?? (await _db.Users.FirstOrDefaultAsync())?.Id ?? 1;
            }

            var receivedAmount = dto.TransferAmount * (dto.ExchangeRate > 0 ? dto.ExchangeRate : 1.0m);

            try
            {
                // 1. Create withdrawal expense on source account
                var withdrawalExpense = new Expense
                {
                    BankAccountId = fromAccount.Id,
                    SubmittedByUserId = userId,
                    Amount = dto.TransferAmount,
                    Currency = fromAccount.Currency,
                    Date = DateTime.UtcNow,
                    Description = $"Inter-account transfer to {toAccount.BankName} ({toAccount.AccountName}). {dto.Description}".Trim(),
                    ApprovalStatus = ApprovalStatus.Paid,
                    PaidAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                // 2. Create deposit contribution on target account
                var firstDonor = await _db.Donors.FirstOrDefaultAsync(d => d.OrganizationId == orgId.Value);
                if (firstDonor == null)
                {
                    firstDonor = new Donor
                    {
                        OrganizationId = orgId.Value,
                        Name = "Internal Account Transfer",
                        DonorType = DonorType.Corporate,
                        Country = "Internal"
                    };
                    _db.Donors.Add(firstDonor);
                    await _db.SaveChangesAsync();
                }

                var depositContribution = new DonorContribution
                {
                    DonorId = firstDonor.Id,
                    BankAccountId = toAccount.Id,
                    Amount = receivedAmount,
                    Currency = toAccount.Currency,
                    Date = DateTime.UtcNow,
                    Type = ContributionType.Cash,
                    Status = ContributionStatus.Received,
                    Notes = $"Inter-account transfer received from {fromAccount.BankName} ({fromAccount.AccountName}). {dto.Description}".Trim()
                };

                _db.Expenses.Add(withdrawalExpense);
                _db.DonorContributions.Add(depositContribution);
                await _db.SaveChangesAsync();

                return Ok(new
                {
                    message = "Transfer completed successfully.",
                    transferredAmount = dto.TransferAmount,
                    fromCurrency = fromAccount.Currency,
                    receivedAmount = receivedAmount,
                    toCurrency = toAccount.Currency
                });
            }
            catch (Exception ex)
            {
                return BadRequest($"Transfer failed: {ex.InnerException?.Message ?? ex.Message}");
            }
        }

        /// <summary>
        /// Returns a unified chronological transaction ledger for a specific bank account.
        /// Deposits = received contributions; Withdrawals = paid/approved expenses.
        /// </summary>
        [HttpGet("{id}/transactions")]
        public async Task<ActionResult<IEnumerable<BankAccountTransactionDto>>> GetTransactions(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var accountExists = await _db.BankAccounts
                .AnyAsync(b => b.Id == id && b.OrganizationId == orgId.Value);

            if (!accountExists) return NotFound();

            var deposits = await _db.DonorContributions
                .Where(c => c.BankAccountId == id && c.Status == ContributionStatus.Received)
                .Include(c => c.Donor)
                .Include(c => c.AllocatedProject)
                .ToListAsync();

            var withdrawals = await _db.Expenses
                .Where(e => e.BankAccountId == id && (e.ApprovalStatus == ApprovalStatus.Approved || e.ApprovalStatus == ApprovalStatus.Paid))
                .Include(e => e.Project)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.FinancialCategory)
                .ToListAsync();

            var transactions = new List<BankAccountTransactionDto>();

            foreach (var dep in deposits)
            {
                transactions.Add(new BankAccountTransactionDto
                {
                    Type = "Deposit",
                    Amount = dep.Amount,
                    Currency = dep.Currency,
                    Date = dep.Date,
                    Description = dep.Notes ?? "Donor contribution received",
                    DonorName = dep.Donor?.Name,
                    ProjectName = dep.AllocatedProject?.Title,
                    ExpenseCategory = null,
                    Status = "Received"
                });
            }

            foreach (var exp in withdrawals)
            {
                transactions.Add(new BankAccountTransactionDto
                {
                    Type = "Withdrawal",
                    Amount = exp.Amount,
                    Currency = exp.Currency,
                    Date = exp.Date,
                    Description = exp.Description,
                    DonorName = null,
                    ProjectName = exp.Project?.Title,
                    ExpenseCategory = exp.FinancialCategory?.Name ?? "General Expense",
                    Status = exp.ApprovalStatus == ApprovalStatus.Paid ? "Paid" : "Approved"
                });
            }

            var sorted = transactions.OrderByDescending(t => t.Date).ToList();
            return Ok(sorted);
        }
    }

    public class BankTransferDto
    {
        public int FromBankAccountId { get; set; }
        public int ToBankAccountId { get; set; }
        public decimal TransferAmount { get; set; }
        public decimal ExchangeRate { get; set; } = 1.0m;
        public string? Description { get; set; }
    }
}
