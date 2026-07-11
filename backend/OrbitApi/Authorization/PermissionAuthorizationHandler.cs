using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement, object>
{
    private readonly OrbitDbContext _db;

    public PermissionAuthorizationHandler(OrbitDbContext db)
    {
        _db = db;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement, object resource)
    {
        var userId = GetCurrentUserId(context.User);
        if (!userId.HasValue)
        {
            context.Fail();
            return;
        }

        var assignments = await _db.RoleAssignments.Include(r => r.Role).Where(r => r.UserId == userId.Value).ToListAsync();
        foreach (var assignment in assignments)
        {
            if (assignment.Role == null || !RoleHasPermission(assignment.Role.Name, requirement.Permission))
                continue;

            if (resource is ScopedResource scopedResource)
            {
                if (await AssignmentCoversResourceAsync(assignment, scopedResource))
                {
                    context.Succeed(requirement);
                    return;
                }
            }
            else
            {
                context.Succeed(requirement);
                return;
            }
        }

        context.Fail();
    }

    private int? GetCurrentUserId(ClaimsPrincipal? user)
    {
        var idValue = user?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return int.TryParse(idValue, out var id) ? id : null;
    }

    private async Task<bool> AssignmentCoversResourceAsync(RoleAssignment assignment, ScopedResource resource)
    {
        if (assignment.ScopeType == resource.ScopeType && assignment.ScopeId == resource.ScopeId)
            return true;

        return assignment.ScopeType switch
        {
            ScopeType.Organization => await ResourceBelongsToOrganizationAsync(resource, assignment.ScopeId),
            ScopeType.Workspace => await ResourceBelongsToWorkspaceAsync(resource, assignment.ScopeId),
            ScopeType.Project => await ResourceBelongsToProjectAsync(resource, assignment.ScopeId),
            _ => false,
        };
    }

    private Task<bool> ResourceBelongsToWorkspaceAsync(ScopedResource resource, int workspaceId)
    {
        return resource.ScopeType switch
        {
            ScopeType.Workspace => Task.FromResult(resource.ScopeId == workspaceId),
            ScopeType.Project => _db.Projects.AnyAsync(p => p.Id == resource.ScopeId && p.WorkspaceId == workspaceId),
            _ => Task.FromResult(false)
        };
    }

    private Task<bool> ResourceBelongsToOrganizationAsync(ScopedResource resource, int organizationId)
    {
        return resource.ScopeType switch
        {
            ScopeType.Organization => Task.FromResult(resource.ScopeId == organizationId),
            ScopeType.Workspace => _db.Workspaces.AnyAsync(w => w.Id == resource.ScopeId && w.OrganizationId == organizationId),
            ScopeType.Project => _db.Projects.AnyAsync(p => p.Id == resource.ScopeId && p.Workspace != null && p.Workspace.OrganizationId == organizationId),
            _ => Task.FromResult(false)
        };
    }

    private Task<bool> ResourceBelongsToProjectAsync(ScopedResource resource, int projectId)
    {
        return resource.ScopeType switch
        {
            ScopeType.Project => Task.FromResult(resource.ScopeId == projectId),
            _ => Task.FromResult(false)
        };
    }

    private bool RoleHasPermission(RoleName role, Permission permission)
    {
        return RolePermissionMapping.Defaults.TryGetValue(role, out var perms) && perms.Contains(permission);
    }
}
