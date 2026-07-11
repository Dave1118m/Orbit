using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class WorkspacesController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;

        public WorkspacesController(OrbitDbContext db, IAuthorizationService authorizationService)
        {
            _db = db;
            _authorizationService = authorizationService;
        }

        [HttpPost]
        public async Task<ActionResult<WorkspaceDto>> Create([FromBody] CreateWorkspaceRequest req)
        {
            var organizationResource = new ScopedResource(ScopeType.Organization, req.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, organizationResource, new PermissionRequirement(Permission.WorkspaceCreate))).Succeeded)
            {
                return Forbid();
            }

            var workspace = new Workspace
            {
                OrganizationId = req.OrganizationId,
                Name = req.Name,
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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkspaceDto>>> List([FromQuery] int? orgId)
        {
            if (orgId.HasValue)
            {
                var orgResource = new ScopedResource(ScopeType.Organization, orgId.Value);
                if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.WorkspaceView))).Succeeded)
                {
                    return Forbid();
                }
            }

            var accessibleWorkspaceIds = orgId.HasValue
                ? await GetAccessibleWorkspaceIdsAsync(Permission.WorkspaceView, orgId.Value)
                : await GetAccessibleWorkspaceIdsAsync(Permission.WorkspaceView, null);

            if (!accessibleWorkspaceIds.Any())
            {
                return Ok(Array.Empty<WorkspaceDto>());
            }

            var workspaces = await _db.Workspaces
                .Where(w => accessibleWorkspaceIds.Contains(w.Id))
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

            if (req.Name != null) workspace.Name = req.Name;
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
            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var workspaceIds = new List<int>();
            var organizationIds = new List<int>();
            var projectIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!RolePermissionMapping.Defaults.TryGetValue(assignment.Role!.Name, out var perms) || !perms.Contains(permission))
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
