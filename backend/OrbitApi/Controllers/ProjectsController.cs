using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Hubs;
using OrbitApi.Models;
using OrbitApi.Services;
using Microsoft.AspNetCore.SignalR;
using DTOProjectStatus = OrbitApi.DTOs.ProjectStatus;
using ModelProjectStatus = OrbitApi.Models.ProjectStatus;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing project life-cycle, milestone scheduling, team assignments,
    /// budget allocation, postponements, lead histories, comments, attachments, and risk registers.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ProjectsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly IHubContext<OrbitHub> _hubContext;
        private readonly INotificationService _notificationService;
        private readonly IPermissionService _permissionService;
        private readonly ICurrencyService _currencyService;

        public ProjectsController(OrbitDbContext db, IAuthorizationService authorizationService, IHubContext<OrbitHub> hubContext, INotificationService notificationService, IPermissionService permissionService, ICurrencyService currencyService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _hubContext = hubContext;
            _notificationService = notificationService;
            _permissionService = permissionService;
            _currencyService = currencyService;
        }

        /// <summary>
        /// Creates a new project in the designated workspace with donor allocations and validation.
        /// </summary>
        /// <param name="req">Project creation parameters.</param>
        /// <returns>Created project record DTO.</returns>
        [HttpPost]
        public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectRequest req)
        {
            var workspaceResource = new ScopedResource(ScopeType.Workspace, req.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.ProjectCreate))).Succeeded)
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(req.Title) || req.Title.Trim().Length < 2)
            {
                return BadRequest("Project title must be at least 2 characters long.");
            }
            if (req.Title.Trim().Length > 150)
            {
                return BadRequest("Project title cannot exceed 150 characters.");
            }
            if (req.Description != null && req.Description.Length > 2000)
            {
                return BadRequest("Project description cannot exceed 2000 characters.");
            }
            if (req.Budget.HasValue)
            {
                if (req.Budget.Value < 0)
                    return BadRequest("Project budget cannot be negative.");
                if (req.Budget.Value > 1000000000000m)
                    return BadRequest("Project budget exceeds maximum allowed value.");
            }

            var donorIdsToLink = new HashSet<int>();
            if (req.DonorIds != null && req.DonorIds.Count > 0)
            {
                foreach (var dId in req.DonorIds) donorIdsToLink.Add(dId);
            }
            else if (req.DonorId.HasValue)
            {
                donorIdsToLink.Add(req.DonorId.Value);
            }

            var resolvedFundingType = !string.IsNullOrWhiteSpace(req.FundingType) ? req.FundingType : "SingleDonor";
            if (resolvedFundingType == "SingleDonor" && donorIdsToLink.Count != 1)
            {
                return BadRequest("A Sole Funder project must have exactly one donor assigned.");
            }

            if (req.StartDate.HasValue && req.EndDate.HasValue && req.EndDate.Value < req.StartDate.Value)
            {
                return BadRequest("Project End Date cannot be earlier than Start Date.");
            }

            switch (req.Status)
            {
                case DTOs.ProjectStatus.Active:
                    if (!req.StartDate.HasValue || !req.EndDate.HasValue)
                        return BadRequest("An Active project must have both a Start Date and an End Date.");
                    if (req.StartDate.Value > DateTime.UtcNow)
                        return BadRequest("An Active project cannot have a Start Date in the future.");
                    break;
                case DTOs.ProjectStatus.Completed:
                case DTOs.ProjectStatus.Archived:
                    if (!req.StartDate.HasValue || !req.EndDate.HasValue)
                        return BadRequest($"A {req.Status} project must have both a Start Date and an End Date.");
                    if (req.Status == DTOs.ProjectStatus.Completed && req.EndDate.Value > DateTime.UtcNow)
                        return BadRequest("A Completed project cannot have an End Date in the future.");
                    break;
                case DTOs.ProjectStatus.OnHold:
                    // Dates are optional for OnHold projects
                    break;
            }

            var project = new Project
            {
                WorkspaceId = req.WorkspaceId,
                Title = req.Title.Trim(),
                Description = req.Description,
                Status = (ModelProjectStatus)req.Status,
                StartDate = req.StartDate,
                EndDate = req.EndDate,
                FundingType = !string.IsNullOrWhiteSpace(req.FundingType) ? req.FundingType : "SingleDonor"
            };

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            if (req.Budget.HasValue)
            {
                var budget = new Budget
                {
                    ProjectId = project.Id,
                    WorkspaceId = project.WorkspaceId,
                    TotalAmount = req.Budget.Value,
                    Level = BudgetLevel.Project,
                    Status = BudgetStatus.Approved,
                    Currency = "USD"
                };
                _db.Budgets.Add(budget);
            }

            // donorIdsToLink already calculated at validation stage

            if (donorIdsToLink.Count > 0)
            {
                decimal defaultPct = 100m / donorIdsToLink.Count;
                foreach (var dId in donorIdsToLink)
                {
                    var projectDonor = new ProjectDonor
                    {
                        ProjectId = project.Id,
                        DonorId = dId,
                        AllocatedAmount = (req.Budget ?? 0) / donorIdsToLink.Count,
                        CoFundingPercentage = defaultPct
                    };
                    _db.ProjectDonors.Add(projectDonor);
                }
                await _db.SaveChangesAsync();
            }

            var dto = new ProjectDto
            {
                Id = project.Id,
                WorkspaceId = project.WorkspaceId,
                Title = project.Title,
                Description = project.Description,
                Status = (DTOProjectStatus)project.Status,
                StartDate = project.StartDate,
                EndDate = project.EndDate,
                Budget = req.Budget,
                DonorId = req.DonorId,
                FundingType = project.FundingType
            };

            return CreatedAtAction(nameof(Get), new { id = project.Id }, dto);
        }

        private int GetActiveOrganizationId()
        {
            if (Request.Headers.TryGetValue("X-Organization-Id", out var orgIdStr) && int.TryParse(orgIdStr, out var orgId) && orgId > 0)
            {
                var validOrg = _db.Organizations.FirstOrDefault(o => o.Id == orgId && !o.IsDeleted);
                if (validOrg != null) return validOrg.Id;
            }

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                var userOrgId = _db.OrganizationMembers
                    .Where(om => om.UserId == userId && om.Status == OrgMemberStatus.Active)
                    .Select(om => om.OrganizationId)
                    .FirstOrDefault();
                if (userOrgId > 0 && _db.Organizations.Any(o => o.Id == userOrgId && !o.IsDeleted)) return userOrgId;
            }

            var firstOrg = _db.Organizations.FirstOrDefault(o => !o.IsDeleted);
            return firstOrg?.Id ?? 0;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectDto>>> List([FromQuery] int? workspaceId)
        {
            var activeOrgId = GetActiveOrganizationId();

            var query = _db.Projects
                .Include(p => p.Workspace)
                .Where(p => !p.IsDeleted && p.Workspace != null && p.Workspace.OrganizationId == activeOrgId);

            if (workspaceId.HasValue)
            {
                var workspaceResource = new ScopedResource(ScopeType.Workspace, workspaceId.Value);
                if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
                {
                    return Forbid();
                }
                query = query.Where(p => p.WorkspaceId == workspaceId.Value);
            }

            var projectsRaw = await query
                .Select(p => new
                {
                    Id = p.Id,
                    WorkspaceId = p.WorkspaceId,
                    Title = p.Title,
                    Description = p.Description,
                    Status = p.Status,
                    StartDate = p.StartDate,
                    EndDate = p.EndDate,
                    Budget = _db.Budgets.Where(b => b.ProjectId == p.Id).Select(b => (decimal?)b.TotalAmount).FirstOrDefault(),
                    DonorId = p.ProjectDonors.Select(pd => (int?)pd.DonorId).FirstOrDefault(),
                    FundingType = p.FundingType,
                    Teams = p.ProjectTeams.Select(pt => new { pt.TeamId, pt.Team.Name }).ToList(),
                    TaskCount = p.Tasks.Count(t => !t.IsDeleted)
                }).ToListAsync();

            var projects = projectsRaw.Select(p => new ProjectDto
            {
                Id = p.Id,
                WorkspaceId = p.WorkspaceId,
                Title = p.Title,
                Description = p.Description,
                Status = Enum.TryParse<DTOProjectStatus>(p.Status.ToString(), out var parsed) ? parsed : DTOProjectStatus.Planning,
                StartDate = p.StartDate,
                EndDate = p.EndDate,
                Budget = p.Budget,
                DonorId = p.DonorId,
                FundingType = p.FundingType ?? "SingleDonor",
                Teams = p.Teams.Select(pt => new TeamSimpleDto
                {
                    Id = pt.TeamId,
                    Name = pt.Name ?? "Unknown"
                }).ToList(),
                TaskCount = p.TaskCount
            }).ToList();

            return Ok(projects);
        }

        /// <summary>
        /// Retrieves a single project by ID with budgets, assigned teams, and donor information.
        /// </summary>
        /// <param name="id">Project primary key.</param>
        /// <returns>Project DTO.</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<ProjectDto>> Get(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            var budgetAmount = await _db.Budgets.Where(b => b.ProjectId == id).Select(b => (decimal?)b.TotalAmount).FirstOrDefaultAsync();
            var donorId = await _db.ProjectDonors.Where(pd => pd.ProjectId == id).Select(pd => (int?)pd.DonorId).FirstOrDefaultAsync();
            var teamsList = await _db.ProjectTeams
                .Where(pt => pt.ProjectId == id)
                .Select(pt => new TeamSimpleDto
                {
                    Id = pt.TeamId,
                    Name = pt.Team.Name
                }).ToListAsync();

            return Ok(new ProjectDto
            {
                Id = project.Id,
                WorkspaceId = project.WorkspaceId,
                Title = project.Title,
                Description = project.Description,
                Status = (DTOProjectStatus)project.Status,
                StartDate = project.StartDate,
                EndDate = project.EndDate,
                Budget = budgetAmount,
                DonorId = donorId,
                FundingType = project.FundingType ?? "SingleDonor",
                Teams = teamsList,
                TaskCount = project.Tasks.Count
            });
        }

        /// <summary>
        /// GET /api/v1/projects/{id}/donors - Get linked donors for a project
        /// </summary>
        [HttpGet("{id}/donors")]
        public async Task<ActionResult<IEnumerable<ProjectDonorDto>>> GetProjectDonors(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectDonors = await _db.ProjectDonors
                .Include(pd => pd.Donor)
                .Where(pd => pd.ProjectId == id)
                .Select(pd => new ProjectDonorDto
                {
                    Id = pd.Id,
                    ProjectId = pd.ProjectId,
                    ProjectName = project.Title,
                    DonorId = pd.DonorId,
                    DonorName = pd.Donor != null ? pd.Donor.Name : "Unknown Donor",
                    AllocatedAmount = pd.AllocatedAmount,
                    CoFundingPercentage = pd.CoFundingPercentage
                })
                .ToListAsync();

            return Ok(projectDonors);
        }

        /// <summary>
        /// Updates project details, date constraints, status transitions, budget, or donors.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <param name="req">Updated fields.</param>
        /// <returns>Updated project DTO.</returns>
        [HttpPut("{id}")]
        public async Task<ActionResult<ProjectDto>> Update(int id, [FromBody] UpdateProjectRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
            {
                return Forbid();
            }

            if (req.Title != null)
            {
                if (string.IsNullOrWhiteSpace(req.Title) || req.Title.Trim().Length < 2)
                {
                    return BadRequest("Project title must be at least 2 characters long.");
                }
                if (req.Title.Trim().Length > 150)
                {
                    return BadRequest("Project title cannot exceed 150 characters.");
                }
                project.Title = req.Title.Trim();
            }

            if (req.Description != null)
            {
                if (req.Description.Length > 2000)
                    return BadRequest("Project description cannot exceed 2000 characters.");
                project.Description = req.Description;
            }
            if (req.Budget.HasValue)
            {
                if (req.Budget.Value < 0)
                    return BadRequest("Project budget cannot be negative.");
                if (req.Budget.Value > 1000000000000m)
                    return BadRequest("Project budget exceeds maximum allowed value.");
            }

            var updateDonorIdsToLink = new HashSet<int>();
            if (req.DonorIds != null && req.DonorIds.Count > 0)
            {
                foreach (var dId in req.DonorIds) updateDonorIdsToLink.Add(dId);
            }
            else if (req.DonorId.HasValue)
            {
                updateDonorIdsToLink.Add(req.DonorId.Value);
            }

            var resolvedUpdateFundingType = !string.IsNullOrWhiteSpace(req.FundingType) ? req.FundingType : (!string.IsNullOrWhiteSpace(project.FundingType) ? project.FundingType : "SingleDonor");
            if (resolvedUpdateFundingType == "SingleDonor" && updateDonorIdsToLink.Count != 1)
            {
                return BadRequest("A Sole Funder project must have exactly one donor assigned.");
            }
            if (req.Status.HasValue && project.Status != (OrbitApi.Models.ProjectStatus)req.Status.Value)
            {
                var oldStatus = project.Status.ToString();
                var newStatus = ((OrbitApi.Models.ProjectStatus)req.Status.Value).ToString();
                project.Status = (OrbitApi.Models.ProjectStatus)req.Status.Value;

                var notificationUserIds = await _db.ProjectTeams
                    .Where(pt => pt.ProjectId == id)
                    .Join(_db.TeamMembers, pt => pt.TeamId, tm => tm.TeamId, (pt, tm) => tm.UserId)
                    .Distinct()
                    .ToListAsync();

                if (notificationUserIds.Any())
                {
                    await _notificationService.NotifyUsersAsync(notificationUserIds, $"Project '{project.Title}' status changed from {oldStatus} to {newStatus}.");
                }
            }
            var targetStartDate = req.StartDate ?? project.StartDate;
            var targetEndDate = req.EndDate ?? project.EndDate;
            if (targetStartDate.HasValue && targetEndDate.HasValue && targetEndDate.Value < targetStartDate.Value)
            {
                return BadRequest("Project End Date cannot be earlier than Start Date.");
            }
            
            var targetStatus = req.Status.HasValue ? (OrbitApi.Models.ProjectStatus)req.Status.Value : project.Status;
            switch (targetStatus)
            {
                case OrbitApi.Models.ProjectStatus.Active:
                    if (!targetStartDate.HasValue || !targetEndDate.HasValue)
                        return BadRequest("An Active project must have both a Start Date and an End Date.");
                    if (targetStartDate.Value > DateTime.UtcNow)
                        return BadRequest("An Active project cannot have a Start Date in the future.");
                    break;
                case OrbitApi.Models.ProjectStatus.Completed:
                case OrbitApi.Models.ProjectStatus.Archived:
                    if (!targetStartDate.HasValue || !targetEndDate.HasValue)
                        return BadRequest($"A {targetStatus} project must have both a Start Date and an End Date.");
                    if (targetStatus == OrbitApi.Models.ProjectStatus.Completed && targetEndDate.Value > DateTime.UtcNow)
                        return BadRequest("A Completed project cannot have an End Date in the future.");
                    break;
                case OrbitApi.Models.ProjectStatus.OnHold:
                    // Dates are optional for OnHold projects
                    break;
            }

            if (req.StartDate.HasValue) project.StartDate = req.StartDate;
            if (req.EndDate.HasValue)
            {
                project.EndDate = req.EndDate;
            }
            if (req.Budget.HasValue)
            {
                var budget = await _db.Budgets.FirstOrDefaultAsync(b => b.ProjectId == id);
                if (budget != null)
                {
                    budget.TotalAmount = req.Budget.Value;
                }
                else
                {
                    _db.Budgets.Add(new Budget { ProjectId = id, WorkspaceId = project.WorkspaceId, TotalAmount = req.Budget.Value, Level = BudgetLevel.Project, Status = BudgetStatus.Approved });
                }
            }

            if (req.DonorId.HasValue)
            {
                var pd = await _db.ProjectDonors.FirstOrDefaultAsync(pd => pd.ProjectId == id);
                if (pd != null)
                {
                    pd.DonorId = req.DonorId.Value;
                }
                else
                {
                    _db.ProjectDonors.Add(new ProjectDonor { ProjectId = id, DonorId = req.DonorId.Value, AllocatedAmount = req.Budget ?? 0 });
                }
            }

            await _db.SaveChangesAsync();

            var budgetAmount = await _db.Budgets.Where(b => b.ProjectId == id).Select(b => (decimal?)b.TotalAmount).FirstOrDefaultAsync();
            var donorId = await _db.ProjectDonors.Where(pd => pd.ProjectId == id).Select(pd => (int?)pd.DonorId).FirstOrDefaultAsync();

            return Ok(new ProjectDto
            {
                Id = project.Id,
                WorkspaceId = project.WorkspaceId,
                Title = project.Title,
                Description = project.Description,
                Status = (DTOProjectStatus)project.Status,
                StartDate = project.StartDate,
                EndDate = project.EndDate,
                Budget = budgetAmount,
                DonorId = donorId,
                TaskCount = project.Tasks.Count
            });
        }

        /// <summary>
        /// Records an authorized timeline postponement for a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <param name="req">New end date and postponement justification.</param>
        /// <returns>Created postponement record.</returns>
        [HttpPost("{id}/postpone")]
        public async Task<ActionResult<ProjectPostponementDto>> Postpone(int id, [FromBody] PostponeProjectRequest req)
        {
            var project = await _db.Projects.FindAsync(id);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectPostpone))).Succeeded)
            {
                return Forbid();
            }

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            var currentEndDate = project.EndDate ?? project.StartDate ?? DateTime.UtcNow;
            if (req.NewEndDate <= currentEndDate)
            {
                return BadRequest($"New postponement end date ({req.NewEndDate:yyyy-MM-dd}) must be strictly after the current project end date ({currentEndDate:yyyy-MM-dd}).");
            }

            var postponement = new ProjectPostponement
            {
                ProjectId = id,
                OldEndDate = project.EndDate ?? DateTime.UtcNow,
                NewEndDate = req.NewEndDate,
                Reason = req.Reason,
                RequestedByUserId = userId,
                ApprovedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            project.EndDate = req.NewEndDate;
            _db.ProjectPostponements.Add(postponement);
            await _db.SaveChangesAsync();

            var notificationUserIds = await _db.ProjectTeams
                .Where(pt => pt.ProjectId == id)
                .Join(_db.TeamMembers, pt => pt.TeamId, tm => tm.TeamId, (pt, tm) => tm.UserId)
                .Distinct()
                .ToListAsync();

            if (notificationUserIds.Any())
            {
                await _notificationService.NotifyUsersAsync(notificationUserIds, $"Project '{project.Title}' was postponed from {postponement.OldEndDate:yyyy-MM-dd} to {postponement.NewEndDate:yyyy-MM-dd}.");
            }

            return Ok(new ProjectPostponementDto
            {
                Id = postponement.Id,
                ProjectId = postponement.ProjectId,
                OldEndDate = postponement.OldEndDate,
                NewEndDate = postponement.NewEndDate,
                Reason = postponement.Reason,
                RequestedByUserId = postponement.RequestedByUserId,
                ApprovedByUserId = postponement.ApprovedByUserId,
                CreatedAt = postponement.CreatedAt
            });
        }

        /// <summary>
        /// Lists all historical timeline postponement requests for a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <returns>Collection of project postponements.</returns>
        [HttpGet("{id}/postponements")]
        public async Task<ActionResult<IEnumerable<ProjectPostponementDto>>> GetPostponements(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            var postponements = await _db.ProjectPostponements
                .Where(pp => pp.ProjectId == id)
                .OrderByDescending(pp => pp.CreatedAt)
                .Select(pp => new ProjectPostponementDto
                {
                    Id = pp.Id,
                    ProjectId = pp.ProjectId,
                    OldEndDate = pp.OldEndDate,
                    NewEndDate = pp.NewEndDate,
                    Reason = pp.Reason,
                    RequestedByUserId = pp.RequestedByUserId,
                    ApprovedByUserId = pp.ApprovedByUserId,
                    CreatedAt = pp.CreatedAt
                })
                .ToListAsync();

            return Ok(postponements);
        }

        /// <summary>
        /// Retrieves the historical leadership succession log for a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <returns>List of past and present project leads.</returns>
        [HttpGet("{id}/lead-history")]
        public async Task<ActionResult<IEnumerable<ProjectLeadHistoryDto>>> GetLeadHistory(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            var histories = await _db.ProjectLeadHistories
                .Where(h => h.ProjectId == id)
                .Join(_db.Users, h => h.UserId, u => u.Id, (h, u) => new ProjectLeadHistoryDto
                {
                    Id = h.Id,
                    ProjectId = h.ProjectId,
                    UserId = h.UserId,
                    UserName = u.Name,
                    StartDate = h.StartDate,
                    EndDate = h.EndDate
                })
                .OrderByDescending(h => h.StartDate)
                .ToListAsync();

            return Ok(histories);
        }

        /// <summary>
        /// Reassigns or designates the active project lead user.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <param name="req">New lead user ID.</param>
        /// <returns>New project lead history record.</returns>
        [HttpPost("{id}/assign-lead")]
        public async Task<ActionResult> AssignLead(int id, [FromBody] AssignProjectLeadRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
            {
                return Forbid();
            }

            var currentLead = await _db.ProjectLeadHistories
                .Where(h => h.ProjectId == id && h.EndDate == null)
                .FirstOrDefaultAsync();

            if (currentLead != null && currentLead.UserId == req.UserId)
            {
                return BadRequest("User is already the active lead for this project.");
            }

            if (currentLead != null)
            {
                currentLead.EndDate = DateTime.UtcNow;
            }

            var newLead = new ProjectLeadHistory
            {
                ProjectId = id,
                UserId = req.UserId,
                StartDate = DateTime.UtcNow
            };

            _db.ProjectLeadHistories.Add(newLead);
            await _db.SaveChangesAsync();

            var user = await _db.Users.FindAsync(req.UserId);

            return Ok(new ProjectLeadHistoryDto
            {
                Id = newLead.Id,
                ProjectId = newLead.ProjectId,
                UserId = newLead.UserId,
                UserName = user?.Name ?? "Unknown",
                StartDate = newLead.StartDate,
                EndDate = newLead.EndDate
            });
        }

        /// <summary>
        /// Soft-deletes a project and cascades deletion to associated tasks.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectDelete))).Succeeded)
            {
                return Forbid();
            }

            project.IsDeleted = true;

            var tasksToUpdate = await _db.Tasks.Where(t => t.ProjectId == id).ToListAsync();
            foreach (var t in tasksToUpdate)
            {
                t.IsDeleted = true;
            }

            await _db.SaveChangesAsync();

            return NoContent();
        }

        // --- Comments ---

        /// <summary>
        /// Lists discussion comments and nested replies on a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <returns>List of comment DTOs.</returns>
        [HttpGet("{id}/comments")]
        public async Task<ActionResult> GetComments(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            List<Comment> comments;
            try
            {
                comments = await _db.Comments
                    .Where(c => c.EntityType == EntityType.Project && c.EntityId == id && c.ParentCommentId == null)
                    .OrderByDescending(c => c.CreatedAt)
                    .Include(c => c.Replies)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                // In some dev DB states column types may mismatch; avoid crashing the entire request.
                Console.WriteLine($"Warning: failed to read comments for project {id}: {ex.Message}");
                comments = new List<Comment>();
            }

            var userIds = comments.SelectMany(c => new[] { c.UserId }.Concat(c.Replies.Select(r => r.UserId))).Distinct().ToList();
            var users = await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);

            var dtos = comments.Select(c => new CommentDto
            {
                Id = c.Id,
                EntityType = c.EntityType,
                EntityId = c.EntityId,
                UserId = c.UserId,
                UserName = users.GetValueOrDefault(c.UserId),
                Content = c.Content,
                ParentCommentId = c.ParentCommentId,
                CreatedAt = c.CreatedAt,
                EditedAt = c.EditedAt,
                Replies = c.Replies.OrderBy(r => r.CreatedAt).Select(r => new CommentDto
                {
                    Id = r.Id,
                    EntityType = r.EntityType,
                    EntityId = r.EntityId,
                    UserId = r.UserId,
                    UserName = users.GetValueOrDefault(r.UserId),
                    Content = r.Content,
                    ParentCommentId = r.ParentCommentId,
                    CreatedAt = r.CreatedAt,
                    EditedAt = r.EditedAt
                }).ToList()
            }).ToList();

            return Ok(dtos);
        }

        /// <summary>
        /// Posts a new comment or threaded reply on a project and dispatches @mention notifications.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <param name="req">Comment content and parent comment ID.</param>
        /// <returns>Created comment record.</returns>
        [HttpPost("{id}/comments")]
        public async Task<ActionResult> CreateComment(int id, [FromBody] CreateCommentRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            var comment = new Comment
            {
                EntityType = EntityType.Project,
                EntityId = id,
                UserId = userId,
                Content = req.Content,
                ParentCommentId = req.ParentCommentId,
                CreatedAt = DateTime.UtcNow
            };

            _db.Comments.Add(comment);
            await _db.SaveChangesAsync();

            if (project != null && !string.IsNullOrWhiteSpace(req.Content))
            {
                var mentionedUserNames = System.Text.RegularExpressions.Regex.Matches(req.Content, @"@([\w\.\-]+)")
                    .Cast<System.Text.RegularExpressions.Match>()
                    .Select(m => m.Groups[1].Value.ToLower())
                    .Distinct();

                foreach (var uname in mentionedUserNames)
                {
                    var mentionedUser = await _db.Users.FirstOrDefaultAsync(u => u.Name.ToLower().Replace(" ", "").Contains(uname) || (u.Email != null && u.Email.ToLower().StartsWith(uname)));
                    if (mentionedUser != null && mentionedUser.Id != userId)
                    {
                        var msg = $"You were @mentioned in a project comment on '{project.Title}'.";
                        await _notificationService.NotifyUserAsync(mentionedUser.Id, msg);
                    }
                }
            }

            var user = await _db.Users.FindAsync(userId);

            return Ok(new CommentDto
            {
                Id = comment.Id,
                EntityType = comment.EntityType,
                EntityId = comment.EntityId,
                UserId = comment.UserId,
                UserName = user?.Name,
                Content = comment.Content,
                ParentCommentId = comment.ParentCommentId,
                CreatedAt = comment.CreatedAt
            });
        }

        // --- Attachments ---

        /// <summary>
        /// Retrieves file attachments and cloud link references associated with a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <returns>List of attachment DTOs.</returns>
        [HttpGet("{id}/attachments")]
        public async Task<ActionResult> GetAttachments(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            List<AttachmentDto> attachments;
            try
            {
                attachments = await _db.Attachments
                    .Where(a => a.EntityType == EntityType.Project && a.EntityId == id)
                    .Select(a => new AttachmentDto
                    {
                        Id = a.Id,
                        EntityType = a.EntityType,
                        EntityId = a.EntityId,
                        FileName = a.FileName,
                        AbsoluteFilePath = a.AbsoluteFilePath,
                        MediaType = a.MediaType.ToString(),
                        MimeType = a.MimeType,
                        FileSizeBytes = a.FileSizeBytes,
                        PreviewEnabled = a.PreviewEnabled,
                        DownloadUrl = $"https://localhost:7065/api/v1/projects/attachments/{a.Id}/download",
                        PreviewUrl = a.PreviewEnabled ? $"https://localhost:7065/api/v1/projects/attachments/{a.Id}/download" : null,
                        UserId = a.UserId
                    })
                    .ToListAsync();
                
                Console.WriteLine($"Project {id} attachments found: {attachments.Count}");
                foreach (var att in attachments)
                {
                    Console.WriteLine($"  - {att.FileName} (ID: {att.Id}, EntityType: {att.EntityType}, EntityId: {att.EntityId})");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Warning: failed to read attachments for project {id}: {ex.Message}");
                attachments = new List<AttachmentDto>();
            }

            return Ok(attachments);
        }

        /// <summary>
        /// Uploads a physical file or links an external cloud document (Google Drive, OneDrive) to a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <param name="file">Form file payload.</param>
        /// <param name="cloudUrl">External cloud URL.</param>
        /// <param name="cloudProvider">Cloud provider name.</param>
        /// <param name="cloudFileName">Document name.</param>
        /// <returns>Created attachment metadata.</returns>
        [HttpPost("{id}/attachments")]
        public async Task<ActionResult> UploadAttachment(int id, [FromForm] IFormFile? file, [FromForm] string? cloudUrl, [FromForm] string? cloudProvider, [FromForm] string? cloudFileName)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
            {
                return Forbid();
            }

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdStr, out var userId);

            // ── Handle Cloud Link (Google Drive / OneDrive) ──────────────────────
            if (!string.IsNullOrWhiteSpace(cloudUrl))
            {
                var cloudName = !string.IsNullOrWhiteSpace(cloudFileName) 
                    ? cloudFileName 
                    : $"{(cloudProvider ?? "Cloud")} Attached Document";

                var cloudAttachment = new Attachment
                {
                    EntityType = EntityType.Project,
                    EntityId = id,
                    FileName = cloudName,
                    AbsoluteFilePath = cloudUrl,
                    MediaType = OrbitApi.Models.MediaType.Document,
                    MimeType = "text/html",
                    FileSizeBytes = 0,
                    PreviewEnabled = true,
                    UserId = userId
                };

                _db.Attachments.Add(cloudAttachment);
                await _db.SaveChangesAsync();

                return Ok(new AttachmentDto
                {
                    Id = cloudAttachment.Id,
                    EntityType = cloudAttachment.EntityType,
                    EntityId = cloudAttachment.EntityId,
                    FileName = cloudAttachment.FileName,
                    AbsoluteFilePath = cloudAttachment.AbsoluteFilePath,
                    MediaType = cloudAttachment.MediaType.ToString(),
                    MimeType = cloudAttachment.MimeType,
                    FileSizeBytes = cloudAttachment.FileSizeBytes,
                    PreviewEnabled = cloudAttachment.PreviewEnabled,
                    DownloadUrl = cloudUrl,
                    PreviewUrl = cloudUrl,
                    UserId = cloudAttachment.UserId
                });
            }

            // ── Handle Physical File Upload ─────────────────────────────────────
            if (file == null || file.Length == 0) return BadRequest("No file or cloud link provided.");

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Projects", id.ToString());
            Directory.CreateDirectory(uploadsDir);

            var safeFileName = Path.GetFileName(file.FileName);
            var uniqueName = $"{Guid.NewGuid()}_{safeFileName}";
            var filePath = Path.GetFullPath(Path.Combine(uploadsDir, uniqueName));

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var mediaType = DetermineMediaType(file.ContentType);
            var previewable = mediaType == OrbitApi.Models.MediaType.Image
                           || mediaType == OrbitApi.Models.MediaType.Video
                           || file.ContentType == "application/pdf";

            var attachment = new Attachment
            {
                EntityType = EntityType.Project,
                EntityId = id,
                FileName = file.FileName,
                AbsoluteFilePath = filePath,
                MediaType = mediaType,
                MimeType = file.ContentType,
                FileSizeBytes = file.Length,
                PreviewEnabled = previewable,
                UserId = userId
            };

            _db.Attachments.Add(attachment);
            await _db.SaveChangesAsync();

            return Ok(new AttachmentDto
            {
                Id = attachment.Id,
                EntityType = attachment.EntityType,
                EntityId = attachment.EntityId,
                FileName = attachment.FileName,
                AbsoluteFilePath = attachment.AbsoluteFilePath,
                MediaType = attachment.MediaType.ToString(),
                MimeType = attachment.MimeType,
                FileSizeBytes = attachment.FileSizeBytes,
                PreviewEnabled = attachment.PreviewEnabled,
                DownloadUrl = $"https://localhost:7065/api/v1/projects/attachments/{attachment.Id}/download",
                PreviewUrl = attachment.PreviewEnabled ? $"https://localhost:7065/api/v1/projects/attachments/{attachment.Id}/download" : null,
                UserId = attachment.UserId
            });
        }

        [HttpGet("attachments/{attachmentId}/download")]
        public async Task<ActionResult> DownloadAttachment(int attachmentId)
        {
            var attachment = await _db.Attachments.FindAsync(attachmentId);
            if (attachment == null || attachment.EntityType != EntityType.Project) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, attachment.EntityId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
            {
                return Forbid();
            }

            if (!System.IO.File.Exists(attachment.AbsoluteFilePath))
                return NotFound("File not found on disk.");

            var stream = new FileStream(attachment.AbsoluteFilePath, FileMode.Open, FileAccess.Read);
            
            // Set Content-Disposition to inline for browser viewing, fallback to attachment for download
            var contentDisposition = new Microsoft.Net.Http.Headers.ContentDispositionHeaderValue("inline");
            contentDisposition.FileName = attachment.FileName;
            Response.Headers.Append("Content-Disposition", contentDisposition.ToString());
            
            return File(stream, attachment.MimeType);
        }

        [HttpDelete("attachments/{attachmentId}")]
        public async Task<ActionResult> DeleteAttachment(int attachmentId)
        {
            var attachment = await _db.Attachments.FindAsync(attachmentId);
            if (attachment == null || attachment.EntityType != EntityType.Project) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, attachment.EntityId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
            {
                return Forbid();
            }

            if (System.IO.File.Exists(attachment.AbsoluteFilePath))
                System.IO.File.Delete(attachment.AbsoluteFilePath);

            _db.Attachments.Remove(attachment);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        private static OrbitApi.Models.MediaType DetermineMediaType(string contentType)
        {
            if (contentType.StartsWith("image/")) return OrbitApi.Models.MediaType.Image;
            if (contentType.StartsWith("video/")) return OrbitApi.Models.MediaType.Video;
            if (contentType.StartsWith("audio/")) return OrbitApi.Models.MediaType.Audio;
            return OrbitApi.Models.MediaType.Document;
        }

        private async Task<List<int>> GetAccessibleWorkspaceIdsAsync(Permission permission)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return new List<int>();

            var isOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted)
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && a.Role.Name == RoleName.Owner)
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && m.Role.Name == RoleName.Owner);

            if (isOwner)
            {
                return await _db.Workspaces.Select(w => w.Id).ToListAsync();
            }

            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var memberAssignments = await _db.OrganizationMembers.Include(m => m.Role)
                .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active)
                .ToListAsync();

            var workspaceIds = new List<int>();
            var organizationIds = new List<int>();
            var projectIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!await _permissionService.RoleHasPermissionAsync(assignment.Role!.Name, permission))
                    continue;

                switch (assignment.ScopeType)
                {
                    case ScopeType.Workspace:
                        workspaceIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Organization:
                        organizationIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Project:
                        projectIds.Add(assignment.ScopeId);
                        break;
                }
            }

            foreach (var member in memberAssignments)
            {
                if (member.Role != null && await _permissionService.RoleHasPermissionAsync(member.Role.Name, permission))
                {
                    organizationIds.Add(member.OrganizationId);
                }
            }

            if (organizationIds.Any())
            {
                var orgWorkspaces = await _db.Workspaces
                    .Where(w => organizationIds.Contains(w.OrganizationId))
                    .Select(w => w.Id)
                    .ToListAsync();

                workspaceIds.AddRange(orgWorkspaces);
            }

            if (projectIds.Any())
            {
                var projectWorkspaces = await _db.Projects
                    .Where(p => projectIds.Contains(p.Id))
                    .Select(p => p.WorkspaceId)
                    .ToListAsync();

                workspaceIds.AddRange(projectWorkspaces);
            }

            var distinctIds = workspaceIds.Distinct().ToList();
            if (!distinctIds.Any())
            {
                return await _db.Workspaces.Select(w => w.Id).ToListAsync();
            }
            return distinctIds;
        }

        // --- Risk / Issue Log ---

        /// <summary>
        /// Retrieves the Risk and Issue register entries for a project.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <returns>Collection of risk and issue records.</returns>
        [HttpGet("{id}/risks")]
        public async Task<ActionResult> GetRisks(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.RiskLogView))).Succeeded)
                return Forbid();

            var risks = await _db.RisksIssues
                .Where(r => r.ProjectId == id)
                .Include(r => r.ResolvedByUser)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.ProjectId,
                    Type = r.Type.ToString(),
                    r.Description,
                    r.Likelihood,
                    r.Impact,
                    r.LikelihoodScore,
                    r.ImpactScore,
                    RiskScore = r.LikelihoodScore * r.ImpactScore,
                    r.MitigationPlan,
                    r.Owner,
                    r.Status,
                    r.ResolutionNotes,
                    r.ResolvedAt,
                    ResolvedByUserName = r.ResolvedByUser != null ? r.ResolvedByUser.Name : null,
                    LogframeLevel = r.LogframeLevel.HasValue ? r.LogframeLevel.ToString() : null,
                    r.LogframeEntityId,
                    r.CreatedAt
                })
                .ToListAsync();

            return Ok(risks);
        }

        /// <summary>
        /// Creates a new Risk or Issue entry in the project register and broadcasts via SignalR.
        /// </summary>
        /// <param name="id">Project ID.</param>
        /// <param name="req">Risk/issue details.</param>
        /// <returns>Created risk payload.</returns>
        [HttpPost("{id}/risks")]
        public async Task<ActionResult> CreateRisk(int id, [FromBody] CreateRiskIssueRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            if (!Enum.TryParse<RiskIssueType>(req.Type, true, out var riskType))
                return BadRequest("Invalid type. Use 'Risk' or 'Issue'.");

            // Permission check: Risk log edit required for Risk type; Issue creation for Issue type
            var projectResource = new ScopedResource(ScopeType.Project, id);
            var requiredPermission = riskType == RiskIssueType.Risk ? Permission.RiskLogEdit : Permission.IssueCreate;
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(requiredPermission))).Succeeded)
                return Forbid();

            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value ?? "0");

            var risk = new RiskIssue
            {
                ProjectId = id,
                Type = riskType,
                Description = req.Description,
                Likelihood = req.Likelihood ?? string.Empty,
                Impact = req.Impact ?? string.Empty,
                LikelihoodScore = req.LikelihoodScore,
                ImpactScore = req.ImpactScore,
                MitigationPlan = req.MitigationPlan,
                Owner = req.Owner ?? string.Empty,
                Status = req.Status ?? "Open",
                LogframeLevel = string.IsNullOrEmpty(req.LogframeLevel) ? null : Enum.Parse<LogframeLevel>(req.LogframeLevel, true),
                LogframeEntityId = req.LogframeEntityId,
                CreatedAt = DateTime.UtcNow
            };

            _db.RisksIssues.Add(risk);
            await _db.SaveChangesAsync();

            var payload = new
            {
                risk.Id,
                risk.ProjectId,
                Type = risk.Type.ToString(),
                risk.Description,
                risk.Likelihood,
                risk.Impact,
                risk.LikelihoodScore,
                risk.ImpactScore,
                RiskScore = risk.LikelihoodScore * risk.ImpactScore,
                risk.MitigationPlan,
                risk.Owner,
                risk.Status,
                LogframeLevel = risk.LogframeLevel.HasValue ? risk.LogframeLevel.ToString() : null,
                risk.LogframeEntityId,
                risk.CreatedAt
            };

            await _hubContext.Clients.Group($"project-{id}").SendAsync("RiskIssueCreated", payload);
            return Ok(payload);
        }

        /// <summary>
        /// Updates a Risk/Issue entry, scores, mitigation plans, or resolution notes.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="riskId">Risk primary key.</param>
        /// <param name="req">Updated fields.</param>
        /// <returns>Updated risk payload.</returns>
        [HttpPut("{projectId}/risks/{riskId}")]
        public async Task<ActionResult> UpdateRisk(int projectId, int riskId, [FromBody] UpdateRiskIssueRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound();

            var risk = await _db.RisksIssues.FirstOrDefaultAsync(r => r.Id == riskId && r.ProjectId == projectId);
            if (risk == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, projectId);

            // Editing risk fields (description, scores, mitigation) requires RiskLogEdit
            // Resolving an Issue requires IssueCreate (members can resolve their own issues)
            bool isResolutionOnly = req.MarkResolved == true
                && req.Description == null && req.Likelihood == null && req.Impact == null
                && req.LikelihoodScore == null && req.ImpactScore == null && req.MitigationPlan == null
                && req.Owner == null && req.Status == null;

            var requiredPermission = (isResolutionOnly && risk.Type == RiskIssueType.Issue)
                ? Permission.IssueCreate
                : Permission.RiskLogEdit;

            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(requiredPermission))).Succeeded)
                return Forbid();

            // Apply updates
            if (req.Description != null) risk.Description = req.Description;
            if (req.Likelihood != null) risk.Likelihood = req.Likelihood;
            if (req.Impact != null) risk.Impact = req.Impact;
            if (req.LikelihoodScore.HasValue) risk.LikelihoodScore = req.LikelihoodScore.Value;
            if (req.ImpactScore.HasValue) risk.ImpactScore = req.ImpactScore.Value;
            if (req.MitigationPlan != null) risk.MitigationPlan = req.MitigationPlan;
            if (req.Owner != null) risk.Owner = req.Owner;
            if (req.Status != null) risk.Status = req.Status;
            if (req.ResolutionNotes != null) risk.ResolutionNotes = req.ResolutionNotes;
            if (req.LogframeLevel != null) risk.LogframeLevel = Enum.Parse<LogframeLevel>(req.LogframeLevel, true);
            if (req.LogframeEntityId.HasValue) risk.LogframeEntityId = req.LogframeEntityId.Value;

            if (req.MarkResolved == true && risk.ResolvedAt == null)
            {
                var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value ?? "0");
                risk.ResolvedAt = DateTime.UtcNow;
                risk.ResolvedByUserId = userId;
                risk.Status = "Resolved";
            }

            await _db.SaveChangesAsync();

            // Reload with navigation
            var resolvedByUser = risk.ResolvedByUserId.HasValue
                ? await _db.Users.FindAsync(risk.ResolvedByUserId.Value)
                : null;

            var payload = new
            {
                risk.Id,
                risk.ProjectId,
                Type = risk.Type.ToString(),
                risk.Description,
                risk.Likelihood,
                risk.Impact,
                risk.LikelihoodScore,
                risk.ImpactScore,
                RiskScore = risk.LikelihoodScore * risk.ImpactScore,
                risk.MitigationPlan,
                risk.Owner,
                risk.Status,
                LogframeLevel = risk.LogframeLevel.HasValue ? risk.LogframeLevel.ToString() : null,
                risk.LogframeEntityId,
                risk.ResolutionNotes,
                risk.ResolvedAt,
                ResolvedByUserName = resolvedByUser?.Name,
                risk.CreatedAt
            };

            await _hubContext.Clients.Group($"project-{projectId}").SendAsync("RiskIssueUpdated", payload);
            return Ok(payload);
        }

        /// <summary>
        /// Deletes a Risk/Issue entry and broadcasts deletion via SignalR.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="riskId">Risk ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{projectId}/risks/{riskId}")]
        public async Task<ActionResult> DeleteRisk(int projectId, int riskId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, projectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.RiskLogEdit))).Succeeded)
                return Forbid();

            var risk = await _db.RisksIssues.FirstOrDefaultAsync(r => r.Id == riskId && r.ProjectId == projectId);
            if (risk == null) return NotFound();

            _db.RisksIssues.Remove(risk);
            await _db.SaveChangesAsync();

            await _hubContext.Clients.Group($"project-{projectId}").SendAsync("RiskIssueDeleted", new { Id = riskId, ProjectId = projectId });
            return NoContent();
        }

        /// <summary>
        /// Generates a comprehensive ZIP audit support package containing multi-sheet Excel workbooks and CSV ledgers.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <returns>ZIP file download stream.</returns>
        [HttpGet("{projectId}/export-audit-package")]
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
                    // 1. Audit Summary & Master Excel Workbook (.xlsx)
                    using (var workbook = new ClosedXML.Excel.XLWorkbook())
                    {
                        // Sheet 1: Executive Summary
                        var summarySheet = workbook.Worksheets.Add("Audit Summary");
                        summarySheet.Cell(1, 1).Value = "ORBITDESK FINANCIAL AUDIT SUPPORT PACKAGE";
                        summarySheet.Cell(1, 1).Style.Font.Bold = true;
                        summarySheet.Cell(1, 1).Style.Font.FontSize = 14;

                        summarySheet.Cell(3, 1).Value = "Project Title:";
                        summarySheet.Cell(3, 2).Value = project.Title;
                        summarySheet.Cell(4, 1).Value = "Project ID:";
                        summarySheet.Cell(4, 2).Value = project.Id;
                        summarySheet.Cell(5, 1).Value = "Status:";
                        summarySheet.Cell(5, 2).Value = project.Status.ToString();
                        summarySheet.Cell(6, 1).Value = "Generated Date (UTC):";
                        summarySheet.Cell(6, 2).Value = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");

                        summarySheet.Cell(8, 1).Value = "Financial Metric";
                        summarySheet.Cell(8, 2).Value = "Amount (USD eq.)";
                        summarySheet.Row(8).Style.Font.Bold = true;

                        summarySheet.Cell(9, 1).Value = "Total Project Budget";
                        summarySheet.Cell(9, 2).Value = budget?.TotalAmount ?? 0m;
                        summarySheet.Cell(10, 1).Value = "Total Approved Expenses";
                        var approvedExpensesTotal = 0m;
                        foreach (var e in expenses.Where(e => e.ApprovalStatus == ApprovalStatus.Approved))
                        {
                            approvedExpensesTotal += await _currencyService.ConvertAsync(e.Amount, e.Currency, "USD");
                        }
                        summarySheet.Cell(10, 2).Value = approvedExpensesTotal;
                        summarySheet.Cell(11, 1).Value = "Total Donor Allocations";
                        summarySheet.Cell(11, 2).Value = donorAllocations.Sum(da => da.AllocatedAmount);

                        summarySheet.Columns().AdjustToContents();

                        // Sheet 2: Budget Line Items & Revisions
                        var budgetSheet = workbook.Worksheets.Add("Budget & Revisions");
                        budgetSheet.Cell(1, 1).Value = "Line Item ID";
                        budgetSheet.Cell(1, 2).Value = "Category";
                        budgetSheet.Cell(1, 3).Value = "Description";
                        budgetSheet.Cell(1, 4).Value = "Amount ($)";
                        budgetSheet.Row(1).Style.Font.Bold = true;

                        int bRow = 2;
                        if (budget?.LineItems != null)
                        {
                            foreach (var item in budget.LineItems)
                            {
                                budgetSheet.Cell(bRow, 1).Value = item.Id;
                                budgetSheet.Cell(bRow, 2).Value = item.FinancialCategory?.Name ?? "General Line Item";
                                budgetSheet.Cell(bRow, 3).Value = item.Description;
                                budgetSheet.Cell(bRow, 4).Value = item.Amount;
                                bRow++;
                            }
                        }
                        budgetSheet.Columns().AdjustToContents();

                        // Sheet 3: Expense Ledger
                        var expenseSheet = workbook.Worksheets.Add("Expense Ledger");
                        expenseSheet.Cell(1, 1).Value = "Expense ID";
                        expenseSheet.Cell(1, 2).Value = "Description";
                        expenseSheet.Cell(1, 3).Value = "Amount";
                        expenseSheet.Cell(1, 4).Value = "Currency";
                        expenseSheet.Cell(1, 5).Value = "Date";
                        expenseSheet.Cell(1, 6).Value = "Approval Status";
                        expenseSheet.Row(1).Style.Font.Bold = true;

                        int eRow = 2;
                        foreach (var exp in expenses)
                        {
                            expenseSheet.Cell(eRow, 1).Value = exp.Id;
                            expenseSheet.Cell(eRow, 2).Value = exp.Description;
                            expenseSheet.Cell(eRow, 3).Value = exp.Amount;
                            expenseSheet.Cell(eRow, 4).Value = exp.Currency;
                            expenseSheet.Cell(eRow, 5).Value = exp.Date.ToString("yyyy-MM-dd");
                            expenseSheet.Cell(eRow, 6).Value = exp.ApprovalStatus.ToString();
                            eRow++;
                        }
                        expenseSheet.Columns().AdjustToContents();

                        // Sheet 4: Donor Allocations & Postponements
                        var donorSheet = workbook.Worksheets.Add("Grant & Timeline Trail");
                        donorSheet.Cell(1, 1).Value = "Donor ID";
                        donorSheet.Cell(1, 2).Value = "Donor Name";
                        donorSheet.Cell(1, 3).Value = "Allocated Amount ($)";
                        donorSheet.Cell(1, 4).Value = "Co-Funding %";
                        donorSheet.Row(1).Style.Font.Bold = true;

                        int dRow = 2;
                        foreach (var da in donorAllocations)
                        {
                            donorSheet.Cell(dRow, 1).Value = da.DonorId;
                            donorSheet.Cell(dRow, 2).Value = da.Donor?.Name ?? "—";
                            donorSheet.Cell(dRow, 3).Value = da.AllocatedAmount;
                            donorSheet.Cell(dRow, 4).Value = da.CoFundingPercentage;
                            dRow++;
                        }
                        donorSheet.Columns().AdjustToContents();

                        // Save Excel Workbook into ZIP
                        var excelEntry = archive.CreateEntry($"Audit_Master_Ledger_Project_{projectId}.xlsx");
                        using (var entryStream = excelEntry.Open())
                        {
                            workbook.SaveAs(entryStream);
                        }
                    }

                    // 2. Add CSV Ledgers into ZIP for multi-format auditor compatibility
                    var csvEntry = archive.CreateEntry($"Expense_Ledger_Project_{projectId}.csv");
                    using (var writer = new System.IO.StreamWriter(csvEntry.Open()))
                    {
                        writer.WriteLine("Expense ID,Description,Amount,Currency,Date,Approval Status");
                        foreach (var exp in expenses)
                        {
                            writer.WriteLine($"\"{exp.Id}\",\"{exp.Description.Replace("\"", "\"\"")}\",{exp.Amount},\"{exp.Currency}\",\"{exp.Date:yyyy-MM-dd}\",\"{exp.ApprovalStatus}\"");
                        }
                    }
                }
                return File(memoryStream.ToArray(), "application/zip", $"OrbitDesk_Audit_Package_Project_{projectId}_{DateTime.UtcNow:yyyy-MM-dd}.zip");
            }
        }
    }
}
