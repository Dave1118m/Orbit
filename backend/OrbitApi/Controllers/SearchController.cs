using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System.Security.Claims;
using System.Text.Json;

namespace OrbitApi.Controllers;

[ApiController]
[Route("api/v1/search")]
[Authorize]
public class SearchController : ControllerBase
{
    private readonly OrbitDbContext _db;

    public SearchController(OrbitDbContext db)
    {
        _db = db;
    }

    private int GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub")
                  ?? User.FindFirstValue("id");
        return int.TryParse(sub, out var id) ? id : 0;
    }

    /// <summary>
    /// Returns the highest role the current user has across all their assignments.
    /// Higher index = more powerful. Owner=6, Admin=5, ... Viewer=0.
    /// </summary>
    private async Task<RoleName?> GetUserHighestRole(int userId)
    {
        var roles = await _db.RoleAssignments
            .Where(ra => ra.UserId == userId)
            .Include(ra => ra.Role)
            .Select(ra => ra.Role!.Name)
            .ToListAsync();

        if (!roles.Any()) return null;

        var roleOrder = new[] { RoleName.Viewer, RoleName.Member, RoleName.Coordinator, RoleName.Manager, RoleName.FinanceOfficer, RoleName.Admin, RoleName.Owner };
        return roles.OrderByDescending(r => Array.IndexOf(roleOrder, r)).First();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/search?q=&type=&status=&dateFrom=&dateTo=&assignee=
    // ─────────────────────────────────────────────────────────────────────────
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

        var userId = GetCurrentUserId();
        var highestRole = await GetUserHighestRole(userId);

        var results = new List<SearchResultDto>();
        var term = q.ToLower();

        // ── Roles that CAN see financial data ──────────────────────────────
        bool canSeeFinancials = highestRole.HasValue && highestRole.Value is
            RoleName.Owner or RoleName.Admin or RoleName.FinanceOfficer or RoleName.Manager;

        // ── PROJECTS ───────────────────────────────────────────────────────
        if (type is null or "project")
        {
            var projectsQuery = _db.Projects
                .Where(p => !p.IsDeleted && (p.Title.ToLower().Contains(term) || (p.Description != null && p.Description.ToLower().Contains(term))));

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

        // ── TASKS ──────────────────────────────────────────────────────────
        if (type is null or "task")
        {
            var tasksQuery = _db.Tasks
                .Where(t => !t.IsDeleted && t.Title.ToLower().Contains(term));

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

        // ── DONORS (finance-gated) ─────────────────────────────────────────
        if (canSeeFinancials && type is null or "donor")
        {
            var donors = await _db.Donors
                .Where(d => d.Name.ToLower().Contains(term))
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

        // ── EXPENSES (finance-gated) ───────────────────────────────────────
        if (canSeeFinancials && type is null or "expense")
        {
            var expensesQuery = _db.Expenses
                .Where(e => e.Description.ToLower().Contains(term));

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

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/search/saved
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/search/saved
    // ─────────────────────────────────────────────────────────────────────────
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
        return CreatedAtAction(nameof(GetSavedSearches), new { id = saved.Id }, new { saved.Id, saved.Name, saved.QueryJson, saved.CreatedAt });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/v1/search/saved/{id}
    // ─────────────────────────────────────────────────────────────────────────
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
