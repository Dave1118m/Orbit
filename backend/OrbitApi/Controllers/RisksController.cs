using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.Models;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Organization-level Risk &amp; Issue roll-up for leadership review (spec 3.4.2).
    /// Route: GET api/v1/organizations/{orgId}/risks
    /// </summary>
    [ApiController]
    [Route("api/v1/organizations/{orgId}/risks")]
    [Authorize]
    public class RisksController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;

        public RisksController(OrbitDbContext db, IAuthorizationService authorizationService)
        {
            _db = db;
            _authorizationService = authorizationService;
        }

        /// <summary>
        /// GET api/v1/organizations/{orgId}/risks
        /// Returns a per-project risk aggregation for org-level leadership review.
        /// Requires RiskLogView permission on at least one workspace in the org.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult> GetOrgRiskRollup(int orgId)
        {
            // Verify org exists
            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId && !o.IsDeleted);
            if (org == null) return NotFound();

            // Check user has RiskLogView on the org (covers all workspaces/projects in it)
            var orgResource = new ScopedResource(ScopeType.Organization, orgId);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.RiskLogView))).Succeeded)
                return Forbid();

            // Get all projects in this org (via workspaces)
            var projectIds = await _db.Projects
                .Where(p => !p.IsDeleted && p.Workspace != null && p.Workspace.OrganizationId == orgId)
                .Select(p => new { p.Id, p.Title, p.Status })
                .ToListAsync();

            if (!projectIds.Any())
                return Ok(new { OrgId = orgId, OrgName = org.Name, Projects = Array.Empty<object>(), Summary = new { } });

            var ids = projectIds.Select(p => p.Id).ToList();

            // Fetch all risks for these projects
            var allRisks = await _db.RisksIssues
                .Where(r => ids.Contains(r.ProjectId))
                .Select(r => new
                {
                    r.Id,
                    r.ProjectId,
                    Type = r.Type.ToString(),
                    r.Description,
                    r.LikelihoodScore,
                    r.ImpactScore,
                    RiskScore = r.LikelihoodScore * r.ImpactScore,
                    r.Owner,
                    r.Status,
                    r.CreatedAt,
                    r.ResolvedAt
                })
                .ToListAsync();

            // Build per-project aggregation
            var projectRollups = projectIds.Select(proj =>
            {
                var projectRisks = allRisks.Where(r => r.ProjectId == proj.Id).ToList();
                var openRisks = projectRisks.Count(r => r.Type == "Risk" && r.Status != "Resolved" && r.Status != "Closed");
                var openIssues = projectRisks.Count(r => r.Type == "Issue" && r.Status != "Resolved" && r.Status != "Closed");
                var highSeverityCount = projectRisks.Count(r => r.RiskScore >= 10 && r.RiskScore < 15 && r.Status != "Resolved" && r.Status != "Closed");
                var criticalCount = projectRisks.Count(r => r.RiskScore >= 15 && r.Status != "Resolved" && r.Status != "Closed");
                var maxScore = projectRisks.Any() ? projectRisks.Max(r => r.RiskScore) : 0;

                return new
                {
                    ProjectId = proj.Id,
                    ProjectTitle = proj.Title,
                    ProjectStatus = proj.Status.ToString(),
                    TotalItems = projectRisks.Count,
                    OpenRisks = openRisks,
                    OpenIssues = openIssues,
                    HighSeverityCount = highSeverityCount,
                    CriticalCount = criticalCount,
                    MaxRiskScore = maxScore,
                    // Severity label for the project
                    SeverityLevel = criticalCount > 0 ? "Critical"
                        : highSeverityCount > 0 ? "High"
                        : (openRisks + openIssues) > 0 ? "Medium"
                        : "Low",
                    Items = projectRisks
                };
            }).ToList();

            // Org-level summary totals
            var summary = new
            {
                TotalOpenRisks = projectRollups.Sum(p => p.OpenRisks),
                TotalOpenIssues = projectRollups.Sum(p => p.OpenIssues),
                TotalHighSeverity = projectRollups.Sum(p => p.HighSeverityCount),
                TotalCritical = projectRollups.Sum(p => p.CriticalCount),
                ProjectsWithOpenItems = projectRollups.Count(p => p.OpenRisks + p.OpenIssues > 0)
            };

            return Ok(new
            {
                OrgId = orgId,
                OrgName = org.Name,
                Summary = summary,
                Projects = projectRollups
            });
        }
    }
}
