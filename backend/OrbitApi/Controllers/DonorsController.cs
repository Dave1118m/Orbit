using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing institutional and private donors, grant contributions,
    /// project co-funding allocations, communications, and USAID-compliant progress reports.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class DonorsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly ICurrencyService _currencyService;

        public DonorsController(OrbitDbContext db, ICurrencyService currencyService)
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

        /// <summary>
        /// Retrieves all donors for the active organization with pledged, received, and active grant summaries.
        /// </summary>
        /// <param name="orgId">Optional explicit organization filter.</param>
        /// <returns>Collection of donor DTOs.</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DonorDto>>> GetDonors([FromQuery] int? orgId)
        {
            var targetOrgId = orgId ?? GetActiveOrganizationId();
            if (!targetOrgId.HasValue || targetOrgId.Value <= 0)
            {
                return Ok(new List<DonorDto>());
            }

            var donors = await _db.Donors
                .Include(d => d.Contributions)
                .Include(d => d.ProjectDonors).ThenInclude(pd => pd.Project)
                .Where(d => d.OrganizationId == targetOrgId.Value)
                .ToListAsync();

            var org = await _db.Organizations.FindAsync(targetOrgId.Value);
            var baseCurrency = org?.Currency ?? "USD";

            var dtos = new List<DonorDto>();
            foreach (var d in donors)
            {
                decimal totalPledged = 0;
                foreach (var c in d.Contributions.Where(x => x.Status == ContributionStatus.Pledged))
                {
                    totalPledged += await _currencyService.ConvertAsync(c.Amount, c.Currency, baseCurrency);
                }

                decimal totalReceived = 0;
                foreach (var c in d.Contributions.Where(x => x.Status == ContributionStatus.Received))
                {
                    totalReceived += await _currencyService.ConvertAsync(c.Amount, c.Currency, baseCurrency);
                }

                dtos.Add(new DonorDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    DonorType = d.DonorType,
                    PrimaryContact = d.PrimaryContact,
                    EmailAddress = d.EmailAddress,
                    PhoneNumber = d.PhoneNumber,
                    Country = d.Country,
                    TotalPledged = totalPledged,
                    TotalReceived = totalReceived,
                    ActiveGrantsCount = d.ProjectDonors.Count(pd => pd.Project != null && !pd.Project.IsDeleted),
                    LinkedProjects = d.ProjectDonors.Where(pd => pd.Project != null && !pd.Project.IsDeleted).Select(pd => new ProjectDonorDto
                    {
                        Id = pd.Id,
                        ProjectId = pd.ProjectId,
                        ProjectName = pd.Project!.Title,
                        AllocatedAmount = pd.AllocatedAmount
                    }).ToList()
                });
            }

            return Ok(dtos);
        }

        /// <summary>
        /// Registers a new donor profile in the organization.
        /// </summary>
        /// <param name="dto">Donor creation payload.</param>
        /// <returns>Created donor DTO.</returns>
        [HttpPost]
        public async Task<ActionResult<DonorDto>> CreateDonor(DonorCreateDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest(new { message = "Organization context is required." });

            var donorName = dto.Name.Trim();

            // Duplicate donor name check
            var isDuplicate = await _db.Donors
                .AnyAsync(d => d.OrganizationId == orgId.Value && d.Name.ToLower() == donorName.ToLower());
            if (isDuplicate)
            {
                return BadRequest(new { message = $"A donor named '{donorName}' already exists in your organization." });
            }

            var donor = new Donor
            {
                OrganizationId = orgId.Value,
                Name = donorName,
                DonorType = dto.DonorType,
                PrimaryContact = dto.PrimaryContact?.Trim(),
                EmailAddress = dto.EmailAddress?.Trim(),
                PhoneNumber = dto.PhoneNumber?.Trim(),
                Country = dto.Country?.Trim()
            };

            _db.Donors.Add(donor);
            await _db.SaveChangesAsync();

            var result = new DonorDto
            {
                Id = donor.Id,
                Name = donor.Name,
                DonorType = donor.DonorType,
                PrimaryContact = donor.PrimaryContact,
                EmailAddress = donor.EmailAddress,
                PhoneNumber = donor.PhoneNumber,
                Country = donor.Country,
                TotalPledged = 0,
                TotalReceived = 0,
                ActiveGrantsCount = 0
            };

            return CreatedAtAction(nameof(GetDonor), new { id = donor.Id }, result);
        }

        /// <summary>
        /// Retrieves a single donor by ID with contribution history and linked project allocations.
        /// </summary>
        /// <param name="id">Donor ID.</param>
        /// <returns>Donor DTO.</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<DonorDto>> GetDonor(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var donor = await _db.Donors
                .Where(d => d.OrganizationId == orgId.Value)
                .Include(d => d.Contributions)
                .Include(d => d.ProjectDonors).ThenInclude(pd => pd.Project)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (donor == null) return NotFound();

            var org = await _db.Organizations.FindAsync(orgId.Value);
            var baseCurrency = org?.Currency ?? "USD";

            decimal totalPledged = 0;
            foreach (var c in donor.Contributions.Where(x => x.Status == ContributionStatus.Pledged))
            {
                totalPledged += await _currencyService.ConvertAsync(c.Amount, c.Currency, baseCurrency);
            }

            decimal totalReceived = 0;
            foreach (var c in donor.Contributions.Where(x => x.Status == ContributionStatus.Received))
            {
                totalReceived += await _currencyService.ConvertAsync(c.Amount, c.Currency, baseCurrency);
            }

            var dto = new DonorDto
            {
                Id = donor.Id,
                Name = donor.Name,
                DonorType = donor.DonorType,
                PrimaryContact = donor.PrimaryContact,
                EmailAddress = donor.EmailAddress,
                PhoneNumber = donor.PhoneNumber,
                Country = donor.Country,
                TotalPledged = totalPledged,
                TotalReceived = totalReceived,
                ActiveGrantsCount = donor.ProjectDonors.Count(pd => pd.Project != null && !pd.Project.IsDeleted),
                LinkedProjects = donor.ProjectDonors.Where(pd => pd.Project != null && !pd.Project.IsDeleted).Select(pd => new ProjectDonorDto
                {
                    Id = pd.Id,
                    ProjectId = pd.ProjectId,
                    ProjectName = pd.Project!.Title,
                    DonorId = pd.DonorId,
                    DonorName = donor.Name,
                    AllocatedAmount = pd.AllocatedAmount,
                    CoFundingPercentage = pd.CoFundingPercentage
                }).ToList()
            };

            return Ok(dto);
        }

        /// <summary>
        /// GET /api/v1/donors/{id}/projects - Get projects funded by a specific donor
        /// </summary>
        [HttpGet("{id}/projects")]
        public async Task<ActionResult<IEnumerable<ProjectDonorDto>>> GetDonorProjects(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var donor = await _db.Donors
                .Where(d => d.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (donor == null) return NotFound();

            var projectDonors = await _db.ProjectDonors
                .Include(pd => pd.Project)
                .Where(pd => pd.DonorId == id && pd.Project != null && !pd.Project.IsDeleted)
                .Select(pd => new ProjectDonorDto
                {
                    Id = pd.Id,
                    ProjectId = pd.ProjectId,
                    ProjectName = pd.Project!.Title,
                    DonorId = pd.DonorId,
                    DonorName = donor.Name,
                    AllocatedAmount = pd.AllocatedAmount,
                    CoFundingPercentage = pd.CoFundingPercentage
                })
                .ToListAsync();

            return Ok(projectDonors);
        }

        /// <summary>
        /// Updates a donor's contact details, type, or country.
        /// </summary>
        /// <param name="id">Donor ID.</param>
        /// <param name="dto">Updated fields.</param>
        /// <returns>NoContent on success.</returns>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDonor(int id, DonorCreateDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var donor = await _db.Donors
                .Where(d => d.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (donor == null) return NotFound();

            donor.Name = dto.Name;
            donor.DonorType = dto.DonorType;
            donor.PrimaryContact = dto.PrimaryContact;
            donor.EmailAddress = dto.EmailAddress;
            donor.PhoneNumber = dto.PhoneNumber;
            donor.Country = dto.Country;

            await _db.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Deletes a donor and cleanly purges dependent project links and contributions.
        /// </summary>
        /// <param name="id">Donor ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDonor(int id)
        {
            try
            {
                var orgId = GetActiveOrganizationId();
                if (orgId == null) return BadRequest("Organization context is required.");

                var donor = await _db.Donors
                    .Where(d => d.OrganizationId == orgId.Value)
                    .FirstOrDefaultAsync(d => d.Id == id);

                if (donor == null) return NotFound("Donor not found.");

                // Remove linked child records across all dependent entities to avoid FK constraints
                var projectDonors = await _db.ProjectDonors.Where(pd => pd.DonorId == id).ToListAsync();
                if (projectDonors.Count > 0) _db.ProjectDonors.RemoveRange(projectDonors);

                var contributions = await _db.DonorContributions.Where(c => c.DonorId == id).ToListAsync();
                if (contributions.Count > 0) _db.DonorContributions.RemoveRange(contributions);

                var communications = await _db.DonorCommunications.Where(dc => dc.DonorId == id).ToListAsync();
                if (communications.Count > 0) _db.DonorCommunications.RemoveRange(communications);

                var grantReports = await _db.GrantReportSchedules.Where(grs => grs.DonorId == id).ToListAsync();
                if (grantReports.Count > 0) _db.GrantReportSchedules.RemoveRange(grantReports);

                // Save child deletions first to ensure foreign key references are cleared in SQL Server
                await _db.SaveChangesAsync();

                _db.Donors.Remove(donor);
                await _db.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
                return BadRequest($"Unable to delete donor: {msg}");
            }
        }

        /// <summary>
        /// Records a donor grant contribution (Pledged or Received) and automatically syncs with financial ledger.
        /// </summary>
        /// <param name="id">Donor ID.</param>
        /// <param name="dto">Contribution details.</param>
        /// <returns>Created contribution DTO.</returns>
        [HttpPost("{id}/contributions")]
        public async Task<ActionResult<DonorContributionDto>> CreateContribution(int id, DonorContributionCreateDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            if (dto.Amount <= 0)
            {
                return BadRequest("Contribution amount must be strictly greater than zero.");
            }
            if (dto.Amount > 1_000_000_000_000m)
            {
                return BadRequest("Contribution amount cannot exceed 1 Trillion.");
            }

            if (!string.IsNullOrWhiteSpace(dto.Currency) && dto.Currency.Trim().Length != 3)
            {
                return BadRequest("Currency must be a 3-letter ISO code.");
            }

            if (!string.IsNullOrWhiteSpace(dto.Notes) && dto.Notes.Length > 2000)
            {
                return BadRequest("Notes cannot exceed 2000 characters.");
            }

            // Verify donor belongs to active org
            var donor = await _db.Donors
                .Where(d => d.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (donor == null) return NotFound("Donor not found.");

            // Verify bank account belongs to active org if provided
            if (dto.BankAccountId.HasValue)
            {
                var bankAccount = await _db.BankAccounts
                    .Where(ba => ba.OrganizationId == orgId.Value)
                    .FirstOrDefaultAsync(ba => ba.Id == dto.BankAccountId.Value);
                if (bankAccount == null) return BadRequest("Bank account not found or does not belong to active organization.");
            }

            // Received Cash grants require a bank account
            if (dto.Status == OrbitApi.Models.ContributionStatus.Received && dto.Type == OrbitApi.Models.ContributionType.Cash && !dto.BankAccountId.HasValue)
            {
                return BadRequest("A 'Received' cash contribution must specify a target Bank Account for deposit reconciliation.");
            }

            // Verify project belongs to active org workspace if provided
            Project? project = null;
            if (dto.AllocatedProjectId.HasValue)
            {
                project = await _db.Projects
                    .Include(p => p.Workspace)
                    .FirstOrDefaultAsync(p => p.Id == dto.AllocatedProjectId.Value);
                if (project == null || (project.Workspace != null && project.Workspace.OrganizationId != orgId.Value))
                    return BadRequest("Allocated project not found or does not belong to active organization.");

                if (project.EndDate.HasValue && dto.Date.Date > project.EndDate.Value.Date)
                {
                    return BadRequest($"Contribution date cannot exceed the allocated project's End Date ({project.EndDate.Value:yyyy-MM-dd}).");
                }
            }

            if (dto.AllocatedTaskId.HasValue)
            {
                var task = await _db.Tasks
                    .Include(t => t.Project)
                    .ThenInclude(p => p.Workspace)
                    .FirstOrDefaultAsync(t => t.Id == dto.AllocatedTaskId.Value);

                if (task == null || (task.Project != null && task.Project.Workspace != null && task.Project.Workspace.OrganizationId != orgId.Value))
                {
                    return BadRequest("Allocated task not found or does not belong to active organization.");
                }

                if (dto.AllocatedProjectId.HasValue && task.ProjectId != dto.AllocatedProjectId.Value)
                {
                    return BadRequest("The allocated task does not belong to the allocated project.");
                }
            }

            var todayUtc = DateTime.UtcNow.Date;
            if (dto.Status == OrbitApi.Models.ContributionStatus.Received && dto.Date.Date > todayUtc)
            {
                return BadRequest("A 'Received' contribution cannot have a date in the future. If the disbursement is scheduled for the future, please select status 'Pledged'.");
            }

            var contribution = new DonorContribution
            {
                DonorId = id,
                Amount = dto.Amount,
                Currency = dto.Currency,
                Date = dto.Date,
                Type = dto.Type,
                Status = dto.Status,
                AllocatedProjectId = dto.AllocatedProjectId,
                AllocatedTaskId = dto.AllocatedTaskId,
                BankAccountId = dto.BankAccountId,
                Notes = dto.Notes
            };

            _db.DonorContributions.Add(contribution);

            // Auto-link donor to project if not already linked
            if (dto.AllocatedProjectId.HasValue)
            {
                var existingLink = await _db.ProjectDonors
                    .FirstOrDefaultAsync(pd => pd.DonorId == id && pd.ProjectId == dto.AllocatedProjectId.Value);
                if (existingLink == null)
                {
                    _db.ProjectDonors.Add(new ProjectDonor
                    {
                        DonorId = id,
                        ProjectId = dto.AllocatedProjectId.Value,
                        AllocatedAmount = dto.Amount
                    });
                }
                else
                {
                    existingLink.AllocatedAmount += dto.Amount;
                }
            }

            await _db.SaveChangesAsync();

            // Auto-post to FinancialTransaction Ledger if Received
            if (contribution.Status == ContributionStatus.Received)
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int.TryParse(userIdClaim, out var userId);
                if (userId <= 0) userId = 1;

                var txn = new FinancialTransaction
                {
                    OrganizationId = orgId.Value,
                    TransactionNumber = $"INC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
                    Type = FinancialTransactionType.Income,
                    TransactionDate = contribution.Date,
                    Amount = contribution.Amount,
                    Currency = contribution.Currency,
                    ExchangeRate = 1.0m,
                    BaseCurrencyAmount = contribution.Amount,
                    CategoryId = contribution.CategoryId,
                    BankAccountId = contribution.BankAccountId,
                    ProjectId = contribution.AllocatedProjectId,
                    TaskId = contribution.AllocatedTaskId,
                    DonorContributionId = contribution.Id,
                    PayeeOrPayer = donor.Name,
                    Description = $"Donor Contribution Received from {donor.Name}",
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
                _db.FinancialTransactions.Add(txn);
                await _db.SaveChangesAsync();
            }

            // Load navigation properties for return DTO
            await _db.Entry(contribution).Reference(c => c.AllocatedProject).LoadAsync();
            await _db.Entry(contribution).Reference(c => c.AllocatedTask).LoadAsync();
            await _db.Entry(contribution).Reference(c => c.BankAccount).LoadAsync();

            var result = new DonorContributionDto
            {
                Id = contribution.Id,
                DonorId = contribution.DonorId,
                Amount = contribution.Amount,
                Currency = contribution.Currency,
                Date = contribution.Date,
                Type = contribution.Type,
                Status = contribution.Status,
                AllocatedProjectId = contribution.AllocatedProjectId,
                AllocatedProjectName = contribution.AllocatedProject?.Title,
                AllocatedTaskId = contribution.AllocatedTaskId,
                AllocatedTaskName = contribution.AllocatedTask?.Title,
                BankAccountId = contribution.BankAccountId,
                BankAccountName = contribution.BankAccount != null ? $"{contribution.BankAccount.BankName} - {contribution.BankAccount.AccountName}" : null,
                Notes = contribution.Notes
            };

            return Ok(result);
        }

        /// <summary>
        /// Lists all contributions associated with a specific donor.
        /// </summary>
        /// <param name="id">Donor ID.</param>
        /// <returns>Collection of donor contributions.</returns>
        [HttpGet("{id}/contributions")]
        public async Task<ActionResult<IEnumerable<DonorContributionDto>>> GetContributions(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            // Verify donor belongs to active org
            var donorExists = await _db.Donors
                .AnyAsync(d => d.Id == id && d.OrganizationId == orgId.Value);

            if (!donorExists) return NotFound("Donor not found.");

            var contributions = await _db.DonorContributions
                .Where(c => c.DonorId == id)
                .Include(c => c.AllocatedProject)
                .Include(c => c.AllocatedTask)
                .Include(c => c.BankAccount)
                .OrderByDescending(c => c.Date)
                .ToListAsync();

            var dtos = contributions.Select(c => new DonorContributionDto
            {
                Id = c.Id,
                DonorId = c.DonorId,
                Amount = c.Amount,
                Currency = c.Currency,
                Date = c.Date,
                Type = c.Type,
                Status = c.Status,
                AllocatedProjectId = c.AllocatedProjectId,
                AllocatedProjectName = c.AllocatedProject?.Title,
                AllocatedTaskId = c.AllocatedTaskId,
                AllocatedTaskName = c.AllocatedTask?.Title,
                BankAccountId = c.BankAccountId,
                BankAccountName = c.BankAccount != null ? $"{c.BankAccount.BankName} - {c.BankAccount.AccountName}" : null,
                Notes = c.Notes
            }).ToList();

            return Ok(dtos);
        }

        /// <summary>
        /// Links a donor's grant funding to a specific project.
        /// </summary>
        /// <param name="id">Donor ID.</param>
        /// <param name="dto">Project ID and allocated funding amount.</param>
        /// <returns>Operation result.</returns>
        [HttpPost("{id}/link-project")]
        public async Task<IActionResult> LinkProject(int id, LinkProjectDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            // Verify donor belongs to active org
            var donor = await _db.Donors
                .Where(d => d.OrganizationId == orgId.Value)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (donor == null) return NotFound("Donor not found.");

            // Verify project belongs to active org
            var project = await _db.Projects
                .Include(p => p.Workspace)
                .FirstOrDefaultAsync(p => p.Id == dto.ProjectId && p.Workspace.OrganizationId == orgId.Value);

            if (project == null) return BadRequest("Project not found or does not belong to active organization.");

            // Check if already linked
            var existingLink = await _db.ProjectDonors
                .FirstOrDefaultAsync(pd => pd.DonorId == id && pd.ProjectId == dto.ProjectId);

            if (existingLink != null)
            {
                existingLink.AllocatedAmount = dto.AllocatedAmount;
            }
            else
            {
                var link = new ProjectDonor
                {
                    DonorId = id,
                    ProjectId = dto.ProjectId,
                    AllocatedAmount = dto.AllocatedAmount
                };
                _db.ProjectDonors.Add(link);
            }

            await _db.SaveChangesAsync();
            return Ok(new { message = "Project linked successfully." });
        }

        /// <summary>
        /// GET /api/v1/donors/{id}/detailed-report - Integrated USAID Compliant Progress & Financial Audit Report
        /// </summary>
        [HttpGet("{id}/detailed-report")]
        public async Task<ActionResult<DonorDetailedReportDto>> GetDonorDetailedReport(int id)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

            var donor = await _db.Donors
                .Include(d => d.Contributions)
                .Include(d => d.ProjectDonors).ThenInclude(pd => pd.Project)
                .FirstOrDefaultAsync(d => d.Id == id && d.OrganizationId == orgId.Value);

            if (donor == null) return NotFound("Donor not found.");

            var totalPledged = donor.Contributions.Where(c => c.Status == ContributionStatus.Pledged).Sum(c => c.Amount);
            var totalReceived = donor.Contributions.Where(c => c.Status == ContributionStatus.Received).Sum(c => c.Amount);

            var projectIds = donor.ProjectDonors.Select(pd => pd.ProjectId).ToList();

            var expenses = await _db.Expenses
                .Include(e => e.Project)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.ApprovedByFinanceOfficer)
                .Include(e => e.SignedOffByManager)
                .Include(e => e.FinancialCategory)
                .Where(e => e.ProjectId.HasValue && projectIds.Contains(e.ProjectId.Value))
                .OrderByDescending(e => e.Date)
                .ToListAsync();

            var totalSpent = expenses.Where(e => e.ApprovalStatus == ApprovalStatus.Paid || e.ApprovalStatus == ApprovalStatus.Approved).Sum(e => e.Amount);

            var indicators = await _db.Indicators
                .Where(i => projectIds.Contains(i.ProjectId))
                .ToListAsync();

            var logframeGoals = await _db.LogframeGoals
                .Include(g => g.Outcomes).ThenInclude(o => o.Outputs).ThenInclude(outp => outp.Activities)
                .Where(g => projectIds.Contains(g.ProjectId))
                .ToListAsync();

            return Ok(new DonorDetailedReportDto
            {
                DonorId = donor.Id,
                DonorName = donor.Name,
                DonorType = donor.DonorType.ToString(),
                PrimaryContact = donor.PrimaryContact,
                EmailAddress = donor.EmailAddress,
                Country = donor.Country,
                TotalPledged = totalPledged,
                TotalReceived = totalReceived,
                TotalSpent = totalSpent,
                RemainingBalance = totalReceived - totalSpent,
                ActiveProjects = donor.ProjectDonors.Select(pd => new ProjectDonorDto
                {
                    Id = pd.Id,
                    ProjectId = pd.ProjectId,
                    ProjectName = pd.Project?.Title ?? "Unknown Project",
                    DonorId = pd.DonorId,
                    DonorName = donor.Name,
                    AllocatedAmount = pd.AllocatedAmount,
                    CoFundingPercentage = pd.CoFundingPercentage
                }).ToList(),
                ItemizedExpenses = expenses.Select(e => new DetailedReportExpenseDto
                {
                    Id = e.Id,
                    ProjectTitle = e.Project?.Title ?? "General",
                    CategoryName = e.FinancialCategory?.Name ?? "General Expense",
                    Amount = e.Amount,
                    Currency = e.Currency,
                    Date = e.Date,
                    Description = e.Description,
                    Status = e.ApprovalStatus.ToString(),
                    SubmittedBy = e.SubmittedByUser?.Name ?? "Staff",
                    ApprovedByFinance = e.ApprovedByFinanceOfficer?.Name,
                    SignedOffByManager = e.SignedOffByManager?.Name,
                    HasReceipt = e.AttachmentId.HasValue
                }).ToList(),
                KPIProgress = indicators.Select(i => new DetailedReportKpiDto
                {
                    Id = i.Id,
                    Name = i.Name,
                    Baseline = i.Baseline,
                    Target = i.Target,
                    Actual = i.Actual,
                    Unit = i.Unit
                }).ToList(),
                TotalLogframeGoalsCount = logframeGoals.Count
            });
        }
    }

    public class DonorDetailedReportDto
    {
        public int DonorId { get; set; }
        public string DonorName { get; set; } = string.Empty;
        public string DonorType { get; set; } = string.Empty;
        public string? PrimaryContact { get; set; }
        public string? EmailAddress { get; set; }
        public string? Country { get; set; }
        public decimal TotalPledged { get; set; }
        public decimal TotalReceived { get; set; }
        public decimal TotalSpent { get; set; }
        public decimal RemainingBalance { get; set; }
        public List<ProjectDonorDto> ActiveProjects { get; set; } = new();
        public List<DetailedReportExpenseDto> ItemizedExpenses { get; set; } = new();
        public List<DetailedReportKpiDto> KPIProgress { get; set; } = new();
        public int TotalLogframeGoalsCount { get; set; }
    }

    public class DetailedReportExpenseDto
    {
        public int Id { get; set; }
        public string ProjectTitle { get; set; } = string.Empty;
        public string CategoryName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Currency { get; set; } = "USD";
        public DateTime Date { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string SubmittedBy { get; set; } = string.Empty;
        public string? ApprovedByFinance { get; set; }
        public string? SignedOffByManager { get; set; }
        public bool HasReceipt { get; set; }
    }

    public class DetailedReportKpiDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Baseline { get; set; } = string.Empty;
        public string Target { get; set; } = string.Empty;
        public string Actual { get; set; } = string.Empty;
        public string Unit { get; set; } = string.Empty;
    }
}
