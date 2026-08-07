using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class PermissionsController : ControllerBase
{
    private readonly OrbitDbContext _db;
    private readonly IPermissionService _permissionService;

    public PermissionsController(OrbitDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    private int? GetCurrentUserId()
    {
        var idValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return int.TryParse(idValue, out var id) ? id : null;
    }

    // GET: api/v1/permissions
    [HttpGet]
    public async Task<IActionResult> GetAllPermissions()
    {
        var permissions = await _db.Permissions
            .Select(p => new { p.Id, p.Name, p.Description })
            .ToListAsync();
        return Ok(permissions);
    }

    // GET: api/v1/permissions/roles
    [HttpGet("roles")]
    public async Task<IActionResult> GetRolesWithPermissions()
    {
        var roles = await _db.Roles
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .Select(r => new
            {
                r.Id,
                Name = r.Name.ToString(),
                r.Description,
                Permissions = r.RolePermissions.Select(rp => new { rp.Permission!.Id, rp.Permission.Name })
            })
            .ToListAsync();

        return Ok(roles);
    }

    public class AssignPermissionRequest
    {
        public int RoleId { get; set; }
        public int PermissionId { get; set; }
        public bool IsGranted { get; set; }
    }

    // POST: api/v1/permissions/assign
    [HttpPost("assign")]
    public async Task<IActionResult> AssignPermission([FromBody] AssignPermissionRequest req)
    {
        var role = await _db.Roles.FindAsync(req.RoleId);
        var perm = await _db.Permissions.FindAsync(req.PermissionId);
        if (role == null || perm == null)
        {
            return NotFound("Role or Permission not found.");
        }

        if (role.Name == RoleName.Owner && !req.IsGranted)
        {
            return BadRequest("Owner permissions are system-protected superuser access and cannot be revoked.");
        }

        var existing = await _db.RolePermissions
            .FirstOrDefaultAsync(rp => rp.RoleId == req.RoleId && rp.PermissionId == req.PermissionId);

        var currentUserId = GetCurrentUserId();

        if (req.IsGranted)
        {
            if (existing == null)
            {
                _db.RolePermissions.Add(new RolePermission { RoleId = req.RoleId, PermissionId = req.PermissionId });

                _db.AuditLogs.Add(new AuditLog
                {
                    Entity = "RolePermission",
                    Action = "GrantPermission",
                    OldValues = $"Granted: false",
                    NewValues = $"Role: {role.Name}, Permission: {perm.Name}, Granted: true",
                    Timestamp = DateTime.UtcNow,
                    PerformedByUserId = currentUserId
                });
            }
        }
        else
        {
            if (existing != null)
            {
                _db.RolePermissions.Remove(existing);

                _db.AuditLogs.Add(new AuditLog
                {
                    Entity = "RolePermission",
                    Action = "RevokePermission",
                    OldValues = $"Role: {role.Name}, Permission: {perm.Name}, Granted: true",
                    NewValues = $"Granted: false",
                    Timestamp = DateTime.UtcNow,
                    PerformedByUserId = currentUserId
                });
            }
        }

        await _db.SaveChangesAsync();

        // Invalidate permission cache for this role
        await _permissionService.InvalidateCacheAsync(role.Name);

        return Ok(new { message = "Permission updated successfully." });
    }

    // GET: api/v1/permissions/audit-log
    [HttpGet("audit-log")]
    public async Task<IActionResult> GetPermissionAuditLogs()
    {
        var logs = await _db.AuditLogs
            .Include(a => a.PerformedByUser)
            .Where(a => a.Entity == "RolePermission")
            .OrderByDescending(a => a.Timestamp)
            .Take(100)
            .Select(a => new
            {
                a.Id,
                a.Entity,
                a.Action,
                a.OldValues,
                a.NewValues,
                a.Timestamp,
                PerformedBy = a.PerformedByUser != null ? a.PerformedByUser.Name : "System",
                a.PerformedByUserId
            })
            .ToListAsync();

        return Ok(logs);
    }
}
