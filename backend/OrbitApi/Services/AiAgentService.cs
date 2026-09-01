using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

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
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Invite Members", "Manage Workspaces", "Audit Security", "Overview Briefing", "System Architecture Guide" }
            },
            new AiPersonaDto
            {
                RoleName = "Manager",
                DisplayTitle = "Project Manager Delegate",
                Description = "Project milestones, task scheduling, team assignments, risk log oversight.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Create Tasks", "Track Project Milestones", "Review Risk Logs", "Check Deadlines", "Workflows Walkthrough" }
            },
            new AiPersonaDto
            {
                RoleName = "FinanceOfficer",
                DisplayTitle = "Finance Officer Delegate",
                Description = "Budget allocation, financial transaction audits, expense claim approvals.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Approve/Reject Expenses", "Financial Summary", "Audit Budgets", "Track Category Spend", "Finance Engine Guide" }
            },
            new AiPersonaDto
            {
                RoleName = "Coordinator",
                DisplayTitle = "Program Coordinator Delegate",
                Description = "Field operations, volunteer mobilization, cross-team activities.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Manage Volunteers", "Track Volunteer Hours", "Assign Field Tasks", "Logframe & MEL Guide" }
            }
        };

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
                Icon = "",
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

        var systemContext = await AggregateSystemLiveContextAsync(request.OrganizationId);

        var isGeneralChat = string.Equals(request.Mode, "chat", StringComparison.OrdinalIgnoreCase);
        var executedActions = new List<ToolCallResult>();
        
        var systemInstruction = isGeneralChat
            ? BuildGeneralAssistantPrompt(orgName, systemContext)
            : BuildRoleDelegatePrompt(request.RolePersona, orgName, systemContext);

        var apiKey = _config["Gemini:ApiKey"] 
                  ?? _config["GEMINI_API_KEY"] 
                  ?? _config["Gemini__ApiKey"]
                  ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY") 
                  ?? Environment.GetEnvironmentVariable("Gemini__ApiKey");
                  
        var model = _config["Gemini:Model"] ?? "gemini-flash-latest";

        if (!string.IsNullOrEmpty(apiKey) && apiKey.Trim().Length > 15)
        {
            try
            {
                var cleanApiKey = apiKey.Trim();
                var geminiResponse = await CallGeminiProAsync(
                    cleanApiKey,
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
                        ResponseText = SanitizePlainOutput(geminiResponse),
                        RolePersona = isGeneralChat ? "Orbit Assistant" : request.RolePersona,
                        ExecutedActions = isGeneralChat ? new List<ToolCallResult>() : executedActions,
                        ModelUsed = "Online",
                        Timestamp = DateTime.UtcNow
                    };
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini API call failed, using live context planner.");
            }
        }

        // Context-Aware Fallback
        var fallbackResponse = isGeneralChat
            ? ExecuteContextAwareChat(request.Prompt, orgName, systemContext)
            : await ExecuteSemanticPlannerAsync(request, orgName, currentUserId, currentRole, executedActions, systemContext);

        return new AiChatResponseDto
        {
            ResponseText = SanitizePlainOutput(fallbackResponse),
            RolePersona = isGeneralChat ? "Orbit Assistant" : request.RolePersona,
            ExecutedActions = executedActions,
            ModelUsed = "Active",
            Timestamp = DateTime.UtcNow
        };
    }

    private string SanitizePlainOutput(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        // Strip headers and any raw # symbols
        var cleaned = Regex.Replace(text, @"^#{1,6}\s*", "", RegexOptions.Multiline);
        cleaned = Regex.Replace(cleaned, @"#(\d+)", "ID $1");
        cleaned = cleaned.Replace("#", "");

        // Strip bold and italic markdown (**text**, *text*, __text__, _text_)
        cleaned = Regex.Replace(cleaned, @"\*\*(.*?)\*\*", "$1");
        cleaned = Regex.Replace(cleaned, @"\*(.*?)\*", "$1");
        cleaned = Regex.Replace(cleaned, @"__(.*?)__", "$1");

        // Convert bullet asterisks to clean dashes
        cleaned = Regex.Replace(cleaned, @"^\s*\*\s+", "- ", RegexOptions.Multiline);

        // Remove markdown table separator lines (e.g. |:---|:---| or |---|---|)
        cleaned = Regex.Replace(cleaned, @"\|[\s\-:]+\|[\s\-:]+\|?", "", RegexOptions.Multiline);

        // Clean up markdown table pipes to clean tabs or spaces
        cleaned = Regex.Replace(cleaned, @"\|\s*", "  ");

        // Remove horizontal rule markers (--- or ***)
        cleaned = Regex.Replace(cleaned, @"^[\-\*]{3,}\s*$", "", RegexOptions.Multiline);

        // Remove decorative emojis
        cleaned = Regex.Replace(cleaned, @"[✨🤖⚡✓🛡️📊💰🤝⚠️👥📋💡🚀💳📑]", "");

        // Collapse excess blank lines
        cleaned = Regex.Replace(cleaned, @"\n{3,}", "\n\n");

        return cleaned.Trim();
    }

    private async Task<string> AggregateSystemLiveContextAsync(int orgId)
    {
        try
        {
            var org = await _db.Organizations
                .Include(o => o.Workspaces)
                .FirstOrDefaultAsync(o => o.Id == orgId);

            if (org == null) return "Organization records are initializing.";

            var workspaceIds = org.Workspaces.Select(w => w.Id).ToList();

            var projects = await _db.Projects
                .Where(p => workspaceIds.Contains(p.WorkspaceId) && !p.IsDeleted)
                .Select(p => new { p.Id, p.Title, Status = p.Status.ToString(), p.FundingType, p.StartDate, p.EndDate })
                .ToListAsync();

            var projectIds = projects.Select(p => p.Id).ToList();

            var tasks = await _db.Tasks
                .Where(t => projectIds.Contains(t.ProjectId) && !t.IsDeleted)
                .Take(20)
                .Select(t => new { t.Id, t.Title, Status = t.Status.ToString(), Priority = t.Priority.ToString(), t.Deadline, ProjectTitle = t.Project != null ? t.Project.Title : "" })
                .ToListAsync();

            var memberCount = await _db.OrganizationMembers.CountAsync(m => m.OrganizationId == orgId);
            var volunteerCount = await _db.Volunteers.CountAsync(v => v.OrganizationId == orgId);
            var riskCount = await _db.RisksIssues.CountAsync(r => projectIds.Contains(r.ProjectId));

            var totalExpenses = await _db.Expenses
                .Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value))
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            var pendingExpenses = await _db.Expenses
                .Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.ApprovalStatus == ApprovalStatus.Pending)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            var categories = await _db.FinancialCategories
                .Where(c => c.OrganizationId == orgId)
                .Select(c => c.Name)
                .ToListAsync();

            var roles = await _db.Roles
                .Where(r => r.OrganizationId == orgId || r.IsSystemRole)
                .Select(r => r.DisplayName)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine($"ORGANIZATION: {org.Name} (Country: {org.Country ?? "Not specified"}, Currency: {org.Currency ?? "USD"})");
            sb.AppendLine($"WORKSPACES ({org.Workspaces.Count}): {string.Join(", ", org.Workspaces.Select(w => w.Name))}");
            sb.AppendLine($"TEAM MEMBERS: {memberCount} active members | VOLUNTEERS: {volunteerCount} registered");
            sb.AppendLine($"ROLES CONFIGURED: {string.Join(", ", roles)}");
            sb.AppendLine($"PROJECTS ({projects.Count}): {JsonSerializer.Serialize(projects)}");
            sb.AppendLine($"RECENT TASKS ({tasks.Count}): {JsonSerializer.Serialize(tasks)}");
            sb.AppendLine($"FINANCIALS: Total Expenses: {totalExpenses:N2} {org.Currency ?? "USD"}, Pending Approvals: {pendingExpenses:N2}, Categories: {string.Join(", ", categories)}");
            sb.AppendLine($"OPEN RISKS & ISSUES: {riskCount} items recorded");

            return sb.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to aggregate system context");
            return "System database is connected.";
        }
    }

    private string BuildGeneralAssistantPrompt(string orgName, string systemContext)
    {
        return $@"You are the official, highly intelligent Assistant for the Orbit organization '{orgName}'.
You behave like an advanced conversational intelligence (similar to OpenAI ChatGPT and Google Gemini).
You have full real-time access to the entire state of the organization and database.

LIVE SYSTEM & DATABASE STATE:
{systemContext}

COMPLETE ORBIT PLATFORM ARCHITECTURE:
1. Workspaces & Projects: Isolated multi-project environments, Kanban status boards (ToDo, InProgress, InReview, Blocked, Done), priorities, deadlines, and subtasks.
2. Logical Framework & MEL: 4-tier results hierarchy (Impact Goals -> Outcomes & Indicators -> Outputs -> Activities) with donor reporting exports.
3. Budgets & Financials: Multi-tier budget caps, $500 threshold receipt rules, dual approvals (Finance Officer -> Project Manager), dual-currency (USD & ETB).
4. Access Control: 7 Predefined system roles (Owner, Admin, Coordinator, Manager, Finance Officer, Member, Viewer) + dynamic custom roles with a 37-point permission matrix.
5. Risk & Issue Register: 5x5 Likelihood vs Impact scoring matrix.
6. Volunteer Portal: Applicant tracking, background check verifications, hour logging.
7. Autonomous Role Delegates: Multi-persona stand-ins that can execute operational actions when leaders are away.

IMPORTANT FORMATTING RULES:
- Write in clean, plain, elegant, natural text.
- Do NOT use markdown symbols like hashtags (#), bold asterisks (**), bullet asterisks (*), or table pipes (|).
- Use natural paragraphs, clear numbered points (1. 2. 3.), or clean dashes (-).
- Answer ANY question the user asks with deep intelligence, precision, and natural articulation.";
    }

    private string BuildRoleDelegatePrompt(string rolePersona, string orgName, string systemContext)
    {
        return $@"You are Orbit's Stand-In Delegate for the role '{rolePersona}' in '{orgName}'.
When the {rolePersona} is busy or away, you execute operational decisions, create tasks, inspect budgets, and monitor milestones.

LIVE DATABASE STATE:
{systemContext}

IMPORTANT FORMATTING RULES:
- Write in clean, plain, professional text.
- Do NOT use markdown symbols like hashtags (#), bold asterisks (**), or bullet asterisks (*).";
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
        client.Timeout = TimeSpan.FromSeconds(45);

        var candidateModels = new[] { "gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest", "gemini-2.5-flash-lite" }.Distinct();

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
                    summarySb.AppendLine($"Action Executed by {request.RolePersona} Delegate:");
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

    private string ExecuteContextAwareChat(string prompt, string orgName, string systemContext)
    {
        var p = prompt.Trim().ToLowerInvariant();

        if (p == "how are you" || p == "how are you?" || p.Contains("how are you"))
        {
            return $"I am doing well and actively monitoring operations for {orgName}.\n\nHow can I assist you today? You can ask me to review projects, analyze current tasks, check financial status, or explain any workflow.";
        }

        if (p == "hello" || p == "hi" || p == "hey" || p.StartsWith("hello") || p.StartsWith("hi ") || p.StartsWith("hey "))
        {
            return $"Hello. I am the Orbit Assistant for {orgName}.\n\nI have complete visibility into all projects, tasks, budgets, and team workflows in the system. How can I help you today?";
        }

        if (p.Contains("overview") || p.Contains("how") && p.Contains("system") || p.Contains("summary") || p.Contains("status"))
        {
            return $"System Overview for {orgName}\n\nHere is the current live status across the organization:\n\n{systemContext}\n\nPlatform Capabilities:\n- Projects & Tasks: Lifecycle tracking with Kanban workflows and deadlines.\n- Logical Framework & MEL: 4-tier results hierarchy tracking baseline vs target performance.\n- Budgets & Financials: Multi-tier budget limits, $500 threshold receipt rules, and approval chains.\n- Access Control: 7 System roles + custom roles configured via the 37-point permission matrix.\n- Role Delegates: Stand-in execution when team leads are unavailable.";
        }

        if (p.Contains("project") || p.Contains("portfolio"))
        {
            return $"Project Portfolio Status for {orgName}\n\nHere is the current project summary from the database:\n\n{systemContext}";
        }

        if (p.Contains("finance") || p.Contains("budget") || p.Contains("expense"))
        {
            return $"Financial Summary for {orgName}\n\nFinancial Policy & Status:\n- $500 Rule: Expenses above $500 require verified receipt attachments.\n- Approval Workflow: Submitter -> Finance Officer review -> Project Manager sign-off.\n\nCurrent Live Records:\n{systemContext}";
        }

        return $"Analysis for {orgName}\n\nRegarding your inquiry: \"{prompt}\"\n\nCurrent System Context:\n{systemContext}\n\nLet me know if you would like me to drill into any specific project, task, or financial report.";
    }

    private async Task<string> ExecuteSemanticPlannerAsync(
        AiChatRequestDto request,
        string orgName,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult> executedActions,
        string systemContext)
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

            return $"Task Created by {request.RolePersona} Delegate:\n{result.Message}\n\nAssigned Details:\n- Project: {targetProject?.Title ?? "Main Project"} (ID: #{targetProjectId})\n- Title: {taskTitle}\n- Priority: High\n- Status: Todo";
        }

        // Action: Financial Summary
        if (promptLower.Contains("finance") || promptLower.Contains("budget") || promptLower.Contains("expense") || promptLower.Contains("money"))
        {
            var finResult = await _toolsService.ExecuteToolAsync("get_financial_summary", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(finResult);

            return $"Financial Summary for {orgName}\n\nLive Ledger Summary:\n{JsonSerializer.Serialize(finResult.Data, new JsonSerializerOptions { WriteIndented = true })}";
        }

        // Action: Project Status
        if (promptLower.Contains("project") || promptLower.Contains("portfolio") || promptLower.Contains("milestone"))
        {
            var projResult = await _toolsService.ExecuteToolAsync("list_projects", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(projResult);

            return $"Project Status for {orgName}\n\n{JsonSerializer.Serialize(projResult.Data, new JsonSerializerOptions { WriteIndented = true })}";
        }

        // Default Overview Briefing
        var overviewResult = await _toolsService.ExecuteToolAsync("get_organization_overview", default, request.OrganizationId, currentUserId, currentRole);
        executedActions.Add(overviewResult);

        return $"Operations Briefing for {orgName}\n\n{JsonSerializer.Serialize(overviewResult.Data, new JsonSerializerOptions { WriteIndented = true })}";
    }
}
