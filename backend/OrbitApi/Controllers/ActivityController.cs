using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// API Controller providing audit trail and activity log event feeds across the platform.
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

        /// <summary>
        /// Retrieves the most recent chronological audit log and system activity events.
        /// </summary>
        /// <param name="limit">Maximum number of records to return (defaults to 20).</param>
        /// <returns>List of recent activity log items.</returns>
        [HttpGet]
        public async Task<ActionResult> List([FromQuery] int? limit)
        {
            var take = limit ?? 20;

            var logs = await _db.AuditLogs
                .Include(a => a.PerformedByUser)
                .OrderByDescending(a => a.Timestamp)
                .Take(take)
                .Select(a => new
                {
                    a.Id,
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
