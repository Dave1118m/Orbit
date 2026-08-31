using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;
using System.Security.Claims;

namespace OrbitApi.Controllers;

[ApiController]
[Route("api/v1/ai")]
[Authorize]
public class AiAgentController : ControllerBase
{
    private readonly IAiAgentService _aiAgentService;
    private readonly OrbitDbContext _db;

    public AiAgentController(IAiAgentService aiAgentService, OrbitDbContext db)
    {
        _aiAgentService = aiAgentService;
        _db = db;
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

    public class DelegateStatusRequest
    {
        public int OrganizationId { get; set; }
        public string RolePersona { get; set; } = "Admin";
        public bool IsAgentModeActive { get; set; }
        public string? AutoReplyMessage { get; set; }
    }

    [HttpPost("delegate-status")]
    public IActionResult SetDelegateStatus([FromBody] DelegateStatusRequest request)
    {
        // Return active state acknowledgment
        return Ok(new
        {
            message = request.IsAgentModeActive
                ? $"🤖 Agent Delegate is now ACTIVE for {request.RolePersona}. Auto-delegation enabled."
                : $"👤 Switched back to Human Mode for {request.RolePersona}.",
            isAgentModeActive = request.IsAgentModeActive,
            rolePersona = request.RolePersona,
            organizationId = request.OrganizationId,
            updatedAt = DateTime.UtcNow
        });
    }
}
