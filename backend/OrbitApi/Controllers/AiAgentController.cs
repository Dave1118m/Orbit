using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;
using System.Security.Claims;
using System.Text.Json;

namespace OrbitApi.Controllers;

[ApiController]
[Route("api/v1/ai")]
[Authorize]
public class AiAgentController : ControllerBase
{
    private readonly IAiAgentService _aiAgentService;
    private readonly OrbitDbContext _db;
    private readonly IAgentToolsService _toolsService;

    public AiAgentController(IAiAgentService aiAgentService, OrbitDbContext db, IAgentToolsService toolsService)
    {
        _aiAgentService = aiAgentService;
        _db = db;
        _toolsService = toolsService;
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("sub")?.Value;
        return int.TryParse(userIdClaim, out var id) ? id : 0;
    }

    [HttpGet("personas")]
    public async Task<IActionResult> GetPersonas([FromQuery] int orgId = 1)
    {
        var userId = GetCurrentUserId();
        var personas = await _aiAgentService.GetUserAvailablePersonasAsync(orgId, userId);
        return Ok(personas);
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
        {
            return BadRequest(new { message = "Prompt cannot be empty." });
        }

        var userId = GetCurrentUserId();
        var assignment = await _db.RoleAssignments
            .Include(a => a.Role)
            .FirstOrDefaultAsync(a => a.UserId == userId && a.ScopeId == request.OrganizationId);

        var currentRole = assignment?.Role?.Name ?? RoleName.Owner;

        var response = await _aiAgentService.ProcessAgentChatAsync(request, userId, currentRole);
        return Ok(response);
    }

    public class ExecuteConfirmedActionRequest
    {
        public int OrganizationId { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public JsonElement Parameters { get; set; }
    }

    [HttpPost("execute-action")]
    public async Task<IActionResult> ExecuteConfirmedAction([FromBody] ExecuteConfirmedActionRequest request)
    {
        var userId = GetCurrentUserId();
        var assignment = await _db.RoleAssignments
            .Include(a => a.Role)
            .FirstOrDefaultAsync(a => a.UserId == userId && a.ScopeId == request.OrganizationId);

        var currentRole = assignment?.Role?.Name ?? RoleName.Owner;
        var result = await _toolsService.ExecuteToolAsync(request.ActionType, request.Parameters, request.OrganizationId, userId, currentRole);
        return Ok(result);
    }

    public class DelegateStatusRequest
    {
        public int OrganizationId { get; set; }
        public string RolePersona { get; set; } = "Admin";
        public bool IsAgentModeActive { get; set; }
        public decimal? MaxAutoApprovalAmount { get; set; }
        public string? AutoReplyMessage { get; set; }
        public bool? AutoApproveVerifiedReceipts { get; set; }
        public bool? AutoTriageTasks { get; set; }
    }

    [HttpGet("delegate-status")]
    public async Task<IActionResult> GetDelegateStatus([FromQuery] int orgId = 1)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var config = await _db.AiDelegateConfigurations
            .FirstOrDefaultAsync(c => c.UserId == userId && c.OrganizationId == orgId);

        if (config == null)
        {
            return Ok(new
            {
                isAgentModeActive = false,
                rolePersona = "Admin",
                organizationId = orgId,
                maxAutoApprovalAmount = 100.00m,
                autoReplyMessage = (string?)null,
                autoApproveVerifiedReceipts = true,
                autoTriageTasks = true,
                activatedAt = (DateTime?)null,
                lastDeactivatedAt = (DateTime?)null,
                updatedAt = DateTime.UtcNow
            });
        }

        return Ok(new
        {
            isAgentModeActive = config.IsActive,
            rolePersona = config.RolePersona,
            organizationId = config.OrganizationId,
            maxAutoApprovalAmount = config.MaxAutoApprovalAmount,
            autoReplyMessage = config.AutoReplyMessage,
            autoApproveVerifiedReceipts = config.AutoApproveVerifiedReceipts,
            autoTriageTasks = config.AutoTriageTasks,
            activatedAt = config.ActivatedAt,
            lastDeactivatedAt = config.LastDeactivatedAt,
            updatedAt = config.UpdatedAt
        });
    }

    [HttpPost("delegate-status")]
    public async Task<IActionResult> SetDelegateStatus([FromBody] DelegateStatusRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var config = await _db.AiDelegateConfigurations
            .FirstOrDefaultAsync(c => c.UserId == userId && c.OrganizationId == request.OrganizationId);

        var wasActive = config?.IsActive ?? false;

        if (config == null)
        {
            config = new AiDelegateConfiguration
            {
                UserId = userId,
                OrganizationId = request.OrganizationId,
                IsActive = request.IsAgentModeActive,
                RolePersona = string.IsNullOrWhiteSpace(request.RolePersona) ? "Admin" : request.RolePersona,
                MaxAutoApprovalAmount = request.MaxAutoApprovalAmount ?? 100.00m,
                AutoReplyMessage = request.AutoReplyMessage,
                AutoApproveVerifiedReceipts = request.AutoApproveVerifiedReceipts ?? true,
                AutoTriageTasks = request.AutoTriageTasks ?? true,
                ActivatedAt = request.IsAgentModeActive ? DateTime.UtcNow : null,
                UpdatedAt = DateTime.UtcNow
            };
            _db.AiDelegateConfigurations.Add(config);
        }
        else
        {
            config.IsActive = request.IsAgentModeActive;
            if (!string.IsNullOrWhiteSpace(request.RolePersona))
            {
                config.RolePersona = request.RolePersona;
            }
            if (request.MaxAutoApprovalAmount.HasValue)
            {
                config.MaxAutoApprovalAmount = request.MaxAutoApprovalAmount.Value;
            }
            if (request.AutoReplyMessage != null)
            {
                config.AutoReplyMessage = request.AutoReplyMessage;
            }
            if (request.AutoApproveVerifiedReceipts.HasValue)
            {
                config.AutoApproveVerifiedReceipts = request.AutoApproveVerifiedReceipts.Value;
            }
            if (request.AutoTriageTasks.HasValue)
            {
                config.AutoTriageTasks = request.AutoTriageTasks.Value;
            }

            if (!wasActive && request.IsAgentModeActive)
            {
                config.ActivatedAt = DateTime.UtcNow;
            }
            else if (wasActive && !request.IsAgentModeActive)
            {
                config.LastDeactivatedAt = DateTime.UtcNow;
            }
            config.UpdatedAt = DateTime.UtcNow;
        }

        _db.AuditLogs.Add(new AuditLog
        {
            OrganizationId = request.OrganizationId,
            Action = request.IsAgentModeActive ? "AiDelegateActivated" : "AiDelegateDeactivated",
            Entity = "AiDelegateConfiguration",
            PerformedByUserId = userId,
            Timestamp = DateTime.UtcNow,
            NewValues = $"AI Delegate {(request.IsAgentModeActive ? "ACTIVATED" : "DEACTIVATED")} for {config.RolePersona} in Org #{request.OrganizationId}"
        });

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = request.IsAgentModeActive
                ? $"🤖 Agent Delegate is now ACTIVE for {config.RolePersona}. Auto-delegation enabled."
                : $"👤 Switched back to Human Mode for {config.RolePersona}.",
            isAgentModeActive = config.IsActive,
            rolePersona = config.RolePersona,
            organizationId = config.OrganizationId,
            maxAutoApprovalAmount = config.MaxAutoApprovalAmount,
            autoReplyMessage = config.AutoReplyMessage,
            autoApproveVerifiedReceipts = config.AutoApproveVerifiedReceipts,
            autoTriageTasks = config.AutoTriageTasks,
            activatedAt = config.ActivatedAt,
            lastDeactivatedAt = config.LastDeactivatedAt,
            updatedAt = config.UpdatedAt
        });
    }

    [HttpGet("delegate-handoff")]
    public async Task<IActionResult> GetDelegateHandoff([FromQuery] int orgId = 1)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var unacknowledgedLogs = await _db.AiDelegateActionLogs
            .Where(l => l.OrganizationId == orgId && l.UserId == userId && !l.WasAcknowledged)
            .OrderByDescending(l => l.Timestamp)
            .Take(50)
            .Select(l => new
            {
                l.Id,
                l.ActionType,
                l.Entity,
                l.EntityId,
                l.Summary,
                l.DetailsJson,
                l.Timestamp
            })
            .ToListAsync();

        var autoApprovedCount = unacknowledgedLogs.Count(l => l.ActionType == "AutoApproveExpense");
        var tasksTriagedCount = unacknowledgedLogs.Count(l => l.ActionType == "TriageTask");

        return Ok(new
        {
            totalUnacknowledged = unacknowledgedLogs.Count,
            autoApprovedCount,
            tasksTriagedCount,
            actions = unacknowledgedLogs
        });
    }

    public class AcknowledgeHandoffRequest
    {
        public int OrganizationId { get; set; }
        public List<int>? ActionLogIds { get; set; }
    }

    [HttpPost("delegate-handoff/acknowledge")]
    public async Task<IActionResult> AcknowledgeHandoff([FromBody] AcknowledgeHandoffRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId <= 0) return Unauthorized();

        var query = _db.AiDelegateActionLogs
            .Where(l => l.OrganizationId == request.OrganizationId && l.UserId == userId && !l.WasAcknowledged);

        if (request.ActionLogIds != null && request.ActionLogIds.Any())
        {
            query = query.Where(l => request.ActionLogIds.Contains(l.Id));
        }

        var logsToUpdate = await query.ToListAsync();
        foreach (var log in logsToUpdate)
        {
            log.WasAcknowledged = true;
        }

        await _db.SaveChangesAsync();

        return Ok(new
        {
            message = $"{logsToUpdate.Count} AI Delegate actions acknowledged.",
            acknowledgedCount = logsToUpdate.Count
        });
    }
}

