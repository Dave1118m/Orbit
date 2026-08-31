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

        var executedActions = new List<ToolCallResult>();
        var systemInstruction = BuildSystemPrompt(request.RolePersona, orgName, request.CustomRoleId);

        var apiKey = _config["Gemini:ApiKey"] 
                  ?? _config["GEMINI_API_KEY"] 
                  ?? _config["Gemini__ApiKey"]
                  ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY") 
                  ?? Environment.GetEnvironmentVariable("Gemini__ApiKey");
                  
        var model = _config["Gemini:Model"] ?? "gemini-1.5-pro";

        if (!string.IsNullOrEmpty(apiKey) && apiKey.Length > 10)
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
                        ModelUsed = $"Gemini Pro ({model})",
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
            ModelUsed = "Orbit Role Delegate Engine",
            Timestamp = DateTime.UtcNow
        };
    }

    private string BuildSystemPrompt(string rolePersona, string orgName, int? customRoleId)
    {
        var systemKnowledge = @"
=== ORBIT ENTERPRISE PLATFORM ARCHITECTURE & CAPABILITIES ===
You are the embedded, highly knowledgeable Orbit Autonomous Operations Assistant & Role Delegate for the organization.
You understand the complete architecture of Orbit and can thoroughly explain how every section of the platform works, as well as execute actions when delegated.

Key Orbit Modules & How They Work:
1. WORKSPACES & ORGANIZATIONS:
   - Organizations are multi-tenant root containers (e.g. NGOs, non-profits, enterprises).
   - Workspaces group related projects, teams, and budget allocations with isolated boundaries.
2. PROJECTS & TASKS:
   - Projects track multi-phase initiatives with status (Planning, Active, OnHold, Completed, Cancelled).
   - Tasks feature Kanban workflows (ToDo, InProgress, InReview, Blocked, Done) with priorities (Low, Medium, High, Urgent), deadlines, checklist subtasks, and dependency tracking.
3. LOGICAL FRAMEWORK & MEL (Monitoring, Evaluation & Learning):
   - Structured 4-tier results hierarchy: Goals (Impact) -> Outcomes -> Outputs -> Activities.
   - Tracks baseline vs target metrics, data sources, frequency, and donor reporting exports.
4. FINANCIALS, BUDGETS & EXPENSES:
   - Multi-tier budget enforcement (Org, Workspace, Project, Category levels).
   - $500 threshold rule triggers mandatory receipt attachment review.
   - Dual-currency engine (USD & ETB) with automated exchange conversions.
   - Approval workflows: Submitter -> Finance Officer review -> Manager sign-off -> Bank account ledger disbursement.
5. ROLES & 37-POINT PERMISSION MATRIX (ABAC):
   - 7 System Roles: Owner (L0 Global Root), Admin (L1 Org Governance), Coordinator (L2 Workspace Scope), Manager (L3 Project Ownership), Finance Officer (L4 Ledger & Approvals), Member (L5 Task Execution), Viewer (L6 Read-Only).
   - Dynamic Custom Roles: Admins can create specialized roles with fine-grained permission assignments.
6. RISK & ISSUE REGISTER:
   - 5x5 Likelihood vs Impact scoring matrix with automated severity categorizations (Low, Medium, High, Critical) and risk-to-issue escalation.
7. VOLUNTEER MANAGEMENT:
   - Volunteer applicant intake, background check verification, logged hours tracking, and skill matching to tasks.
8. AUTONOMOUS ROLE DELEGATES:
   - Multi-persona stand-in delegates that monitor operations, analyze metrics, and execute database actions when team members are busy or offline.

When users ask for an overview, guidance, or how a specific part of Orbit works, provide rich, crystal-clear, structured Markdown explanations.
When users command actions (such as creating tasks, checking budgets, querying projects, or approving expenses), execute the relevant tool functions.";

        return rolePersona.ToLowerInvariant() switch
        {
            "admin" => $"You are Orbit's Administrator Delegate for {orgName}. You oversee governance, member invitations, access security, workspace management, and system architecture. {systemKnowledge}",
            "manager" => $"You are Orbit's Project & Operations Manager Delegate for {orgName}. You oversee project milestones, task distribution, team deadlines, and risk logs. {systemKnowledge}",
            "financeofficer" or "finance" => $"You are Orbit's Finance Officer Delegate for {orgName}. You manage budgets, track expenditures against funding limits, review pending expense claims, and ensure strict compliance. {systemKnowledge}",
            "coordinator" => $"You are Orbit's Program & Field Coordinator Delegate for {orgName}. You organize volunteers, field activities, task assignments, and logistical workflows. {systemKnowledge}",
            _ => $"You are Orbit's Dedicated Role Delegate for '{rolePersona}' in {orgName}. You assist with tasks and platform workflows. {systemKnowledge}"
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

        string? finalResponseText = null;

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var textProp))
            {
                finalResponseText = textProp.GetString();
            }

            if (part.TryGetProperty("functionCall", out var fnCall))
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

        // If tools were executed but model returned no explicit summary text, run follow up
        if (executedActions.Any() && string.IsNullOrEmpty(finalResponseText))
        {
            var summarySb = new StringBuilder();
            summarySb.AppendLine($"### ⚡ Action Executed by **{request.RolePersona} Stand-In**");
            foreach (var act in executedActions)
            {
                summarySb.AppendLine($"- {act.Message}");
            }
            return summarySb.ToString();
        }

        return finalResponseText;
    }

    private async Task<string> ExecuteSemanticPlannerAsync(
        AiChatRequestDto request,
        string orgName,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult> executedActions)
    {
        var promptLower = request.Prompt.ToLowerInvariant();

        // System overview or how parts of the system work
        if (promptLower.Contains("how") && (promptLower.Contains("work") || promptLower.Contains("system") || promptLower.Contains("part") || promptLower.Contains("orbit"))
            || promptLower.Contains("overview") || promptLower.Contains("explain") || promptLower.Contains("architecture") || promptLower.Contains("help"))
        {
            if (promptLower.Contains("finance") || promptLower.Contains("budget") || promptLower.Contains("expense"))
            {
                var finResult = await _toolsService.ExecuteToolAsync("get_financial_summary", default, request.OrganizationId, currentUserId, currentRole);
                executedActions.Add(finResult);
                return $"### 💰 Orbit Financials & Budget Architecture\n\nOrbit provides a strict, multi-tiered financial control engine designed for institutional transparency:\n\n1. **Multi-Level Budgets:** Set and enforce ceilings at Organization, Workspace, Project, and Task levels.\n2. **$500 Receipt Threshold:** Any expense exceeding $500 automatically flags a mandatory receipt verification requirement.\n3. **Approval Chain:** Submitted by team members -> Reviewed & approved by Finance Officer -> Signed off by Project Manager.\n4. **Dual-Currency Ledger:** Live multi-currency conversions in USD and ETB with transaction audit logs.\n\n*Current Organization Financial Summary:* Total Expenses: ${finResult.Data}";
            }

            if (promptLower.Contains("logframe") || promptLower.Contains("mel") || promptLower.Contains("indicator"))
            {
                return $"### 📊 Orbit Logical Framework & MEL Engine\n\nOrbit includes an institutional Results Framework for project managers, M&E officers, and donors:\n\n1. **Goals (Impact Level):** High-level multi-year socio-economic objectives.\n2. **Outcomes & Indicators:** Measurable transformation metrics comparing baseline vs actual target values.\n3. **Outputs & Activities:** Tangible deliverables linked directly to project tasks and verification sources.\n4. **Donor Reports:** Instant 1-click export of logframe matrices for institutional compliance.";
            }

            if (promptLower.Contains("role") || promptLower.Contains("permission") || promptLower.Contains("abac"))
            {
                return $"### 🛡️ Orbit Dynamic Roles & 37-Point ABAC Matrix\n\nOrbit uses Attribute-Based Access Control (ABAC) configured in Settings (Tab 5):\n\n1. **Predefined System Roles:**\n   - **👑 Owner (L0):** Root tenant authority and billing.\n   - **🛡️ Admin (L1):** Organization governance and compliance.\n   - **🤝 Coordinator (L2):** Workspace-level project coordination.\n   - **📊 Manager (L3):** Project ownership, task scheduling & approvals.\n   - **💰 Finance Officer (L4):** Expense audits & ledger sign-offs.\n   - **👥 Member & Viewer (L5/L6):** Task execution and read-only transparency.\n2. **Dynamic Custom Roles:** Create on-demand roles (e.g. Field Operations, Logistics) and toggle any of the 37 permissions in real-time.\n3. **Autonomous Role Delegates:** Switch to any role persona and toggle 'Auto-Delegate Mode' so Orbit manages operations when leaders are away.";
            }

            // General Full Platform Walkthrough
            var ovResult = await _toolsService.ExecuteToolAsync("get_organization_overview", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(ovResult);
            return $"### 🚀 Orbit Platform Comprehensive Guide — **{orgName}**\n\nWelcome to Orbit! Here is how every module in the platform works:\n\n"
                 + "1. **🏢 Workspaces & Organizations:** Segment your multi-project operations into isolated workspaces with dedicated teams and budget ceilings.\n"
                 + "2. **📋 Projects & Kanban Tasks:** Full project lifecycle tracking with interactive Kanban boards (ToDo, InProgress, InReview, Blocked, Done), subtasks, and deadlines.\n"
                 + "3. **📊 Logical Framework & MEL:** Institutional results framework tracking Goals, Outcomes, Outputs, and baseline/target indicators.\n"
                 + "4. **💰 Multi-Tier Budgets & Receipts:** Strict financial governance with $500 receipt alerts, expense approval pipelines, and dual-currency ledgers (USD & ETB).\n"
                 + "5. **🛡️ 37-Point Permission Matrix & Dynamic Roles:** 7 System roles + on-demand custom roles with instant permission toggles.\n"
                 + "6. **⚠️ Risk & Issue Register:** 5x5 Likelihood vs Impact scoring matrix with heatmap severity categorization.\n"
                 + "7. **👥 Volunteer Portal & Hours:** Public volunteer applications, background check verification, and hour logging.\n"
                 + "8. **⚡ Autonomous Role Delegates:** Multi-persona operational stand-ins that manage tasks and monitor metrics when you are busy.\n\n"
                 + $"*Live Organization Status:* Connected with real database records.";
        }

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

        return $"### 📋 Executive Operations Briefing for **{orgName}**\nAs the **{request.RolePersona} Delegate**, here is the live operational summary:\n\n```json\n{JsonSerializer.Serialize(overviewResult.Data, new JsonSerializerOptions { WriteIndented = true })}\n```\n\n*You can command me to create tasks, inspect budgets, query projects, or ask how any part of Orbit works.*";
    }
}
