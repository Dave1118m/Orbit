using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing workspace teams, member rosters, workload analytics,
    /// project assignment, team replacements, team migrations, and team duplication.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class TeamsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly INotificationService _notificationService;
        private readonly IPermissionService _permissionService;

        public TeamsController(OrbitDbContext db, IAuthorizationService authorizationService, INotificationService notificationService, IPermissionService permissionService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _notificationService = notificationService;
            _permissionService = permissionService;
        }

        private int GetActiveOrganizationId()
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

            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            if (int.TryParse(userIdClaim, out var userId))
            {
                var userOrgId = _db.OrganizationMembers
                    .Where(om => om.UserId == userId && om.Status == OrgMemberStatus.Active)
                    .Select(om => om.OrganizationId)
                    .FirstOrDefault();
                if (userOrgId > 0 && _db.Organizations.Any(o => o.Id == userOrgId && !o.IsDeleted)) return userOrgId;

                var ownedOrgId = _db.Organizations
                    .Where(o => o.OwnerId == userId && !o.IsDeleted)
                    .Select(o => o.Id)
                    .FirstOrDefault();
                if (ownedOrgId > 0) return ownedOrgId;
            }
            
            return 0;
        }

        private async Task<bool> IsAuthorizedForWorkspaceAsync(int workspaceId, Permission permission)
        {
            var workspaceResource = new ScopedResource(ScopeType.Workspace, workspaceId);
            return (await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(permission))).Succeeded;
        }

        private async Task<bool> IsAuthorizedForProjectAsync(int projectId, Permission permission)
        {
            var projectResource = new ScopedResource(ScopeType.Project, projectId);
            return (await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(permission))).Succeeded;
        }

        /// <summary>
        /// Lists all teams within the active organization or filtered by workspace.
        /// </summary>
        /// <param name="workspaceId">Optional workspace ID filter.</param>
        /// <returns>Collection of team DTOs.</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TeamDto>>> List([FromQuery] int? workspaceId)
        {
            var activeOrgId = GetActiveOrganizationId();

            var query = _db.Teams
                .Include(t => t.Workspace)
                .Include(t => t.TeamMembers)
                .Include(t => t.ProjectTeams).ThenInclude(p => p.Project)
                .Where(t => t.Workspace != null && t.Workspace.OrganizationId == activeOrgId);

            if (workspaceId.HasValue)
            {
                if (!(await IsAuthorizedForWorkspaceAsync(workspaceId.Value, Permission.TeamView)))
                {
                    return Forbid();
                }
                query = query.Where(t => t.WorkspaceId == workspaceId.Value);
            }

            var teamEntities = await query.ToListAsync();

            // Self-healing: Ensure any team with a designated TeamLeadUserId has the leader enrolled in TeamMembers
            bool needsDbSave = false;
            foreach (var team in teamEntities)
            {
                if (team.TeamLeadUserId.HasValue && team.TeamLeadUserId.Value > 0 && !team.TeamMembers.Any(m => m.UserId == team.TeamLeadUserId.Value))
                {
                    var newLeadMember = new TeamMember
                    {
                        TeamId = team.Id,
                        UserId = team.TeamLeadUserId.Value,
                        JoinedAt = DateTime.UtcNow
                    };
                    _db.TeamMembers.Add(newLeadMember);
                    team.TeamMembers.Add(newLeadMember);
                    needsDbSave = true;
                }
            }
            if (needsDbSave)
            {
                await _db.SaveChangesAsync();
            }

            var teams = teamEntities.Select(t => new TeamDto
            {
                Id = t.Id,
                WorkspaceId = t.WorkspaceId,
                Name = t.Name,
                Description = t.Description,
                TeamLeadUserId = t.TeamLeadUserId,
                IsArchived = t.IsArchived,
                Members = t.TeamMembers.Select(m => new TeamMemberDto
                {
                    Id = m.Id,
                    TeamId = m.TeamId,
                    UserId = m.UserId,
                    JoinedAt = m.JoinedAt
                }).ToList(),
                Projects = t.ProjectTeams
                    .Where(p => p.Project != null && !p.Project.IsDeleted)
                    .Select(p => new ProjectTeamDto
                    {
                        Id = p.Id,
                        ProjectId = p.ProjectId,
                        ProjectTitle = p.Project!.Title,
                        TeamId = p.TeamId,
                        AssignedAt = p.AssignedAt
                    }).ToList()
            }).ToList();

            return Ok(teams);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TeamDto>> Get(int id)
        {
            var team = await _db.Teams
                .Include(t => t.TeamMembers)
                .Include(t => t.ProjectTeams)
                .ThenInclude(pt => pt.Project)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamView)))
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
                Projects = team.ProjectTeams
                    .Where(p => p.Project != null && !p.Project.IsDeleted)
                    .Select(p => new ProjectTeamDto
                    {
                        Id = p.Id,
                        ProjectId = p.ProjectId,
                        ProjectTitle = p.Project!.Title,
                        TeamId = p.TeamId,
                        AssignedAt = p.AssignedAt
                    }).ToList()
            };

            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<TeamDto>> Create([FromBody] CreateTeamRequest req)
        {
            if (!(await IsAuthorizedForWorkspaceAsync(req.WorkspaceId, Permission.TeamCreate)))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
            {
                return BadRequest("Team name must be at least 2 characters long.");
            }
            if (req.Name.Trim().Length > 100)
            {
                return BadRequest("Team name cannot exceed 100 characters.");
            }

            var isDuplicate = await _db.Teams.AnyAsync(t => t.WorkspaceId == req.WorkspaceId && t.Name.ToLower() == req.Name.Trim().ToLower());
            if (isDuplicate)
            {
                return BadRequest($"A team named '{req.Name.Trim()}' already exists in this workspace.");
            }

            var team = new Team
            {
                WorkspaceId = req.WorkspaceId,
                Name = req.Name.Trim(),
                Description = req.Description,
                TeamLeadUserId = req.TeamLeadUserId,
                IsArchived = false
            };

            _db.Teams.Add(team);
            await _db.SaveChangesAsync();

            var membersList = new List<TeamMemberDto>();

            // Automatically enroll designated team leader as an initial member of the team
            if (req.TeamLeadUserId.HasValue && req.TeamLeadUserId.Value > 0)
            {
                var leadMember = new TeamMember
                {
                    TeamId = team.Id,
                    UserId = req.TeamLeadUserId.Value,
                    JoinedAt = DateTime.UtcNow
                };
                _db.TeamMembers.Add(leadMember);
                await _db.SaveChangesAsync();

                membersList.Add(new TeamMemberDto
                {
                    Id = leadMember.Id,
                    TeamId = team.Id,
                    UserId = leadMember.UserId,
                    JoinedAt = leadMember.JoinedAt
                });
            }

            var dto = new TeamDto
            {
                Id = team.Id,
                WorkspaceId = team.WorkspaceId,
                Name = team.Name,
                Description = team.Description,
                TeamLeadUserId = team.TeamLeadUserId,
                IsArchived = team.IsArchived,
                Members = membersList
            };

            return CreatedAtAction(nameof(Get), new { id = team.Id }, dto);
        }

        /// <summary>
        /// Updates team name, description, designated lead, or archived status.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <param name="req">Updated fields.</param>
        /// <returns>Updated team DTO.</returns>
        [HttpPut("{id}")]
        public async Task<ActionResult<TeamDto>> Update(int id, [FromBody] UpdateTeamRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamEdit)))
            {
                return Forbid();
            }

            var previousLeadUserId = team.TeamLeadUserId;
            if (req.Name != null)
            {
                if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
                {
                    return BadRequest("Team name must be at least 2 characters long.");
                }
                if (req.Name.Trim().Length > 100)
                {
                    return BadRequest("Team name cannot exceed 100 characters.");
                }

                var isDuplicate = await _db.Teams.AnyAsync(t => t.WorkspaceId == team.WorkspaceId && t.Id != id && t.Name.ToLower() == req.Name.Trim().ToLower());
                if (isDuplicate)
                {
                    return BadRequest($"A team named '{req.Name.Trim()}' already exists in this workspace.");
                }

                team.Name = req.Name.Trim();
            }
            if (req.Description != null) team.Description = req.Description;
            if (req.TeamLeadUserId.HasValue) team.TeamLeadUserId = req.TeamLeadUserId;
            if (req.IsArchived.HasValue) team.IsArchived = req.IsArchived.Value;

            await _db.SaveChangesAsync();

            if (req.TeamLeadUserId.HasValue && req.TeamLeadUserId != previousLeadUserId)
            {
                var newLeadUserId = req.TeamLeadUserId.Value;
                if (previousLeadUserId.HasValue && previousLeadUserId.Value > 0)
                {
                    await _notificationService.NotifyUserAsync(previousLeadUserId.Value, $"You are no longer the lead of team '{team.Name}'.");
                }

                await _notificationService.NotifyUserAsync(newLeadUserId, $"You are now the lead of team '{team.Name}'.");
            }

            return Ok(new TeamDto { Id = team.Id, WorkspaceId = team.WorkspaceId, Name = team.Name, Description = team.Description, TeamLeadUserId = team.TeamLeadUserId, IsArchived = team.IsArchived });
        }

        /// <summary>
        /// Soft-deletes/archives a team.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamDelete)))
            {
                return Forbid();
            }

            // soft-delete by archiving to avoid cascade problems
            team.IsArchived = true;
            await _db.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Adds an individual member to a team.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <param name="req">User ID to add.</param>
        /// <returns>Created team member record.</returns>
        [HttpPost("{id}/members")]
        public async Task<ActionResult<TeamMemberDto>> AddMember(int id, [FromBody] AddTeamMemberRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamManageMembers)))
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

        /// <summary>
        /// Bulk-adds multiple users to a team roster.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <param name="req">List of user IDs.</param>
        /// <returns>Count of members added.</returns>
        [HttpPost("{id}/members/bulk")]
        public async Task<ActionResult> AddMembersBulk(int id, [FromBody] BulkAddTeamMembersRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamManageMembers)))
            {
                return Forbid();
            }

            if (req.UserIds == null || !req.UserIds.Any())
            {
                return BadRequest("No users provided.");
            }

            var existingMemberIds = await _db.TeamMembers
                .Where(tm => tm.TeamId == id)
                .Select(tm => tm.UserId)
                .ToListAsync();

            var validUserIds = await _db.Users
                .Where(u => req.UserIds.Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync();

            var newUsers = validUserIds.Except(existingMemberIds).Distinct().ToList();

            foreach (var userId in newUsers)
            {
                _db.TeamMembers.Add(new TeamMember { TeamId = id, UserId = userId, JoinedAt = DateTime.UtcNow });
            }

            await _db.SaveChangesAsync();

            return Ok(new { addedCount = newUsers.Count });
        }

        /// <summary>
        /// Removes a member from a team.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <param name="userId">User ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}/members/{userId}")]
        public async Task<IActionResult> RemoveMember(int id, int userId)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamManageMembers)))
            {
                return Forbid();
            }

            var member = await _db.TeamMembers.FirstOrDefaultAsync(tm => tm.TeamId == id && tm.UserId == userId);
            if (member == null) return NotFound();

            _db.TeamMembers.Remove(member);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Assigns a team as a cohesive unit to a project.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <param name="req">Target project ID.</param>
        /// <returns>Project team linkage record.</returns>
        [HttpPost("{id}/assign-project")]
        public async Task<ActionResult<ProjectTeamDto>> AssignProject(int id, [FromBody] AssignTeamToProjectRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamAssignProject)))
            {
                return Forbid();
            }

            var project = await _db.Projects.FindAsync(req.ProjectId);
            if (project == null) return BadRequest("Project not found");

            var existing = await _db.ProjectTeams.FirstOrDefaultAsync(pt => pt.TeamId == id && pt.ProjectId == req.ProjectId);
            if (existing != null) return Conflict("Team already assigned to project");

            var pt = new ProjectTeam { ProjectId = req.ProjectId, TeamId = id, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeams.Add(pt);

            var history = new ProjectTeamHistory { ProjectId = req.ProjectId, TeamId = id, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeamHistories.Add(history);

            await _db.SaveChangesAsync();

            var dto = new ProjectTeamDto { Id = pt.Id, ProjectId = pt.ProjectId, TeamId = pt.TeamId, AssignedAt = pt.AssignedAt };
            return CreatedAtAction(nameof(Get), new { id = id }, dto);
        }

        /// <summary>
        /// Retrieves the complete historical project assignment log for a team.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <returns>List of past and current project assignments.</returns>
        [HttpGet("{id}/history")]
        public async Task<ActionResult<List<ProjectTeamHistoryDto>>> GetTeamHistory(int id)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamView)))
            {
                return Forbid();
            }

            var list = await _db.ProjectTeamHistories
                .Include(h => h.Project)
                .Where(h => h.TeamId == id && h.Project != null && !h.Project.IsDeleted)
                .Select(h => new ProjectTeamHistoryDto
                {
                    Id = h.Id,
                    ProjectId = h.ProjectId,
                    ProjectTitle = h.Project!.Title,
                    TeamId = h.TeamId,
                    AssignedAt = h.AssignedAt,
                    RemovedAt = h.RemovedAt,
                    ReplacedByTeamId = h.ReplacedByTeamId
                }).ToListAsync();

            return Ok(list);
        }

        /// <summary>
        /// Replaces a team on a project with a new team, recording historical audit records and optional deadline extension.
        /// </summary>
        /// <param name="id">Current Team ID.</param>
        /// <param name="req">Replacement parameters including new team ID, reason, and new end date.</param>
        /// <returns>Replacement status.</returns>
        [HttpPost("{id}/replace-on-project")]
        public async Task<ActionResult> ReplaceTeam(int id, [FromBody] ReplaceTeamRequest req)
        {
            if (req.NewTeamId == id)
            {
                return BadRequest("The replacement team cannot be the current team.");
            }

            var currentTeam = await _db.Teams.FindAsync(id);
            if (currentTeam == null) return NotFound("Current team not found");

            var newTeam = await _db.Teams.FindAsync(req.NewTeamId);
            if (newTeam == null) return BadRequest("Replacement team not found");

            if (newTeam.IsArchived)
            {
                return BadRequest("Cannot replace with an archived team.");
            }

            if (currentTeam.WorkspaceId != newTeam.WorkspaceId)
                return BadRequest("Teams must be in the same workspace");

            if (!(await IsAuthorizedForWorkspaceAsync(currentTeam.WorkspaceId, Permission.TeamAssignProject)))
            {
                return Forbid();
            }

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && !p.IsDeleted);
            if (project == null) return BadRequest("Target project not found or has been deleted.");

            if (!(await IsAuthorizedForProjectAsync(project.Id, Permission.ProjectEdit)))
            {
                return Forbid();
            }

            if (!(await IsAuthorizedForWorkspaceAsync(newTeam.WorkspaceId, Permission.TeamAssignProject)))
            {
                return Forbid();
            }

            var currentProjectTeam = await _db.ProjectTeams.FirstOrDefaultAsync(pt => pt.TeamId == id && pt.ProjectId == req.ProjectId);
            if (currentProjectTeam == null)
            {
                return BadRequest("The current team is not currently assigned to this project.");
            }

            var alreadyAssigned = await _db.ProjectTeams.FirstOrDefaultAsync(pt => pt.TeamId == req.NewTeamId && pt.ProjectId == req.ProjectId);
            if (alreadyAssigned != null) return Conflict("The replacement team is already assigned to this project.");

            _db.ProjectTeams.Remove(currentProjectTeam);

            var oldHistory = await _db.ProjectTeamHistories
                .Where(h => h.TeamId == id && h.ProjectId == req.ProjectId && h.RemovedAt == null)
                .OrderByDescending(h => h.AssignedAt)
                .FirstOrDefaultAsync();

            if (oldHistory != null)
            {
                oldHistory.RemovedAt = DateTime.UtcNow;
                oldHistory.ReplacedByTeamId = req.NewTeamId;
            }

            var newProjectTeam = new ProjectTeam { ProjectId = req.ProjectId, TeamId = req.NewTeamId, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeams.Add(newProjectTeam);

            var newHistory = new ProjectTeamHistory { ProjectId = req.ProjectId, TeamId = req.NewTeamId, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeamHistories.Add(newHistory);

            if (req.NewEndDate.HasValue)
            {
                if (project != null)
                {
                    var currentEnd = project.EndDate ?? project.StartDate ?? DateTime.UtcNow;
                    if (req.NewEndDate.Value <= currentEnd)
                    {
                        return BadRequest($"Postponed project end date ({req.NewEndDate.Value:yyyy-MM-dd}) must be strictly after current project end date ({currentEnd:yyyy-MM-dd}).");
                    }
                    var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                        ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
                    int.TryParse(userIdClaim, out var userId);

                    var postponement = new ProjectPostponement
                    {
                        ProjectId = req.ProjectId,
                        OldEndDate = project.EndDate ?? DateTime.UtcNow,
                        NewEndDate = req.NewEndDate.Value,
                        Reason = string.IsNullOrWhiteSpace(req.Reason) ? $"Postponement due to replacement of Team #{id} with Team #{req.NewTeamId}" : req.Reason,
                        RequestedByUserId = userId,
                        ApprovedByUserId = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _db.ProjectPostponements.Add(postponement);
                    project.EndDate = req.NewEndDate.Value;
                }
            }

            await _db.SaveChangesAsync();

            return Ok(new { message = "Team replaced successfully", replacedAt = DateTime.UtcNow, postponementLogged = req.NewEndDate.HasValue });
        }

        /// <summary>
        /// Retrieves detailed roster metrics for a team including open and overdue task counts per member.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <returns>List of team roster member DTOs.</returns>
        [HttpGet("{id}/roster")]
        public async Task<ActionResult<List<TeamRosterDto>>> GetTeamRoster(int id)
        {
            var team = await _db.Teams.Include(t => t.TeamMembers).FirstOrDefaultAsync(t => t.Id == id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamView)))
            {
                return Forbid();
            }

            var roster = new List<TeamRosterDto>();

            var teamProjectIds = await _db.ProjectTeams
                .Where(pt => pt.TeamId == id)
                .Select(pt => pt.ProjectId)
                .ToListAsync();

            // If team lead was not in TeamMembers table, auto-enroll them
            if (team.TeamLeadUserId.HasValue && team.TeamLeadUserId.Value > 0 && !team.TeamMembers.Any(m => m.UserId == team.TeamLeadUserId.Value))
            {
                var newLeadMember = new TeamMember
                {
                    TeamId = team.Id,
                    UserId = team.TeamLeadUserId.Value,
                    JoinedAt = DateTime.UtcNow
                };
                _db.TeamMembers.Add(newLeadMember);
                await _db.SaveChangesAsync();
                team.TeamMembers.Add(newLeadMember);
            }

            foreach (var member in team.TeamMembers)
            {
                var user = await _db.Users.FindAsync(member.UserId);
                if (user == null) continue;

                var openTasks = await _db.TaskMembers
                    .Where(tm => tm.UserId == member.UserId)
                    .Join(_db.Tasks, tm => tm.TaskId, t => t.Id, (tm, t) => t)
                    .Where(t => teamProjectIds.Contains(t.ProjectId) && t.Status != OrbitApi.Models.TaskStatus.Done && !t.IsDeleted)
                    .CountAsync();

                var overdueTasks = await _db.TaskMembers
                    .Where(tm => tm.UserId == member.UserId)
                    .Join(_db.Tasks, tm => tm.TaskId, t => t.Id, (tm, t) => t)
                    .Where(t => teamProjectIds.Contains(t.ProjectId) && t.Status != OrbitApi.Models.TaskStatus.Done && !t.IsDeleted && t.Deadline < DateTime.UtcNow)
                    .CountAsync();

                roster.Add(new TeamRosterDto
                {
                    Id = member.Id,
                    TeamId = team.Id,
                    UserId = member.UserId,
                    UserName = user.Name,
                    UserEmail = user.Email,
                    UserPhotoUrl = user.PhotoUrl,
                    CurrentRole = team.TeamLeadUserId == member.UserId ? "Team Lead" : "Member",
                    OpenTaskCount = openTasks,
                    OverdueTaskCount = overdueTasks,
                    JoinedAt = member.JoinedAt
                });
            }

            return Ok(roster);
        }

        /// <summary>
        /// Computes comprehensive team workload distribution and task capacity metrics.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <returns>Team workload analytics DTO.</returns>
        [HttpGet("{id}/workload")]
        public async Task<ActionResult<TeamWorkloadDto>> GetTeamWorkload(int id)
        {
            var team = await _db.Teams.Include(t => t.TeamMembers).FirstOrDefaultAsync(t => t.Id == id);
            if (team == null) return NotFound();

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamView)))
            {
                return Forbid();
            }

            var memberWorkloads = new List<TeamMemberWorkloadDto>();
            int totalOpen = 0, totalOverdue = 0;

            var teamProjectIds = await _db.ProjectTeams
                .Where(pt => pt.TeamId == id)
                .Select(pt => pt.ProjectId)
                .ToListAsync();

            var teamMemberUserIds = team.TeamMembers.Select(m => m.UserId).ToList();
            
            var users = await _db.Users
                .Where(u => teamMemberUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Name);

            var taskMemberships = await _db.TaskMembers
                .Where(tm => teamMemberUserIds.Contains(tm.UserId))
                .Join(_db.Tasks, tm => tm.TaskId, t => t.Id, (tm, t) => new { tm.UserId, t })
                .Where(x => teamProjectIds.Contains(x.t.ProjectId) && x.t.Status != OrbitApi.Models.TaskStatus.Done && !x.t.IsDeleted)
                .ToListAsync();

            var volunteerTaskMemberships = await _db.Volunteers
                .Where(v => v.UserId != null && teamMemberUserIds.Contains(v.UserId.Value))
                .Join(_db.TaskVolunteers, v => v.Id, tv => tv.VolunteerId, (v, tv) => new { v.UserId, tv.TaskId })
                .Join(_db.Tasks, vt => vt.TaskId, t => t.Id, (vt, t) => new { vt.UserId, t })
                .Where(x => teamProjectIds.Contains(x.t.ProjectId) && x.t.Status != OrbitApi.Models.TaskStatus.Done && !x.t.IsDeleted)
                .ToListAsync();

            foreach (var member in team.TeamMembers)
            {
                var userName = users.GetValueOrDefault(member.UserId) ?? "Unknown";

                var userTaskIds = taskMemberships.Where(x => x.UserId == member.UserId).Select(x => x.t)
                    .Concat(volunteerTaskMemberships.Where(x => x.UserId == member.UserId).Select(x => x.t))
                    .GroupBy(t => t.Id).Select(g => g.First()).ToList();

                var openTasks = userTaskIds.Count;
                var overdueTasks = userTaskIds.Count(t => t.Deadline < DateTime.UtcNow);

                memberWorkloads.Add(new TeamMemberWorkloadDto
                {
                    UserId = member.UserId,
                    UserName = userName,
                    OpenTasks = openTasks,
                    OverdueTasks = overdueTasks
                });

                totalOpen += openTasks;
                totalOverdue += overdueTasks;
            }

            var workload = new TeamWorkloadDto
            {
                TeamId = team.Id,
                TeamName = team.Name,
                TotalMembers = team.TeamMembers.Count,
                OpenTasksTotal = totalOpen,
                OverdueTasksTotal = totalOverdue,
                AverageTasksPerMember = team.TeamMembers.Count > 0 ? (decimal)totalOpen / team.TeamMembers.Count : 0,
                MemberWorkloads = memberWorkloads
            };

            return Ok(workload);
        }

        /// <summary>
        /// Copies an existing team and its roster to a target workspace.
        /// </summary>
        /// <param name="id">Source Team ID.</param>
        /// <param name="req">Target workspace ID, new team name, and description.</param>
        /// <returns>Created duplicated team DTO.</returns>
        [HttpPost("{id}/copy")]
        public async Task<ActionResult<TeamDto>> CopyTeam(int id, [FromBody] CopyTeamRequest req)
        {
            var sourceTeam = await _db.Teams.Include(t => t.TeamMembers).FirstOrDefaultAsync(t => t.Id == id);
            if (sourceTeam == null) return NotFound("Source team not found");

            if (!(await IsAuthorizedForWorkspaceAsync(req.WorkspaceId, Permission.TeamCreate)))
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(req.NewTeamName) || req.NewTeamName.Trim().Length < 2)
            {
                return BadRequest("New team name must be at least 2 characters long.");
            }
            if (req.NewTeamName.Trim().Length > 100)
            {
                return BadRequest("New team name cannot exceed 100 characters.");
            }

            var isDuplicate = await _db.Teams.AnyAsync(t => t.WorkspaceId == req.WorkspaceId && t.Name.ToLower() == req.NewTeamName.Trim().ToLower());
            if (isDuplicate)
            {
                return BadRequest($"A team named '{req.NewTeamName.Trim()}' already exists in the target workspace.");
            }

            var newTeam = new Team
            {
                WorkspaceId = req.WorkspaceId,
                Name = req.NewTeamName.Trim(),
                Description = req.NewTeamDescription,
                TeamLeadUserId = sourceTeam.TeamLeadUserId,
                IsArchived = false
            };

            _db.Teams.Add(newTeam);
            await _db.SaveChangesAsync();

            foreach (var member in sourceTeam.TeamMembers)
            {
                var newMember = new TeamMember
                {
                    TeamId = newTeam.Id,
                    UserId = member.UserId,
                    JoinedAt = DateTime.UtcNow
                };
                _db.TeamMembers.Add(newMember);
            }

            await _db.SaveChangesAsync();

            var dto = new TeamDto
            {
                Id = newTeam.Id,
                WorkspaceId = newTeam.WorkspaceId,
                Name = newTeam.Name,
                Description = newTeam.Description,
                TeamLeadUserId = newTeam.TeamLeadUserId,
                IsArchived = newTeam.IsArchived
            };

            return CreatedAtAction(nameof(Get), new { id = newTeam.Id }, dto);
        }

        /// <summary>
        /// Migrates/reassigns a team from its current projects to a new destination project.
        /// </summary>
        /// <param name="id">Team ID.</param>
        /// <param name="req">Destination project ID.</param>
        /// <returns>Move operation result.</returns>
        [HttpPost("{id}/move-to-project")]
        public async Task<ActionResult> MoveTeamToProject(int id, [FromBody] AssignTeamToProjectRequest req)
        {
            var team = await _db.Teams.FindAsync(id);
            if (team == null) return NotFound("Team not found.");

            if (team.IsArchived)
            {
                return BadRequest("Cannot move an archived team.");
            }

            if (!(await IsAuthorizedForWorkspaceAsync(team.WorkspaceId, Permission.TeamAssignProject)))
            {
                return Forbid();
            }

            var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == req.ProjectId && !p.IsDeleted);
            if (project == null) return BadRequest("Destination project not found or has been deleted.");

            if (!(await IsAuthorizedForProjectAsync(project.Id, Permission.ProjectEdit)))
            {
                return Forbid();
            }

            var alreadyOnProject = await _db.ProjectTeams.AnyAsync(pt => pt.TeamId == id && pt.ProjectId == req.ProjectId);
            if (alreadyOnProject)
            {
                return BadRequest("Team is already assigned to this destination project.");
            }

            var currentAssignments = await _db.ProjectTeams.Where(pt => pt.TeamId == id).ToListAsync();
            _db.ProjectTeams.RemoveRange(currentAssignments);

            foreach (var assignment in currentAssignments)
            {
                var history = await _db.ProjectTeamHistories
                    .Where(h => h.TeamId == id && h.ProjectId == assignment.ProjectId && h.RemovedAt == null)
                    .OrderByDescending(h => h.AssignedAt)
                    .FirstOrDefaultAsync();

                if (history != null)
                {
                    history.RemovedAt = DateTime.UtcNow;
                }
            }

            var newAssignment = new ProjectTeam { ProjectId = req.ProjectId, TeamId = id, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeams.Add(newAssignment);

            var newHistory = new ProjectTeamHistory { ProjectId = req.ProjectId, TeamId = id, AssignedAt = DateTime.UtcNow };
            _db.ProjectTeamHistories.Add(newHistory);

            await _db.SaveChangesAsync();

            return Ok(new { message = "Team moved successfully", assignedToProjectId = req.ProjectId });
        }

        private async Task<List<int>> GetAccessibleWorkspaceIdsAsync(Permission permission)
        {
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var isOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted)
                || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && a.Role.Name == RoleName.Owner)
                || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && m.Role.Name == RoleName.Owner);

            if (isOwner)
            {
                return await _db.Workspaces.Select(w => w.Id).ToListAsync();
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
