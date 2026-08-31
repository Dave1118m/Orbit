using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System.Text;
using System.Text.Json;

namespace OrbitApi.Services;

public class AiAgentService : IAiAgentService
{
    private readonly OrbitDbContext _db;
    private readonly IAgentToolsService _toolsService;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AiAgentService> _logger;

    public AiAgentService(
        OrbitDbContext db,
        IAgentToolsService toolsService,
        IConfiguration config,
        IHttpClientFactory httpClientFactory,
        ILogger<AiAgentService> logger)
    {
        _db = db;
        _toolsService = toolsService;
        _config = config;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<List<AiPersonaDto>> GetUserAvailablePersonasAsync(int organizationId, int currentUserId)
    {
        var personas = new List<AiPersonaDto>
        {
            new AiPersonaDto
            {
                RoleName = "Admin",
                DisplayTitle = "Administrator AI Delegate",
                Description = "Organization governance, invitations, workspace configuration, security oversight.",
                Icon = "🛡️",
                IsCustomRole = false,
                Capabilities = new List<string> { "Invite Members", "Manage Workspaces", "Audit Security", "Overview Dashboard" }
            },
            new AiPersonaDto
            {
                RoleName = "Manager",
                DisplayTitle = "Project Manager AI Delegate",
                Description = "Project milestones, task scheduling, team assignments, risk log oversight.",
                Icon = "📊",
                IsCustomRole = false,
                Capabilities = new List<string> { "Create Tasks", "Track Project Milestones", "Review Risk Logs", "Check Deadlines" }
            },
            new AiPersonaDto
            {
                RoleName = "FinanceOfficer",
                DisplayTitle = "Finance Officer AI Delegate",
                Description = "Budget allocation, financial transaction audits, expense claim approvals.",
                Icon = "💰",
                IsCustomRole = false,
                Capabilities = new List<string> { "Approve/Reject Expenses", "Financial Summary", "Audit Budgets", "Track Category Spend" }
            },
            new AiPersonaDto
            {
                RoleName = "Coordinator",
                DisplayTitle = "Coordinator AI Delegate",
                Description = "Volunteer mobilization, activity coordination, task assignment dispatch.",
                Icon = "🤝",
                IsCustomRole = false,
                Capabilities = new List<string> { "Coordinate Volunteers", "Dispatch Tasks", "Monitor Inter-Team Progress" }
            }
        };

        // Add custom roles created in this organization
        var customRoles = await _db.Roles
            .Where(r => !r.IsSystemRole && (r.OrganizationId == null || r.OrganizationId == organizationId))
            .ToListAsync();

        foreach (var cr in customRoles)
        {
            personas.Add(new AiPersonaDto
            {
                RoleName = "Member",
                RoleId = cr.Id,
                DisplayTitle = cr.DisplayName,
                Description = cr.Description ?? $"Dynamic role delegate for {cr.DisplayName}.",
                Icon = "⚡",
                IsCustomRole = true,
                Capabilities = new List<string> { "Scoped Task Execution", "Assigned Workspaces", "Operational Action" }
            });
        }

        return personas;
    }

    public async Task<AiChatResponseDto> ProcessAgentChatAsync(AiChatRequestDto request, int currentUserId, RoleName currentRole)
    {
        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == request.OrganizationId && !o.IsDeleted);
        var orgName = org?.Name ?? "Orbit Workspace";

        var executedActions = new List<ToolCallResult>();
        var systemInstruction = BuildSystemPrompt(request.RolePersona, orgName, request.CustomRoleId);

        var apiKey = _config["Gemini:ApiKey"] ?? _config["GEMINI_API_KEY"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        var model = _config["Gemini:Model"] ?? "gemini-1.5-pro";

        if (!string.IsNullOrEmpty(apiKey))
        {
            try
            {
                var geminiResponse = await CallGeminiProAsync(apiKey, model, systemInstruction, request, currentUserId, currentRole, executedActions);
                if (!string.IsNullOrEmpty(geminiResponse))
                {
                    return new AiChatResponseDto
                    {
                        ResponseText = geminiResponse,
                        RolePersona = request.RolePersona,
                        ExecutedActions = executedActions,
                        ModelUsed = $"Google Gemini ({model})",
                        Timestamp = DateTime.UtcNow
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini API call failed, falling back to embedded semantic planner.");
            }
        }

        // Fallback or Intelligent Native Planner Execution
        var fallbackResponse = await ExecuteSemanticPlannerAsync(request, orgName, currentUserId, currentRole, executedActions);
        return new AiChatResponseDto
        {
            ResponseText = fallbackResponse,
            RolePersona = request.RolePersona,
            ExecutedActions = executedActions,
            ModelUsed = "Orbit AI Delegate Engine (Local Semantic Orchestrator)",
            Timestamp = DateTime.UtcNow
        };
    }

    private string BuildSystemPrompt(string rolePersona, string orgName, int? customRoleId)
    {
        return rolePersona.ToLowerInvariant() switch
        {
            "admin" => $"You are Orbit's Autonomous Administrator AI Agent for {orgName}. You oversee governance, team invitations, access security, workspace management, and high-level operations. When the Admin is busy or away, you act decisively within authorized boundaries. You can use available tools to inspect organization KPIs, manage settings, and invite collaborators. Always provide professional, structured, executive responses.",
            "manager" => $"You are Orbit's Project & Operations Manager AI Agent for {orgName}. You oversee project milestones, task distribution, team deadlines, and risk logs. When the Manager is unavailable, you monitor deliverable progress, assign work items, and resolve bottlenecks. Always be structured, outcome-driven, and prioritize deadlines.",
            "financeofficer" or "finance" => $"You are Orbit's Chief Financial Officer / Finance Delegate AI Agent for {orgName}. You manage budgets, track expenditures against funding limits, review pending expense claims, and ensure strict compliance. When the Finance Officer is away, you audit transaction flows and can approve/reject verified expenses within policy limits. Always provide clear financial breakdowns.",
            "coordinator" => $"You are Orbit's Field & Team Coordinator AI Agent for {orgName}. You organize volunteers, field activities, task assignments, and logistical workflows. When the Coordinator is busy, you assist team members in finding their tasks and updating progress.",
            _ => $"You are Orbit's Dedicated AI Role Delegate for '{rolePersona}' in {orgName}. You assist with tasks within the scoped permissions granted to {rolePersona}."
        };
    }

    private async Task<string?> CallGeminiProAsync(
        string apiKey,
        string model,
        string systemInstruction,
        AiChatRequestDto request,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult> executedActions)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var contents = new List<object>();

        if (request.History != null)
        {
            foreach (var msg in request.History.TakeLast(6))
            {
                contents.Add(new
                {
                    role = msg.Role == "assistant" ? "model" : "user",
                    parts = new[] { new { text = msg.Content } }
                });
            }
        }

        contents.Add(new
        {
            role = "user",
            parts = new[] { new { text = request.Prompt } }
        });

        var toolsDeclarations = _toolsService.GetAvailableToolDeclarations(currentRole);

        var requestBody = new
        {
            system_instruction = new
            {
                parts = new[] { new { text = systemInstruction } }
            },
            contents,
            tools = new[]
            {
                new { function_declarations = toolsDeclarations }
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
        var response = await client.PostAsync(url, jsonContent);

        if (!response.IsSuccessStatusCode)
        {
            var errBody = await response.Content.ReadAsStringAsync();
            _logger.LogWarning("Gemini API returned {StatusCode}: {Body}", response.StatusCode, errBody);
            return null;
        }

        var resJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(resJson);
        var root = doc.RootElement;

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            return null;
        }

        var firstCandidate = candidates[0];
        if (!firstCandidate.TryGetProperty("content", out var content) || !content.TryGetProperty("parts", out var parts))
        {
            return null;
        }

        var sbText = new StringBuilder();

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var textEl))
            {
                sbText.Append(textEl.GetString());
            }

            if (part.TryGetProperty("functionCall", out var fnCall))
            {
                var fnName = fnCall.GetProperty("name").GetString() ?? "";
                var fnArgs = fnCall.GetProperty("args");

                var toolResult = await _toolsService.ExecuteToolAsync(fnName, fnArgs, request.OrganizationId, currentUserId, currentRole);
                executedActions.Add(toolResult);

                if (string.IsNullOrEmpty(sbText.ToString()))
                {
                    sbText.AppendLine($"✅ **Action Executed:** {toolResult.Message}");
                    if (toolResult.Data != null)
                    {
                        sbText.AppendLine($"```json\n{JsonSerializer.Serialize(toolResult.Data, new JsonSerializerOptions { WriteIndented = true })}\n```");
                    }
                }
            }
        }

        return sbText.ToString();
    }

    private async Task<string> ExecuteSemanticPlannerAsync(
        AiChatRequestDto request,
        string orgName,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult> executedActions)
    {
        var p = request.Prompt.ToLowerInvariant();
        var sb = new StringBuilder();

        // Financial intent
        if (p.Contains("finance") || p.Contains("financial") || p.Contains("budget") || p.Contains("spending") || p.Contains("spend"))
        {
            var finResult = await _toolsService.ExecuteToolAsync("get_financial_summary", JsonDocument.Parse("{}").RootElement, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(finResult);

            sb.AppendLine($"### 💰 Financial Health Briefing for **{orgName}**");
            sb.AppendLine($"As the **{request.RolePersona} Delegate**, I analyzed our current budget and expenditure records.");
            if (finResult.Data != null)
            {
                var json = JsonSerializer.Serialize(finResult.Data, new JsonSerializerOptions { WriteIndented = true });
                sb.AppendLine("\n**Live Financial Summary Data:**");
                sb.AppendLine($"```json\n{json}\n```");
            }
            sb.AppendLine("\n*All numbers are synchronized in real-time with our SQL Ledger.*");
            return sb.ToString();
        }

        // Pending Expenses
        if (p.Contains("pending expense") || p.Contains("approve") || p.Contains("expense claim") || p.Contains("receipt"))
        {
            var expResult = await _toolsService.ExecuteToolAsync("list_pending_expenses", JsonDocument.Parse("{}").RootElement, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(expResult);

            sb.AppendLine($"### 📑 Pending Expense Approvals — **{orgName}**");
            sb.AppendLine($"As your **{request.RolePersona} Delegate**, here is the list of expense submissions currently pending review:");
            if (expResult.Data != null)
            {
                var json = JsonSerializer.Serialize(expResult.Data, new JsonSerializerOptions { WriteIndented = true });
                sb.AppendLine($"```json\n{json}\n```");
            }
            sb.AppendLine("\n💡 *To approve any expense, you can command me: `Approve expense #ID with note 'Approved'`*");
            return sb.ToString();
        }

        // Project listing & milestone oversight
        if (p.Contains("project") || p.Contains("milestone") || p.Contains("deliverable"))
        {
            var projResult = await _toolsService.ExecuteToolAsync("list_projects", JsonDocument.Parse("{}").RootElement, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(projResult);

            sb.AppendLine($"### 🚀 Active Project Status — **{orgName}**");
            sb.AppendLine($"As the **{request.RolePersona} Delegate**, here is our project portfolio overview:");
            if (projResult.Data != null)
            {
                var json = JsonSerializer.Serialize(projResult.Data, new JsonSerializerOptions { WriteIndented = true });
                sb.AppendLine($"```json\n{json}\n```");
            }
            return sb.ToString();
        }

        // Task Creation intent
        if (p.Contains("create task") || p.Contains("add task") || p.Contains("new task") || p.Contains("assign task"))
        {
            var projects = await _db.Projects.Where(pr => !pr.IsDeleted).ToListAsync();
            var targetProject = projects.FirstOrDefault();
            if (targetProject != null)
            {
                var taskTitle = request.Prompt.Replace("create task", "", StringComparison.OrdinalIgnoreCase).Trim();
                if (string.IsNullOrEmpty(taskTitle)) taskTitle = "AI Delegated Operational Task";

                var argsJson = JsonSerializer.Serialize(new
                {
                    projectId = targetProject.Id,
                    title = taskTitle,
                    description = $"Created automatically via AI Delegate in {request.RolePersona} mode.",
                    priority = "High",
                    deadline = DateTime.UtcNow.AddDays(5).ToString("yyyy-MM-dd")
                });

                var taskResult = await _toolsService.ExecuteToolAsync("create_task", JsonDocument.Parse(argsJson).RootElement, request.OrganizationId, currentUserId, currentRole);
                executedActions.Add(taskResult);

                sb.AppendLine($"### ⚡ Task Created by **{request.RolePersona} Delegate**");
                sb.AppendLine(taskResult.Message);
                sb.AppendLine("\n**Assigned Details:**");
                sb.AppendLine($"- **Project:** {targetProject.Title} (ID: #{targetProject.Id})");
                sb.AppendLine($"- **Title:** {taskTitle}");
                sb.AppendLine($"- **Priority:** High");
                sb.AppendLine($"- **Status:** Todo");
                return sb.ToString();
            }
        }

        // Default Overview / General Assistance
        var overviewResult = await _toolsService.ExecuteToolAsync("get_organization_overview", JsonDocument.Parse("{}").RootElement, request.OrganizationId, currentUserId, currentRole);
        executedActions.Add(overviewResult);

        sb.AppendLine($"### 🤖 {request.RolePersona} AI Delegate Operational Briefing");
        sb.AppendLine($"I am actively standing in for the **{request.RolePersona}** role for **{orgName}** while personnel are busy or away.");
        sb.AppendLine("\n**Real-Time Organization Status:**");
        if (overviewResult.Data != null)
        {
            var json = JsonSerializer.Serialize(overviewResult.Data, new JsonSerializerOptions { WriteIndented = true });
            sb.AppendLine($"```json\n{json}\n```");
        }
        sb.AppendLine("\n**Available Commands:**");
        sb.AppendLine("- *\"Summarize financial budget and category expenses\"*");
        sb.AppendLine("- *\"List pending expense claims requiring approval\"*");
        sb.AppendLine("- *\"Create task 'Follow up with procurement team'\"*");
        sb.AppendLine("- *\"List active projects and timelines\"*");

        return sb.ToString();
    }
}
