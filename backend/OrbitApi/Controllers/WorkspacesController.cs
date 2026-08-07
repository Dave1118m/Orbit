using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class WorkspacesController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly IPermissionService _permissionService;

        public WorkspacesController(OrbitDbContext db, IAuthorizationService authorizationService, IPermissionService permissionService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _permissionService = permissionService;
        }

        [HttpPost]
        public async Task<ActionResult<WorkspaceDto>> Create([FromBody] CreateWorkspaceRequest req)
        {
            var organizationResource = new ScopedResource(ScopeType.Organization, req.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, organizationResource, new PermissionRequirement(Permission.WorkspaceCreate))).Succeeded)
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
            {
                return BadRequest("Workspace name must be at least 2 characters long.");
            }
            if (req.Name.Trim().Length > 100)
            {
                return BadRequest("Workspace name cannot exceed 100 characters.");
            }
            if (req.BudgetCeiling.HasValue && req.BudgetCeiling.Value < 0)
            {
                return BadRequest("Workspace budget ceiling cannot be negative.");
            }

            var workspace = new Workspace
            {
                OrganizationId = req.OrganizationId,
                Name = req.Name.Trim(),
                Description = req.Description,
                Visibility = (VisibilityLevel)req.Visibility,
                BudgetCeiling = req.BudgetCeiling,
                IsArchived = req.IsArchived ?? false
            };

            _db.Workspaces.Add(workspace);
            await _db.SaveChangesAsync();

            var dto = new WorkspaceDto
            {
                Id = workspace.Id,
                OrganizationId = workspace.OrganizationId,
                Name = workspace.Name,
                Description = workspace.Description,
                Visibility = (WorkspaceVisibility)workspace.Visibility,
                BudgetCeiling = workspace.BudgetCeiling,
                IsArchived = workspace.IsArchived
            };

            return CreatedAtAction(nameof(Get), new { id = workspace.Id }, dto);
        }

        private int GetActiveOrganizationId()
        {
            if (Request.Headers.TryGetValue("X-Organization-Id", out var orgIdStr) && int.TryParse(orgIdStr, out var orgId) && orgId > 0)
            {
                var validOrg = _db.Organizations.FirstOrDefault(o => o.Id == orgId && !o.IsDeleted);
                if (validOrg != null) return validOrg.Id;
            }

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                var userOrgId = _db.OrganizationMembers
                    .Where(om => om.UserId == userId && om.Status == OrgMemberStatus.Active)
                    .Select(om => om.OrganizationId)
                    .FirstOrDefault();
                if (userOrgId > 0 && _db.Organizations.Any(o => o.Id == userOrgId && !o.IsDeleted)) return userOrgId;
            }

            var firstOrg = _db.Organizations.FirstOrDefault(o => !o.IsDeleted);
            return firstOrg?.Id ?? 2003;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkspaceDto>>> List([FromQuery] int? orgId)
        {
            var targetOrgId = orgId ?? GetActiveOrganizationId();

            var workspaces = await _db.Workspaces
                .Where(w => w.OrganizationId == targetOrgId && !w.IsArchived)
                .Select(w => new WorkspaceDto
                {
                    Id = w.Id,
                    OrganizationId = w.OrganizationId,
                    Name = w.Name,
                    Description = w.Description,
                    Visibility = (WorkspaceVisibility)w.Visibility,
                    BudgetCeiling = w.BudgetCeiling,
                    IsArchived = w.IsArchived
                }).ToListAsync();

            return Ok(workspaces);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<WorkspaceDto>> Get(int id)
        {
            var workspace = await _db.Workspaces.FindAsync(id);
            if (workspace == null) return NotFound();

            var workspaceResource = new ScopedResource(ScopeType.Workspace, id);
            if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.WorkspaceView))).Succeeded)
            {
                return Forbid();
            }

            return Ok(new WorkspaceDto
            {
                Id = workspace.Id,
                OrganizationId = workspace.OrganizationId,
                Name = workspace.Name,
                Description = workspace.Description,
                Visibility = (WorkspaceVisibility)workspace.Visibility,
                BudgetCeiling = workspace.BudgetCeiling,
                IsArchived = workspace.IsArchived
            });
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<WorkspaceDto>> Update(int id, [FromBody] UpdateWorkspaceRequest req)
        {
            var workspace = await _db.Workspaces.FindAsync(id);
            if (workspace == null) return NotFound();

            var workspaceResource = new ScopedResource(ScopeType.Workspace, id);
            if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.WorkspaceEdit))).Succeeded)
            {
                return Forbid();
            }

            if (req.Name != null)
            {
                if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
                {
                    return BadRequest("Workspace name must be at least 2 characters long.");
                }
                if (req.Name.Trim().Length > 100)
                {
                    return BadRequest("Workspace name cannot exceed 100 characters.");
                }
                workspace.Name = req.Name.Trim();
            }

            if (req.BudgetCeiling.HasValue && req.BudgetCeiling.Value < 0)
            {
                return BadRequest("Workspace budget ceiling cannot be negative.");
            }

            if (req.Description != null) workspace.Description = req.Description;
            if (req.Visibility.HasValue) workspace.Visibility = (VisibilityLevel)req.Visibility.Value;
            if (req.BudgetCeiling.HasValue) workspace.BudgetCeiling = req.BudgetCeiling;
            if (req.IsArchived.HasValue) workspace.IsArchived = req.IsArchived.Value;

            await _db.SaveChangesAsync();

            return Ok(new WorkspaceDto
            {
                Id = workspace.Id,
                OrganizationId = workspace.OrganizationId,
                Name = workspace.Name,
                Description = workspace.Description,
                Visibility = (WorkspaceVisibility)workspace.Visibility,
                BudgetCeiling = workspace.BudgetCeiling,
                IsArchived = workspace.IsArchived
            });
        }

        private async Task<List<int>> GetAccessibleWorkspaceIdsAsync(Permission permission, int? organizationId)
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var isOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted)
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && a.Role.Name == RoleName.Owner)
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && m.Role.Name == RoleName.Owner);

            if (isOwner)
            {
                var query = _db.Workspaces.AsQueryable();
                if (organizationId.HasValue)
                    query = query.Where(w => w.OrganizationId == organizationId.Value);
                return await query.Select(w => w.Id).ToListAsync();
            }

            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var memberAssignments = await _db.OrganizationMembers.Include(m => m.Role)
                .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active)
                .ToListAsync();

            var workspaceIds = new List<int>();
            var organizationIds = new List<int>();
            var projectIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!await _permissionService.RoleHasPermissionAsync(assignment.Role!.Name, permission))
                    continue;

                switch (assignment.ScopeType)
                {
                    case ScopeType.Workspace:
                        workspaceIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Organization:
                        organizationIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Project:
                        projectIds.Add(assignment.ScopeId);
                        break;
                }
            }

            foreach (var member in memberAssignments)
            {
                if (member.Role != null && await _permissionService.RoleHasPermissionAsync(member.Role.Name, permission))
                {
                    organizationIds.Add(member.OrganizationId);
                }
            }

            if (organizationId.HasValue)
            {
                organizationIds.Add(organizationId.Value);
            }

            if (organizationIds.Any())
            {
                var orgWorkspaces = await _db.Workspaces
                    .Where(w => organizationIds.Contains(w.OrganizationId))
                    .Select(w => w.Id)
                    .ToListAsync();
                workspaceIds.AddRange(orgWorkspaces);
            }

            if (projectIds.Any())
            {
                var projectWorkspaces = await _db.Projects
                    .Where(p => projectIds.Contains(p.Id))
                    .Select(p => p.WorkspaceId)
                    .ToListAsync();
                workspaceIds.AddRange(projectWorkspaces);
            }

            return workspaceIds.Distinct().ToList();
        }
    }
}
