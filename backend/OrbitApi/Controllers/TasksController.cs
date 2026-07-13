using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly INotificationService _notificationService;

        public TasksController(OrbitDbContext db, IAuthorizationService authorizationService, INotificationService notificationService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _notificationService = notificationService;
        }

        [HttpPost]
        public async Task<ActionResult<TaskDto>> Create([FromBody] CreateTaskRequest req)
        {
            var projectResource = new ScopedResource(ScopeType.Project, req.ProjectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskCreate))).Succeeded)
            {
                return Forbid();
            }

            var task = new TaskItem
            {
                ProjectId = req.ProjectId,
                Title = req.Title,
                Status = (OrbitApi.Models.TaskStatus)req.Status,
                Priority = (OrbitApi.Models.PriorityLevel)req.Priority,
                Deadline = req.Deadline,
                ParentTaskId = req.ParentTaskId
            };

            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();

            return Ok(MapToDto(task));
        }

        [HttpGet]
        public async Task<ActionResult> List([FromQuery] int? projectId)
        {
            if (projectId.HasValue)
            {
                var projectResource = new ScopedResource(ScopeType.Project, projectId.Value);
                if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskView))).Succeeded)
                {
                    return Forbid();
                }
            }

            var projectIds = projectId.HasValue
                ? new List<int> { projectId.Value }
                : await GetAccessibleProjectIdsAsync(Permission.TaskView);

            if (!projectIds.Any())
            {
                return Ok(Array.Empty<TaskDto>());
            }

            var tasks = await _db.Tasks
                .Where(t => projectIds.Contains(t.ProjectId) && !t.IsDeleted)
                .ToListAsync();

            return Ok(tasks.Select(MapToDto));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskDto>> Get(int id)
        {
            var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
            if (task == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskView))).Succeeded)
            {
                return Forbid();
            }

            return Ok(MapToDto(task));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TaskDto>> Update(int id, [FromBody] UpdateTaskRequest req)
        {
            var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
            if (task == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskEdit))).Succeeded)
            {
                return Forbid();
            }

            if (req.Title != null) task.Title = req.Title;
            if (req.Status.HasValue)
            {
                if (task.Status != (OrbitApi.Models.TaskStatus)req.Status.Value)
                {
                    var oldStatus = task.Status.ToString();
                    var newStatus = ((OrbitApi.Models.TaskStatus)req.Status.Value).ToString();
                    
                    task.Status = (OrbitApi.Models.TaskStatus)req.Status.Value;
                    
                    if (task.Status == OrbitApi.Models.TaskStatus.Done)
                    {
                        task.CompletedDate = DateTime.UtcNow;
                    }
                    else
                    {
                        task.CompletedDate = null; // Reverted if moved back from Done
                    }

                    var assignedUserIds = await _db.TaskMembers
                        .Where(tm => tm.TaskId == id)
                        .Select(tm => tm.UserId)
                        .Distinct()
                        .ToListAsync();

                    if (assignedUserIds.Any())
                    {
                        await _notificationService.NotifyUsersAsync(assignedUserIds, $"Status for task '{task.Title}' changed from {oldStatus} to {newStatus}.");
                    }

                    var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (int.TryParse(userIdStr, out var userId))
                    {
                        var history = new TaskStatusHistory
                        {
                            TaskId = task.Id,
                            OldStatus = oldStatus,
                            NewStatus = newStatus,
                            ChangedByUserId = userId,
                            ChangedAt = DateTime.UtcNow
                        };
                        _db.Set<TaskStatusHistory>().Add(history);
                    }
                }
            }
            if (req.Priority.HasValue) task.Priority = (OrbitApi.Models.PriorityLevel)req.Priority.Value;
            if (req.Deadline.HasValue)
            {
                var oldDeadlineText = task.Deadline.HasValue ? task.Deadline.Value.ToString("yyyy-MM-dd") : "No deadline";
                var newDeadlineText = req.Deadline.Value.ToString("yyyy-MM-dd");
                if (task.Deadline != req.Deadline)
                {
                    task.Deadline = req.Deadline;

                    var assignedUserIds = await _db.TaskMembers
                        .Where(tm => tm.TaskId == id)
                        .Select(tm => tm.UserId)
                        .Distinct()
                        .ToListAsync();

                    if (assignedUserIds.Any())
                    {
                        await _notificationService.NotifyUsersAsync(assignedUserIds, $"Deadline for task '{task.Title}' changed from {oldDeadlineText} to {newDeadlineText}.");
                    }
                }
                else
                {
                    task.Deadline = req.Deadline;
                }
            }
            if (req.ParentTaskId.HasValue) task.ParentTaskId = req.ParentTaskId;

            await _db.SaveChangesAsync();

            return Ok(MapToDto(task));
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
            if (task == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskEdit))).Succeeded)
            {
                return Forbid();
            }

            task.IsDeleted = true;
            await _db.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("{id}/subtasks")]
        public async Task<ActionResult<SubtaskDto>> CreateSubtask(int id, [FromBody] CreateSubtaskRequest req)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskEdit))).Succeeded)
            {
                return Forbid();
            }

            var subtask = new Subtask
            {
                TaskId = id,
                Title = req.Title,
                IsDone = false
            };

            _db.Subtasks.Add(subtask);
            await _db.SaveChangesAsync();

            return Ok(new SubtaskDto
            {
                Id = subtask.Id,
                TaskId = subtask.TaskId,
                Title = subtask.Title,
                IsDone = subtask.IsDone
            });
        }

        [HttpGet("{id}/subtasks")]
        public async Task<ActionResult> GetSubtasks(int id)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            var subtasks = await _db.Subtasks
                .Where(s => s.TaskId == id)
                .Select(s => new SubtaskDto { Id = s.Id, TaskId = s.TaskId, Title = s.Title, IsDone = s.IsDone })
                .ToListAsync();

            return Ok(subtasks);
        }

        [HttpPut("{taskId}/subtasks/{subtaskId}")]
        public async Task<ActionResult> ToggleSubtask(int taskId, int subtaskId, [FromBody] SubtaskDto req)
        {
            var subtask = await _db.Subtasks.FirstOrDefaultAsync(s => s.Id == subtaskId && s.TaskId == taskId);
            if (subtask == null) return NotFound();

            subtask.IsDone = req.IsDone;
            if (req.Title != null) subtask.Title = req.Title;
            await _db.SaveChangesAsync();

            return Ok(new SubtaskDto { Id = subtask.Id, TaskId = subtask.TaskId, Title = subtask.Title, IsDone = subtask.IsDone });
        }

        [HttpDelete("{taskId}/subtasks/{subtaskId}")]
        public async Task<ActionResult> DeleteSubtask(int taskId, int subtaskId)
        {
            var subtask = await _db.Subtasks.FirstOrDefaultAsync(s => s.Id == subtaskId && s.TaskId == taskId);
            if (subtask == null) return NotFound();

            _db.Subtasks.Remove(subtask);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        // --- Task Members (Assignment) ---

        [HttpGet("{id}/members")]
        public async Task<ActionResult> GetMembers(int id)
        {
            var members = await _db.TaskMembers
                .Include(m => m.User)
                .Where(m => m.TaskId == id)
                .Select(m => new TaskMemberDto
                {
                    Id = m.Id,
                    TaskId = m.TaskId,
                    UserId = m.UserId,
                    UserName = m.User != null ? m.User.Name : null,
                    UserEmail = m.User != null ? m.User.Email : null
                })
                .ToListAsync();

            return Ok(members);
        }

        [HttpPost("{id}/members")]
        public async Task<ActionResult> AssignMember(int id, [FromBody] AssignTaskMemberRequest req)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            var exists = await _db.TaskMembers.AnyAsync(m => m.TaskId == id && m.UserId == req.UserId);
            if (exists) return Conflict("User is already assigned.");

            var member = new TaskMember { TaskId = id, UserId = req.UserId };
            _db.TaskMembers.Add(member);
            await _db.SaveChangesAsync();

            var assignedUser = await _db.Users.FindAsync(req.UserId);
            if (assignedUser != null)
            {
                var message = $"You were assigned to task '{task.Title}'.";
                await _notificationService.NotifyUserAsync(req.UserId, message);
            }

            return Ok(new TaskMemberDto { Id = member.Id, TaskId = member.TaskId, UserId = member.UserId });
        }

        [HttpDelete("{taskId}/members/{userId}")]
        public async Task<ActionResult> UnassignMember(int taskId, int userId)
        {
            var member = await _db.TaskMembers.FirstOrDefaultAsync(m => m.TaskId == taskId && m.UserId == userId);
            if (member == null) return NotFound();

            _db.TaskMembers.Remove(member);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        // --- Comments ---

        [HttpGet("{id}/comments")]
        public async Task<ActionResult> GetComments(int id)
        {
            var comments = await _db.Comments
                .Where(c => c.EntityType == EntityType.Task && c.EntityId == id && c.ParentCommentId == null)
                .OrderByDescending(c => c.CreatedAt)
                .Include(c => c.Replies)
                .ToListAsync();

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
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            var comment = new Comment
            {
                EntityType = EntityType.Task,
                EntityId = id,
                UserId = userId,
                Content = req.Content,
                ParentCommentId = req.ParentCommentId,
                CreatedAt = DateTime.UtcNow
            };

            _db.Comments.Add(comment);
            await _db.SaveChangesAsync();

            var task = await _db.Tasks.FindAsync(id);
            if (task != null)
            {
                var mentionedUserIds = ParseMentions(req.Content);
                foreach (var mentionedUserId in mentionedUserIds)
                {
                    var mentionedUser = await _db.Users.FindAsync(mentionedUserId);
                    if (mentionedUser != null)
                    {
                        var message = $"You were mentioned in a comment on task '{task.Title}'.";
                        await _notificationService.NotifyUserAsync(mentionedUserId, message);
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

        private List<int> ParseMentions(string content)
        {
            var mentionedIds = new List<int>();
            if (string.IsNullOrWhiteSpace(content)) return mentionedIds;

            var tokens = content.Split(new[] { ' ', '\n', '\r', '\t', ',', '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var token in tokens)
            {
                if (!token.StartsWith("@")) continue;
                if (int.TryParse(token.TrimStart('@'), out var userId))
                {
                    mentionedIds.Add(userId);
                }
            }

            return mentionedIds.Distinct().ToList();
        }

        // --- Attachments ---

        [HttpGet("{id}/attachments")]
        public async Task<ActionResult> GetAttachments(int id)
        {
            var attachments = await _db.Attachments
                .Where(a => a.EntityType == EntityType.Task && a.EntityId == id)
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
                    DownloadUrl = $"https://localhost:7065/api/v1/tasks/attachments/{a.Id}/download",
                    PreviewUrl = a.PreviewEnabled ? $"https://localhost:7065/api/v1/tasks/attachments/{a.Id}/download" : null,
                    UserId = a.UserId
                })
                .ToListAsync();

            return Ok(attachments);
        }

        [HttpPost("{id}/attachments")]
        public async Task<ActionResult> UploadAttachment(int id, IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdStr, out var userId);

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Tasks", id.ToString());
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
                EntityType = EntityType.Task,
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
                DownloadUrl = $"https://localhost:7065/api/v1/tasks/attachments/{attachment.Id}/download",
                PreviewUrl = attachment.PreviewEnabled ? $"https://localhost:7065/api/v1/tasks/attachments/{attachment.Id}/download" : null,
                UserId = attachment.UserId
            });
        }

        [HttpGet("attachments/{attachmentId}/download")]
        public async Task<ActionResult> DownloadAttachment(int attachmentId)
        {
            var attachment = await _db.Attachments.FindAsync(attachmentId);
            if (attachment == null) return NotFound();

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
            if (attachment == null) return NotFound();

            if (System.IO.File.Exists(attachment.AbsoluteFilePath))
                System.IO.File.Delete(attachment.AbsoluteFilePath);

            _db.Attachments.Remove(attachment);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        // --- Status History ---

        [HttpGet("{id}/history")]
        public async Task<ActionResult> GetStatusHistory(int id)
        {
            var histories = await _db.TaskStatusHistories
                .Where(h => h.TaskId == id)
                .OrderByDescending(h => h.ChangedAt)
                .ToListAsync();

            var userIds = histories.Select(h => h.ChangedByUserId).Distinct().ToList();
            var users = await _db.Users.Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);

            var dtos = histories.Select(h => new TaskStatusHistoryDto
            {
                Id = h.Id,
                TaskId = h.TaskId,
                OldStatus = h.OldStatus,
                NewStatus = h.NewStatus,
                ChangedByUserId = h.ChangedByUserId,
                ChangedByUserName = users.GetValueOrDefault(h.ChangedByUserId),
                ChangedAt = h.ChangedAt
            }).ToList();

            return Ok(dtos);
        }

        // --- Helpers ---

        private static OrbitApi.Models.MediaType DetermineMediaType(string contentType)
        {
            if (contentType.StartsWith("image/")) return OrbitApi.Models.MediaType.Image;
            if (contentType.StartsWith("video/")) return OrbitApi.Models.MediaType.Video;
            if (contentType.StartsWith("audio/")) return OrbitApi.Models.MediaType.Audio;
            return OrbitApi.Models.MediaType.Document;
        }

        private async Task<List<int>> GetAccessibleProjectIdsAsync(Permission permission)
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var projectIds = new List<int>();
            var workspaceIds = new List<int>();
            var organizationIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!RolePermissionMapping.Defaults.TryGetValue(assignment.Role!.Name, out var perms) || !perms.Contains(permission))
                    continue;

                switch (assignment.ScopeType)
                {
                    case ScopeType.Project:
                        projectIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Workspace:
                        workspaceIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Organization:
                        organizationIds.Add(assignment.ScopeId);
                        break;
                }
            }

            if (workspaceIds.Any())
            {
                var workspaceProjects = await _db.Projects
                    .Where(p => workspaceIds.Contains(p.WorkspaceId))
                    .Select(p => p.Id)
                    .ToListAsync();
                projectIds.AddRange(workspaceProjects);
            }

            if (organizationIds.Any())
            {
                var orgProjects = await _db.Projects
                    .Where(p => p.Workspace != null && organizationIds.Contains(p.Workspace.OrganizationId))
                    .Select(p => p.Id)
                    .ToListAsync();
                projectIds.AddRange(orgProjects);
            }

            return projectIds.Distinct().ToList();
        }

        private TaskDto MapToDto(TaskItem task)
        {
            return new TaskDto
            {
                Id = task.Id,
                ProjectId = task.ProjectId,
                Title = task.Title,
                Status = (OrbitApi.DTOs.TaskStatus)task.Status,
                Priority = (OrbitApi.DTOs.TaskPriority)task.Priority,
                Deadline = task.Deadline,
                CompletedDate = task.CompletedDate,
                ParentTaskId = task.ParentTaskId
            };
        }
    }
}
