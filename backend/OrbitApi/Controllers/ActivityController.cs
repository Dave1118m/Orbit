using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// API Controller providing audit trail and activity log event feeds across the platform scoped to the active organization tenant.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ActivityController : ControllerBase
    {
        private readonly OrbitDbContext _db;

        /// <summary>
        /// Initializes a new instance of <see cref="ActivityController"/>.
        /// </summary>
        public ActivityController(OrbitDbContext db)
        {
            _db = db;
        }

        private int? GetCurrentUserId()
        {
            var idValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            return int.TryParse(idValue, out var id) ? id : null;
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

            var userId = GetCurrentUserId();
            if (userId.HasValue && userId.Value > 0)
            {
                var userOrgId = _db.OrganizationMembers
                    .Where(om => om.UserId == userId.Value && om.Status == OrgMemberStatus.Active)
                    .Select(om => om.OrganizationId)
                    .FirstOrDefault();
                if (userOrgId > 0 && _db.Organizations.Any(o => o.Id == userOrgId && !o.IsDeleted)) return userOrgId;

                var ownedOrgId = _db.Organizations
                    .Where(o => o.OwnerId == userId.Value && !o.IsDeleted)
                    .Select(o => o.Id)
                    .FirstOrDefault();
                if (ownedOrgId > 0) return ownedOrgId;
            }

            return null;
        }

        /// <summary>
        /// Retrieves the most recent chronological audit log and system activity events scoped to the caller's organization.
        /// </summary>
        /// <param name="limit">Maximum number of records to return (defaults to 20).</param>
        /// <param name="orgId">Optional explicit organization ID filter.</param>
        /// <returns>List of recent activity log items.</returns>
        [HttpGet]
        public async Task<ActionResult> List([FromQuery] int? limit, [FromQuery] int? orgId)
        {
            var targetOrgId = orgId ?? GetActiveOrganizationId();
            var take = limit ?? 20;

            var query = _db.AuditLogs
                .Include(a => a.PerformedByUser)
                .AsQueryable();

            if (targetOrgId.HasValue && targetOrgId.Value > 0)
            {
                query = query.Where(a => a.OrganizationId == targetOrgId.Value);
            }
            else
            {
                // Fallback for system superadmin without organization context
                query = query.Where(a => a.OrganizationId == null);
            }

            var logs = await query
                .OrderByDescending(a => a.Timestamp)
                .Take(take)
                .Select(a => new
                {
                    a.Id,
                    a.OrganizationId,
                    a.Entity,
                    a.Action,
                    a.Timestamp,
                    PerformedByUserId = a.PerformedByUserId,
                    PerformedByUserName = a.PerformedByUser != null ? a.PerformedByUser.Name : null
                })
                .ToListAsync();

            return Ok(logs);
        }
    }
}
