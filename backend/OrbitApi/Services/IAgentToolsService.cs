using OrbitApi.Models;
using System.Text.Json;

namespace OrbitApi.Services;

public class ToolCallResult
{
    public string ToolName { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? Data { get; set; }
}

public interface IAgentToolsService
{
    Task<ToolCallResult> ExecuteToolAsync(string toolName, JsonElement arguments, int organizationId, int currentUserId, RoleName currentRole);
    List<object> GetAvailableToolDeclarations(RoleName role, bool isCustomRole = false);
}
