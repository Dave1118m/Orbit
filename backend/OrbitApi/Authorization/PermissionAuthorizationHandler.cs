using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement, object>
{
    private readonly OrbitDbContext _db;
    private readonly IPermissionService _permissionService;

    public PermissionAuthorizationHandler(OrbitDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement, object resource)
    {
        var userId = GetCurrentUserId(context.User);
        if (!userId.HasValue)
        {
            context.Fail();
            return;
        }

        // 1. Direct Organization Owner bypass: Owners have absolute full permission
        var isDirectOrgOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId.Value && !o.IsDeleted);
        if (isDirectOrgOwner)
        {
            context.Succeed(requirement);
            return;
        }

        var assignments = await _db.RoleAssignments.Include(r => r.Role).Where(r => r.UserId == userId.Value).ToListAsync();

        var memberAssignments = await _db.OrganizationMembers.Include(m => m.Role)
            .Where(m => m.UserId == userId.Value && m.Status == OrgMemberStatus.Active)
            .ToListAsync();

        foreach (var member in memberAssignments)
        {
            if (member.Role != null && !assignments.Any(a => a.ScopeType == ScopeType.Organization && a.ScopeId == member.OrganizationId && a.RoleId == member.RoleId))
            {
                assignments.Add(new RoleAssignment
                {
                    UserId = member.UserId,
                    RoleId = member.RoleId,
                    Role = member.Role,
                    ScopeType = ScopeType.Organization,
                    ScopeId = member.OrganizationId
                });
            }
        }

        // 2. Owner role bypass: Any user assigned RoleName.Owner automatically gets full permission
        if (assignments.Any(a => a.Role != null && a.Role.Name == RoleName.Owner))
        {
            context.Succeed(requirement);
            return;
        }

        foreach (var assignment in assignments)
        {
            if (assignment.Role == null) continue;

            // Use IPermissionService (DB-driven) instead of static mapping
            if (!await _permissionService.RoleHasPermissionAsync(assignment.Role.Name, requirement.Permission))
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
}
