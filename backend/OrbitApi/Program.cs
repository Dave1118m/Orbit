using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OrbitApi.Authorization;
using OrbitApi.Hubs;
using OrbitApi.Identity;
using OrbitApi.Models;
using OrbitApi.Services;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("https://localhost:7065");

// Load .env file overrides (from project root, cwd, or content root)
var candidateEnvPaths = new[]
{
    Path.Combine(builder.Environment.ContentRootPath, ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(AppContext.BaseDirectory, ".env"),
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", ".env")),
    Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".env"))
};

var envValues = new Dictionary<string, string>();
foreach (var candidate in candidateEnvPaths.Distinct())
{
    if (File.Exists(candidate))
    {
        Console.WriteLine($"[Config] Loading environment variables from .env: {candidate}");
        foreach (var line in File.ReadAllLines(candidate))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#")) continue;
            var separatorIndex = trimmed.IndexOf('=');
            if (separatorIndex <= 0) continue;
            var rawKey = trimmed.Substring(0, separatorIndex).Trim();
            var rawValue = trimmed.Substring(separatorIndex + 1).Trim();

            // Set system environment variable directly
            Environment.SetEnvironmentVariable(rawKey, rawValue);

            // Add both colon format and underscore format for IConfiguration
            var configKey = rawKey.Replace("__", ":");
            envValues[configKey] = rawValue;
            envValues[rawKey] = rawValue;
        }
        break;
    }
}

builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true);

if (envValues.Count > 0)
{
    builder.Configuration.AddInMemoryCollection(envValues!);
}

builder.Configuration.AddEnvironmentVariables();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddSignalR();
builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});
builder.Services.AddOpenApi();

// Add Local Memory Caching (Replaces Redis for local testing without external database)
builder.Services.AddDistributedMemoryCache();
builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddScoped<IGoogleCalendarService, GoogleCalendarService>();
builder.Services.AddScoped<ICurrencyService, CurrencyService>();
builder.Services.AddHttpClient();

builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddDbContext<OrbitDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Server=(localdb)\\mssqllocaldb;Database=OrbitDeskDb;Trusted_Connection=True;TrustServerCertificate=True;"));

// Identity: separate Identity DbContext using integer keys
builder.Services.AddDbContext<OrbitIdentityDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireDigit = false;
    // Require confirmed email for sign-in
    options.SignIn.RequireConfirmedEmail = true;
})
    .AddRoles<IdentityRole<int>>()
    .AddEntityFrameworkStores<OrbitIdentityDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "OrbitApi";
if (string.IsNullOrEmpty(jwtKey))
{
    // Warning: in production set Jwt:Key in user secrets or environment variable
    jwtKey = "ReplaceThisDevKeyWithAStrongSecretInProduction!";
}

var keyBytes = Encoding.UTF8.GetBytes(jwtKey);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ClockSkew = TimeSpan.FromMinutes(2)
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<OrbitDbContext>();
                var jti = context.Principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
                var userIdStr = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (!string.IsNullOrEmpty(jti) && int.TryParse(userIdStr, out int userId))
                {
                    // Check if token is in blocklist (specific or wildcard for user)
                    var isRevoked = await db.RevokedTokens.AnyAsync(r => 
                        r.TokenId == jti || (r.UserId == userId && r.TokenId == "*"));
                        
                    if (isRevoked)
                    {
                        context.Fail("This session has been administratively revoked.");
                    }
                }
            },
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"].FirstOrDefault();
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/orbit"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// HTTP context accessor and client for token & header verification
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();

// Email sender (SendGrid)
builder.Services.AddSingleton<OrbitApi.Services.IEmailSender, OrbitApi.Services.SendGridEmailSender>();

// Notification service registration
builder.Services.AddScoped<INotificationService, NotificationService>();

builder.Services.AddHostedService<OrbitApi.Services.ComplianceReminderService>();
builder.Services.AddHostedService<OrbitApi.Services.ScheduledReportWorkerService>();
builder.Services.AddHostedService<OrbitApi.Services.RecurringTaskWorkerService>();
builder.Services.AddHostedService<OrbitApi.Services.AiDelegateWorkerService>();

builder.Services.AddScoped<OrbitApi.Services.IPermissionService, OrbitApi.Services.PermissionService>();
builder.Services.AddScoped<OrbitApi.Services.IAgentToolsService, OrbitApi.Services.AgentToolsService>();
builder.Services.AddScoped<OrbitApi.Services.IAiAgentService, OrbitApi.Services.AiAgentService>();

builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireProjectEdit", policy => policy.Requirements.Add(new PermissionRequirement(Permission.ProjectEdit)));
    options.AddPolicy("RequireTeamManageMembers", policy => policy.Requirements.Add(new PermissionRequirement(Permission.TeamManageMembers)));
});

builder.Services.AddHsts(options =>
{
    options.Preload = true;
    options.IncludeSubDomains = true;
    options.MaxAge = TimeSpan.FromDays(365);
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();
    try
    {
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Expenses_ProjectId_Category_ApprovalStatus' AND object_id = OBJECT_ID('Expenses')) BEGIN CREATE INDEX [IX_Expenses_ProjectId_Category_ApprovalStatus] ON [Expenses] ([ProjectId], [ApprovalStatus]); END");
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        // In development allow the app to continue running even if migrations are pending
        Console.WriteLine($"WARNING: Database migration failed or pending changes detected: {ex.Message}");
    }

    var existingRoleNames = db.Roles.ToList().Select(r => r.Name.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
    var missingRoles = Enum.GetValues<RoleName>()
        .Where(role => !existingRoleNames.Contains(role.ToString()))
        .ToList();
    if (missingRoles.Any())
    {
        db.Roles.AddRange(missingRoles.Select(role => new Role { Name = role, Description = role.ToString() }));
        db.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHsts();
app.UseHttpsRedirection();
app.UseCors("DefaultCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});
app.MapControllers();
app.MapHub<OrbitHub>("/hubs/orbit");

// ----- Phase 3: Seed Permissions -----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();

    // Purge any synthetic mock accounts (@orbit.org or demo.)
    try
    {
        var mockUsers = db.Users.Where(u => u.Email.Contains("@orbit.org") || u.Email.StartsWith("demo.") || u.Name.Contains("Demo Persona")).ToList();
        if (mockUsers.Count > 0)
        {
            var mockIds = mockUsers.Select(u => u.Id).ToList();
            var teamMembers = db.TeamMembers.Where(m => mockIds.Contains(m.UserId)).ToList();
            db.TeamMembers.RemoveRange(teamMembers);
            var memberRecords = db.OrganizationMembers.Where(m => mockIds.Contains(m.UserId)).ToList();
            db.OrganizationMembers.RemoveRange(memberRecords);
            var assignRecords = db.RoleAssignments.Where(a => mockIds.Contains(a.UserId)).ToList();
            db.RoleAssignments.RemoveRange(assignRecords);
            db.Users.RemoveRange(mockUsers);
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Notice purging mock users: {ex.Message}");
    }

    var validPermNames = Enum.GetNames<Permission>().ToHashSet();

    // Remove any legacy dot-style permissions that don't match the Permission enum
    var stalePerms = db.Permissions
        .ToList()
        .Where(p => !validPermNames.Contains(p.Name))
        .ToList();
    if (stalePerms.Count > 0)
    {
        db.Permissions.RemoveRange(stalePerms);
        db.SaveChanges();
    }

    // Seed all permissions from the Permission enum (add any missing ones)
    var existingPermNames = db.Permissions.Select(p => p.Name).ToHashSet();
    var missingPerms = validPermNames
        .Where(name => !existingPermNames.Contains(name))
        .Select(name => new AppPermission { Name = name });
    db.Permissions.AddRange(missingPerms);

    // Seed all roles from the RoleName enum (add any missing ones)
    var existingRoleNamesSet = db.Roles.ToList().Select(r => r.Name.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
    var allRoleNames = Enum.GetValues<RoleName>();
    var missingRoles = allRoleNames
        .Where(r => !existingRoleNamesSet.Contains(r.ToString()))
        .Select(r => new Role { Name = r, Description = $"{r} role", IsSystemRole = true });
    db.Roles.AddRange(missingRoles);

    // Ensure all built-in roles without CustomTitle have IsSystemRole = true
    var builtInRoles = db.Roles.Where(r => string.IsNullOrEmpty(r.CustomTitle) && !r.IsSystemRole).ToList();
    foreach (var br in builtInRoles)
    {
        br.IsSystemRole = true;
    }

    db.SaveChanges();

    // Seed default RolePermissions: map each role to its default permissions.
    // This runs on every startup but only inserts truly missing rows (idempotent).
    // These are the system defaults — admins can still modify them via the Permissions Matrix UI.
    var defaultRolePerms = new Dictionary<RoleName, Permission[]>
    {
        [RoleName.Owner] = Enum.GetValues<Permission>(),

        [RoleName.Admin] = Enum.GetValues<Permission>().Where(p => p != Permission.OrganizationTransferOwnership).ToArray(),

        [RoleName.Coordinator] = new[] {
            Permission.OrganizationView,
            Permission.WorkspaceCreate, Permission.WorkspaceEdit, Permission.WorkspaceView, Permission.WorkspaceDelete,
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectView, Permission.ProjectAssignTeam, Permission.ProjectPostpone, Permission.ProjectDelete,
            Permission.TeamCreate, Permission.TeamEdit, Permission.TeamDelete, Permission.TeamView, Permission.TeamManageMembers, Permission.TeamAssignProject,
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskDelete, Permission.TaskView,
            Permission.BudgetEdit,
            Permission.ViewReports,
            Permission.VolunteerManage, Permission.VolunteerView,
            Permission.RiskLogView, Permission.RiskLogEdit, Permission.IssueCreate
        },

        [RoleName.Manager] = new[] {
            Permission.OrganizationView, Permission.WorkspaceView,
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectView, Permission.ProjectAssignTeam, Permission.ProjectPostpone,
            Permission.TeamView, Permission.TaskCreate, Permission.TaskEdit, Permission.TaskView,
            Permission.ViewReports,
            Permission.BudgetEdit, Permission.ExpenseApprove,
            Permission.VolunteerView,
            Permission.RiskLogView, Permission.RiskLogEdit, Permission.IssueCreate
        },

        [RoleName.FinanceOfficer] = new[] {
            Permission.OrganizationView, Permission.WorkspaceView, Permission.ProjectView, Permission.TeamView, Permission.TaskView,
            Permission.ExpenseApprove, Permission.BudgetEdit, Permission.ViewReports,
            Permission.VolunteerView,
            Permission.RiskLogView
        },

        [RoleName.Member] = new[] {
            Permission.OrganizationView, Permission.WorkspaceView,
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskView,
            Permission.TeamView, Permission.ProjectView,
            Permission.VolunteerView,
            Permission.RiskLogView, Permission.IssueCreate
        },

        [RoleName.Viewer] = new[] {
            Permission.TaskView, Permission.TeamView, Permission.ProjectView,
            Permission.WorkspaceView, Permission.OrganizationView, Permission.ViewReports,
            Permission.VolunteerView,
            Permission.RiskLogView
        }
    };

    // Load roles and permissions once
    var allRoles = db.Roles.ToList();
    var allPerms = db.Permissions.ToList();
    var existingRolePerms = db.RolePermissions
        .Select(rp => new { rp.RoleId, rp.PermissionId })
        .ToHashSet();

    var newRolePerms = new List<RolePermission>();
    foreach (var (roleName, permissions) in defaultRolePerms)
    {
        var role = allRoles.FirstOrDefault(r => r.Name == roleName);
        if (role == null) continue;

        foreach (var perm in permissions)
        {
            var permEntity = allPerms.FirstOrDefault(p => p.Name == perm.ToString());
            if (permEntity == null) continue;

            if (!existingRolePerms.Contains(new { RoleId = role.Id, PermissionId = permEntity.Id }))
            {
                newRolePerms.Add(new RolePermission { RoleId = role.Id, PermissionId = permEntity.Id });
            }
        }
    }

    if (newRolePerms.Count > 0)
    {
        db.RolePermissions.AddRange(newRolePerms);
        db.SaveChanges();
    }
}
// -------------------------------------

app.Run();
