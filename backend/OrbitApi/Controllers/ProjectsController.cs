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

        public ProjectsController(OrbitDbContext db, IAuthorizationService authorizationService, IHubContext<OrbitHub> hubContext, INotificationService notificationService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _hubContext = hubContext;
            _notificationService = notificationService;
        }

        [HttpPost]
        public async Task<ActionResult<ProjectDto>> Create([FromBody] CreateProjectRequest req)
        {
            var workspaceResource = new ScopedResource(ScopeType.Workspace, req.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.ProjectCreate))).Succeeded)
            {
                return Forbid();
            }

            var project = new Project
            {
                WorkspaceId = req.WorkspaceId,
                Title = req.Title,
                Description = req.Description,
                Status = (ModelProjectStatus)req.Status,
                StartDate = req.StartDate,
                EndDate = req.EndDate,
                Budget = req.Budget,
                DonorId = req.DonorId
            };

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            var dto = new ProjectDto
            {
                Id = project.Id,
                WorkspaceId = project.WorkspaceId,
                Title = project.Title,
                Description = project.Description,
                Status = (DTOProjectStatus)project.Status,
                StartDate = project.StartDate,
                EndDate = project.EndDate,
                Budget = project.Budget,
                DonorId = project.DonorId
            };

            return CreatedAtAction(nameof(Get), new { id = project.Id }, dto);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProjectDto>>> List([FromQuery] int? workspaceId)
        {
            if (workspaceId.HasValue)
            {
                var workspaceResource = new ScopedResource(ScopeType.Workspace, workspaceId.Value);
                if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
                {
                    return Forbid();
                }
            }

            var workspaceIds = workspaceId.HasValue
                ? new List<int> { workspaceId.Value }
                : await GetAccessibleWorkspaceIdsAsync(Permission.ProjectView);

            if (!workspaceIds.Any())
            {
                return Ok(Array.Empty<ProjectDto>());
            }

            var projects = await _db.Projects
                .Where(p => workspaceIds.Contains(p.WorkspaceId) && !p.IsDeleted)
                .Select(p => new ProjectDto
                {
                    Id = p.Id,
                    WorkspaceId = p.WorkspaceId,
                    Title = p.Title,
                    Description = p.Description,
                    Status = (OrbitApi.DTOs.ProjectStatus)p.Status,
                    StartDate = p.StartDate,
                    EndDate = p.EndDate,
                    Budget = p.Budget,
                    DonorId = p.DonorId,
                    TaskCount = p.Tasks.Count
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

            return Ok(new ProjectDto
            {
                Id = project.Id,
                WorkspaceId = project.WorkspaceId,
                Title = project.Title,
                Description = project.Description,
                Status = (DTOProjectStatus)project.Status,
                StartDate = project.StartDate,
                EndDate = project.EndDate,
                Budget = project.Budget,
                DonorId = project.DonorId,
                TaskCount = project.Tasks.Count
            });
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

            if (req.Title != null) project.Title = req.Title;
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
            if (req.StartDate.HasValue) project.StartDate = req.StartDate;
            if (req.EndDate.HasValue)
            {
                project.EndDate = req.EndDate;
            }
            if (req.Budget.HasValue) project.Budget = req.Budget;
            if (req.DonorId.HasValue) project.DonorId = req.DonorId;

            await _db.SaveChangesAsync();

            return Ok(new ProjectDto
            {
                Id = project.Id,
                WorkspaceId = project.WorkspaceId,
                Title = project.Title,
                Description = project.Description,
                Status = (DTOProjectStatus)project.Status,
                StartDate = project.StartDate,
                EndDate = project.EndDate,
                Budget = project.Budget,
                DonorId = project.DonorId,
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

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded) // Or a Delete permission if one exists
            {
                return Forbid();
            }

            project.IsDeleted = true;
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
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var workspaceIds = new List<int>();
            var organizationIds = new List<int>();
            var projectIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!RolePermissionMapping.Defaults.TryGetValue(assignment.Role!.Name, out var perms) || !perms.Contains(permission))
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

            return workspaceIds.Distinct().ToList();
        }

        // --- Risk / Issue Log ---

        [HttpGet("{id}/risks")]
        public async Task<ActionResult> GetRisks(int id)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectView))).Succeeded)
                return Forbid();

            var risks = await _db.RisksIssues
                .Where(r => r.ProjectId == id)
                .OrderByDescending(r => r.Id)
                .Select(r => new
                {
                    r.Id,
                    r.ProjectId,
                    Type = r.Type.ToString(),
                    r.Likelihood,
                    r.Impact,
                    r.Owner,
                    r.Status
                })
                .ToListAsync();

            return Ok(risks);
        }

        [HttpPost("{id}/risks")]
        public async Task<ActionResult> CreateRisk(int id, [FromBody] CreateRiskIssueRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, id);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
                return Forbid();

            if (!Enum.TryParse<RiskIssueType>(req.Type, true, out var riskType))
                return BadRequest("Invalid type. Use 'Risk' or 'Issue'.");

            var risk = new RiskIssue
            {
                ProjectId = id,
                Type = riskType,
                Likelihood = req.Likelihood ?? "",
                Impact = req.Impact ?? "",
                Owner = req.Owner ?? "",
                Status = req.Status ?? "Open"
            };

            _db.RisksIssues.Add(risk);
            await _db.SaveChangesAsync();

            await _hubContext.Clients.Group($"project-{id}").SendAsync("RiskIssueCreated", new
            {
                risk.Id,
                risk.ProjectId,
                Type = risk.Type.ToString(),
                risk.Likelihood,
                risk.Impact,
                risk.Owner,
                risk.Status
            });

            return Ok(new
            {
                risk.Id,
                risk.ProjectId,
                Type = risk.Type.ToString(),
                risk.Likelihood,
                risk.Impact,
                risk.Owner,
                risk.Status
            });
        }

        [HttpPut("{projectId}/risks/{riskId}")]
        public async Task<ActionResult> UpdateRisk(int projectId, int riskId, [FromBody] UpdateRiskIssueRequest req)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, projectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
                return Forbid();

            var risk = await _db.RisksIssues.FirstOrDefaultAsync(r => r.Id == riskId && r.ProjectId == projectId);
            if (risk == null) return NotFound();

            if (req.Likelihood != null) risk.Likelihood = req.Likelihood;
            if (req.Impact != null) risk.Impact = req.Impact;
            if (req.Owner != null) risk.Owner = req.Owner;
            if (req.Status != null) risk.Status = req.Status;

            await _db.SaveChangesAsync();

            await _hubContext.Clients.Group($"project-{projectId}").SendAsync("RiskIssueUpdated", new
            {
                risk.Id,
                risk.ProjectId,
                Type = risk.Type.ToString(),
                risk.Likelihood,
                risk.Impact,
                risk.Owner,
                risk.Status
            });

            return Ok(new
            {
                risk.Id,
                risk.ProjectId,
                Type = risk.Type.ToString(),
                risk.Likelihood,
                risk.Impact,
                risk.Owner,
                risk.Status
            });
        }

        [HttpDelete("{projectId}/risks/{riskId}")]
        public async Task<ActionResult> DeleteRisk(int projectId, int riskId)
        {
            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, projectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.ProjectEdit))).Succeeded)
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
