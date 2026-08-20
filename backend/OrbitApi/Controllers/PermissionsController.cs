using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers;

/// <summary>
/// API Controller for administering system permissions, role permission mappings, and permission audit logs.
/// </summary>
[Authorize]
[ApiController]
[Route("api/v1/[controller]")]
public class PermissionsController : ControllerBase
{
    private readonly OrbitDbContext _db;
    private readonly IPermissionService _permissionService;

    /// <summary>
    /// Initializes a new instance of <see cref="PermissionsController"/>.
    /// </summary>
    public PermissionsController(OrbitDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    /// <summary>
    /// Helper to extract the authenticated user ID from claims.
    /// </summary>
    private int? GetCurrentUserId()
    {
        var idValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
        return int.TryParse(idValue, out var id) ? id : null;
    }

    /// <summary>
    /// Returns the complete catalog of all available permissions in the system.
    /// </summary>
    /// <returns>List of permissions with Id, Name, and Description.</returns>
    [HttpGet]
    public async Task<IActionResult> GetAllPermissions()
    {
        var permissions = await _db.Permissions
            .Select(p => new { p.Id, p.Name, p.Description })
            .ToListAsync();
        return Ok(permissions);
    }

    /// <summary>
    /// Retrieves all system roles alongside their currently granted permissions for the Permissions Matrix UI.
    /// </summary>
    /// <returns>Collection of roles containing granted permission IDs and names.</returns>
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

    /// <summary>
    /// Request model for granting or revoking a permission on a specific role.
    /// </summary>
    public class AssignPermissionRequest
    {
        public int RoleId { get; set; }
        public int PermissionId { get; set; }
        public bool IsGranted { get; set; }
    }

    /// <summary>
    /// Dynamically grants or revokes a permission for a role in the database, records an audit log entry, and invalidates permission caches.
    /// Superuser Owner permissions cannot be revoked.
    /// </summary>
    /// <param name="req">The assignment request payload.</param>
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

    /// <summary>
    /// Retrieves the most recent 100 permission modification audit trail logs.
    /// </summary>
    /// <returns>List of audit log records detailing permission modifications.</returns>
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
