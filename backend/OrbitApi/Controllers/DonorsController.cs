using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class DonorsController : ControllerBase
    {
        private readonly OrbitDbContext _db;

        public DonorsController(OrbitDbContext db)
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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DonorDto>>> GetDonors()
        {
            var orgId = GetActiveOrganizationId();

            var query = _db.Donors
                .Include(d => d.Contributions)
                .Include(d => d.ProjectDonors).ThenInclude(pd => pd.Project)
                .AsQueryable();

            if (orgId.HasValue && await query.AnyAsync(d => d.OrganizationId == orgId.Value))
            {
                query = query.Where(d => d.OrganizationId == orgId.Value);
            }

            var donors = await query.ToListAsync();

            var dtos = donors.Select(d => new DonorDto
            {
                Id = d.Id,
                Name = d.Name,
                DonorType = d.DonorType,
                PrimaryContact = d.PrimaryContact,
                EmailAddress = d.EmailAddress,
                PhoneNumber = d.PhoneNumber,
                Country = d.Country,
                TotalPledged = d.Contributions.Where(c => c.Status == ContributionStatus.Pledged).Sum(c => c.Amount),
                TotalReceived = d.Contributions.Where(c => c.Status == ContributionStatus.Received).Sum(c => c.Amount),
                ActiveGrantsCount = d.ProjectDonors.Count(pd => pd.Project != null && !pd.Project.IsDeleted),
                LinkedProjects = d.ProjectDonors.Where(pd => pd.Project != null && !pd.Project.IsDeleted).Select(pd => new ProjectDonorDto
                {
                    Id = pd.Id,
                    ProjectId = pd.ProjectId,
                    ProjectName = pd.Project!.Title,
                    AllocatedAmount = pd.AllocatedAmount
                }).ToList()
            }).ToList();

            return Ok(dtos);
        }

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

            var dto = new DonorDto
            {
                Id = donor.Id,
                Name = donor.Name,
                DonorType = donor.DonorType,
                PrimaryContact = donor.PrimaryContact,
                EmailAddress = donor.EmailAddress,
                PhoneNumber = donor.PhoneNumber,
                Country = donor.Country,
                TotalPledged = donor.Contributions.Where(c => c.Status == ContributionStatus.Pledged).Sum(c => c.Amount),
                TotalReceived = donor.Contributions.Where(c => c.Status == ContributionStatus.Received).Sum(c => c.Amount),
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

        [HttpPost("{id}/contributions")]
        public async Task<ActionResult<DonorContributionDto>> CreateContribution(int id, DonorContributionCreateDto dto)
        {
            var orgId = GetActiveOrganizationId();
            if (orgId == null) return BadRequest("Organization context is required.");

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

            // Verify project belongs to active org workspace if provided
            if (dto.AllocatedProjectId.HasValue)
            {
                var project = await _db.Projects
                    .Include(p => p.Workspace)
                    .FirstOrDefaultAsync(p => p.Id == dto.AllocatedProjectId.Value);
                if (project == null || (project.Workspace != null && project.Workspace.OrganizationId != orgId.Value))
                    return BadRequest("Allocated project not found or does not belong to active organization.");

                if (project.StartDate.HasValue && dto.Date.Date < project.StartDate.Value.Date)
                {
                    return BadRequest($"Contribution date ({dto.Date:yyyy-MM-dd}) cannot be earlier than project start date ({project.StartDate.Value:yyyy-MM-dd}).");
                }
                if (project.EndDate.HasValue && dto.Date.Date > project.EndDate.Value.Date)
                {
                    return BadRequest($"Contribution date ({dto.Date:yyyy-MM-dd}) cannot be later than project end date ({project.EndDate.Value:yyyy-MM-dd}).");
                }
            }

            if (dto.Date.Date > DateTime.UtcNow.Date)
            {
                return BadRequest("Contribution date cannot be in the future.");
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
                    ProjectName = pd.Project != null ? pd.Project.Title : "Unknown",
                    DonorId = pd.DonorId,
                    DonorName = donor.Name,
                    AllocatedAmount = pd.AllocatedAmount,
                    CoFundingPercentage = pd.CoFundingPercentage
                }).ToList(),
                ItemizedExpenses = expenses.Select(e => new DetailedReportExpenseDto
                {
                    Id = e.Id,
                    ProjectTitle = e.Project?.Title ?? "General",
                    CategoryName = e.Category.ToString(),
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
