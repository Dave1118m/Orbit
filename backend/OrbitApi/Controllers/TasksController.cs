using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing task tracking, assignments, Kanban transitions, subtasks,
    /// dependencies, comments, attachments, and Google Calendar event sync.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly INotificationService _notificationService;
        private readonly IPermissionService _permissionService;
        private readonly IGoogleCalendarService _googleCalendarService;

        public TasksController(OrbitDbContext db, IAuthorizationService authorizationService, INotificationService notificationService, IPermissionService permissionService, IGoogleCalendarService googleCalendarService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _notificationService = notificationService;
            _permissionService = permissionService;
            _googleCalendarService = googleCalendarService;
        }

        /// <summary>
        /// Creates a new task within a project with date boundary validation and dependency checks.
        /// </summary>
        /// <param name="req">Task creation payload.</param>
        /// <returns>Created task DTO.</returns>
        [HttpPost]
        public async Task<ActionResult<TaskDto>> Create([FromBody] CreateTaskRequest req)
        {
            var projectResource = new ScopedResource(ScopeType.Project, req.ProjectId);
            if (!(await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskCreate))).Succeeded)
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(req.Title) || req.Title.Trim().Length < 2)
            {
                return BadRequest("Task title must be at least 2 characters long.");
            }
            if (req.Title.Trim().Length > 200)
            {
                return BadRequest("Task title cannot exceed 200 characters.");
            }

            var todayUtc = DateTime.UtcNow.Date;

            if (req.StartDate.HasValue && req.Deadline.HasValue && req.Deadline.Value.Date < req.StartDate.Value.Date)
            {
                return BadRequest("Task End Date (Deadline) cannot be earlier than Task Start Date.");
            }

            var project = await _db.Projects.FindAsync(req.ProjectId);
            if (project != null)
            {
                if (req.StartDate.HasValue && project.StartDate.HasValue && req.StartDate.Value.Date < project.StartDate.Value.Date)
                {
                    return BadRequest($"Task start date ({req.StartDate.Value:yyyy-MM-dd}) cannot be earlier than the project start date ({project.StartDate.Value:yyyy-MM-dd}).");
                }
                if (req.Deadline.HasValue && project.EndDate.HasValue && req.Deadline.Value.Date > project.EndDate.Value.Date)
                {
                    return BadRequest($"Task deadline ({req.Deadline.Value:yyyy-MM-dd}) cannot exceed the project end date ({project.EndDate.Value:yyyy-MM-dd}).");
                }
            }

            switch (req.Status)
            {
                case DTOs.TaskStatus.InProgress:
                case DTOs.TaskStatus.InReview:
                    if (req.StartDate.HasValue && req.StartDate.Value.Date > todayUtc)
                    {
                        return BadRequest("An In Progress task cannot have a Start Date in the future. Please set status to 'To Do' or select today as the Start Date.");
                    }
                    break;
                case DTOs.TaskStatus.Done:
                    if (req.Deadline.HasValue && req.Deadline.Value.Date > todayUtc)
                    {
                        return BadRequest("A Completed (Done) task cannot have a Deadline in the future.");
                    }
                    break;
                case DTOs.TaskStatus.ToDo:
                case DTOs.TaskStatus.Blocked:
                    // Dates are flexible
                    break;
            }

            if (req.ParentTaskId.HasValue)
            {
                var parentTask = await _db.Tasks.FindAsync(req.ParentTaskId.Value);
                if (parentTask != null)
                {
                    if (req.StartDate.HasValue && parentTask.StartDate.HasValue && req.StartDate.Value.Date < parentTask.StartDate.Value.Date)
                    {
                        return BadRequest($"Subtask start date cannot be earlier than parent task start date ({parentTask.StartDate.Value:yyyy-MM-dd}).");
                    }
                    if (req.Deadline.HasValue && parentTask.Deadline.HasValue && req.Deadline.Value.Date > parentTask.Deadline.Value.Date)
                    {
                        return BadRequest($"Subtask deadline cannot exceed parent task deadline ({parentTask.Deadline.Value:yyyy-MM-dd}).");
                    }
                }
            }

            var task = new TaskItem
            {
                ProjectId = req.ProjectId,
                Title = req.Title,
                Description = req.Description,
                Status = (OrbitApi.Models.TaskStatus)req.Status,
                Priority = (OrbitApi.Models.PriorityLevel)req.Priority,
                StartDate = req.StartDate,
                Deadline = req.Deadline,
                ParentTaskId = req.ParentTaskId,
                CategoryId = req.CategoryId.HasValue && req.CategoryId.Value > 0 ? req.CategoryId.Value : null
            };

            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();

            // Load category navigation if assigned
            if (task.CategoryId.HasValue)
            {
                await _db.Entry(task).Reference(t => t.Category).LoadAsync();
            }

            return Ok(MapToDto(task));
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
        public async Task<ActionResult> List([FromQuery] int? projectId)
        {
            var activeOrgId = GetActiveOrganizationId();

            var query = _db.Tasks
                .Include(t => t.Project)
                .ThenInclude(p => p!.Workspace)
                .Include(t => t.Category)
                .Where(t => !t.IsDeleted && t.ParentTaskId == null && t.Project != null && !t.Project.IsDeleted && t.Project.Workspace != null && t.Project.Workspace.OrganizationId == activeOrgId);

            if (projectId.HasValue)
            {
                var projectResource = new ScopedResource(ScopeType.Project, projectId.Value);
                var isAuth = (await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskView))).Succeeded;
                
                if (!isAuth)
                {
                    var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (int.TryParse(userIdClaim, out var userId))
                    {
                        isAuth = await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.OrganizationId == activeOrgId && m.Status == OrgMemberStatus.Active)
                              || await _db.Organizations.AnyAsync(o => o.Id == activeOrgId && o.OwnerId == userId && !o.IsDeleted);
                    }
                }

                if (!isAuth)
                {
                    return Forbid();
                }
                query = query.Where(t => t.ProjectId == projectId.Value);
            }

            var tasks = await query.ToListAsync();
            return Ok(tasks.Select(MapToDto));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TaskDto>> Get(int id)
        {
            var task = await _db.Tasks
                .Include(t => t.Category)
                .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
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

            if (req.Title != null)
            {
                if (string.IsNullOrWhiteSpace(req.Title) || req.Title.Trim().Length < 2)
                {
                    return BadRequest("Task title must be at least 2 characters long.");
                }
                if (req.Title.Trim().Length > 200)
                {
                    return BadRequest("Task title cannot exceed 200 characters.");
                }
                task.Title = req.Title.Trim();
            }
            if (req.Description != null) task.Description = req.Description;
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
            var finalStartDate = req.StartDate ?? task.StartDate;
            var finalDeadline = req.Deadline ?? task.Deadline;

            if (finalStartDate.HasValue && finalDeadline.HasValue && finalDeadline.Value.Date < finalStartDate.Value.Date)
            {
                return BadRequest("Task End Date (Deadline) cannot be earlier than Task Start Date.");
            }

            var project = await _db.Projects.FindAsync(task.ProjectId);
            if (project != null)
            {
                if (finalStartDate.HasValue && project.StartDate.HasValue && finalStartDate.Value.Date < project.StartDate.Value.Date)
                {
                    return BadRequest($"Task start date ({finalStartDate.Value:yyyy-MM-dd}) cannot be earlier than the project start date ({project.StartDate.Value:yyyy-MM-dd}).");
                }
                if (finalDeadline.HasValue && project.EndDate.HasValue && finalDeadline.Value.Date > project.EndDate.Value.Date)
                {
                    return BadRequest($"Task deadline ({finalDeadline.Value:yyyy-MM-dd}) cannot exceed the project end date ({project.EndDate.Value:yyyy-MM-dd}).");
                }
            }

            var todayUtcDate = DateTime.UtcNow.Date;
            var currentStatus = req.Status.HasValue ? (OrbitApi.Models.TaskStatus)req.Status.Value : task.Status;
            switch (currentStatus)
            {
                case OrbitApi.Models.TaskStatus.InProgress:
                case OrbitApi.Models.TaskStatus.InReview:
                    if (finalStartDate.HasValue && finalStartDate.Value.Date > todayUtcDate)
                    {
                        return BadRequest("An In Progress task cannot have a Start Date in the future. Please set status to 'To Do' or select today as the Start Date.");
                    }
                    break;
                case OrbitApi.Models.TaskStatus.Done:
                    if (finalDeadline.HasValue && finalDeadline.Value.Date > todayUtcDate)
                    {
                        return BadRequest("A Completed (Done) task cannot have a Deadline in the future.");
                    }
                    break;
            }

            if (finalStartDate.HasValue)
            {
                var dependencies = await _db.TaskDependencies
                    .Include(d => d.DependsOnTask)
                    .Where(d => d.TaskId == id)
                    .ToListAsync();
                    
                foreach (var dep in dependencies)
                {
                    if (dep.DependsOnTask != null && dep.DependsOnTask.Deadline.HasValue && finalStartDate.Value.Date < dep.DependsOnTask.Deadline.Value.Date)
                    {
                        return BadRequest($"Task start date cannot be earlier than the deadline of prerequisite task '{dep.DependsOnTask.Title}' ({dep.DependsOnTask.Deadline.Value:yyyy-MM-dd}).");
                    }
                }
            }

            if (req.ParentTaskId.HasValue) 
            {
                task.ParentTaskId = req.ParentTaskId;
            }

            if (task.ParentTaskId.HasValue)
            {
                var parentTask = await _db.Tasks.FindAsync(task.ParentTaskId.Value);
                if (parentTask != null)
                {
                    if (finalStartDate.HasValue && parentTask.StartDate.HasValue && finalStartDate.Value.Date < parentTask.StartDate.Value.Date)
                        return BadRequest($"Subtask start date cannot be earlier than parent task start date ({parentTask.StartDate.Value:yyyy-MM-dd}).");
                    if (finalDeadline.HasValue && parentTask.Deadline.HasValue && finalDeadline.Value.Date > parentTask.Deadline.Value.Date)
                        return BadRequest($"Subtask deadline cannot exceed parent task deadline ({parentTask.Deadline.Value:yyyy-MM-dd}).");
                }
            }

            if (req.StartDate.HasValue) task.StartDate = req.StartDate;

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

            if (req.CategoryId.HasValue)
            {
                task.CategoryId = req.CategoryId.Value > 0 ? req.CategoryId.Value : null;
            }

            await _db.SaveChangesAsync();

            if (task.CategoryId.HasValue)
            {
                await _db.Entry(task).Reference(t => t.Category).LoadAsync();
            }

            return Ok(MapToDto(task));
        }

        /// <summary>
        /// Soft-deletes a task item.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>NoContent on success.</returns>
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

        /// <summary>
        /// Creates a new subtask checklist item under a parent task.
        /// </summary>
        /// <param name="id">Parent Task ID.</param>
        /// <param name="req">Subtask title payload.</param>
        /// <returns>Created subtask DTO.</returns>
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

        /// <summary>
        /// Lists subtasks associated with a parent task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>List of subtask records.</returns>
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

        /// <summary>
        /// Updates a subtask completion status or title.
        /// </summary>
        /// <param name="taskId">Parent Task ID.</param>
        /// <param name="subtaskId">Subtask ID.</param>
        /// <param name="req">Updated fields.</param>
        /// <returns>Updated subtask DTO.</returns>
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

        /// <summary>
        /// Deletes a subtask.
        /// </summary>
        /// <param name="taskId">Parent Task ID.</param>
        /// <param name="subtaskId">Subtask ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{taskId}/subtasks/{subtaskId}")]
        public async Task<ActionResult> DeleteSubtask(int taskId, int subtaskId)
        {
            var subtask = await _db.Subtasks.FirstOrDefaultAsync(s => s.Id == subtaskId && s.TaskId == taskId);
            if (subtask == null) return NotFound();

            _db.Subtasks.Remove(subtask);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Quick-toggles subtask completion status.
        /// </summary>
        /// <param name="subtaskId">Subtask primary key.</param>
        /// <returns>Updated subtask DTO.</returns>
        [HttpPatch("/api/v1/subtasks/{subtaskId}/toggle")]
        public async Task<ActionResult> ToggleSubtaskStatus(int subtaskId)
        {
            var subtask = await _db.Subtasks.FindAsync(subtaskId);
            if (subtask == null) return NotFound();
            subtask.IsDone = !subtask.IsDone;
            await _db.SaveChangesAsync();
            return Ok(new SubtaskDto { Id = subtask.Id, TaskId = subtask.TaskId, Title = subtask.Title, IsDone = subtask.IsDone });
        }

        // --- Task Members (Assignment) ---

        /// <summary>
        /// Lists assigned team members for a task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>List of task members.</returns>
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

        /// <summary>
        /// Assigns a team member to a task and dispatches notification.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <param name="req">User ID to assign.</param>
        /// <returns>Task member record.</returns>
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

        /// <summary>
        /// Unassigns a user from a task.
        /// </summary>
        /// <param name="taskId">Task ID.</param>
        /// <param name="userId">User ID.</param>
        /// <returns>NoContent on success.</returns>
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

        /// <summary>
        /// Lists discussion comments on a task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>List of comment DTOs.</returns>
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

        /// <summary>
        /// Posts a comment on a task and triggers @mention notifications.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <param name="req">Comment content.</param>
        /// <returns>Created comment record.</returns>
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

        /// <summary>
        /// Lists file attachments and cloud documents on a task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>List of task attachments.</returns>
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

        /// <summary>
        /// Uploads a file or links an external cloud document to a task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <param name="file">File payload.</param>
        /// <param name="cloudUrl">External document URL.</param>
        /// <param name="cloudProvider">Cloud provider.</param>
        /// <param name="cloudFileName">Document name.</param>
        /// <returns>Created attachment metadata.</returns>
        [HttpPost("{id}/attachments")]
        public async Task<ActionResult> UploadAttachment(int id, [FromForm] IFormFile? file, [FromForm] string? cloudUrl, [FromForm] string? cloudProvider, [FromForm] string? cloudFileName)
        {
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
                    EntityType = EntityType.Task,
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

        /// <summary>
        /// Generates a Google Calendar event creation URL for adding task deadlines to calendar.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>Google Calendar URL.</returns>
        [HttpGet("{id}/google-calendar-url")]
        public async Task<ActionResult> GetGoogleCalendarUrl(int id)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            var url = _googleCalendarService.GenerateGoogleCalendarWebUrl(task);
            return Ok(new { url });
        }

        // --- Status History ---

        /// <summary>
        /// Retrieves the status change audit history for a task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>Status change history entries.</returns>
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

        /// <summary>
        /// Lists prerequisites and predecessor dependencies for a task.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <returns>List of task dependencies.</returns>
        [HttpGet("{id}/dependencies")]
        public async Task<ActionResult<IEnumerable<TaskDependencyDto>>> GetDependencies(int id)
        {
            var taskExists = await _db.Tasks.AnyAsync(t => t.Id == id);
            if (!taskExists) return NotFound("Task not found.");

            var dependencies = await _db.TaskDependencies
                .Where(td => td.TaskId == id)
                .Include(td => td.DependsOnTask)
                .ToListAsync();

            var dtos = dependencies.Select(td => new TaskDependencyDto
            {
                Id = td.Id,
                TaskId = td.TaskId,
                DependsOnTaskId = td.DependsOnTaskId,
                DependsOnTaskTitle = td.DependsOnTask?.Title ?? "Unknown Task",
                DependsOnTaskStatus = td.DependsOnTask?.Status.ToString() ?? "ToDo",
                DependencyType = td.DependencyType.ToString()
            }).ToList();

            return Ok(dtos);
        }

        /// <summary>
        /// Links a predecessor task dependency with circular dependency and timeline sequence validation.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <param name="req">Predecessor task ID.</param>
        /// <returns>Created dependency record.</returns>
        [HttpPost("{id}/dependencies")]
        public async Task<ActionResult<TaskDependencyDto>> AddDependency(int id, [FromBody] CreateTaskDependencyRequest req)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound("Task not found.");

            if (req.DependsOnTaskId == id)
            {
                return BadRequest("A task cannot depend on itself.");
            }

            var dependsOnTask = await _db.Tasks.FindAsync(req.DependsOnTaskId);
            if (dependsOnTask == null) return BadRequest("Predecessor task not found.");

            var existing = await _db.TaskDependencies
                .FirstOrDefaultAsync(td => td.TaskId == id && td.DependsOnTaskId == req.DependsOnTaskId);

            if (existing != null)
            {
                return BadRequest("This dependency link already exists.");
            }

            // Finish-to-Start: Task B cannot start before Task A ends
            if (task.StartDate.HasValue && dependsOnTask.Deadline.HasValue
                && task.StartDate.Value.Date < dependsOnTask.Deadline.Value.Date)
            {
                return BadRequest(
                    $"Dependency conflict: '{task.Title}' starts on {task.StartDate.Value:yyyy-MM-dd}, " +
                    $"but prerequisite '{dependsOnTask.Title}' ends on {dependsOnTask.Deadline.Value:yyyy-MM-dd}. " +
                    $"Please update task dates before linking.");
            }

            // Circular dependency check (simple: A→B then B→A)
            var reverseExists = await _db.TaskDependencies
                .AnyAsync(td => td.TaskId == req.DependsOnTaskId && td.DependsOnTaskId == id);
            if (reverseExists)
            {
                return BadRequest("Circular dependency detected: the predecessor already depends on this task.");
            }

            var dep = new TaskDependency
            {
                TaskId = id,
                DependsOnTaskId = req.DependsOnTaskId,
                DependencyType = DependencyType.FinishToStart
            };

            _db.TaskDependencies.Add(dep);
            await _db.SaveChangesAsync();

            return Ok(new TaskDependencyDto
            {
                Id = dep.Id,
                TaskId = dep.TaskId,
                DependsOnTaskId = dep.DependsOnTaskId,
                DependsOnTaskTitle = dependsOnTask.Title,
                DependsOnTaskStatus = dependsOnTask.Status.ToString(),
                DependencyType = dep.DependencyType.ToString()
            });
        }

        /// <summary>
        /// Removes a task dependency link.
        /// </summary>
        /// <param name="id">Task ID.</param>
        /// <param name="dependencyId">Dependency primary key.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}/dependencies/{dependencyId}")]
        public async Task<IActionResult> RemoveDependency(int id, int dependencyId)
        {
            var dep = await _db.TaskDependencies.FirstOrDefaultAsync(td => td.Id == dependencyId && td.TaskId == id);
            if (dep == null) return NotFound("Dependency not found.");

            _db.TaskDependencies.Remove(dep);
            await _db.SaveChangesAsync();

            return NoContent();
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
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return new List<int>();
            var isOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted)
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && a.Role.Name == RoleName.Owner)
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && m.Role.Name == RoleName.Owner);

            if (isOwner)
            {
                return await _db.Projects.Where(p => !p.IsDeleted).Select(p => p.Id).ToListAsync();
            }

            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var memberAssignments = await _db.OrganizationMembers.Include(m => m.Role)
                .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active)
                .ToListAsync();

            var projectIds = new List<int>();
            var workspaceIds = new List<int>();
            var organizationIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!await _permissionService.RoleHasPermissionAsync(assignment.Role!.Name, permission))
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

            foreach (var member in memberAssignments)
            {
                if (member.Role != null && await _permissionService.RoleHasPermissionAsync(member.Role.Name, permission))
                {
                    organizationIds.Add(member.OrganizationId);
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

            var resultIds = projectIds.Distinct().ToList();
            if (!resultIds.Any())
            {
                return await _db.Projects.Where(p => !p.IsDeleted).Select(p => p.Id).ToListAsync();
            }
            return resultIds;
        }

        private TaskDto MapToDto(TaskItem task)
        {
            return new TaskDto
            {
                Id = task.Id,
                ProjectId = task.ProjectId,
                Title = task.Title,
                Description = task.Description,
                Status = (OrbitApi.DTOs.TaskStatus)task.Status,
                Priority = (OrbitApi.DTOs.TaskPriority)task.Priority,
                StartDate = task.StartDate,
                Deadline = task.Deadline,
                CompletedDate = task.CompletedDate,
                ParentTaskId = task.ParentTaskId,
                CategoryId = task.CategoryId,
                CategoryName = task.Category?.Name
            };
        }
    }
}
