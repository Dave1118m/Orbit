using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ActivityController : ControllerBase
    {
        private readonly OrbitDbContext _db;

        public ActivityController(OrbitDbContext db)
        {
            _db = db;
        }

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
