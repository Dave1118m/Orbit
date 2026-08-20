using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Authorization;

/// <summary>
/// Core ASP.NET Core authorization handler that evaluates permission requirements against
/// user role assignments, organization memberships, and hierarchical resource scopes.
/// </summary>
public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement, object>
{
    private readonly OrbitDbContext _db;
    private readonly IPermissionService _permissionService;

    /// <summary>
    /// Initializes a new instance of <see cref="PermissionAuthorizationHandler"/>.
    /// </summary>
    /// <param name="db">The primary database context for querying roles, assignments, and entities.</param>
    /// <param name="permissionService">The cached permission service for role permission lookups.</param>
    public PermissionAuthorizationHandler(OrbitDbContext db, IPermissionService permissionService)
    {
        _db = db;
        _permissionService = permissionService;
    }

    /// <summary>
    /// Evaluates if the calling user satisfies the specified permission requirement on the target resource.
    /// Handles superuser bypass for organization owners, evaluates role assignments, and checks scope inheritance.
    /// </summary>
    /// <param name="context">The authorization handler context containing claims and status.</param>
    /// <param name="requirement">The permission requirement to validate.</param>
    /// <param name="resource">The optional resource context (e.g. ScopedResource) to validate scope against.</param>
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

        foreach (var assignment in assignments)
        {
            if (assignment.Role == null) continue;

            // If the role is Owner, bypass the specific permission check, but WE MUST still verify the scope below
            bool hasPermission = assignment.Role.Name == RoleName.Owner || await _permissionService.RoleHasPermissionAsync(assignment.Role.Name, requirement.Permission);
            
            if (!hasPermission)
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

    /// <summary>
    /// Extracts the integer User ID from the authenticated user's JWT claims.
    /// </summary>
    /// <param name="user">The ClaimsPrincipal representing the current user.</param>
    /// <returns>The parsed integer User ID if valid; otherwise null.</returns>
    private int? GetCurrentUserId(ClaimsPrincipal? user)
    {
        var idValue = user?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return int.TryParse(idValue, out var id) ? id : null;
    }

    /// <summary>
    /// Determines whether an active role assignment's scope covers the target resource via hierarchical inheritance.
    /// (Organization scope covers all child Workspaces and Projects; Workspace scope covers child Projects).
    /// </summary>
    /// <param name="assignment">The active role assignment holding scope level and ID.</param>
    /// <param name="resource">The target resource being accessed.</param>
    /// <returns>True if the assignment's scope encloses the requested resource.</returns>
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

    /// <summary>
    /// Checks if a given resource belongs to a specific workspace.
    /// </summary>
    /// <param name="resource">The target resource.</param>
    /// <param name="workspaceId">The workspace identifier.</param>
    private Task<bool> ResourceBelongsToWorkspaceAsync(ScopedResource resource, int workspaceId)
    {
        return resource.ScopeType switch
        {
            ScopeType.Workspace => Task.FromResult(resource.ScopeId == workspaceId),
            ScopeType.Project => _db.Projects.AnyAsync(p => p.Id == resource.ScopeId && p.WorkspaceId == workspaceId),
            _ => Task.FromResult(false)
        };
    }

    /// <summary>
    /// Checks if a given resource belongs to a specific organization.
    /// </summary>
    /// <param name="resource">The target resource.</param>
    /// <param name="organizationId">The organization identifier.</param>
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

    /// <summary>
    /// Checks if a given resource belongs to a specific project.
    /// </summary>
    /// <param name="resource">The target resource.</param>
    /// <param name="projectId">The project identifier.</param>
    private Task<bool> ResourceBelongsToProjectAsync(ScopedResource resource, int projectId)
    {
        return resource.ScopeType switch
        {
            ScopeType.Project => Task.FromResult(resource.ScopeId == projectId),
            _ => Task.FromResult(false)
        };
    }
}
