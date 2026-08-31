using OrbitApi.Models;

namespace OrbitApi.Services;

public class AiChatMessageDto
{
    public string Role { get; set; } = "user"; // "user", "assistant", "model", "system"
    public string Content { get; set; } = string.Empty;
}

public class AiChatRequestDto
{
    public int OrganizationId { get; set; }
    public string RolePersona { get; set; } = "Admin"; // Admin, Manager, FinanceOfficer, Coordinator, or Custom Title
    public int? CustomRoleId { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public List<AiChatMessageDto>? History { get; set; } = new();
}

public class AiChatResponseDto
{
    public string ResponseText { get; set; } = string.Empty;
    public string RolePersona { get; set; } = string.Empty;
    public List<ToolCallResult> ExecutedActions { get; set; } = new();
    public string ModelUsed { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class AiPersonaDto
{
    public string RoleName { get; set; } = string.Empty;
    public string DisplayTitle { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "🤖";
    public bool IsCustomRole { get; set; }
    public int? RoleId { get; set; }
    public List<string> Capabilities { get; set; } = new();
}

public interface IAiAgentService
{
    Task<AiChatResponseDto> ProcessAgentChatAsync(AiChatRequestDto request, int currentUserId, RoleName currentRole);
    Task<List<AiPersonaDto>> GetUserAvailablePersonasAsync(int organizationId, int currentUserId);
}
