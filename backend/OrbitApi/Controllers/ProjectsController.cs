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

        public ProjectsController(OrbitDbContext db, IAuthorizationService authorizationService, IHubContext<OrbitHub> hubContext, INotificationService notificationService, IPermissionService permissionService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _hubContext = hubContext;
            _notificationService = notificationService;
            _permissionService = permissionService;
        }

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
            if (req.Budget.HasValue && req.Budget.Value < 0)
            {
                return BadRequest("Project budget cannot be negative.");
            }

            if (req.StartDate.HasValue && req.EndDate.HasValue && req.EndDate.Value < req.StartDate.Value)
            {
                return BadRequest("Project End Date cannot be earlier than Start Date.");
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

            var donorIdsToLink = new HashSet<int>();
            if (req.DonorIds != null && req.DonorIds.Count > 0)
            {
                foreach (var dId in req.DonorIds) donorIdsToLink.Add(dId);
            }
            else if (req.DonorId.HasValue)
            {
                donorIdsToLink.Add(req.DonorId.Value);
            }

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
            return firstOrg?.Id ?? 2003;
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

            var projects = await query
                .Select(p => new ProjectDto
                {
                    Id = p.Id,
                    WorkspaceId = p.WorkspaceId,
                    Title = p.Title,
                    Description = p.Description,
                    Status = (DTOProjectStatus)p.Status,
                    StartDate = p.StartDate,
                    EndDate = p.EndDate,
                    Budget = _db.Budgets.Where(b => b.ProjectId == p.Id).Select(b => (decimal?)b.TotalAmount).FirstOrDefault(),
                    DonorId = p.ProjectDonors.Select(pd => (int?)pd.DonorId).FirstOrDefault(),
                    FundingType = p.FundingType ?? "SingleDonor",
                    TaskCount = p.Tasks.Count(t => !t.IsDeleted)
                }).ToListAsync();

            return Ok(projects);
        }

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

            if (req.Budget.HasValue && req.Budget.Value < 0)
            {
                return BadRequest("Project budget cannot be negative.");
            }
            if (req.Description != null) project.Description = req.Description;
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

        [HttpPost("{id}/attachments")]
        public async Task<ActionResult> UploadAttachment(int id, IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
            {
                return Forbid();
            }

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdStr, out var userId);

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
                    r.CreatedAt
                })
                .ToListAsync();

            return Ok(risks);
        }

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
                risk.CreatedAt
            };

            await _hubContext.Clients.Group($"project-{id}").SendAsync("RiskIssueCreated", payload);
            return Ok(payload);
        }

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
                risk.ResolutionNotes,
                risk.ResolvedAt,
                ResolvedByUserName = resolvedByUser?.Name,
                risk.CreatedAt
            };

            await _hubContext.Clients.Group($"project-{projectId}").SendAsync("RiskIssueUpdated", payload);
            return Ok(payload);
        }

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
    }
}
