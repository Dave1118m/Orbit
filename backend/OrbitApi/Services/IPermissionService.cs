using OrbitApi.Authorization;
using OrbitApi.Models;

namespace OrbitApi.Services;

/// <summary>
/// Single source of truth for all role-based permission checks.
/// All data is read from the database (RolePermissions table),
/// making the Settings Permissions Matrix the effective configuration authority.
/// Supports both system predefined roles (RoleName) and dynamic custom roles (RoleId).
/// </summary>
public interface IPermissionService
{
    /// <summary>
    /// Returns true if the given role has the specified permission in the DB.
    /// </summary>
    Task<bool> RoleHasPermissionAsync(RoleName role, Permission permission);

    /// <summary>
    /// Returns true if the given custom/system role ID has the specified permission in the DB.
    /// </summary>
    Task<bool> RoleIdHasPermissionAsync(int roleId, Permission permission);

    /// <summary>
    /// Returns all permission names granted to the given role from the DB.
    /// </summary>
    Task<List<string>> GetPermissionsForRoleAsync(RoleName role);

    /// <summary>
    /// Returns all permission names granted to the given role ID from the DB.
    /// </summary>
    Task<List<string>> GetPermissionsForRoleIdAsync(int roleId);

    /// <summary>
    /// Returns the union of all permissions for a set of roles from the DB.
    /// Used when a user holds multiple roles.
    /// </summary>
    Task<List<string>> GetPermissionsForRolesAsync(IEnumerable<RoleName> roles);

    /// <summary>
    /// Returns the union of all permissions for a set of role IDs from the DB.
    /// </summary>
    Task<List<string>> GetPermissionsForRoleIdsAsync(IEnumerable<int> roleIds);

    /// <summary>
    /// Invalidates permission caches when role permissions are updated.
    /// </summary>
    Task InvalidateCacheAsync(RoleName? role = null, int? roleId = null);
}
