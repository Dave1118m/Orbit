using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.Models;

namespace OrbitApi.Services;

/// <summary>
/// DB-driven & cached implementation of IPermissionService.
/// Reads permissions from the RolePermissions table and caches results in Redis/Memory,
/// invalidating cache when permissions change.
/// </summary>
public class PermissionService : IPermissionService
{
    private readonly OrbitDbContext _db;
    private readonly ICacheService _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);

    public PermissionService(OrbitDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    /// <inheritdoc/>
    public async Task<bool> RoleHasPermissionAsync(RoleName role, Permission permission)
    {
        var cacheKey = $"perm:has:{role}:{permission}";
        var cached = await _cache.GetAsync<bool?>(cacheKey);
        if (cached.HasValue)
        {
            return cached.Value;
        }

        var permName = permission.ToString();
        var result = await _db.Roles
            .Where(r => r.Name == role)
            .SelectMany(r => r.RolePermissions)
            .AnyAsync(rp => rp.Permission != null && rp.Permission.Name == permName);

        await _cache.SetAsync(cacheKey, result, absoluteExpireTime: CacheDuration);
        return result;
    }

    /// <inheritdoc/>
    public async Task<bool> RoleIdHasPermissionAsync(int roleId, Permission permission)
    {
        var cacheKey = $"perm:has:id:{roleId}:{permission}";
        var cached = await _cache.GetAsync<bool?>(cacheKey);
        if (cached.HasValue)
        {
            return cached.Value;
        }

        var permName = permission.ToString();
        var result = await _db.Roles
            .Where(r => r.Id == roleId)
            .SelectMany(r => r.RolePermissions)
            .AnyAsync(rp => rp.Permission != null && rp.Permission.Name == permName);

        await _cache.SetAsync(cacheKey, result, absoluteExpireTime: CacheDuration);
        return result;
    }

    /// <inheritdoc/>
    public async Task<List<string>> GetPermissionsForRoleAsync(RoleName role)
    {
        var cacheKey = $"perm:role:{role}";
        var cached = await _cache.GetAsync<List<string>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        var result = await _db.Roles
            .Where(r => r.Name == role)
            .SelectMany(r => r.RolePermissions)
            .Where(rp => rp.Permission != null)
            .Select(rp => rp.Permission!.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync();

        await _cache.SetAsync(cacheKey, result, absoluteExpireTime: CacheDuration);
        return result;
    }

    /// <inheritdoc/>
    public async Task<List<string>> GetPermissionsForRoleIdAsync(int roleId)
    {
        var cacheKey = $"perm:role:id:{roleId}";
        var cached = await _cache.GetAsync<List<string>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        var result = await _db.Roles
            .Where(r => r.Id == roleId)
            .SelectMany(r => r.RolePermissions)
            .Where(rp => rp.Permission != null)
            .Select(rp => rp.Permission!.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync();

        await _cache.SetAsync(cacheKey, result, absoluteExpireTime: CacheDuration);
        return result;
    }

    /// <inheritdoc/>
    public async Task<List<string>> GetPermissionsForRolesAsync(IEnumerable<RoleName> roles)
    {
        var roleList = roles.Distinct().OrderBy(r => r).ToList();
        if (!roleList.Any()) return new List<string>();

        var cacheKey = $"perm:roles:{string.Join("-", roleList)}";
        var cached = await _cache.GetAsync<List<string>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        var result = await _db.Roles
            .Where(r => roleList.Contains(r.Name))
            .SelectMany(r => r.RolePermissions)
            .Where(rp => rp.Permission != null)
            .Select(rp => rp.Permission!.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync();

        await _cache.SetAsync(cacheKey, result, absoluteExpireTime: CacheDuration);
        return result;
    }

    /// <inheritdoc/>
    public async Task<List<string>> GetPermissionsForRoleIdsAsync(IEnumerable<int> roleIds)
    {
        var idList = roleIds.Distinct().OrderBy(i => i).ToList();
        if (!idList.Any()) return new List<string>();

        var cacheKey = $"perm:roles:ids:{string.Join("-", idList)}";
        var cached = await _cache.GetAsync<List<string>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        var result = await _db.Roles
            .Where(r => idList.Contains(r.Id))
            .SelectMany(r => r.RolePermissions)
            .Where(rp => rp.Permission != null)
            .Select(rp => rp.Permission!.Name)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync();

        await _cache.SetAsync(cacheKey, result, absoluteExpireTime: CacheDuration);
        return result;
    }

    /// <inheritdoc/>
    public async Task InvalidateCacheAsync(RoleName? role = null, int? roleId = null)
    {
        if (role.HasValue)
        {
            await _cache.RemoveByPrefixAsync($"perm:has:{role.Value}");
            await _cache.RemoveAsync($"perm:role:{role.Value}");
        }
        if (roleId.HasValue)
        {
            await _cache.RemoveByPrefixAsync($"perm:has:id:{roleId.Value}");
            await _cache.RemoveAsync($"perm:role:id:{roleId.Value}");
        }
        await _cache.RemoveByPrefixAsync("perm:");
    }
}
