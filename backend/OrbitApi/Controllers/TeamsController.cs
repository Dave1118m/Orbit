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
    public class TeamsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;

        public TeamsController(OrbitDbContext db, IAuthorizationService authorizationService)
        {
            _db = db;
            _authorizationService = authorizationService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TeamDto>>> List([FromQuery] int? workspaceId)
        {
            if (workspaceId.HasValue)
            {
                var workspaceResource = new ScopedResource(ScopeType.Workspace, workspaceId.Value);
                if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.TeamView))).Succeeded)
                {
                    return Forbid();
                }
            }

            var workspaceIds = workspaceId.HasValue
                ? new List<int> { workspaceId.Value }
                : await GetAccessibleWorkspaceIdsAsync(Permission.TeamView);

            if (!workspaceIds.Any())
            {
                return Ok(Array.Empty<TeamDto>());
            }

            var teams = await _db.Teams
                .Where(t => workspaceIds.Contains(t.WorkspaceId))
                .Select(t => new TeamDto
                {
                    Id = t.Id,
                    WorkspaceId = t.WorkspaceId,
                    Name = t.Name,
                    Description = t.Description,
                    TeamLeadUserId = t.TeamLeadUserId,
                    IsArchived = t.IsArchived
                }).ToListAsync();

            return Ok(teams);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TeamDto>> Get(int id)
        {
            var team = await _db.Teams
                .Include(t => t.TeamMembers)
                .Include(t => t.ProjectTeams)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamView))).Succeeded)
            {
                return Forbid();
            }

            var dto = new TeamDto
            {
                Id = team.Id,
                WorkspaceId = team.WorkspaceId,
                Name = team.Name,
                Description = team.Description,
                TeamLeadUserId = team.TeamLeadUserId,
                IsArchived = team.IsArchived,
                Members = team.TeamMembers.Select(m => new TeamMemberDto
                {
                    Id = m.Id,
                    TeamId = m.TeamId,
                    UserId = m.UserId,
                    JoinedAt = m.JoinedAt
                }).ToList(),
                Projects = team.ProjectTeams.Select(p => new ProjectTeamDto
                {
                    Id = p.Id,
                    ProjectId = p.ProjectId,
                    TeamId = p.TeamId,
                    AssignedAt = p.AssignedAt
                }).ToList()
            };

            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<TeamDto>> Create([FromBody] CreateTeamRequest req)
        {
            var workspaceResource = new ScopedResource(ScopeType.Workspace, req.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.TeamCreate))).Succeeded)
            {
                return Forbid();
            }

            var team = new Team
            {
                WorkspaceId = req.WorkspaceId,
                Name = req.Name,
                Description = req.Description,
                TeamLeadUserId = req.TeamLeadUserId,
                IsArchived = false
            };

            _db.Teams.Add(team);
            await _db.SaveChangesAsync();

            var dto = new TeamDto { Id = team.Id, WorkspaceId = team.WorkspaceId, Name = team.Name, Description = team.Description, TeamLeadUserId = team.TeamLeadUserId, IsArchived = team.IsArchived };

            return CreatedAtAction(nameof(Get), new { id = team.Id }, dto);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TeamDto>> Update(int id, [FromBody] UpdateTeamRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamEdit))).Succeeded)
            {
                return Forbid();
            }

            if (req.Name != null) team.Name = req.Name;
            if (req.Description != null) team.Description = req.Description;
            if (req.TeamLeadUserId.HasValue) team.TeamLeadUserId = req.TeamLeadUserId;
            if (req.IsArchived.HasValue) team.IsArchived = req.IsArchived.Value;

            await _db.SaveChangesAsync();

            return Ok(new TeamDto { Id = team.Id, WorkspaceId = team.WorkspaceId, Name = team.Name, Description = team.Description, TeamLeadUserId = team.TeamLeadUserId, IsArchived = team.IsArchived });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamDelete))).Succeeded)
            {
                return Forbid();
            }

            // soft-delete by archiving to avoid cascade problems
            team.IsArchived = true;
            await _db.SaveChangesAsync();

            return NoContent();
        }

        [HttpPost("{id}/members")]
        public async Task<ActionResult<TeamMemberDto>> AddMember(int id, [FromBody] AddTeamMemberRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamManageMembers))).Succeeded)
            {
                return Forbid();
            }

            var existing = await _db.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == id && tm.UserId == req.UserId);
            if (existing != null) return Conflict("Member already exists");

            var member = new TeamMember { TeamId = id, UserId = req.UserId, JoinedAt = DateTime.UtcNow };
            _db.TeamMembers.Add(member);
            await _db.SaveChangesAsync();

            var dto = new TeamMemberDto { Id = member.Id, TeamId = member.TeamId, UserId = member.UserId, JoinedAt = member.JoinedAt };
            return CreatedAtAction(nameof(Get), new { id = id }, dto);
        }

        [HttpDelete("{id}/members/{userId}")]
        public async Task<IActionResult> RemoveMember(int id, int userId)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamManageMembers))).Succeeded)
            {
                return Forbid();
            }

            var member = await _db.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == id && tm.UserId == userId);
            if (member == null) return NotFound();

            _db.TeamMembers.Remove(member);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id}/assign-project")]
        public async Task<ActionResult<ProjectTeamDto>> AssignProject(int id, [FromBody] AssignTeamToProjectRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamAssignProject))).Succeeded)
            {
                return Forbid();
            }

            var project = await _db.Projects.FindAsync(req.ProjectId);
            if (project == null) return BadRequest("Project not found");

            var existing = await _db.ProjectTeams.FirstOrDefaultAsync(pt => pt.TeamId == id && pt.ProjectId == req.ProjectId);
            if (existing != null) return Conflict("Team already assigned to project");

            var pt = new ProjectTeam { ProjectId = req.ProjectId, TeamId = id, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeams.Add(pt);

            var hist = new ProjectTeamHistory { ProjectId = req.ProjectId, TeamId = id, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeamHistories.Add(hist);

            await _db.SaveChangesAsync();

            var dto = new ProjectTeamDto { Id = pt.Id, ProjectId = pt.ProjectId, TeamId = pt.TeamId, AssignedAt = pt.AssignedAt };
            return CreatedAtAction(nameof(Get), new { id = id }, dto);
        }

        [HttpDelete("{id}/unassign-project/{projectId}")]
        public async Task<IActionResult> UnassignProject(int id, int projectId)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamAssignProject))).Succeeded)
            {
                return Forbid();
            }

            var pt = await _db.ProjectTeams.FirstOrDefaultAsync(x => x.TeamId == id && x.ProjectId == projectId);
            if (pt == null) return NotFound();

            _db.ProjectTeams.Remove(pt);

            var hist = await _db.ProjectTeamHistories.Where(h => h.TeamId == id && h.ProjectId == projectId).OrderByDescending(h => h.AssignedAt).FirstOrDefaultAsync();
            if (hist != null)
            {
                hist.RemovedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{id}/history")]
        public async Task<ActionResult<IEnumerable<ProjectTeamHistoryDto>>> History(int id)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            var teamResource = new ScopedResource(ScopeType.Workspace, team.WorkspaceId);
            if (!(await _authorizationService.AuthorizeAsync(User, teamResource, new PermissionRequirement(Permission.TeamView))).Succeeded)
            {
                return Forbid();
            }

            var list = await _db.ProjectTeamHistories.Where(h => h.TeamId == id).Select(h => new ProjectTeamHistoryDto
            {
                Id = h.Id,
                ProjectId = h.ProjectId,
                TeamId = h.TeamId,
                AssignedAt = h.AssignedAt,
                RemovedAt = h.RemovedAt,
                ReplacedByTeamId = h.ReplacedByTeamId
            }).ToListAsync();

            return Ok(list);
        }

        private async Task<List<int>> GetAccessibleWorkspaceIdsAsync(Permission permission)
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
