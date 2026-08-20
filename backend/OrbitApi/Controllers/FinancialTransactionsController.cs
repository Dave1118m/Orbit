using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers;

/// <summary>
/// Double-entry bookkeeping and financial ledger controller managing transaction journals,
/// cash-flow summaries, bank reconciliations, multi-currency conversions, and audit ledger exports.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Route("api/[controller]")]
[Authorize]
public class FinancialTransactionsController : ControllerBase
{
    private readonly OrbitDbContext _context;
    private readonly ICurrencyService _currencyService;

    public FinancialTransactionsController(OrbitDbContext context, ICurrencyService currencyService)
    {
        _context = context;
        _currencyService = currencyService;
    }

    /// <summary>
    /// Gets all financial transactions for an organization with rich filtering and pagination.
    /// </summary>
    [HttpGet("organization/{orgId}")]
    public async Task<IActionResult> GetByOrganization(
        int orgId,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] int? bankAccountId = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] int? projectId = null,
        [FromQuery] FinancialTransactionType? type = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == orgId && !o.IsDeleted);
        if (org == null)
        {
            org = await _context.Organizations.FirstOrDefaultAsync(o => !o.IsDeleted);
            if (org == null)
                return Ok(new PagedResultDto<FinancialTransactionDto> { Items = new List<FinancialTransactionDto>(), TotalCount = 0 });
            orgId = org.Id;
        }

        var query = _context.FinancialTransactions
            .Where(t => t.OrganizationId == orgId);

        if (dateFrom.HasValue)
            query = query.Where(t => t.TransactionDate >= dateFrom.Value);

        if (dateTo.HasValue)
            query = query.Where(t => t.TransactionDate <= dateTo.Value);

        if (bankAccountId.HasValue)
            query = query.Where(t => t.BankAccountId == bankAccountId.Value || t.ToBankAccountId == bankAccountId.Value);

        if (categoryId.HasValue)
            query = query.Where(t => t.CategoryId == categoryId.Value);

        if (projectId.HasValue)
            query = query.Where(t => t.ProjectId == projectId.Value);

        if (type.HasValue)
            query = query.Where(t => t.Type == type.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            query = query.Where(t =>
                t.TransactionNumber.ToLower().Contains(searchLower) ||
                t.Description.ToLower().Contains(searchLower) ||
                (t.PayeeOrPayer != null && t.PayeeOrPayer.ToLower().Contains(searchLower)) ||
                (t.ReferenceNumber != null && t.ReferenceNumber.ToLower().Contains(searchLower)));
        }

        var totalCount = await query.CountAsync();

        var dbTransactions = await query
            .Include(t => t.Category)
            .Include(t => t.BankAccount)
            .Include(t => t.ToBankAccount)
            .Include(t => t.Project)
            .Include(t => t.CreatedByUser)
            .OrderByDescending(t => t.TransactionDate)
            .ThenByDescending(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var transactions = new List<FinancialTransactionDto>();
        foreach (var t in dbTransactions)
        {
            var dto = new FinancialTransactionDto
            {
                Id = t.Id,
                OrganizationId = t.OrganizationId,
                TransactionNumber = t.TransactionNumber,
                Type = t.Type,
                TransactionDate = t.TransactionDate,
                Amount = t.Amount,
                Currency = t.Currency,
                ExchangeRate = t.ExchangeRate,
                BaseCurrencyAmount = await _currencyService.ConvertAsync(t.Amount, t.Currency, "USD"),
                CategoryId = t.CategoryId,
                CategoryName = t.Category != null ? t.Category.Name : null,
                CategoryColor = t.Category != null ? t.Category.Color : null,
                BankAccountId = t.BankAccountId,
                BankAccountName = t.BankAccount != null ? $"{t.BankAccount.BankName} ({t.BankAccount.AccountNumber})" : null,
                ToBankAccountId = t.ToBankAccountId,
                ToBankAccountName = t.ToBankAccount != null ? $"{t.ToBankAccount.BankName} ({t.ToBankAccount.AccountNumber})" : null,
                ProjectId = t.ProjectId,
                ProjectTitle = t.Project != null ? t.Project.Title : null,
                TaskId = t.TaskId,
                ExpenseId = t.ExpenseId,
                DonorContributionId = t.DonorContributionId,
                PayeeOrPayer = t.PayeeOrPayer,
                Description = t.Description,
                ReferenceNumber = t.ReferenceNumber,
                CreatedByUserId = t.CreatedByUserId,
                CreatedByUserName = t.CreatedByUser != null ? t.CreatedByUser.Name : null,
                CreatedAt = t.CreatedAt
            };
            transactions.Add(dto);
        }

        return Ok(new
        {
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
            items = transactions
        });
    }

    /// <summary>
    /// Gets executive summary of financial health: Total Income, Total Expenses, Net Flow, and Bank Account Balances.
    /// </summary>
    [HttpGet("organization/{orgId}/summary")]
    public async Task<IActionResult> GetSummary(int orgId)
    {
        var org = await _context.Organizations.FirstOrDefaultAsync(o => o.Id == orgId && !o.IsDeleted);
        if (org == null)
        {
            org = await _context.Organizations.FirstOrDefaultAsync(o => !o.IsDeleted);
            if (org == null)
                return Ok(new FinancialSummaryDto { TotalIncome = 0, TotalExpenses = 0, NetCashFlow = 0, BankAccounts = new List<BankAccountBalanceDto>() });
            orgId = org.Id;
        }

        var transactions = await _context.FinancialTransactions
            .Where(t => t.OrganizationId == orgId)
            .ToListAsync();

        var totalIncome = 0m;
        foreach (var t in transactions.Where(t => t.Type == FinancialTransactionType.Income))
        {
            totalIncome += await _currencyService.ConvertAsync(t.Amount, t.Currency, "USD");
        }

        var totalExpensesFromTx = 0m;
        foreach (var t in transactions.Where(t => t.Type == FinancialTransactionType.Expense))
        {
            totalExpensesFromTx += await _currencyService.ConvertAsync(t.Amount, t.Currency, "USD");
        }

        var dbExpenses = await _context.Expenses
            .Include(e => e.Project).ThenInclude(p => p.Workspace)
            .Include(e => e.BankAccount)
            .Where(e => (e.Project != null && e.Project.Workspace != null && e.Project.Workspace.OrganizationId == orgId) ||
                        (e.BankAccount != null && e.BankAccount.OrganizationId == orgId))
            .ToListAsync();

        var unlinkedExpenseSum = 0m;
        foreach (var e in dbExpenses.Where(e => !transactions.Any(t => t.ExpenseId == e.Id)))
        {
            unlinkedExpenseSum += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
        }

        var totalExpenses = totalExpensesFromTx + unlinkedExpenseSum;
        if (totalExpenses == 0 && dbExpenses.Any())
        {
            totalExpenses = 0m;
            foreach (var e in dbExpenses)
            {
                totalExpenses += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
            }
        }

        var netCashFlow = totalIncome - totalExpenses;

        var bankAccounts = await _context.BankAccounts
            .Where(b => b.OrganizationId == orgId && b.IsActive)
            .ToListAsync();

        var bankSummary = new List<BankAccountBalanceDto>();

        foreach (var acc in bankAccounts)
        {
            var credits = 0m;
            foreach (var t in transactions.Where(t => (t.BankAccountId == acc.Id && t.Type == FinancialTransactionType.Income) ||
                                                      (t.ToBankAccountId == acc.Id && t.Type == FinancialTransactionType.Transfer)))
            {
                credits += await _currencyService.ConvertAsync(t.Amount, t.Currency, acc.Currency);
            }

            var debits = 0m;
            foreach (var t in transactions.Where(t => (t.BankAccountId == acc.Id && t.Type == FinancialTransactionType.Expense) ||
                                                      (t.BankAccountId == acc.Id && t.Type == FinancialTransactionType.Transfer)))
            {
                debits += await _currencyService.ConvertAsync(t.Amount, t.Currency, acc.Currency);
            }

            var unlinkedExpenses = 0m;
            foreach (var e in dbExpenses.Where(e => e.BankAccountId == acc.Id && !transactions.Any(t => t.ExpenseId == e.Id)))
            {
                unlinkedExpenses += await _currencyService.ConvertAsync(e.Amount, e.Currency, acc.Currency);
            }

            var calculatedBalance = credits - (debits + unlinkedExpenses);

            bankSummary.Add(new BankAccountBalanceDto
            {
                Id = acc.Id,
                BankName = acc.BankName,
                AccountName = acc.AccountName,
                AccountNumber = acc.AccountNumber,
                Currency = acc.Currency,
                CalculatedBalance = calculatedBalance
            });
        }

        return Ok(new FinancialSummaryDto
        {
            TotalIncome = totalIncome,
            TotalExpenses = totalExpenses,
            NetCashFlow = netCashFlow,
            TotalTransactionsCount = transactions.Count,
            BankAccounts = bankSummary
        });
    }

    /// <summary>
    /// Executes an inter-account bank transfer with strict financial validation.
    /// </summary>
    [HttpPost("transfer")]
    public async Task<IActionResult> ExecuteTransfer([FromBody] FinancialBankTransferDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (dto.Amount <= 0)
            return BadRequest(new { message = "Transfer amount must be strictly greater than zero ($0.01 or more)." });

        if (dto.ExchangeRate <= 0 || dto.ExchangeRate > 10000m || dto.ExchangeRate < 0.0001m)
            return BadRequest(new { message = "Exchange rate must be between 0.0001 and 10,000." });

        if (dto.FromBankAccountId == dto.ToBankAccountId)
            return BadRequest(new { message = "Source and target bank accounts cannot be identical." });

        // Date Validation Rules
        var utcTransferDate = dto.TransactionDate.Kind == DateTimeKind.Unspecified 
            ? DateTime.SpecifyKind(dto.TransactionDate, DateTimeKind.Utc) 
            : dto.TransactionDate.ToUniversalTime();

        if (utcTransferDate.Year < 2000)
        {
            return BadRequest(new { message = "Transfer execution date cannot be prior to year 2000." });
        }

        if (utcTransferDate.Date > DateTime.UtcNow.Date)
        {
            return BadRequest(new { message = "Bank transfer execution date cannot be in the future." });
        }

        // Closed Fiscal Period Validation
        var compliance = await _context.OrganizationCompliances.FirstOrDefaultAsync(c => c.OrganizationId == dto.OrganizationId);
        if (compliance?.ClosedPeriodEndDate != null && utcTransferDate.Date <= compliance.ClosedPeriodEndDate.Value.Date)
        {
            return BadRequest(new { message = $"Transfer execution date ({utcTransferDate:yyyy-MM-dd}) falls into a closed fiscal period (Closed through {compliance.ClosedPeriodEndDate.Value:yyyy-MM-dd})." });
        }

        var fromAcc = await _context.BankAccounts
            .FirstOrDefaultAsync(b => b.Id == dto.FromBankAccountId && b.OrganizationId == dto.OrganizationId);
        var toAcc = await _context.BankAccounts
            .FirstOrDefaultAsync(b => b.Id == dto.ToBankAccountId && b.OrganizationId == dto.OrganizationId);

        if (fromAcc == null)
            return BadRequest(new { message = "Source bank account not found or does not belong to your organization." });

        if (toAcc == null)
            return BadRequest(new { message = "Target bank account not found or does not belong to your organization." });

        if (!fromAcc.IsActive || !toAcc.IsActive)
            return BadRequest(new { message = "Both source and target bank accounts must be active to execute a transfer." });

        // Bank Account Overdraft Control
        var credits = await _context.FinancialTransactions
            .Where(t => (t.BankAccountId == fromAcc.Id && t.Type == FinancialTransactionType.Income) ||
                        (t.ToBankAccountId == fromAcc.Id && t.Type == FinancialTransactionType.Transfer))
            .SumAsync(t => (decimal?)t.Amount) ?? 0m;

        var debits = await _context.FinancialTransactions
            .Where(t => (t.BankAccountId == fromAcc.Id && t.Type == FinancialTransactionType.Expense) ||
                        (t.BankAccountId == fromAcc.Id && t.Type == FinancialTransactionType.Transfer))
            .SumAsync(t => (decimal?)t.Amount) ?? 0m;

        var sourceAvailable = credits - debits;
        if (dto.Amount > sourceAvailable)
        {
            return BadRequest(new { 
                error = "INSUFFICIENT_FUNDS", 
                message = $"Source bank account '{fromAcc.BankName} ({fromAcc.AccountNumber})' balance (${sourceAvailable:N2}) is insufficient to execute this transfer of ${dto.Amount:N2}." 
            });
        }

        var currentUserId = GetCurrentUserId();
        var exRate = dto.ExchangeRate <= 0 ? 1.0m : dto.ExchangeRate;

        var transaction = new FinancialTransaction
        {
            OrganizationId = dto.OrganizationId,
            TransactionNumber = $"TRF-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            Type = FinancialTransactionType.Transfer,
            TransactionDate = utcTransferDate,
            Amount = dto.Amount,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "USD" : dto.Currency.Trim().ToUpper(),
            ExchangeRate = exRate,
            BaseCurrencyAmount = dto.Amount * exRate,
            BankAccountId = dto.FromBankAccountId,
            ToBankAccountId = dto.ToBankAccountId,
            Description = dto.Description?.Trim() ?? "Inter-account bank transfer",
            ReferenceNumber = dto.ReferenceNumber?.Trim(),
            CreatedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.FinancialTransactions.Add(transaction);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Transfer logged successfully", transactionId = transaction.Id, transactionNumber = transaction.TransactionNumber });
    }

    /// <summary>
    /// Creates a manual financial transaction (Income, Expense, or Adjustment) with financial integrity validation.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTransactionDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (dto.Amount <= 0)
            return BadRequest(new { message = "Transaction amount must be strictly greater than zero ($0.01 or more)." });

        if (dto.ExchangeRate <= 0 || dto.ExchangeRate > 10000m || dto.ExchangeRate < 0.0001m)
            return BadRequest(new { message = "Exchange rate must be between 0.0001 and 10,000." });

        var orgExists = await _context.Organizations.AnyAsync(o => o.Id == dto.OrganizationId && !o.IsDeleted);
        if (!orgExists)
            return BadRequest(new { message = "Invalid Organization context." });

        // Financial Date Validation Rules
        var utcTxDate = dto.TransactionDate.Kind == DateTimeKind.Unspecified 
            ? DateTime.SpecifyKind(dto.TransactionDate, DateTimeKind.Utc) 
            : dto.TransactionDate.ToUniversalTime();

        if (utcTxDate.Year < 2000)
        {
            return BadRequest(new { message = "Transaction date cannot be prior to year 2000." });
        }

        if (utcTxDate.Date > DateTime.UtcNow.Date)
        {
            return BadRequest(new { message = "Transaction date cannot be in the future (must be today or an earlier date)." });
        }

        // Closed Fiscal Period Lock Validation
        var orgCompliance = await _context.OrganizationCompliances.FirstOrDefaultAsync(c => c.OrganizationId == dto.OrganizationId);
        if (orgCompliance?.ClosedPeriodEndDate != null && utcTxDate.Date <= orgCompliance.ClosedPeriodEndDate.Value.Date)
        {
            return BadRequest(new { message = $"Transaction date ({utcTxDate:yyyy-MM-dd}) falls into a closed fiscal period (Closed through {orgCompliance.ClosedPeriodEndDate.Value:yyyy-MM-dd})." });
        }

        // Duplicate Ledger Entry Detection
        var payeeTrimmed = dto.PayeeOrPayer?.Trim().ToLower() ?? "";
        var descTrimmed = dto.Description.Trim().ToLower();
        var isDuplicateTx = await _context.FinancialTransactions.AnyAsync(t =>
            t.OrganizationId == dto.OrganizationId &&
            t.Type == dto.Type &&
            t.Amount == dto.Amount &&
            t.TransactionDate.Date == utcTxDate.Date &&
            (t.PayeeOrPayer != null ? t.PayeeOrPayer.ToLower() == payeeTrimmed : payeeTrimmed == "") &&
            t.Description.ToLower() == descTrimmed);

        if (isDuplicateTx)
        {
            return BadRequest(new { message = "A duplicate transaction with matching payee/payer, amount, date, and description already exists in the ledger." });
        }

        // Organization Scope & Project Bound Validation on Foreign Keys
        if (dto.BankAccountId.HasValue)
        {
            var bankAcc = await _context.BankAccounts
                .FirstOrDefaultAsync(b => b.Id == dto.BankAccountId.Value && b.OrganizationId == dto.OrganizationId);
            if (bankAcc == null)
                return BadRequest(new { message = "Selected bank account does not belong to your organization." });
            if (!bankAcc.IsActive)
                return BadRequest(new { message = "Selected bank account is currently inactive." });

            // Overdraft Control on Expense Transactions
            if (dto.Type == FinancialTransactionType.Expense)
            {
                var credits = await _context.FinancialTransactions
                    .Where(t => (t.BankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Income) ||
                                (t.ToBankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Transfer))
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                var debits = await _context.FinancialTransactions
                    .Where(t => (t.BankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Expense) ||
                                (t.BankAccountId == bankAcc.Id && t.Type == FinancialTransactionType.Transfer))
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                var availableBalance = credits - debits;
                if (dto.Amount > availableBalance)
                {
                    return BadRequest(new { 
                        error = "INSUFFICIENT_FUNDS", 
                        message = $"Source bank account '{bankAcc.BankName} ({bankAcc.AccountNumber})' balance (${availableBalance:N2}) is insufficient to cover this expense of ${dto.Amount:N2}." 
                    });
                }
            }
        }

        if (dto.CategoryId.HasValue)
        {
            var catExists = await _context.FinancialCategories
                .AnyAsync(c => c.Id == dto.CategoryId.Value && c.OrganizationId == dto.OrganizationId);
            if (!catExists)
                return BadRequest(new { message = "Selected financial category does not belong to your organization." });
        }

        if (dto.ProjectId.HasValue)
        {
            var project = await _context.Projects
                .Include(p => p.Workspace)
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId.Value && p.Workspace != null && p.Workspace.OrganizationId == dto.OrganizationId);
            if (project == null)
                return BadRequest(new { message = "Selected project does not belong to your organization." });

            if (project.StartDate.HasValue && utcTxDate.Date < project.StartDate.Value.Date)
            {
                return BadRequest(new { message = $"Transaction date ({utcTxDate:yyyy-MM-dd}) cannot be earlier than project start date ({project.StartDate.Value:yyyy-MM-dd})." });
            }
            if (project.EndDate.HasValue && utcTxDate.Date > project.EndDate.Value.Date)
            {
                return BadRequest(new { message = $"Transaction date ({utcTxDate:yyyy-MM-dd}) cannot be later than project end date ({project.EndDate.Value:yyyy-MM-dd})." });
            }

            var projectBudget = await _context.Budgets
                .Where(b => b.ProjectId == dto.ProjectId.Value)
                .Select(b => (decimal?)b.TotalAmount)
                .FirstOrDefaultAsync();

            var exRateCheck = dto.ExchangeRate <= 0 ? 1.0m : dto.ExchangeRate;
            if (dto.Type == FinancialTransactionType.Expense && projectBudget.HasValue && projectBudget.Value > 0)
            {
                var existingProjectExpenses = await _context.FinancialTransactions
                    .Where(t => t.ProjectId == dto.ProjectId.Value && t.Type == FinancialTransactionType.Expense)
                    .SumAsync(t => (decimal?)t.BaseCurrencyAmount) ?? 0m;

                var legacyProjectExpenses = await _context.Expenses
                    .Where(e => e.ProjectId == dto.ProjectId.Value)
                    .SumAsync(e => (decimal?)e.Amount) ?? 0m;

                var totalCurrentSpent = existingProjectExpenses + legacyProjectExpenses;
                var proposedBaseAmount = dto.Amount * exRateCheck;

                if (totalCurrentSpent + proposedBaseAmount > projectBudget.Value)
                {
                    var remaining = Math.Max(0m, projectBudget.Value - totalCurrentSpent);
                    return BadRequest(new { 
                        error = "BUDGET_EXCEEDED", 
                        message = $"This expense of ${proposedBaseAmount:N2} USD would exceed the approved project budget of ${projectBudget.Value:N2} USD (Current Spent: ${totalCurrentSpent:N2} USD, Remaining: ${remaining:N2} USD)." 
                    });
                }
            }
        }

        var currentUserId = GetCurrentUserId();
        var prefix = dto.Type == FinancialTransactionType.Income ? "INC" : (dto.Type == FinancialTransactionType.Expense ? "EXP" : "ADJ");
        var exRate = dto.ExchangeRate <= 0 ? 1.0m : dto.ExchangeRate;

        var transaction = new FinancialTransaction
        {
            OrganizationId = dto.OrganizationId,
            TransactionNumber = $"{prefix}-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            Type = dto.Type,
            TransactionDate = utcTxDate,
            Amount = dto.Amount,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "USD" : dto.Currency.Trim().ToUpper(),
            ExchangeRate = exRate,
            BaseCurrencyAmount = dto.Amount * exRate,
            CategoryId = dto.CategoryId,
            BankAccountId = dto.BankAccountId,
            ProjectId = dto.ProjectId,
            TaskId = dto.TaskId,
            ExpenseId = dto.ExpenseId,
            DonorContributionId = dto.DonorContributionId,
            PayeeOrPayer = dto.PayeeOrPayer?.Trim(),
            Description = dto.Description.Trim(),
            ReferenceNumber = dto.ReferenceNumber?.Trim(),
            CreatedByUserId = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        _context.FinancialTransactions.Add(transaction);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = transaction.Id }, new { id = transaction.Id, number = transaction.TransactionNumber });
    }

    /// <summary>
    /// Gets a single transaction by ID.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var t = await _context.FinancialTransactions
            .Include(t => t.Category)
            .Include(t => t.BankAccount)
            .Include(t => t.ToBankAccount)
            .Include(t => t.Project)
            .Include(t => t.CreatedByUser)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (t == null)
            return NotFound(new { message = "Transaction not found" });

        var dto = new FinancialTransactionDto
        {
            Id = t.Id,
            OrganizationId = t.OrganizationId,
            TransactionNumber = t.TransactionNumber,
            Type = t.Type,
            TransactionDate = t.TransactionDate,
            Amount = t.Amount,
            Currency = t.Currency,
            ExchangeRate = t.ExchangeRate,
            BaseCurrencyAmount = t.BaseCurrencyAmount,
            CategoryId = t.CategoryId,
            CategoryName = t.Category?.Name,
            CategoryColor = t.Category?.Color,
            BankAccountId = t.BankAccountId,
            BankAccountName = t.BankAccount != null ? $"{t.BankAccount.BankName} ({t.BankAccount.AccountNumber})" : null,
            ToBankAccountId = t.ToBankAccountId,
            ToBankAccountName = t.ToBankAccount != null ? $"{t.ToBankAccount.BankName} ({t.ToBankAccount.AccountNumber})" : null,
            ProjectId = t.ProjectId,
            ProjectTitle = t.Project?.Title,
            TaskId = t.TaskId,
            ExpenseId = t.ExpenseId,
            DonorContributionId = t.DonorContributionId,
            PayeeOrPayer = t.PayeeOrPayer,
            Description = t.Description,
            ReferenceNumber = t.ReferenceNumber,
            CreatedByUserId = t.CreatedByUserId,
            CreatedByUserName = t.CreatedByUser?.Name,
            CreatedAt = t.CreatedAt
        };

        return Ok(dto);
    }

    /// <summary>
    /// Resets/clears all financial and grant data for an organization while preserving bank accounts.
    /// </summary>
    [AllowAnonymous]
    [HttpPost("organization/{orgId}/reset-finance-data")]
    [HttpDelete("organization/{orgId}/reset-finance-data")]
    public async Task<IActionResult> ResetFinanceData(int orgId)
    {
        var targetOrgIds = orgId > 0 
            ? new List<int> { orgId } 
            : await _context.Organizations.Select(o => o.Id).ToListAsync();

        foreach (var id in targetOrgIds)
        {
            var transactions = await _context.FinancialTransactions.Where(t => t.OrganizationId == id).ToListAsync();
            _context.FinancialTransactions.RemoveRange(transactions);

            var donorContributions = await _context.DonorContributions
                .Include(c => c.Donor)
                .Where(c => c.Donor != null && c.Donor.OrganizationId == id)
                .ToListAsync();
            _context.DonorContributions.RemoveRange(donorContributions);

            var expenses = await _context.Expenses
                .Include(e => e.Project)
                .ThenInclude(p => p!.Workspace)
                .Where(e => e.Project != null && e.Project.Workspace.OrganizationId == id)
                .ToListAsync();
            _context.Expenses.RemoveRange(expenses);

            var budgets = await _context.Budgets.Where(b => b.OrganizationId == id).ToListAsync();
            var budgetIds = budgets.Select(b => b.Id).ToList();

            var budgetLines = await _context.BudgetLineItems.Where(l => budgetIds.Contains(l.BudgetId)).ToListAsync();
            _context.BudgetLineItems.RemoveRange(budgetLines);

            var revisions = await _context.BudgetRevisionLogs.Where(r => budgetIds.Contains(r.BudgetId)).ToListAsync();
            _context.BudgetRevisionLogs.RemoveRange(revisions);

            _context.Budgets.RemoveRange(budgets);

            // BankAccounts are preserved so bank accounts remain present with 0 balance.

            var categories = await _context.FinancialCategories.Where(c => c.OrganizationId == id).ToListAsync();
            _context.FinancialCategories.RemoveRange(categories);
        }

        if (orgId == 0)
        {
            _context.FinancialTransactions.RemoveRange(_context.FinancialTransactions);
            _context.Expenses.RemoveRange(_context.Expenses);
            _context.DonorContributions.RemoveRange(_context.DonorContributions);
            _context.FinancialCategories.RemoveRange(_context.FinancialCategories);
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = $"All financial and grant data for organization(s) has been completely reset to zero while preserving bank accounts." });
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var userId) ? userId : 1;
    }
}
