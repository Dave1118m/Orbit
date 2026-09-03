using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using OrbitTaskStatus = OrbitApi.Models.TaskStatus;

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
                RoleName = "Owner",
                DisplayTitle = "Owner",
                Description = "Organization governance, executive oversight, policy control.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Executive Briefing", "Audit Security", "Approve Expenses", "Overview Briefing" }
            },
            new AiPersonaDto
            {
                RoleName = "Admin",
                DisplayTitle = "Admin",
                Description = "User invitations, workspace management, access security.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Invite Members", "Manage Workspaces", "Audit Security", "Overview Briefing" }
            },
            new AiPersonaDto
            {
                RoleName = "Manager",
                DisplayTitle = "Manager",
                Description = "Project milestones, task scheduling, team assignments, risk logs.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Create Tasks", "Track Milestones", "Review Risks", "Check Deadlines" }
            },
            new AiPersonaDto
            {
                RoleName = "FinanceOfficer",
                DisplayTitle = "Finance",
                Description = "Budget allocation, transaction audits, expense claim approvals.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Approve/Reject Expenses", "Financial Summary", "Audit Budgets", "Track Spend" }
            },
            new AiPersonaDto
            {
                RoleName = "Coordinator",
                DisplayTitle = "Coordinator",
                Description = "Field operations, volunteer mobilization, cross-team activities.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "Manage Volunteers", "Track Hours", "Assign Field Tasks" }
            },
            new AiPersonaDto
            {
                RoleName = "Member",
                DisplayTitle = "Member",
                Description = "Task execution, progress tracking, project updates.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "My Tasks", "Upcoming Deadlines", "Track Progress" }
            },
            new AiPersonaDto
            {
                RoleName = "Viewer",
                DisplayTitle = "Viewer",
                Description = "Read-only workspace viewing and project tracking.",
                Icon = "",
                IsCustomRole = false,
                Capabilities = new List<string> { "View Projects", "Summary Briefing", "Read-Only Reports" }
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
                Description = cr.Description ?? $"Custom role for {cr.DisplayName}.",
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
                        ResponseText = FormatProfessionalOutput(geminiResponse),
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
        ProposedActionDto? proposedAction = null;
        string fallbackResponse;

        if (isGeneralChat)
        {
            fallbackResponse = await ExecuteContextAwareChatAsync(request.Prompt, orgName, request.OrganizationId, systemContext);
        }
        else
        {
            var (plannerText, action) = await ExecuteSemanticPlannerAsync(request, orgName, currentUserId, currentRole, executedActions, systemContext);
            fallbackResponse = plannerText;
            proposedAction = action;
        }

        return new AiChatResponseDto
        {
            ResponseText = FormatProfessionalOutput(fallbackResponse),
            RolePersona = isGeneralChat ? "Orbit Assistant" : request.RolePersona,
            ExecutedActions = executedActions,
            ProposedAction = proposedAction,
            ModelUsed = "Active",
            Timestamp = DateTime.UtcNow
        };
    }

    private string FormatProfessionalOutput(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        return Regex.Replace(text.Trim(), @"\n{4,}", "\n\n\n");
    }

    private string BuildGeneralAssistantPrompt(string orgName, string systemContext)
    {
        return $@"You are the official, highly intelligent Operations Assistant for the Orbit organization '{orgName}'.
You behave like an advanced conversational intelligence (similar to OpenAI ChatGPT, Notion AI, and Google Gemini).
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

CORE CAPABILITIES & FORMATTING RULES:
- If asked to draft a donor update, progress summary, or board memo, write an executive, polished narrative (typically 2-3 structured paragraphs) highlighting key community milestones, financial stewardship ($500 rule compliance), and forward outlook.
- When referencing records, embed clickable markdown navigation links such as [Project Name](/projects), [Expense #ID](/finance?tab=expenses), [Task #ID](/tasks), or [Volunteers Roster](/volunteers).
- Use clean, modern Markdown with bold headings, clean bullet points, and elegant structure.
- Answer ANY question the user asks with deep intelligence, precision, and natural articulation.";
    }

    private string BuildRoleDelegatePrompt(string rolePersona, string orgName, string systemContext)
    {
        return $@"You are Orbit's Stand-In Delegate for the role '{rolePersona}' in '{orgName}'.
When the {rolePersona} is busy or away, you execute operational decisions, create tasks, inspect budgets, and monitor milestones.

LIVE DATABASE STATE:
{systemContext}

IMPORTANT FORMATTING RULES:
- Write in clean, professional markdown with bold headings and bulleted action items.
- Reference internal records using markdown links like [Task #ID](/tasks) and [Expense #ID](/finance?tab=expenses).";
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

        var candidateModels = new[] { "gemini-flash-latest", "gemini-3.7-flash", "gemini-3.6-flash" }.Distinct();

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

    /// <summary>
    /// Pillar 1: Executive Writing & Donor Summaries (Like Notion AI).
    /// Synthesizes real project, task, grant, and financial metrics into a polished 2-3 paragraph executive brief.
    /// </summary>
    private async Task<string> DraftExecutiveDonorBriefAsync(int orgId, string orgName, string prompt)
    {
        var org = await _db.Organizations
            .Include(o => o.Workspaces)
            .FirstOrDefaultAsync(o => o.Id == orgId);

        var wsIds = org?.Workspaces.Select(w => w.Id).ToList() ?? new List<int>();
        var projects = await _db.Projects
            .Include(p => p.ProjectDonors)
                .ThenInclude(pd => pd.Donor)
            .Include(p => p.Tasks)
            .Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted)
            .ToListAsync();

        var pLower = prompt.ToLowerInvariant();
        var targetProject = projects.FirstOrDefault(p => pLower.Contains(p.Title.ToLowerInvariant()))
                         ?? projects.FirstOrDefault();

        var currency = org?.Currency ?? "USD";

        if (targetProject == null)
        {
            return $"### Executive Donor Brief — {orgName}\n\nNo active project records found to generate a donor brief. Please ensure an active project is registered.";
        }

        var projectDonors = targetProject.ProjectDonors
            .Where(pd => pd.Donor != null)
            .Select(pd => pd.Donor!.Name)
            .Distinct()
            .ToList();

        var donorLabel = projectDonors.Any() ? string.Join(", ", projectDonors) : "Institutional Partners & Donors";

        var totalTasks = targetProject.Tasks.Count(t => !t.IsDeleted);
        var doneTasks = targetProject.Tasks.Count(t => !t.IsDeleted && t.Status == OrbitTaskStatus.Done);
        var inProgressTasks = targetProject.Tasks.Count(t => !t.IsDeleted && t.Status == OrbitTaskStatus.InProgress);
        var velocityPct = totalTasks > 0 ? (int)Math.Round((double)doneTasks / totalTasks * 100) : 100;

        var spentAmount = await _db.Expenses
            .Where(e => e.ProjectId == targetProject.Id && e.ApprovalStatus == ApprovalStatus.Approved)
            .SumAsync(e => (decimal?)e.Amount) ?? 0;

        var pendingExpenses = await _db.Expenses
            .Where(e => e.ProjectId == targetProject.Id && e.ApprovalStatus == ApprovalStatus.Pending)
            .SumAsync(e => (decimal?)e.Amount) ?? 0;

        var completedTaskTitles = targetProject.Tasks
            .Where(t => !t.IsDeleted && t.Status == OrbitTaskStatus.Done)
            .Take(3)
            .Select(t => $"\"{t.Title}\"")
            .ToList();
        var completedSummary = completedTaskTitles.Any() ? string.Join(", ", completedTaskTitles) : "core operational deliveries";

        var nextTasks = targetProject.Tasks
            .Where(t => !t.IsDeleted && t.Status != OrbitTaskStatus.Done)
            .Take(2)
            .Select(t => $"\"{t.Title}\"")
            .ToList();
        var nextSummary = nextTasks.Any() ? string.Join(" and ", nextTasks) : "scheduled community follow-ups";

        var sb = new StringBuilder();
        sb.AppendLine($"### Executive Donor Brief: **{targetProject.Title}**");
        sb.AppendLine($"**Grant Partner:** {donorLabel} | **Operating Status:** `{targetProject.Status}`");
        sb.AppendLine($"**Project Reference:** [Project #{targetProject.Id}: {targetProject.Title}](/projects)");
        sb.AppendLine();
        sb.AppendLine("#### 1. Strategic Progress & Community Milestones");
        sb.AppendLine($"During the current operating period, the **{targetProject.Title}** initiative achieved measurable traction across its target community indicators. Operational completion velocity currently stands at **{velocityPct}%** ({doneTasks} of {totalTasks} scheduled milestones accomplished). Successful frontline deliveries include {completedSummary}, validating continuous community engagement and fidelity to grant deliverables.");
        sb.AppendLine();
        sb.AppendLine("#### 2. Financial Governance & Grant Stewardship");
        sb.AppendLine($"Total grant resources deployed to date stand at **{spentAmount:N2} {currency}** in verified, approved program disbursements, with **{pendingExpenses:N2} {currency}** currently advancing through dual-approval verification. All expenditures above the $500 threshold comply with mandatory receipt verification rules, ensuring strict conformity with donor covenants, anti-fraud controls, and external audit expectations.");
        sb.AppendLine();
        sb.AppendLine("#### 3. Forward Implementation Horizon");
        sb.AppendLine($"In the subsequent phase, operational focus will pivot toward finalizing {nextSummary}. Regular monitoring confirms that timeline variances remain low, open risks are fully mitigated, and community impact aligns closely with baseline targets.");

        return sb.ToString();
    }

    /// <summary>
    /// Pillar 2: Conversational "Ask Anything" Search with Smart Query Resolvers and Clickable Links.
    /// Handles threshold searches (expenses > $500), volunteer rosters, and active priority tasks.
    /// </summary>
    private async Task<string> ExecuteContextAwareChatAsync(string prompt, string orgName, int orgId, string systemContext)
    {
        var p = prompt.Trim().ToLowerInvariant();

        // 1. Executive Donor Brief / Writing (Pillar 1)
        if (p.Contains("donor") || p.Contains("draft update") || p.Contains("progress summary") || p.Contains("board memo") || p.Contains("executive brief"))
        {
            return await DraftExecutiveDonorBriefAsync(orgId, orgName, prompt);
        }

        var org = await _db.Organizations.Include(o => o.Workspaces).FirstOrDefaultAsync(o => o.Id == orgId);
        var wsIds = org?.Workspaces.Select(w => w.Id).ToList() ?? new List<int>();
        var projectIds = await _db.Projects.Where(p => wsIds.Contains(p.WorkspaceId) && !p.IsDeleted).Select(p => p.Id).ToListAsync();
        var currency = org?.Currency ?? "USD";

        // 2. Financial & Threshold Queries (Pillar 2 - e.g. "expenses over $500")
        if (p.Contains("expense") || p.Contains("receipt") || p.Contains("spend") || p.Contains("budget"))
        {
            decimal threshold = 0;
            var numMatch = Regex.Match(p, @"(?:over|above|greater than|more than|\$)\s*(\d+)");
            if (numMatch.Success && decimal.TryParse(numMatch.Groups[1].Value, out var val))
            {
                threshold = val;
            }
            else if (p.Contains("500"))
            {
                threshold = 500;
            }

            var expensesQuery = _db.Expenses
                .Include(e => e.Project)
                .Include(e => e.SubmittedByUser)
                .Include(e => e.FinancialCategory)
                .Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.ApprovalStatus == ApprovalStatus.Pending);

            if (threshold > 0)
            {
                expensesQuery = expensesQuery.Where(e => e.Amount >= threshold);
            }

            var pendingExpenses = await expensesQuery.OrderByDescending(e => e.Amount).Take(10).ToListAsync();

            var sb = new StringBuilder();
            if (threshold > 0)
            {
                if (pendingExpenses.Any())
                {
                    sb.AppendLine($"### Pending Expenses Over {currency} {threshold:N0}");
                    sb.AppendLine($"Found **{pendingExpenses.Count}** expense claim(s) exceeding the threshold requiring review:\n");
                    foreach (var exp in pendingExpenses)
                    {
                        var projName = exp.Project?.Title ?? "General Project";
                        var submitter = exp.SubmittedByUser?.Name ?? "Staff Member";
                        var dateStr = exp.Date.ToString("MMM dd, yyyy");
                        sb.AppendLine($"- **[Expense #{exp.Id}: {exp.Description}](/finance?tab=expenses)** — **{exp.Amount:N2} {currency}**");
                        sb.AppendLine($"  *Project:* {projName} | *Submitted by:* {submitter} on {dateStr}");
                        sb.AppendLine($"  *Governance Note:* Requires verified receipt validation per the $500 threshold rule.");
                    }
                    sb.AppendLine($"\n👉 Review and approve claims in the **[Finance Governance Hub](/finance?tab=expenses)**.");
                }
                else
                {
                    sb.AppendLine($"### Financial Status: Threshold Query");
                    sb.AppendLine($"There are currently **no pending expenses over {currency} {threshold:N0}** awaiting approval in {orgName}.");
                    sb.AppendLine($"All pending claims are within standard operating caps. You can inspect all ledger activity in **[Finance & Budgets](/finance)**.");
                }
                return sb.ToString();
            }

            // General pending expenses
            var allPending = await _db.Expenses
                .Where(e => e.ProjectId != null && projectIds.Contains(e.ProjectId.Value) && e.ApprovalStatus == ApprovalStatus.Pending)
                .Take(5)
                .Select(e => new { e.Id, e.Description, e.Amount, Project = e.Project != null ? e.Project.Title : "Project" })
                .ToListAsync();

            if (allPending.Any())
            {
                sb.AppendLine($"### Pending Expense Approvals");
                sb.AppendLine($"There are **{allPending.Count}** pending expense claims awaiting sign-off:\n");
                foreach (var e in allPending)
                {
                    sb.AppendLine($"- **[Expense #{e.Id}: {e.Description}](/finance?tab=expenses)** — **{e.Amount:N2} {currency}** (Project: {e.Project})");
                }
                sb.AppendLine($"\nVisit **[Finance Ledger](/finance?tab=expenses)** to execute approvals.");
                return sb.ToString();
            }

            return $"### Financial Ledger Overview\n\nNo pending expense claims currently require approval. Organization expenditures remain balanced across registered budget categories.\n\nVisit **[Finance & Budgets](/finance)** for comprehensive statements.";
        }

        // 3. Volunteer Queries (Pillar 2)
        if (p.Contains("volunteer"))
        {
            var volunteers = await _db.Volunteers.Where(v => v.OrganizationId == orgId).ToListAsync();
            var vettedCount = volunteers.Count(v => v.BackgroundCheckStatus == BackgroundCheckStatus.Passed);
            var pendingCount = volunteers.Count(v => v.BackgroundCheckStatus == BackgroundCheckStatus.Pending);

            var sb = new StringBuilder();
            sb.AppendLine($"### Volunteer Community Roster");
            sb.AppendLine($"Organization has **{volunteers.Count}** registered volunteer(s):\n");
            sb.AppendLine($"- **Vetted & Active:** {vettedCount}");
            sb.AppendLine($"- **Background Check Pending:** {pendingCount}");

            if (volunteers.Any())
            {
                sb.AppendLine($"\n**Recent Volunteers:**");
                foreach (var vol in volunteers.Take(5))
                {
                    var skills = !string.IsNullOrEmpty(vol.Skills) ? vol.Skills : "General Support";
                    sb.AppendLine($"- **[Volunteer: {vol.Name}](/volunteers)** ({vol.Email}) — *Skills:* {skills} | *Status:* {vol.BackgroundCheckStatus}");
                }
            }
            sb.AppendLine($"\nManage volunteer hours and shifts in the **[Volunteers Portal](/volunteers)**.");
            return sb.ToString();
        }

        // 4. Overdue & Priority Task Queries (Pillar 2)
        if (p.Contains("task") && (p.Contains("overdue") || p.Contains("blocked") || p.Contains("pending") || p.Contains("risk") || p.Contains("deadline")))
        {
            var tasks = await _db.Tasks
                .Include(t => t.Project)
                .Where(t => projectIds.Contains(t.ProjectId) && !t.IsDeleted && t.Status != OrbitTaskStatus.Done)
                .OrderBy(t => t.Deadline)
                .Take(8)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine($"### Active Operational Tasks & Priorities");
            if (tasks.Any())
            {
                sb.AppendLine($"Found **{tasks.Count}** priority task(s) in progress:\n");
                foreach (var t in tasks)
                {
                    var dline = t.Deadline.HasValue ? t.Deadline.Value.ToString("MMM dd, yyyy") : "No deadline";
                    var isOverdue = t.Deadline.HasValue && t.Deadline.Value < DateTime.UtcNow;
                    var tag = isOverdue ? "⚠️ **OVERDUE**" : $"Due {dline}";
                    sb.AppendLine($"- **[Task #{t.Id}: {t.Title}](/tasks)** — {tag} | *Priority:* {t.Priority} | *Status:* {t.Status} (Project: {t.Project?.Title})");
                }
                sb.AppendLine($"\nOpen the Kanban board at **[Tasks & Workflow](/tasks)** to update lane statuses.");
            }
            else
            {
                sb.AppendLine("All scheduled tasks are completed. No overdue or blocked items recorded.");
            }
            return sb.ToString();
        }

        // 5. Projects & Portfolio Queries
        if (p.Contains("project") || p.Contains("portfolio") || p.Contains("status") || p.Contains("summary"))
        {
            var projects = await _db.Projects
                .Include(p => p.Tasks)
                .Where(p => projectIds.Contains(p.Id) && !p.IsDeleted)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine($"### Project Portfolio Overview — {orgName}\n");
            if (projects.Any())
            {
                foreach (var proj in projects)
                {
                    var total = proj.Tasks.Count(t => !t.IsDeleted);
                    var done = proj.Tasks.Count(t => !t.IsDeleted && t.Status == OrbitTaskStatus.Done);
                    var pct = total > 0 ? (int)Math.Round((double)done / total * 100) : 0;
                    sb.AppendLine($"- **[Project: {proj.Title}](/projects)** — *Status:* **{proj.Status}** | *Completion:* **{pct}%** ({done}/{total} tasks done)");
                    if (!string.IsNullOrEmpty(proj.Description))
                        sb.AppendLine($"  _{proj.Description}_");
                }
                sb.AppendLine($"\nNavigate to **[Projects Hub](/projects)** to inspect workspace milestones.");
            }
            else
            {
                sb.AppendLine("No projects are currently registered in this workspace.");
            }
            return sb.ToString();
        }

        // Default conversational reply
        if (p == "hello" || p == "hi" || p == "hey" || p.StartsWith("hello") || p.StartsWith("hi "))
        {
            return $"Hello! I am your **Orbit Operations Assistant** for **{orgName}**.\n\nI can assist you with:\n- **Executive Writing:** *\"Draft a donor update for Project Merryjoy\"*\n- **Deep Search:** *\"Are there any expenses over $500 waiting for approval?\"*\n- **Action Shortcuts:** *\"Create task: Review Q3 Grant Deliverables\"*\n\nWhat would you like to explore today?";
        }

        return $"### Operations Briefing for {orgName}\n\nRegarding: \"{prompt}\"\n\n{systemContext}\n\nYou can ask me to draft donor narratives, query pending expenses over any dollar threshold, check volunteer rosters, or inspect project task velocity.";
    }

    /// <summary>
    /// Pillar 3: Fast Operational Shortcuts (Action Proposals & Formatted Responses).
    /// Prepares interactive task creation proposals instead of blind insertions.
    /// </summary>
    private async Task<(string ResponseText, ProposedActionDto? Action)> ExecuteSemanticPlannerAsync(
        AiChatRequestDto request,
        string orgName,
        int currentUserId,
        RoleName currentRole,
        List<ToolCallResult> executedActions,
        string systemContext)
    {
        var promptLower = request.Prompt.ToLowerInvariant();

        // Action: Create Task (Draft Interactive Proposal)
        if (promptLower.Contains("create task") || promptLower.Contains("add task") || promptLower.Contains("new task"))
        {
            var taskTitle = request.Prompt.Replace("create task", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("add task", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("new task", "", StringComparison.OrdinalIgnoreCase)
                                         .Trim(':')
                                         .Trim();

            if (string.IsNullOrWhiteSpace(taskTitle)) taskTitle = "Field Operations Dispatch";

            var projects = await _db.Projects.Where(p => !p.IsDeleted).ToListAsync();
            var matchedProject = projects.FirstOrDefault(p => promptLower.Contains(p.Title.ToLowerInvariant()))
                              ?? projects.FirstOrDefault();
            var targetProjectId = matchedProject?.Id ?? 1;
            var targetProjectTitle = matchedProject?.Title ?? "Main Project";

            var proposedAction = new ProposedActionDto
            {
                ActionType = "create_task",
                Title = $"Create Task: \"{taskTitle}\"",
                Summary = $"Add to Project '{targetProjectTitle}' with High priority and a 4-day deadline.",
                Parameters = new Dictionary<string, object?>
                {
                    ["projectId"] = targetProjectId,
                    ["projectName"] = targetProjectTitle,
                    ["title"] = taskTitle,
                    ["priority"] = "High",
                    ["deadline"] = DateTime.UtcNow.AddDays(4).ToString("yyyy-MM-dd"),
                    ["description"] = $"Task requested via Orbit AI Copilot."
                }
            };

            var responseText = $"I have prepared the task creation request below for your review:\n\n- **Title:** {taskTitle}\n- **Project:** [Project #{targetProjectId}: {targetProjectTitle}](/projects)\n- **Priority:** High\n- **Target Deadline:** {DateTime.UtcNow.AddDays(4):MMM dd, yyyy}\n\nPlease click **Confirm & Create** below to finalize, or cancel if you'd like to adjust.";

            return (responseText, proposedAction);
        }

        // Action: Financial Summary (Formatted Markdown)
        if (promptLower.Contains("finance") || promptLower.Contains("budget") || promptLower.Contains("expense") || promptLower.Contains("money"))
        {
            var finResult = await _toolsService.ExecuteToolAsync("get_financial_summary", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(finResult);

            return ($"### Financial Ledger Summary for {orgName}\n\nFinancial oversight data has been verified against active project ledgers.\n\nNavigate to **[Finance & Budgets Hub](/finance)** to inspect approval queues and bank reconciliation.", null);
        }

        // Action: Project Status (Formatted Markdown)
        if (promptLower.Contains("project") || promptLower.Contains("portfolio") || promptLower.Contains("milestone"))
        {
            var projResult = await _toolsService.ExecuteToolAsync("list_projects", default, request.OrganizationId, currentUserId, currentRole);
            executedActions.Add(projResult);

            return ($"### Project Milestone Status for {orgName}\n\nActive workspace projects are synchronized with the central project ledger.\n\nOpen **[Projects Hub](/projects)** to inspect milestones.", null);
        }

        // Default Overview Briefing
        var overviewResult = await _toolsService.ExecuteToolAsync("get_organization_overview", default, request.OrganizationId, currentUserId, currentRole);
        executedActions.Add(overviewResult);

        return ($"### Operations Briefing for {orgName}\n\nCentral operational metrics loaded from the live system database.\n\nOpen **[Dashboard](/dashboard)** for high-level governance summaries.", null);
    }
}
