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

        if (!string.IsNullOrEmpty(apiKey) && apiKey.Trim().Length > 15)
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
                        ExecutedActions = isGeneralChat ? new List<ToolCallResult>() : executedActions,
                        ModelUsed = $"Gemini AI ({model})",
                        Timestamp = DateTime.UtcNow
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini API call failed, falling back to embedded conversational intelligence.");
            }
        }

        // Fallback Execution
        if (isGeneralChat)
        {
            var generalResponse = ExecuteGeneralChatFallback(request.Prompt, orgName);
            return new AiChatResponseDto
            {
                ResponseText = generalResponse,
                RolePersona = "AI Assistant",
                ExecutedActions = new List<ToolCallResult>(), // Zero database actions in general chat!
                ModelUsed = "Orbit Conversational Assistant",
                Timestamp = DateTime.UtcNow
            };
        }
        else
        {
            var delegateResponse = await ExecuteSemanticPlannerAsync(request, orgName, currentUserId, currentRole, executedActions);
            return new AiChatResponseDto
            {
                ResponseText = delegateResponse,
                RolePersona = request.RolePersona,
                ExecutedActions = executedActions,
                ModelUsed = "Orbit Role Delegate Engine",
                Timestamp = DateTime.UtcNow
            };
        }
    }

    private string BuildGeneralChatSystemPrompt(string orgName)
    {
        return $@"You are the intelligent, articulate, and supportive AI Assistant embedded in the Orbit workspace for '{orgName}'.
You behave like an advanced conversational intelligence (similar to OpenAI ChatGPT and Google Gemini).
You are helpful, friendly, articulate, and insightful across all subjects.

Orbit Platform Knowledge:
- Workspaces & Projects: Isolated workspaces, Kanban task boards (ToDo, InProgress, InReview, Blocked, Done), priorities, deadlines, checklist subtasks.
- Logical Framework & MEL: 4-tier results matrix (Goals, Outcomes, Outputs, Activities) tracking indicators, baselines, and donor reports.
- Budgets & Financials: Multi-tier ceilings, $500 threshold receipt rule, approval chains (Finance Officer -> Project Manager), dual-currency (USD & ETB).
- Access Control: 7 Predefined system roles (Owner, Admin, Coordinator, Manager, FinanceOfficer, Member, Viewer) + dynamic custom roles with 37 permissions.
- Risk & Issue Register: 5x5 Likelihood vs Impact scoring matrix.
- Volunteer Portal: Background checks, hour logs, skill matching.
- Autonomous Role Delegates: Multi-persona stand-in delegates that execute database actions for busy leaders.

Tone & Formatting Guidelines:
- If the user greets you (e.g. 'How are you', 'Hello', 'Hi'), respond warmly and naturally like an intelligent assistant.
- Use clear, professional, structured Markdown formatting.
- Answer any question directly, whether about Orbit workflows, business strategy, proposal writing, email drafting, or problem solving.";
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

        var candidateModels = new[] { model, "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-pro" }.Distinct();

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
        var p = prompt.Trim().ToLowerInvariant();

        // 1. Greetings & conversational check-in
        if (p == "how are you" || p == "how are you?" || p == "how are you doing" || p.Contains("how are you"))
        {
            return $"I'm doing great, thank you for asking! 😊 I'm fully ready to assist you and your team at **{orgName}**.\n\nHow can I help you today? Whether you need to draft project plans, analyze budgets, understand Orbit workflows, or brainstorm strategy, feel free to ask!";
        }

        if (p == "hello" || p == "hi" || p == "hey" || p.StartsWith("hello") || p.StartsWith("hi ") || p.StartsWith("hey "))
        {
            return $"Hello! 👋 Welcome to **Orbit AI Assistant** for **{orgName}**.\n\nI am here to assist you with operations, project planning, report drafting, or answering any questions about the platform. What are you working on today?";
        }

        if (p.Contains("who are you") || p.Contains("what can you do") || p.Contains("what are your capabilities"))
        {
            return $"I am your **Orbit AI Assistant** — a conversational intelligence partner embedded directly into your workspace.\n\n**Here is what I can help you with:**\n- 💡 **Strategy & Guidance:** Brainstorm ideas, draft project plans, write emails, and summarize reports.\n- 📋 **System Walkthroughs:** Explain how Workspaces, Kanban Tasks, Logframe & MEL, Budgets, and Permissions work.\n- 🤖 **Role Delegation:** If you are busy or away, you can switch to the **Role Delegate (Busy)** tab to let Orbit autonomously manage tasks, review expenses, and audit project metrics on your behalf!";
        }

        // 2. System Walkthrough Queries
        if (p.Contains("logframe") || p.Contains("mel") || p.Contains("indicator"))
        {
            return $"### 📊 Logical Framework (Logframe) & MEL Engine in Orbit\n\nA Logframe is a structured results matrix used by international development organizations, NGOs, and donors:\n\n1. **Impact (Goal):** Long-term transformational objective (e.g., *Reduce community waterborne illness by 40%*).\n2. **Outcomes & Indicators:** Intermediate measurable milestones comparing baseline vs actual target achievements.\n3. **Outputs & Activities:** Direct deliverables produced by your field teams, linked directly to operational Kanban tasks.\n4. **Donor Reports:** 1-click export of logframe tables for compliance and donor reviews.";
        }

        if (p.Contains("finance") || p.Contains("budget") || p.Contains("expense") || p.Contains("threshold"))
        {
            return $"### 💰 Financial Governance & $500 Threshold in Orbit\n\nOrbit provides multi-level financial transparency:\n\n- **Multi-Level Budgets:** Set and enforce spending limits at Organization, Workspace, Project, and Task tiers.\n- **$500 Rule:** Any single expense exceeding $500 triggers a mandatory receipt attachment requirement.\n- **Approval Workflow:** Submitter -> Reviewed by Finance Officer -> Signed off by Project Manager.\n- **Dual-Currency Ledger:** Live tracking and conversions in USD and ETB.";
        }

        if (p.Contains("role") || p.Contains("permission") || p.Contains("abac"))
        {
            return $"### 🛡️ Roles & 37-Point Permission Matrix in Orbit\n\nOrbit uses Attribute-Based Access Control (ABAC):\n\n- **7 System Roles:** Owner (L0 Root), Admin (L1 Org Governance), Coordinator (L2 Workspace), Manager (L3 Project), Finance Officer (L4 Ledger & Approvals), Member (L5 Tasks), Viewer (L6 Read-Only).\n- **Dynamic Custom Roles:** Create on-demand custom roles (e.g. *Field Logistics Lead*) and assign specific permissions from the 37-point matrix in Settings (Tab 5).";
        }

        // 3. General Helpful Conversational Answer
        return $"Thank you for your question! Here is my insight regarding **\"{prompt}\"**:\n\n"
             + "Orbit is designed to streamline non-profit and enterprise operations from high-level strategic governance down to day-to-day task execution.\n\n"
             + "If you need specific guidance on a workflow, drafting assistance, or troubleshooting, let me know what you would like to accomplish!\n\n"
             + "*Tip:* If you want the system to execute real database actions (such as creating a task or approving an expense), switch to the **Role Delegate (Busy)** tab above.";
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
