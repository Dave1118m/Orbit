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
                DisplayTitle = "Administrator Delegate",
                Description = "Organization governance, user invitations, access security, workspace oversight.",
                Icon = "🛡️",
                IsCustomRole = false,
                Capabilities = new List<string> { "Invite Members", "Manage Workspaces", "Audit Security", "Overview Briefing", "System Architecture Guide" }
            },
            new AiPersonaDto
            {
                RoleName = "Manager",
                DisplayTitle = "Project Manager Delegate",
                Description = "Project milestones, task scheduling, team assignments, risk log oversight.",
                Icon = "📊",
                IsCustomRole = false,
                Capabilities = new List<string> { "Create Tasks", "Track Project Milestones", "Review Risk Logs", "Check Deadlines", "Workflows Walkthrough" }
            },
            new AiPersonaDto
            {
                RoleName = "FinanceOfficer",
                DisplayTitle = "Finance Officer Delegate",
                Description = "Budget allocation, financial transaction audits, expense claim approvals.",
                Icon = "💰",
                IsCustomRole = false,
                Capabilities = new List<string> { "Approve/Reject Expenses", "Financial Summary", "Audit Budgets", "Track Category Spend", "Finance Engine Guide" }
            },
            new AiPersonaDto
            {
                RoleName = "Coordinator",
                DisplayTitle = "Program Coordinator Delegate",
                Description = "Field operations, volunteer mobilization, cross-team activities.",
                Icon = "🤝",
                IsCustomRole = false,
                Capabilities = new List<string> { "Manage Volunteers", "Track Volunteer Hours", "Assign Field Tasks", "Logframe & MEL Guide" }
            }
        };

        // Fetch dynamic custom roles
        var customRoles = await _db.Roles
            .Where(r => !r.IsSystemRole && (r.OrganizationId == organizationId || r.OrganizationId == null))
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

        var isGeneralChat = string.Equals(request.Mode, "chat", StringComparison.OrdinalIgnoreCase);
        var executedActions = new List<ToolCallResult>();
        var systemInstruction = isGeneralChat
            ? BuildGeneralChatSystemPrompt(orgName)
            : BuildRoleDelegateSystemPrompt(request.RolePersona, orgName, request.CustomRoleId);

        var apiKey = _config["Gemini:ApiKey"] 
                  ?? _config["GEMINI_API_KEY"] 
                  ?? _config["Gemini__ApiKey"]
                  ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY") 
                  ?? Environment.GetEnvironmentVariable("Gemini__ApiKey");
                  
        var model = _config["Gemini:Model"] ?? "gemini-1.5-flash";

        if (!string.IsNullOrEmpty(apiKey) && apiKey.Length > 15)
        {
            try
            {
                var geminiResponse = await CallGeminiProAsync(
                    apiKey.Trim(),
                    model,
                    systemInstruction,
                    request,
                    currentUserId,
                    currentRole,
                    isGeneralChat ? null : executedActions);

                if (!string.IsNullOrEmpty(geminiResponse))
                {
                    return new AiChatResponseDto
                    {
                        ResponseText = geminiResponse,
                        RolePersona = isGeneralChat ? "AI Assistant" : request.RolePersona,
                        ExecutedActions = executedActions,
                        ModelUsed = $"Gemini AI ({model})",
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
        var fallbackResponse = isGeneralChat
            ? ExecuteGeneralChatFallback(request.Prompt, orgName)
            : await ExecuteSemanticPlannerAsync(request, orgName, currentUserId, currentRole, executedActions);

        return new AiChatResponseDto
        {
            ResponseText = fallbackResponse,
            RolePersona = isGeneralChat ? "AI Assistant" : request.RolePersona,
            ExecutedActions = executedActions,
            ModelUsed = isGeneralChat ? "Orbit Conversational Assistant" : "Orbit Role Delegate Engine",
            Timestamp = DateTime.UtcNow
        };
    }

    private string BuildGeneralChatSystemPrompt(string orgName)
    {
        return $@"You are the official, highly intelligent AI Assistant for Orbit, serving members of '{orgName}'.
You behave like an advanced conversational intelligence (similar to OpenAI ChatGPT and Google Gemini).
You are articulate, professional, supportive, and knowledgeable across business strategy, non-profit operations, project management, technical problem solving, and general knowledge.

You also possess complete knowledge of Orbit:
- Workspaces & Projects management (Kanban status boards, deadlines, priorities)
- Multi-tier Budgets & $500 threshold receipt verification rules
- Logical Framework & MEL (Monitoring, Evaluation and Learning) results hierarchy (Goals, Outcomes, Outputs, Activities)
- Attribute-Based Access Control (ABAC) with 7 predefined system roles and dynamic custom roles
- Risk & Issue registers with 5x5 scoring matrix
- Volunteer mobilization and hour tracking
- Multi-persona Autonomous Role Delegates for busy team leaders

When responding to users:
- Provide rich, structured, thoughtful, and articulate Markdown formatting.
- Be direct, insightful, and adaptable to any topic or question the user asks.
- If they ask general questions (e.g. drafting proposals, explaining concepts, brainstorming), assist thoroughly.";
    }

    private string BuildRoleDelegateSystemPrompt(string rolePersona, string orgName, int? customRoleId)
    {
        return rolePersona.ToLowerInvariant() switch
        {
            "admin" => $"You are Orbit's Administrator Stand-In Delegate for {orgName}. You manage organization governance, team invitations, access security, workspace oversight, and high-level operations. When the Admin is busy, you act decisively and execute tools on their behalf within authorized boundaries. Always provide professional, structured executive responses.",
            "manager" => $"You are Orbit's Project & Operations Manager Stand-In Delegate for {orgName}. You oversee project milestones, task creation, deadlines, and risk registers. When the Manager is busy, you monitor progress, assign tasks, and execute workflow tools directly.",
            "financeofficer" or "finance" => $"You are Orbit's Finance Officer Stand-In Delegate for {orgName}. You oversee budgets, verify expenditures against limits, review pending expense claims, and ensure compliance. When the Finance Officer is away, you audit ledger balances and can approve/reject expenses.",
            "coordinator" => $"You are Orbit's Program & Field Coordinator Stand-In Delegate for {orgName}. You organize volunteers, field tasks, and operational logistics. When the Coordinator is busy, you dispatch volunteer work items and check milestones.",
            _ => $"You are Orbit's Dedicated Role Stand-In for '{rolePersona}' in {orgName}. You execute tasks within the scoped permissions granted to {rolePersona}."
        };
    }

    private async Task<string?> CallGeminiProAsync(
        string apiKey,
        string model,
        string systemInstruction,
        AiChatRequestDto request,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult>? executedActions)
    {
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(25);

        // Try primary model and fallback model if needed
        var candidateModels = new[] { model, "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro" }.Distinct();

        foreach (var m in candidateModels)
        {
            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={apiKey}";

                var contents = new List<object>();

                if (request.History != null)
                {
                    foreach (var msg in request.History.TakeLast(6))
                    {
                        contents.Add(new
                        {
                            role = msg.Role == "assistant" || msg.Role == "model" ? "model" : "user",
                            parts = new[] { new { text = msg.Content } }
                        });
                    }
                }

                contents.Add(new
                {
                    role = "user",
                    parts = new[] { new { text = request.Prompt } }
                });

                object requestBody;

                if (executedActions != null)
                {
                    // Role Delegate mode with database tools
                    var toolsDeclarations = _toolsService.GetAvailableToolDeclarations(currentRole);
                    requestBody = new
                    {
                        system_instruction = new { parts = new[] { new { text = systemInstruction } } },
                        contents,
                        tools = new[] { new { function_declarations = toolsDeclarations } }
                    };
                }
                else
                {
                    // Pure conversational AI assistant mode (OpenAI/Gemini style)
                    requestBody = new
                    {
                        system_instruction = new { parts = new[] { new { text = systemInstruction } } },
                        contents
                    };
                }

                var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, jsonContent);

                if (!response.IsSuccessStatusCode)
                {
                    var errBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Gemini model {Model} returned {StatusCode}: {Body}", m, response.StatusCode, errBody);
                    continue;
                }

                var resJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(resJson);
                var root = doc.RootElement;

                if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
                {
                    continue;
                }

                var firstCandidate = candidates[0];
                if (!firstCandidate.TryGetProperty("content", out var content) || !content.TryGetProperty("parts", out var parts))
                {
                    continue;
                }

                string? finalResponseText = null;

                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var textProp))
                    {
                        finalResponseText = textProp.GetString();
                    }

                    if (executedActions != null && part.TryGetProperty("functionCall", out var fnCall))
                    {
                        var functionName = fnCall.GetProperty("name").GetString();
                        var args = fnCall.GetProperty("args");

                        if (!string.IsNullOrEmpty(functionName))
                        {
                            var actionResult = await _toolsService.ExecuteToolAsync(functionName, args, request.OrganizationId, currentUserId, currentRole);
                            executedActions.Add(actionResult);
                        }
                    }
                }

                if (executedActions != null && executedActions.Any() && string.IsNullOrEmpty(finalResponseText))
                {
                    var summarySb = new StringBuilder();
                    summarySb.AppendLine($"### ⚡ Action Executed by **{request.RolePersona} Stand-In**");
                    foreach (var act in executedActions)
                    {
                        summarySb.AppendLine($"- {act.Message}");
                    }
                    return summarySb.ToString();
                }

                if (!string.IsNullOrEmpty(finalResponseText))
                {
                    return finalResponseText;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed attempt with Gemini model {Model}", m);
            }
        }

        return null;
    }

    private string ExecuteGeneralChatFallback(string prompt, string orgName)
    {
        var promptLower = prompt.ToLowerInvariant();

        if (promptLower.Contains("hello") || promptLower.Contains("hi") || promptLower.Contains("hey"))
        {
            return $"Hello! I am your **Orbit AI Assistant** for **{orgName}**. How can I help you today? You can ask me anything about managing projects, budgets, logframes, team workflows, or general strategy.";
        }

        if (promptLower.Contains("who are you") || promptLower.Contains("what can you do"))
        {
            return $"I am your dedicated **Conversational AI Assistant** integrated into Orbit. I can help you brainstorm solutions, analyze project progress, explain system workflows, draft communications, and answer any questions you have about operations or business strategy.";
        }

        if (promptLower.Contains("logframe") || promptLower.Contains("mel"))
        {
            return $"### 📊 Logical Framework (Logframe) in Orbit\n\nA Logframe is a systematic results matrix used by international development organizations and donors:\n\n1. **Impact (Goal):** Long-term vision (e.g. Reduce waterborne disease by 40%).\n2. **Outcomes:** Intermediate changes (e.g. 15,000 households accessing clean water).\n3. **Outputs:** Direct products/services (e.g. 50 community wells constructed).\n4. **Activities:** The operational tasks executed by your field team.\n\nIn Orbit, outputs and activities link directly to your Kanban tasks and budget line items.";
        }

        if (promptLower.Contains("finance") || promptLower.Contains("budget") || promptLower.Contains("threshold"))
        {
            return $"### 💰 Financial Governance & $500 Threshold Rule\n\nOrbit enforces a strict financial control pipeline:\n- **Budgets** are set at Organization, Workspace, and Project tiers.\n- **$500 Rule:** Any expense exceeding $500 automatically requires receipt proof before approval.\n- **Two-Step Approval:** Finance Officer review followed by Project Manager sign-off before payment disbursement.";
        }

        return $"Thank you for your message! Regarding **\"{prompt}\"**:\n\nOrbit provides comprehensive tools for project tracking, multi-tier budget auditing, team coordination, and automated role delegation. If you would like to execute database actions directly (such as creating tasks or auditing financials), you can also switch to the **Autonomous Role Delegate** tab.";
    }

    private async Task<string> ExecuteSemanticPlannerAsync(
        AiChatRequestDto request,
        string orgName,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult> executedActions)
    {
        var promptLower = request.Prompt.ToLowerInvariant();

        // Action: Create Task
        if (promptLower.Contains("create task") || promptLower.Contains("add task") || promptLower.Contains("new task"))
        {
            var taskTitle = request.Prompt.Replace("create task", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("add task", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("new task", "", StringComparison.OrdinalIgnoreCase)
                                         .Trim(':')
                                         .Trim();

            if (string.IsNullOrWhiteSpace(taskTitle)) taskTitle = "Field Operations Dispatch";

            var projects = await _db.Projects.Where(p => !p.IsDeleted).ToListAsync();
            var targetProject = projects.FirstOrDefault();
            var targetProjectId = targetProject?.Id ?? 1;

            var argsDoc = JsonDocument.Parse(JsonSerializer.Serialize(new
            {
                projectId = targetProjectId,
                title = taskTitle,
                description = $"Task created autonomously by {request.RolePersona} Role Delegate.",
                priority = "High",
                deadline = DateTime.UtcNow.AddDays(4).ToString("yyyy-MM-dd")
            }));

            var result = await _toolsService.ExecuteToolAsync("create_task", argsDoc.RootElement, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(result);

            return $"### ⚡ Task Created by **{request.RolePersona} Delegate**\n{result.Message}\n\n**Assigned Details:**\n- **Project:** {targetProject?.Title ?? "Main Project"} (ID: #{targetProjectId})\n- **Title:** {taskTitle}\n- **Priority:** High\n- **Status:** Todo";
        }

        // Action: Financial Summary
        if (promptLower.Contains("finance") || promptLower.Contains("budget") || promptLower.Contains("expense") || promptLower.Contains("money"))
        {
            var finResult = await _toolsService.ExecuteToolAsync("get_financial_summary", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(finResult);

            return $"### 💰 Financial Health Briefing for **{orgName}**\nAs the **{request.RolePersona} Delegate**, I analyzed our current budget and expenditure records.\n\n**Live Financial Summary Data:**\n```json\n{JsonSerializer.Serialize(finResult.Data, new JsonSerializerOptions { WriteIndented = true })}\n```\n\n*All numbers are synchronized in real-time with our SQL Ledger.*";
        }

        // Action: Project Status
        if (promptLower.Contains("project") || promptLower.Contains("portfolio") || promptLower.Contains("milestone"))
        {
            var projResult = await _toolsService.ExecuteToolAsync("list_projects", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(projResult);

            return $"### 🚀 Active Project Status — **{orgName}**\nAs the **{request.RolePersona} Delegate**, here is our project portfolio overview:\n```json\n{JsonSerializer.Serialize(projResult.Data, new JsonSerializerOptions { WriteIndented = true })}\n```";
        }

        // Default Overview Briefing
        var overviewResult = await _toolsService.ExecuteToolAsync("get_organization_overview", default, request.OrganizationId, currentUserId, currentRole);
        executedActions.Add(overviewResult);

        return $"### 📋 Executive Operations Briefing for **{orgName}**\nAs the **{request.RolePersona} Delegate**, here is the live operational summary:\n\n```json\n{JsonSerializer.Serialize(overviewResult.Data, new JsonSerializerOptions { WriteIndented = true })}\n```\n\n*You can command me to create tasks, inspect budgets, query projects, or approve expenses.*";
    }
}
