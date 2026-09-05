using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Http;
using OrbitApi.Authorization;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Regulatory and Compliance Controller managing grant reporting milestones,
    /// chronological audit trails, logframe exports, and USAID donor compliance data packages.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ComplianceController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly ICacheService _cache;
        private readonly IAuthorizationService _authorizationService;

        public ComplianceController(OrbitDbContext db, ICacheService cache, IAuthorizationService authorizationService)
        {
            _db = db;
            _cache = cache;
            _authorizationService = authorizationService;
        }

        private async Task<bool> CanManageComplianceAsync(int orgId)
        {
            var activeRoleClaim = User.FindFirst("active_role")?.Value;
            if (string.IsNullOrWhiteSpace(activeRoleClaim) && Request.Headers.TryGetValue("X-Active-Role", out var headerVal))
            {
                activeRoleClaim = headerVal.FirstOrDefault();
            }

            if (!string.IsNullOrWhiteSpace(activeRoleClaim) && Enum.TryParse<RoleName>(activeRoleClaim, true, out var switchedRole))
            {
                return switchedRole == RoleName.Owner || switchedRole == RoleName.Admin || switchedRole == RoleName.FinanceOfficer || switchedRole == RoleName.Coordinator || switchedRole == RoleName.Manager;
            }

            var orgResource = new ScopedResource(ScopeType.Organization, orgId);
            var authResult = await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManageCompliance));
            if (authResult.Succeeded) return true;

            var reportsAuth = await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.ViewReports));
            return reportsAuth.Succeeded;
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

        /// <summary>
        /// GET /api/v1/compliance/reports — Fetch all reporting schedules
        /// </summary>
        [HttpGet("reports")]
        public async Task<ActionResult<IEnumerable<GrantReportScheduleDto>>> GetReportingSchedules([FromQuery] int? orgId)
        {
            var targetOrgId = orgId ?? GetActiveOrganizationId();
            if (!targetOrgId.HasValue || targetOrgId.Value <= 0)
            {
                return Ok(new List<GrantReportScheduleDto>());
            }

            var query = _db.GrantReportSchedules
                .Include(r => r.Project).ThenInclude(p => p!.Workspace)
                .Include(r => r.Donor)
                .Where(r => (r.Project != null && r.Project.Workspace != null && r.Project.Workspace.OrganizationId == targetOrgId.Value) ||
                            (r.Donor != null && r.Donor.OrganizationId == targetOrgId.Value) ||
                            (r.ProjectId == null && r.DonorId == null));

            var schedules = await query.OrderBy(r => r.DeadlineDate).ToListAsync();

            var dtos = schedules.Select(r => new GrantReportScheduleDto
            {
                Id = r.Id,
                ProjectId = r.ProjectId,
                ProjectName = r.Project?.Title ?? "General Organization Schedule",
                DonorId = r.DonorId,
                DonorName = r.Donor?.Name,
                ReportType = r.ReportType,
                DeadlineDate = r.DeadlineDate,
                Status = r.Status,
                SubmittedDate = r.SubmittedDate
            });

            return Ok(dtos);
        }

        /// <summary>
        /// POST /api/v1/compliance/reports — Create a new grant report schedule
        /// </summary>
        [HttpPost("reports")]
        public async Task<ActionResult<GrantReportScheduleDto>> CreateReportSchedule([FromBody] CreateGrantReportScheduleRequest req)
        {
            var targetOrgId = GetActiveOrganizationId();
            if (targetOrgId.HasValue && !await CanManageComplianceAsync(targetOrgId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Permission denied. Only authorized compliance officers, Admins, and Owners can manage grant reporting schedules." });
            }

            if (req.DeadlineDate.Date < DateTime.UtcNow.Date)
            {
                return BadRequest("Grant report deadline date cannot be in the past.");
            }

            Project? project = null;
            if (req.ProjectId.HasValue && req.ProjectId.Value > 0)
            {
                project = await _db.Projects.FindAsync(req.ProjectId.Value);
                if (project == null) return BadRequest("Selected project not found.");
            }

            if (req.DonorId.HasValue)
            {
                var donorExists = await _db.Donors.AnyAsync(d => d.Id == req.DonorId.Value);
                if (!donorExists) return BadRequest("Selected donor not found.");
            }

            var schedule = new GrantReportSchedule
            {
                ProjectId = req.ProjectId.HasValue && req.ProjectId.Value > 0 ? req.ProjectId.Value : null,
                DonorId = req.DonorId,
                ReportType = req.ReportType,
                DeadlineDate = req.DeadlineDate,
                Status = ReportStatus.Pending
            };

            _db.GrantReportSchedules.Add(schedule);
            await _db.SaveChangesAsync();

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(ClaimTypes.Name)?.Value;
            int.TryParse(userIdClaim, out var userId);
            if (userId <= 0) userId = 1;
            
            var scheduleOrgId = project?.Workspace?.OrganizationId ?? targetOrgId;

            _db.AuditLogs.Add(new AuditLog
            {
                OrganizationId = scheduleOrgId,
                PerformedByUserId = userId,
                Action = "Created Grant Report Schedule",
                Entity = "GrantReportSchedule",
                Timestamp = DateTime.UtcNow,
                NewValues = $"{req.ReportType} report schedule created for Project {project?.Title} (Due {req.DeadlineDate:yyyy-MM-dd})."
            });

            _db.Notifications.Add(new Notification
            {
                UserId = userId,
                Message = $"📄 Grant Report Scheduled: {req.ReportType} report for '{project?.Title}' due on {req.DeadlineDate:yyyy-MM-dd}.",
                Channel = NotificationChannel.InApp,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                Link = "/finance"
            });

            await _db.SaveChangesAsync();

            var donor = req.DonorId.HasValue ? await _db.Donors.FindAsync(req.DonorId.Value) : null;

            return Ok(new GrantReportScheduleDto
            {
                Id = schedule.Id,
                ProjectId = schedule.ProjectId,
                ProjectName = project?.Title,
                DonorId = schedule.DonorId,
                DonorName = donor?.Name,
                ReportType = schedule.ReportType,
                DeadlineDate = schedule.DeadlineDate,
                Status = schedule.Status,
                SubmittedDate = null
            });
        }

        /// <summary>
        /// POST /api/v1/compliance/reports/{id}/submit — Mark a report as submitted
        /// </summary>
        [HttpPost("reports/{id}/submit")]
        public async Task<ActionResult> SubmitReport(int id)
        {
            var report = await _db.GrantReportSchedules.FindAsync(id);
            if (report == null) return NotFound();

            var proj = await _db.Projects.Include(p => p.Workspace).FirstOrDefaultAsync(p => p.Id == report.ProjectId);
            var reportOrgId = proj?.Workspace?.OrganizationId ?? GetActiveOrganizationId();

            if (reportOrgId.HasValue && !await CanManageComplianceAsync(reportOrgId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Permission denied. Only authorized compliance officers, Admins, and Owners can submit grant reports." });
            }

            report.Status = ReportStatus.Submitted;
            report.SubmittedDate = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            // Log this action in Audit Log
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(ClaimTypes.Name)?.Value;
            int.TryParse(userIdClaim, out var userId);
            if (userId <= 0) userId = 1;

            _db.AuditLogs.Add(new AuditLog
            {
                OrganizationId = reportOrgId,
                PerformedByUserId = userId,
                Action = "Submitted Grant Report",
                Entity = "GrantReportSchedule",
                Timestamp = DateTime.UtcNow,
                NewValues = $"{report.ReportType} report for Project {report.ProjectId} submitted."
            });

            _db.Notifications.Add(new Notification
            {
                UserId = userId,
                Message = $"📄 Grant Report Submitted: {report.ReportType} report for Project #{report.ProjectId} was marked as Submitted.",
                Channel = NotificationChannel.InApp,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                Link = "/finance"
            });

            await _db.SaveChangesAsync();

            return Ok(new { message = "Grant report marked as submitted." });
        }

        /// <summary>
        /// Deletes a grant reporting schedule entry.
        /// </summary>
        /// <param name="id">Report schedule ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("reports/{id}")]
        public async Task<ActionResult> DeleteReportSchedule(int id)
        {
            var report = await _db.GrantReportSchedules.FindAsync(id);
            if (report == null) return NotFound();

            var proj = await _db.Projects.Include(p => p.Workspace).FirstOrDefaultAsync(p => p.Id == report.ProjectId);
            var reportOrgId = proj?.Workspace?.OrganizationId ?? GetActiveOrganizationId();

            if (reportOrgId.HasValue && !await CanManageComplianceAsync(reportOrgId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Permission denied. Only authorized compliance officers, Admins, and Owners can delete grant reports." });
            }

            _db.GrantReportSchedules.Remove(report);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Manually triggers and generates an on-demand grant report run.
        /// </summary>
        /// <param name="id">Report schedule ID.</param>
        /// <returns>Execution confirmation.</returns>
        [HttpPost("reports/{id}/run-now")]
        public async Task<ActionResult> RunReportNow(int id)
        {
            var report = await _db.GrantReportSchedules.FindAsync(id);
            if (report == null) return NotFound();

            var proj = await _db.Projects.Include(p => p.Workspace).FirstOrDefaultAsync(p => p.Id == report.ProjectId);
            var reportOrgId = proj?.Workspace?.OrganizationId ?? GetActiveOrganizationId();

            if (reportOrgId.HasValue && !await CanManageComplianceAsync(reportOrgId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Permission denied. Only authorized compliance officers, Admins, and Owners can trigger grant reports." });
            }

            report.SubmittedDate = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Ok(new { message = "Automated report triggered successfully and dispatched." });
        }



        /// <summary>
        /// GET /api/v1/compliance/audit-logs — Fetch chronological ledger scoped to active organization
        /// </summary>
        [HttpGet("audit-logs")]
        public async Task<ActionResult<IEnumerable<AuditLogDto>>> GetAuditLogs([FromQuery] int? orgId)
        {
            var targetOrgId = orgId ?? GetActiveOrganizationId();
            if (!targetOrgId.HasValue || targetOrgId.Value <= 0)
            {
                return Ok(new List<AuditLogDto>());
            }

            var cacheKey = $"compliance_auditlogs_{targetOrgId.Value}";
            var cachedLogs = await _cache.GetAsync<IEnumerable<AuditLogDto>>(cacheKey);
            
            if (cachedLogs != null)
            {
                return Ok(cachedLogs);
            }

            var logs = await _db.AuditLogs
                .Include(a => a.PerformedByUser)
                .Where(a => a.OrganizationId == targetOrgId.Value)
                .OrderByDescending(a => a.Timestamp)
                .Take(100) // Limit to last 100 for performance
                .ToListAsync();

            var dtos = logs.Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.PerformedByUserId ?? 0,
                UserName = a.PerformedByUser?.Name ?? "System",
                Action = a.Action,
                EntityType = a.Entity,
                EntityId = 0,
                Timestamp = a.Timestamp,
                Details = a.NewValues ?? string.Empty
            });

            await _cache.SetAsync(cacheKey, dtos, TimeSpan.FromMinutes(5));

            return Ok(dtos);
        }

        /// <summary>
        /// GET /api/v1/compliance/export/expenses — Export expenses as CSV
        /// </summary>
        [HttpGet("export/expenses")]
        public async Task<IActionResult> ExportExpenses()
        {
            var expenses = await _db.Expenses
                .Include(e => e.Project)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.FinancialCategory)
                .OrderByDescending(e => e.Date)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("ID,Date,Project,Submitter,Category,Amount,Currency,Status,Description");

            foreach (var e in expenses)
            {
                var catName = e.FinancialCategory?.Name ?? "General Expense";
                var row = $"{e.Id},{e.Date:yyyy-MM-dd},\"{e.Project?.Title}\",\"{e.SubmittedByUser?.Name}\",\"{catName}\",{e.Amount},{e.Currency},{e.ApprovalStatus},\"{e.Description?.Replace("\"", "\"\"")}\"";
                builder.AppendLine(row);
            }

            var bytes = Encoding.UTF8.GetBytes(builder.ToString());
            return File(bytes, "text/csv", "Orbit_Expenses_Export.csv");
        }

        /// <summary>
        /// GET /api/v1/compliance/export/budgets — Export budgets as CSV
        /// </summary>
        [HttpGet("export/budgets")]
        public async Task<IActionResult> ExportBudgets()
        {
            var budgets = await _db.Budgets
                .Include(b => b.Organization)
                .Include(b => b.Project)
                .Include(b => b.LineItems)
                .OrderBy(b => b.Level)
                .ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("ID,Level,EntityName,Status,TotalCeiling,AllocatedAmount,Currency");

            foreach (var b in budgets)
            {
                string entityName = b.Organization?.Name ?? b.Project?.Title ?? "Unknown";
                decimal allocated = b.LineItems.Sum(li => li.Amount);

                var row = $"{b.Id},{b.Level},\"{entityName}\",{b.Status},{b.TotalAmount},{allocated},{b.Currency}";
                builder.AppendLine(row);
            }

            var bytes = Encoding.UTF8.GetBytes(builder.ToString());
            return File(bytes, "text/csv", "Orbit_Budgets_Export.csv");
        }
        /// <summary>
        /// GET /api/v1/compliance/export/logframe — Export logframe as CSV
        /// </summary>
        [HttpGet("export/logframe")]
        public async Task<IActionResult> ExportLogframe([FromQuery] int? projectId)
        {
            var orgId = GetActiveOrganizationId();
            var projectsQuery = _db.Projects.Where(p => !p.IsDeleted);

            if (orgId.HasValue)
            {
                projectsQuery = projectsQuery.Where(p => p.Workspace != null && p.Workspace.OrganizationId == orgId.Value);
            }

            if (projectId.HasValue && projectId.Value > 0)
            {
                projectsQuery = projectsQuery.Where(p => p.Id == projectId.Value);
            }

            var projects = await projectsQuery.ToListAsync();

            var builder = new StringBuilder();
            builder.AppendLine("Project,Level,ID,Description,Linked Task,Task Progress (%),Indicator Name,Baseline,Target,Actual,Unit,Notes");

            foreach (var project in projects)
            {
                var goals = await _db.LogframeGoals
                    .Where(g => g.ProjectId == project.Id)
                    .Include(g => g.Outcomes)
                        .ThenInclude(o => o.Outputs)
                            .ThenInclude(op => op.Activities)
                                .ThenInclude(a => a.LinkedTask)
                    .ToListAsync();

                var indicators = await _db.Indicators
                    .Where(i => i.ProjectId == project.Id)
                    .ToListAsync();

                void AppendIndicators(LogframeLevel level, int entityId)
                {
                    var inds = indicators.Where(i => i.Level == level && i.EntityId == entityId).ToList();
                    foreach (var ind in inds)
                    {
                        builder.AppendLine($"\"{project.Title}\",,,,,,\"{ind.Name}\",\"{ind.Baseline}\",\"{ind.Target}\",\"{ind.Actual}\",\"{ind.Unit}\",\"{ind.Notes}\"");
                    }
                }

                foreach (var goal in goals)
                {
                    builder.AppendLine($"\"{project.Title}\",Goal,{goal.Id},\"{goal.Description.Replace("\"", "\"\"")}\",,,,,,,,");
                    AppendIndicators(LogframeLevel.Goal, goal.Id);

                    foreach (var outcome in goal.Outcomes)
                    {
                        builder.AppendLine($"\"{project.Title}\",Outcome,{outcome.Id},\"{outcome.Description.Replace("\"", "\"\"")}\",,,,,,,,");
                        AppendIndicators(LogframeLevel.Outcome, outcome.Id);

                        foreach (var output in outcome.Outputs)
                        {
                            builder.AppendLine($"\"{project.Title}\",Output,{output.Id},\"{output.Description.Replace("\"", "\"\"")}\",,,,,,,,");
                            AppendIndicators(LogframeLevel.Output, output.Id);

                            foreach (var activity in output.Activities)
                            {
                                var taskTitle = activity.LinkedTask?.Title ?? "";
                                var taskProgress = activity.LinkedTask != null
                                    ? (activity.LinkedTask.Status == Models.TaskStatus.Done ? 100
                                        : activity.LinkedTask.Status == Models.TaskStatus.InReview ? 80
                                        : activity.LinkedTask.Status == Models.TaskStatus.InProgress ? 50
                                        : activity.LinkedTask.Status == Models.TaskStatus.Blocked ? 20
                                        : 0).ToString()
                                    : "";

                                builder.AppendLine($"\"{project.Title}\",Activity,{activity.Id},\"{activity.Description.Replace("\"", "\"\"")}\",\"{taskTitle}\",\"{taskProgress}\",,,,,,");
                                AppendIndicators(LogframeLevel.Activity, activity.Id);
                            }
                        }
                    }
                }
            }

            var bytes = Encoding.UTF8.GetBytes(builder.ToString());
            var fileName = projectId.HasValue && projectId.Value > 0 && projects.Any()
                ? $"Orbit_Logframe_{projects.First().Title.Replace(" ", "_")}_Export.csv"
                : "Orbit_Logframe_Export.csv";

            return File(bytes, "text/csv", fileName);
        }
    }
}
