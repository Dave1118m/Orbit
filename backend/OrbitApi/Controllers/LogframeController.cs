using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.Models;
using OrbitApi.Services;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;


namespace OrbitApi.Controllers
{
    /// <summary>
    /// Logical Framework (Logframe) Controller managing hierarchical project matrices
    /// (Goals -> Outcomes -> Outputs -> Activities), linked tasks, verifiable indicators, and donor CSV exports.
    /// </summary>
    [ApiController]
    [Route("api/v1/projects/{projectId}/logframe")]
    [Authorize]
    public class LogframeController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly ICacheService _cache;
        private const string LogframeCachePrefix = "logframe:";

        public LogframeController(OrbitDbContext db, IAuthorizationService authorizationService, ICacheService cache)
        {
            _db = db;
            _authorizationService = authorizationService;
            _cache = cache;
        }

        // ── Helper ────────────────────────────────────────────────────────────────

        private string LogframeCacheKey(int projectId) => $"{LogframeCachePrefix}{projectId}";

        private int? GetCurrentUserId() =>
            int.TryParse(
                User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value,
                out var id) ? id : null;

        private async Task<bool> IsAuthorizedForProjectAsync(int projectId, Permission permission)
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            if (int.TryParse(userIdStr, out var userId) && userId > 0)
            {
                var project = await _db.Projects.Include(p => p.Workspace).FirstOrDefaultAsync(p => p.Id == projectId);
                if (project != null && project.Workspace != null)
                {
                    var isOwnerOrMember = await _db.Organizations.AnyAsync(o => o.Id == project.Workspace.OrganizationId && o.OwnerId == userId && !o.IsDeleted)
                        || await _db.OrganizationMembers.AnyAsync(m => m.OrganizationId == project.Workspace.OrganizationId && m.UserId == userId && m.Status == OrgMemberStatus.Active);
                    if (isOwnerOrMember) return true;
                }
            }

            var projectResource = new ScopedResource(ScopeType.Project, projectId);
            return (await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(permission))).Succeeded;
        }

        // ── GET full logframe (with indicators + hierarchical progress rollups) ──

        /// <summary>
        /// Retrieves the entire hierarchical logframe matrix, linked tasks, rollups, and indicators for a project.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <returns>Logframe hierarchy and indicator payload.</returns>
        [HttpGet]
        public async Task<ActionResult> GetLogframe(int projectId)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectView)))
                return Forbid();

            // ── Cache hit ────────────────────────────────────────────────────────
            var cacheKey = LogframeCacheKey(projectId);
            var cachedResult = await _cache.GetAsync<object>(cacheKey);
            if (cachedResult != null)
                return Ok(cachedResult);

            // ── Cache miss — query DB with full tree ──────────────────────────────
            var rawGoals = await _db.LogframeGoals
                .Where(g => g.ProjectId == projectId)
                .Include(g => g.Outcomes)
                    .ThenInclude(o => o.Outputs)
                        .ThenInclude(op => op.Activities)
                            .ThenInclude(a => a.LinkedTask)
                .ToListAsync();

            var indicatorsList = await _db.Indicators
                .Where(i => i.ProjectId == projectId)
                .ToListAsync();

            var indicators = indicatorsList.Select(i => new
            {
                i.Id,
                i.ProjectId,
                Level = i.Level.ToString(),
                LevelInt = (int)i.Level,
                i.EntityId,
                i.Name,
                i.Baseline,
                i.Target,
                i.Actual,
                i.Unit,
                i.Notes,
                i.UpdatedAt
            }).ToList();

            // ── Compute hierarchical progress rollups ─────────────────────────────
            static int? ActivityProgress(LogframeActivity a) =>
                a.LinkedTask == null ? null :
                a.LinkedTask.Status == Models.TaskStatus.Done      ? 100 :
                a.LinkedTask.Status == Models.TaskStatus.InReview   ? 80  :
                a.LinkedTask.Status == Models.TaskStatus.InProgress ? 50  :
                a.LinkedTask.Status == Models.TaskStatus.Blocked    ? 20  : 0;

            static double? AverageProgress(IEnumerable<double?> values)
            {
                var valid = values.Where(v => v.HasValue).Select(v => v!.Value).ToList();
                return valid.Any() ? valid.Average() : null;
            }

            // Build typed result with rollups
            var goals = rawGoals.Select(g =>
            {
                var outcomes = g.Outcomes.Select(o =>
                {
                    var outputs = o.Outputs.Select(op =>
                    {
                        var activities = op.Activities.Select(a => new
                        {
                            a.Id,
                            a.Description,
                            a.CreatedAt,
                            a.LinkedTaskId,
                            LinkedTaskTitle = a.LinkedTask?.Title,
                            TaskProgress = ActivityProgress(a),
                            Progress = (double?)ActivityProgress(a),
                            LinkedTaskStatus = a.LinkedTask?.Status.ToString()
                        }).ToList();

                        var outputProgress = AverageProgress(activities.Select(a => a.Progress));
                        return new
                        {
                            op.Id,
                            op.Description,
                            op.CreatedAt,
                            Progress = outputProgress.HasValue ? Math.Round(outputProgress.Value, 1) : (double?)null,
                            Activities = activities
                        };
                    }).ToList();

                    var outcomeProgress = AverageProgress(outputs.Select(op => op.Progress));
                    return new
                    {
                        o.Id,
                        o.Description,
                        o.CreatedAt,
                        Progress = outcomeProgress.HasValue ? Math.Round(outcomeProgress.Value, 1) : (double?)null,
                        Outputs = outputs
                    };
                }).ToList();

                var goalProgress = AverageProgress(outcomes.Select(o => o.Progress));
                return new
                {
                    g.Id,
                    g.Description,
                    g.CreatedAt,
                    Progress = goalProgress.HasValue ? Math.Round(goalProgress.Value, 1) : (double?)null,
                    Outcomes = outcomes
                };
            }).ToList();

            var result = new { Goals = goals, Indicators = indicators };

            // Cache for 10 minutes — invalidated explicitly on any write
            await _cache.SetAsync(cacheKey, result, absoluteExpireTime: TimeSpan.FromMinutes(10));

            return Ok(result);
        }

        // ── Goals ─────────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a top-level Logframe Goal.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="req">Goal entity.</param>
        /// <returns>Created goal record.</returns>
        [HttpPost("goals")]
        public async Task<ActionResult> CreateGoal(int projectId, [FromBody] LogframeGoal req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            if (string.IsNullOrWhiteSpace(req.Description) || req.Description.Trim().Length < 2)
            {
                return BadRequest("Goal description must be at least 2 characters long.");
            }

            req.ProjectId = projectId;
            req.Description = req.Description.Trim();
            req.CreatedAt = DateTime.UtcNow;
            _db.LogframeGoals.Add(req);
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { req.Id, req.ProjectId, req.Description, req.CreatedAt });
        }

        [HttpPut("goals/{id}")]
        public async Task<ActionResult> UpdateGoal(int projectId, int id, [FromBody] LogframeItemUpdateRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeGoals.FirstOrDefaultAsync(g => g.Id == id && g.ProjectId == projectId);
            if (item == null) return NotFound();

            item.Description = req.Description;
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { item.Id, item.ProjectId, item.Description, item.CreatedAt });
        }

        [HttpDelete("goals/{id}")]
        public async Task<ActionResult> DeleteGoal(int projectId, int id)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeGoals.FindAsync(id);
            if (item != null) { _db.LogframeGoals.Remove(item); await _db.SaveChangesAsync(); }
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return NoContent();
        }

        // ── Outcomes ──────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a Logframe Outcome under a parent Goal.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="req">Outcome entity.</param>
        /// <returns>Created outcome record.</returns>
        [HttpPost("outcomes")]
        public async Task<ActionResult> CreateOutcome(int projectId, [FromBody] LogframeOutcome req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            req.CreatedAt = DateTime.UtcNow;
            _db.LogframeOutcomes.Add(req);
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { req.Id, req.GoalId, req.Description, req.CreatedAt });
        }

        [HttpPut("outcomes/{id}")]
        public async Task<ActionResult> UpdateOutcome(int projectId, int id, [FromBody] LogframeItemUpdateRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeOutcomes.FindAsync(id);
            if (item == null) return NotFound();

            item.Description = req.Description;
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { item.Id, item.GoalId, item.Description, item.CreatedAt });
        }

        [HttpDelete("outcomes/{id}")]
        public async Task<ActionResult> DeleteOutcome(int projectId, int id)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeOutcomes.FindAsync(id);
            if (item != null) { _db.LogframeOutcomes.Remove(item); await _db.SaveChangesAsync(); }
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return NoContent();
        }

        // ── Outputs ───────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a Logframe Output under a parent Outcome.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="req">Output entity.</param>
        /// <returns>Created output record.</returns>
        [HttpPost("outputs")]
        public async Task<ActionResult> CreateOutput(int projectId, [FromBody] LogframeOutput req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            req.CreatedAt = DateTime.UtcNow;
            _db.LogframeOutputs.Add(req);
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { req.Id, req.OutcomeId, req.Description, req.CreatedAt });
        }

        [HttpPut("outputs/{id}")]
        public async Task<ActionResult> UpdateOutput(int projectId, int id, [FromBody] LogframeItemUpdateRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeOutputs.FindAsync(id);
            if (item == null) return NotFound();

            item.Description = req.Description;
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { item.Id, item.OutcomeId, item.Description, item.CreatedAt });
        }

        [HttpDelete("outputs/{id}")]
        public async Task<ActionResult> DeleteOutput(int projectId, int id)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeOutputs.FindAsync(id);
            if (item != null) { _db.LogframeOutputs.Remove(item); await _db.SaveChangesAsync(); }
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return NoContent();
        }

        // ── Activities ────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates a Logframe Activity under a parent Output.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="req">Activity entity.</param>
        /// <returns>Created activity record.</returns>
        [HttpPost("activities")]
        public async Task<ActionResult> CreateActivity(int projectId, [FromBody] LogframeActivity req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            req.CreatedAt = DateTime.UtcNow;
            _db.LogframeActivities.Add(req);
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { req.Id, req.OutputId, req.Description, req.CreatedAt, req.LinkedTaskId });
        }

        [HttpPut("activities/{id}")]
        public async Task<ActionResult> UpdateActivity(int projectId, int id, [FromBody] ActivityUpdateRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeActivities.FindAsync(id);
            if (item == null) return NotFound();

            if (req.Description != null) item.Description = req.Description;

            if (req.LinkedTaskId.HasValue)
            {
                var taskBelongs = await _db.Tasks.AnyAsync(t => t.Id == req.LinkedTaskId.Value && t.ProjectId == projectId && !t.IsDeleted);
                if (!taskBelongs) return BadRequest("Task does not belong to this project.");
                item.LinkedTaskId = req.LinkedTaskId.Value;
            }
            else if (req.ClearTaskLink == true)
            {
                item.LinkedTaskId = null;
            }

            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { item.Id, item.OutputId, item.Description, item.CreatedAt, item.LinkedTaskId });
        }

        [HttpDelete("activities/{id}")]
        public async Task<ActionResult> DeleteActivity(int projectId, int id)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.LogframeActivities.FindAsync(id);
            if (item != null) { _db.LogframeActivities.Remove(item); await _db.SaveChangesAsync(); }
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return NoContent();
        }

        [HttpPost("activities/{activityId}/link-task")]
        public async Task<ActionResult> LinkTask(int projectId, int activityId, [FromBody] LinkTaskRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var activity = await _db.LogframeActivities
                .Include(a => a.Output)
                .ThenInclude(o => o!.Outcome)
                .ThenInclude(oc => oc!.Goal)
                .FirstOrDefaultAsync(a => a.Id == activityId);

            if (activity == null) return NotFound("Activity not found.");

            if (activity.Output?.Outcome?.Goal?.ProjectId != projectId)
                return BadRequest("Activity does not belong to this project.");

            if (req.TaskId.HasValue)
            {
                var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == req.TaskId.Value && t.ProjectId == projectId && !t.IsDeleted);
                if (task == null) return BadRequest("Task not found in this project.");
                activity.LinkedTaskId = req.TaskId.Value;
            }
            else
            {
                activity.LinkedTaskId = null;
            }

            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new { activity.Id, activity.LinkedTaskId });
        }

        // ── Indicators ────────────────────────────────────────────────────────────

        /// <summary>
        /// Adds a measurable indicator to any logframe hierarchy level.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <param name="req">Indicator baseline, target, actual, and unit payload.</param>
        /// <returns>Created indicator record.</returns>
        [HttpPost("indicators")]
        public async Task<ActionResult> CreateIndicator(int projectId, [FromBody] CreateIndicatorRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
            {
                return BadRequest("Indicator name must be at least 2 characters long.");
            }

            var indicator = new Indicator
            {
                ProjectId = projectId,
                Level = req.GetParsedLevel(),
                EntityId = req.EntityId,
                Name = req.Name.Trim(),
                Baseline = req.Baseline ?? string.Empty,
                Target = req.Target ?? string.Empty,
                Actual = string.IsNullOrEmpty(req.Actual) ? (req.Baseline ?? string.Empty) : req.Actual,
                Unit = req.Unit ?? string.Empty,
                Notes = req.Notes,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Indicators.Add(indicator);
            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new
            {
                indicator.Id,
                indicator.ProjectId,
                Level = indicator.Level.ToString(),
                LevelInt = (int)indicator.Level,
                indicator.EntityId,
                indicator.Name,
                indicator.Baseline,
                indicator.Target,
                indicator.Actual,
                indicator.Unit,
                indicator.Notes,
                indicator.UpdatedAt
            });
        }

        [HttpPut("indicators/{indicatorId}")]
        public async Task<ActionResult> UpdateIndicator(int projectId, int indicatorId, [FromBody] CreateIndicatorRequest req)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var indicator = await _db.Indicators.FirstOrDefaultAsync(i => i.Id == indicatorId && i.ProjectId == projectId);
            if (indicator == null) return NotFound();

            if (req.Name != null) indicator.Name = req.Name;
            if (req.Baseline != null) indicator.Baseline = req.Baseline;
            if (req.Target != null) indicator.Target = req.Target;
            if (req.Actual != null) indicator.Actual = req.Actual;
            if (req.Unit != null) indicator.Unit = req.Unit;
            if (req.Notes != null) indicator.Notes = req.Notes;
            indicator.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return Ok(new
            {
                indicator.Id,
                indicator.ProjectId,
                Level = indicator.Level.ToString(),
                LevelInt = (int)indicator.Level,
                indicator.EntityId,
                indicator.Name,
                indicator.Baseline,
                indicator.Target,
                indicator.Actual,
                indicator.Unit,
                indicator.Notes,
                indicator.UpdatedAt
            });
        }

        [HttpDelete("indicators/{id}")]
        public async Task<ActionResult> DeleteIndicator(int projectId, int id)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectEdit)))
                return Forbid();

            var item = await _db.Indicators.FindAsync(id);
            if (item != null) { _db.Indicators.Remove(item); await _db.SaveChangesAsync(); }
            await _cache.RemoveAsync(LogframeCacheKey(projectId));
            return NoContent();
        }

        // ── Export (donor-preferred CSV) ──────────────────────────────────────────

        /// <summary>
        /// Exports the logframe hierarchy and verifiable indicator metrics as a donor-compliant CSV.
        /// </summary>
        /// <param name="projectId">Project ID.</param>
        /// <returns>CSV file download stream.</returns>
        [HttpGet("export")]
        public async Task<IActionResult> ExportLogframe(int projectId)
        {
            if (!(await IsAuthorizedForProjectAsync(projectId, Permission.ProjectView)))
                return Forbid();

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && !p.IsDeleted);
            if (project == null) return NotFound();

            var goals = await _db.LogframeGoals
                .Where(g => g.ProjectId == projectId)
                .Include(g => g.Outcomes)
                    .ThenInclude(o => o.Outputs)
                        .ThenInclude(op => op.Activities)
                            .ThenInclude(a => a.LinkedTask)
                .ToListAsync();

            var indicators = await _db.Indicators
                .Where(i => i.ProjectId == projectId)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("Level,ID,Description,Linked Task,Task Status,Task Progress (%),Indicator Name,Baseline,Target,Actual,Unit,Notes");

            void AppendIndicators(LogframeLevel level, int entityId)
            {
                var inds = indicators.Where(i => i.Level == level && i.EntityId == entityId).ToList();
                if (!inds.Any()) return;
                foreach (var ind in inds)
                {
                    sb.AppendLine($",,,,,,\"{ind.Name}\",\"{ind.Baseline}\",\"{ind.Target}\",\"{ind.Actual}\",\"{ind.Unit}\",\"{ind.Notes}\"");
                }
            }

            foreach (var goal in goals)
            {
                sb.AppendLine($"Goal,{goal.Id},\"{goal.Description.Replace("\"", "\"\"")}\",,,,,,,,,");
                AppendIndicators(LogframeLevel.Goal, goal.Id);

                foreach (var outcome in goal.Outcomes)
                {
                    sb.AppendLine($"Outcome,{outcome.Id},\"{outcome.Description.Replace("\"", "\"\"")}\",,,,,,,,,");
                    AppendIndicators(LogframeLevel.Outcome, outcome.Id);

                    foreach (var output in outcome.Outputs)
                    {
                        sb.AppendLine($"Output,{output.Id},\"{output.Description.Replace("\"", "\"\"")}\",,,,,,,,,");
                        AppendIndicators(LogframeLevel.Output, output.Id);

                        foreach (var activity in output.Activities)
                        {
                            var taskTitle = activity.LinkedTask?.Title ?? "";
                            var taskStatus = activity.LinkedTask?.Status.ToString() ?? "";
                            var taskProgress = activity.LinkedTask != null
                                ? (activity.LinkedTask.Status == Models.TaskStatus.Done ? 100
                                    : activity.LinkedTask.Status == Models.TaskStatus.InReview ? 80
                                    : activity.LinkedTask.Status == Models.TaskStatus.InProgress ? 50
                                    : activity.LinkedTask.Status == Models.TaskStatus.Blocked ? 20
                                    : 0).ToString()
                                : "";

                            sb.AppendLine($"Activity,{activity.Id},\"{activity.Description.Replace("\"", "\"\"")}\",\"{taskTitle}\",\"{taskStatus}\",\"{taskProgress}\",,,,,, ");
                            AppendIndicators(LogframeLevel.Activity, activity.Id);
                        }
                    }
                }
            }

            var bytes = Encoding.UTF8.GetBytes(sb.ToString());
            var fileName = $"Orbit_Logframe_{project.Title.Replace(" ", "_")}_{DateTime.UtcNow:yyyy-MM-dd}.csv";
            return File(bytes, "text/csv", fileName);
        }
    }

    public class LogframeItemUpdateRequest
    {
        public string Description { get; set; } = string.Empty;
    }

    public class ActivityUpdateRequest
    {
        public string? Description { get; set; }
        public int? LinkedTaskId { get; set; }
        public bool? ClearTaskLink { get; set; }
    }

    public class LinkTaskRequest
    {
        public int? TaskId { get; set; }
    }

    public class CreateIndicatorRequest
    {
        public object? Level { get; set; }
        public int EntityId { get; set; }
        public string? Name { get; set; }
        public string? Baseline { get; set; }
        public string? Target { get; set; }
        public string? Actual { get; set; }
        public string? Unit { get; set; }
        public string? Notes { get; set; }

        public LogframeLevel GetParsedLevel()
        {
            if (Level == null) return LogframeLevel.Goal;
            if (Level is int intVal) return (LogframeLevel)intVal;
            if (Level is long longVal) return (LogframeLevel)(int)longVal;
            var strVal = Level.ToString() ?? "";
            if (int.TryParse(strVal, out var parsedInt)) return (LogframeLevel)parsedInt;
            if (Enum.TryParse<LogframeLevel>(strVal, true, out var parsedEnum)) return parsedEnum;
            return LogframeLevel.Goal;
        }
    }
}
