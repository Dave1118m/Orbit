using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
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
    /// Resolves the active organization ID via headers, query string, or active membership.
    /// </summary>
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
    /// Retrieves all system and custom roles alongside their currently granted permissions for the Permissions Matrix UI.
    /// Scoped to system roles and roles created by the active organization.
    /// </summary>
    /// <returns>Collection of roles containing granted permission IDs and names.</returns>
    [HttpGet("roles")]
    public async Task<IActionResult> GetRolesWithPermissions()
    {
        var activeOrgId = GetActiveOrganizationId();
        var roles = await _db.Roles
            .Include(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
            .Where(r => r.IsSystemRole || (activeOrgId.HasValue && r.OrganizationId == activeOrgId.Value))
            .Select(r => new
            {
                r.Id,
                Name = r.Name.ToString(),
                CustomTitle = r.CustomTitle,
                DisplayName = !string.IsNullOrEmpty(r.CustomTitle) ? r.CustomTitle : r.Name.ToString(),
                r.Description,
                r.IsSystemRole,
                DefaultScope = r.DefaultScope.ToString(),
                r.OrganizationId,
                Permissions = r.RolePermissions.Select(rp => new { rp.Permission!.Id, rp.Permission.Name })
            })
            .ToListAsync();

        return Ok(roles);
    }

    /// <summary>
    /// Request model for creating a dynamic custom role.
    /// </summary>
    public class CreateCustomRoleRequest
    {
        [Required]
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public ScopeType DefaultScope { get; set; } = ScopeType.Workspace;
        public int? OrganizationId { get; set; }
        public List<int>? InitialPermissionIds { get; set; }
    }

    /// <summary>
    /// Creates a new dynamic custom role with custom title, scope, description, and optional initial permissions.
    /// </summary>
    [HttpPost("roles")]
    public async Task<IActionResult> CreateCustomRole([FromBody] CreateCustomRoleRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
        {
            return BadRequest("Custom role title is required.");
        }

        var cleanTitle = req.Title.Trim();
        var activeOrgId = req.OrganizationId ?? GetActiveOrganizationId();
        var exists = await _db.Roles.AnyAsync(r => 
            (r.OrganizationId == activeOrgId && r.CustomTitle != null && r.CustomTitle.ToLower() == cleanTitle.ToLower()) ||
            (r.IsSystemRole && r.Name.ToString().ToLower() == cleanTitle.ToLower()));
        if (exists)
        {
            return BadRequest($"A role named '{cleanTitle}' already exists in this organization.");
        }
        var newRole = new Role
        {
            Name = RoleName.Member,
            CustomTitle = cleanTitle,
            Description = req.Description?.Trim(),
            IsSystemRole = false,
            DefaultScope = req.DefaultScope,
            OrganizationId = activeOrgId
        };

        _db.Roles.Add(newRole);
        await _db.SaveChangesAsync();

        if (req.InitialPermissionIds != null && req.InitialPermissionIds.Any())
        {
            foreach (var pId in req.InitialPermissionIds.Distinct())
            {
                _db.RolePermissions.Add(new RolePermission { RoleId = newRole.Id, PermissionId = pId });
            }
            await _db.SaveChangesAsync();
        }

        var currentUserId = GetCurrentUserId();
        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = activeOrgId,
            Entity = "Role",
            Action = "CreateCustomRole",
            OldValues = null,
            NewValues = $"Role: {newRole.CustomTitle} (Id: {newRole.Id})",
            Timestamp = DateTime.UtcNow,
            PerformedByUserId = currentUserId
        });
        await _db.SaveChangesAsync();

        return Ok(new
        {
            newRole.Id,
            Name = newRole.Name.ToString(),
            CustomTitle = newRole.CustomTitle,
            DisplayName = newRole.CustomTitle,
            newRole.Description,
            newRole.IsSystemRole,
            DefaultScope = newRole.DefaultScope.ToString(),
            newRole.OrganizationId,
            Permissions = req.InitialPermissionIds ?? new List<int>()
        });
    }

    /// <summary>
    /// Request model for updating a custom role.
    /// </summary>
    public class UpdateCustomRoleRequest
    {
        [Required]
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public ScopeType DefaultScope { get; set; } = ScopeType.Workspace;
    }

    /// <summary>
    /// Updates metadata for a custom role or description for a system role.
    /// </summary>
    [HttpPut("roles/{id}")]
    public async Task<IActionResult> UpdateCustomRole(int id, [FromBody] UpdateCustomRoleRequest req)
    {
        var role = await _db.Roles.FindAsync(id);
        if (role == null) return NotFound("Role not found.");

        if (role.IsSystemRole)
        {
            role.Description = req.Description?.Trim();
        }
        else
        {
            if (string.IsNullOrWhiteSpace(req.Title)) return BadRequest("Title is required.");
            role.CustomTitle = req.Title.Trim();
            role.Description = req.Description?.Trim();
            role.DefaultScope = req.DefaultScope;
        }

        await _db.SaveChangesAsync();
        await _permissionService.InvalidateCacheAsync(roleId: role.Id);
        return Ok(new { message = "Role updated successfully." });
    }

    /// <summary>
    /// Deletes a custom role provided no users are currently assigned to it.
    /// </summary>
    [HttpDelete("roles/{id}")]
    public async Task<IActionResult> DeleteCustomRole(int id)
    {
        var role = await _db.Roles
            .Include(r => r.RoleAssignments)
            .Include(r => r.RolePermissions)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (role == null) return NotFound("Role not found.");

        if (role.IsSystemRole)
        {
            return BadRequest("System predefined roles cannot be deleted.");
        }

        if (role.RoleAssignments.Any())
        {
            return BadRequest($"Cannot delete role '{role.CustomTitle}' because it is currently assigned to {role.RoleAssignments.Count} user(s). Please reassign users first.");
        }

        var activeOrgId = role.OrganizationId ?? GetActiveOrganizationId();

        _db.RolePermissions.RemoveRange(role.RolePermissions);
        _db.Roles.Remove(role);
        await _db.SaveChangesAsync();

        await _permissionService.InvalidateCacheAsync(roleId: id);

        var currentUserId = GetCurrentUserId();
        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = activeOrgId,
            Entity = "Role",
            Action = "DeleteCustomRole",
            OldValues = $"Role: {role.CustomTitle} (Id: {id})",
            NewValues = null,
            Timestamp = DateTime.UtcNow,
            PerformedByUserId = currentUserId
        });
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Custom role '{role.CustomTitle}' deleted successfully." });
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
        var activeOrgId = role.OrganizationId ?? GetActiveOrganizationId();

        if (req.IsGranted)
        {
            if (existing == null)
            {
                _db.RolePermissions.Add(new RolePermission { RoleId = req.RoleId, PermissionId = req.PermissionId });

                _db.AuditLogs.Add(new AuditLog
                {
                    OrganizationId = activeOrgId,
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
                    OrganizationId = activeOrgId,
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
    /// Retrieves the most recent 100 permission modification audit trail logs scoped to the active organization.
    /// </summary>
    /// <returns>List of audit log records detailing permission modifications.</returns>
    [HttpGet("audit-log")]
    public async Task<IActionResult> GetPermissionAuditLogs()
    {
        var activeOrgId = GetActiveOrganizationId();
        var logs = await _db.AuditLogs
            .Include(a => a.PerformedByUser)
            .Where(a => (a.Entity == "RolePermission" || a.Entity == "Role") && (a.OrganizationId == activeOrgId || (!activeOrgId.HasValue && a.OrganizationId == null)))
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
