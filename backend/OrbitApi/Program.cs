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

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("https://localhost:7065");

Dictionary<string, string>? envValues = null;
var envFile = Path.Combine(builder.Environment.ContentRootPath, ".env");
if (File.Exists(envFile))
{
    envValues = File.ReadAllLines(envFile)
        .Select(line => line.Trim())
        .Where(line => !string.IsNullOrWhiteSpace(line) && !line.StartsWith("#"))
        .Select(line =>
        {
            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0) return default(KeyValuePair<string, string>?);
            var key = line.Substring(0, separatorIndex).Trim();
            var value = line.Substring(separatorIndex + 1).Trim();
            key = key.Replace("__", ":");
            return new KeyValuePair<string, string>(key, value);
        })
        .Where(kvp => kvp.HasValue)
        .Select(kvp => kvp.Value)
        .ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
    Console.WriteLine($"DEBUG: .env file found at {envFile}");
}

builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true);

if (envValues != null && envValues.Count > 0)
{
    builder.Configuration.AddInMemoryCollection(envValues!);
}

builder.Configuration.AddEnvironmentVariables();


builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddOpenApi();

// Add Local Memory Caching (Replaces Redis for local testing without external database)
builder.Services.AddDistributedMemoryCache();
builder.Services.AddScoped<ICacheService, RedisCacheService>();
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

// HTTP client for external token verification (Google)
builder.Services.AddHttpClient();

// Email sender (SendGrid)
builder.Services.AddSingleton<OrbitApi.Services.IEmailSender, OrbitApi.Services.SendGridEmailSender>();

// Notification service registration
builder.Services.AddScoped<INotificationService, NotificationService>();

builder.Services.AddHostedService<OrbitApi.Services.ComplianceReminderService>();
builder.Services.AddHostedService<OrbitApi.Services.ScheduledReportWorkerService>();
builder.Services.AddHostedService<OrbitApi.Services.RecurringTaskWorkerService>();

builder.Services.AddScoped<OrbitApi.Services.IPermissionService, OrbitApi.Services.PermissionService>();

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
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        // In development allow the app to continue running even if migrations are pending
        Console.WriteLine($"WARNING: Database migration failed or pending changes detected: {ex.Message}");
    }

    try
    {
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ContactInquiries')
            BEGIN
                CREATE TABLE [ContactInquiries] (
                    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [Name] NVARCHAR(MAX) NOT NULL,
                    [Email] NVARCHAR(MAX) NOT NULL,
                    [Subject] NVARCHAR(MAX) NOT NULL,
                    [Message] NVARCHAR(MAX) NOT NULL,
                    [CreatedAt] DATETIME2 NOT NULL,
                    [IsResolved] BIT NOT NULL DEFAULT 0,
                    [AdminNotes] NVARCHAR(MAX) NULL,
                    [ReplyMessage] NVARCHAR(MAX) NULL,
                    [RepliedAt] DATETIME2 NULL,
                    [RepliedByUserName] NVARCHAR(MAX) NULL
                );
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ContactInquiries') AND name = 'ReplyMessage')
                    ALTER TABLE [ContactInquiries] ADD [ReplyMessage] NVARCHAR(MAX) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ContactInquiries') AND name = 'RepliedAt')
                    ALTER TABLE [ContactInquiries] ADD [RepliedAt] DATETIME2 NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ContactInquiries') AND name = 'RepliedByUserName')
                    ALTER TABLE [ContactInquiries] ADD [RepliedByUserName] NVARCHAR(MAX) NULL;
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"WARNING: Automatic ContactInquiries table check: {ex.Message}");
    }

    var existingRoles = db.Roles.Select(r => r.Name).ToHashSet();
    var missingRoles = Enum.GetValues<RoleName>().Where(role => !existingRoles.Contains(role)).ToList();
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
    var existingRoleNames = db.Roles.Select(r => r.Name).ToHashSet();
    var allRoleNames = Enum.GetValues<RoleName>();
    var missingRoles = allRoleNames
        .Where(r => !existingRoleNames.Contains(r))
        .Select(r => new Role { Name = r, Description = $"{r} role" });
    db.Roles.AddRange(missingRoles);

    db.SaveChanges();

    // Seed default RolePermissions: map each role to its default permissions.
    // This runs on every startup but only inserts truly missing rows (idempotent).
    // These are the system defaults — admins can still modify them via the Permissions Matrix UI.
    var defaultRolePerms = new Dictionary<RoleName, Permission[]>
    {
        [RoleName.Owner] = Enum.GetValues<Permission>(),

        [RoleName.Admin] = new[] {
            Permission.OrganizationManage, Permission.OrganizationView, Permission.OrganizationInvite,
            Permission.OrganizationRestore, Permission.OrganizationManagePartners, Permission.OrganizationManageCompliance,
            Permission.WorkspaceCreate, Permission.WorkspaceEdit, Permission.WorkspaceDelete, Permission.WorkspaceView,
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectDelete, Permission.ProjectView, Permission.ProjectAssignTeam, Permission.ProjectPostpone,
            Permission.TeamCreate, Permission.TeamEdit, Permission.TeamDelete, Permission.TeamManageMembers, Permission.TeamAssignProject, Permission.TeamView,
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskDelete, Permission.TaskView,
            Permission.UserManage, Permission.UserInvite,
            Permission.ViewReports,
            Permission.VolunteerManage, Permission.VolunteerView,
            Permission.RiskLogView, Permission.RiskLogEdit, Permission.IssueCreate
        },

        [RoleName.Coordinator] = new[] {
            Permission.OrganizationView,
            Permission.WorkspaceCreate, Permission.WorkspaceEdit, Permission.WorkspaceView,
            Permission.ProjectCreate, Permission.ProjectEdit, Permission.ProjectView, Permission.ProjectAssignTeam, Permission.ProjectPostpone,
            Permission.TeamCreate, Permission.TeamEdit, Permission.TeamDelete, Permission.TeamView, Permission.TeamManageMembers, Permission.TeamAssignProject,
            Permission.TaskCreate, Permission.TaskEdit, Permission.TaskView,
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
