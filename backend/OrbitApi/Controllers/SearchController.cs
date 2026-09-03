using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System.Security.Claims;
using System.Text.Json;

namespace OrbitApi.Controllers;

/// <summary>
/// API Controller providing multi-entity global search across projects, tasks, donors, and financial records with role-based filtering.
/// </summary>
[ApiController]
[Route("api/v1/search")]
[Authorize]
public class SearchController : ControllerBase
{
    private readonly OrbitDbContext _db;

    /// <summary>
    /// Initializes a new instance of <see cref="SearchController"/>.
    /// </summary>
    public SearchController(OrbitDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Extracts the integer User ID from authentication claims.
    /// </summary>
    private int GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub")
                  ?? User.FindFirstValue("id");
        return int.TryParse(sub, out var id) ? id : 0;
    }

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
        if (userId > 0)
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

        return null;
    }

    /// <summary>
    /// Computes the highest organizational role the current user holds to enforce sensitive data visibility (e.g. financial filtering).
    /// </summary>
    /// <param name="userId">The user ID.</param>
    /// <returns>Highest role name or null.</returns>
    private async Task<RoleName?> GetUserHighestRole(int userId)
    {
        var isOwner = await _db.Organizations.AnyAsync(o => o.OwnerId == userId && !o.IsDeleted)
            || await _db.RoleAssignments.AnyAsync(a => a.UserId == userId && a.Role != null && a.Role.Name == RoleName.Owner)
            || await _db.OrganizationMembers.AnyAsync(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null && m.Role.Name == RoleName.Owner);

        if (isOwner) return RoleName.Owner;

        var roles = await _db.RoleAssignments
            .Where(ra => ra.UserId == userId && ra.Role != null)
            .Include(ra => ra.Role)
            .Select(ra => ra.Role!.Name)
            .ToListAsync();

        var memberRoles = await _db.OrganizationMembers
            .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active && m.Role != null)
            .Include(m => m.Role)
            .Select(m => m.Role!.Name)
            .ToListAsync();

        roles.AddRange(memberRoles);

        if (!roles.Any()) return null;

        var roleOrder = new[] { RoleName.Viewer, RoleName.Member, RoleName.Coordinator, RoleName.Manager, RoleName.FinanceOfficer, RoleName.Admin, RoleName.Owner };
        return roles.OrderByDescending(r => Array.IndexOf(roleOrder, r)).First();
    }

    /// <summary>
    /// Executes a federated search across Projects, Tasks, Donors, and Expenses based on query terms and filters.
    /// Scoped strictly to the active organization tenant.
    /// </summary>
    /// <param name="q">Search keyword.</param>
    /// <param name="type">Optional entity filter ('project', 'task', 'donor', 'expense').</param>
    /// <param name="status">Optional status filter string.</param>
    /// <param name="dateFrom">Optional start date boundary.</param>
    /// <param name="dateTo">Optional end date boundary.</param>
    /// <param name="assignee">Optional assignee user ID filter for tasks.</param>
    /// <returns>Unified list of SearchResultDto items matching criteria.</returns>
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int? assignee)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new { results = Array.Empty<object>(), totalCount = 0 });

        var activeOrgId = GetActiveOrganizationId();
        if (!activeOrgId.HasValue || activeOrgId.Value <= 0)
            return Ok(new { results = Array.Empty<object>(), totalCount = 0 });

        var targetOrgId = activeOrgId.Value;
        var userId = GetCurrentUserId();
        var highestRole = await GetUserHighestRole(userId);

        var results = new List<SearchResultDto>();
        var term = q.ToLower();

        // ── Roles that CAN see financial data ──────────────────────────────
        bool canSeeFinancials = highestRole.HasValue && highestRole.Value is
            RoleName.Owner or RoleName.Admin or RoleName.FinanceOfficer or RoleName.Manager;

        // ── PROJECTS (organization-scoped) ─────────────────────────────────
        if (type is null or "project")
        {
            var projectsQuery = _db.Projects
                .Where(p => !p.IsDeleted && p.Workspace != null && p.Workspace.OrganizationId == targetOrgId &&
                    (p.Title.ToLower().Contains(term) || (p.Description != null && p.Description.ToLower().Contains(term))));

            if (status != null)
            {
                if (Enum.TryParse<ProjectStatus>(status, true, out var ps))
                    projectsQuery = projectsQuery.Where(p => p.Status == ps);
            }
            if (dateFrom.HasValue)
                projectsQuery = projectsQuery.Where(p => p.StartDate >= dateFrom.Value);
            if (dateTo.HasValue)
                projectsQuery = projectsQuery.Where(p => p.StartDate <= dateTo.Value);

            var projects = await projectsQuery
                .Include(p => p.Workspace)
                .Take(20)
                .ToListAsync();

            results.AddRange(projects.Select(p => new SearchResultDto
            {
                Type = "Project",
                Id = p.Id,
                Title = p.Title,
                Subtitle = p.Workspace?.Name ?? "Unknown workspace",
                Status = p.Status.ToString(),
                Url = "/projects"
            }));
        }

        // ── TASKS (organization-scoped) ────────────────────────────────────
        if (type is null or "task")
        {
            var tasksQuery = _db.Tasks
                .Where(t => !t.IsDeleted && t.Project != null && t.Project.Workspace != null && t.Project.Workspace.OrganizationId == targetOrgId &&
                    t.Title.ToLower().Contains(term));

            if (status != null)
            {
                if (Enum.TryParse<OrbitApi.Models.TaskStatus>(status, true, out var ts))
                    tasksQuery = tasksQuery.Where(t => t.Status == ts);
            }
            if (dateFrom.HasValue)
                tasksQuery = tasksQuery.Where(t => t.Deadline >= dateFrom.Value);
            if (dateTo.HasValue)
                tasksQuery = tasksQuery.Where(t => t.Deadline <= dateTo.Value);
            if (assignee.HasValue)
                tasksQuery = tasksQuery.Where(t => t.TaskMembers.Any(tm => tm.UserId == assignee.Value));

            var tasks = await tasksQuery
                .Include(t => t.Project)
                .Take(20)
                .ToListAsync();

            results.AddRange(tasks.Select(t => new SearchResultDto
            {
                Type = "Task",
                Id = t.Id,
                Title = t.Title,
                Subtitle = t.Project?.Title ?? "Unknown project",
                Status = t.Status.ToString(),
                Url = "/tasks"
            }));
        }

        // ── DONORS (organization-scoped & finance-gated) ───────────────────
        if (canSeeFinancials && type is null or "donor")
        {
            var donors = await _db.Donors
                .Where(d => d.OrganizationId == targetOrgId && d.Name.ToLower().Contains(term))
                .Take(10)
                .ToListAsync();

            results.AddRange(donors.Select(d => new SearchResultDto
            {
                Type = "Donor",
                Id = d.Id,
                Title = d.Name,
                Subtitle = d.DonorType.ToString(),
                Status = null,
                Url = "/organizations"
            }));
        }

        // ── EXPENSES (organization-scoped & finance-gated) ─────────────────
        if (canSeeFinancials && type is null or "expense")
        {
            var expensesQuery = _db.Expenses
                .Where(e => ((e.Project != null && e.Project.Workspace != null && e.Project.Workspace.OrganizationId == targetOrgId) ||
                             (e.BankAccount != null && e.BankAccount.OrganizationId == targetOrgId) ||
                             (e.Task != null && e.Task.Project != null && e.Task.Project.Workspace != null && e.Task.Project.Workspace.OrganizationId == targetOrgId)) &&
                            e.Description.ToLower().Contains(term));

            if (status != null && Enum.TryParse<ApprovalStatus>(status, true, out var approvalStatus))
                expensesQuery = expensesQuery.Where(e => e.ApprovalStatus == approvalStatus);
            if (dateFrom.HasValue)
                expensesQuery = expensesQuery.Where(e => e.Date >= dateFrom.Value);
            if (dateTo.HasValue)
                expensesQuery = expensesQuery.Where(e => e.Date <= dateTo.Value);

            var expenses = await expensesQuery
                .Include(e => e.Project)
                .Take(10)
                .ToListAsync();

            results.AddRange(expenses.Select(e => new SearchResultDto
            {
                Type = "Expense",
                Id = e.Id,
                Title = $"{e.Currency} {e.Amount:N2} — {e.Description}",
                Subtitle = e.Project?.Title ?? "General",
                Status = e.ApprovalStatus.ToString(),
                Url = "/organizations"
            }));
        }

        return Ok(new { results, totalCount = results.Count });
    }

    /// <summary>
    /// Retrieves all saved search queries created by the current user.
    /// </summary>
    [HttpGet("saved")]
    public async Task<IActionResult> GetSavedSearches()
    {
        var userId = GetCurrentUserId();
        var saved = await _db.SavedSearches
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new { s.Id, s.Name, s.QueryJson, s.CreatedAt })
            .ToListAsync();
        return Ok(saved);
    }

    /// <summary>
    /// Persists a custom search filter combination for fast re-execution.
    /// </summary>
    /// <param name="req">The search save request payload.</param>
    [HttpPost("saved")]
    public async Task<IActionResult> SaveSearch([FromBody] SaveSearchRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest("Name is required.");

        var userId = GetCurrentUserId();
        var saved = new SavedSearch
        {
            UserId = userId,
            Name = req.Name,
            QueryJson = req.QueryJson ?? "{}",
            CreatedAt = DateTime.UtcNow
        };
        _db.SavedSearches.Add(saved);
        await _db.SaveChangesAsync();
        return Ok(new { saved.Id, saved.Name, saved.QueryJson, saved.CreatedAt });
    }

    /// <summary>
    /// Deletes a saved search query belonging to the authenticated user.
    /// </summary>
    /// <param name="id">The saved search record ID.</param>
    [HttpDelete("saved/{id}")]
    public async Task<IActionResult> DeleteSavedSearch(int id)
    {
        var userId = GetCurrentUserId();
        var saved = await _db.SavedSearches.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
        if (saved == null) return NotFound();
        _db.SavedSearches.Remove(saved);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record SearchResultDto
{
    public string Type { get; init; } = "";
    public int Id { get; init; }
    public string Title { get; init; } = "";
    public string Subtitle { get; init; } = "";
    public string? Status { get; init; }
    public string Url { get; init; } = "";
}

public record SaveSearchRequest(string Name, string? QueryJson);
