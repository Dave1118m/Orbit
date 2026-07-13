using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
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

var envFile = Path.Combine(builder.Environment.ContentRootPath, ".env");
if (File.Exists(envFile))
{
    var envValues = File.ReadAllLines(envFile)
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
    builder.Configuration.AddInMemoryCollection(envValues!);
    Console.WriteLine($"DEBUG: .env file found at {envFile}");
    Console.WriteLine($"DEBUG: loaded Smtp:Host={envValues.GetValueOrDefault("Smtp:Host")}");
}

builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultCorsPolicy", policy =>
    {
        policy.WithOrigins("https://localhost:5173", "https://127.0.0.1:5173")
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
        // Allow SignalR WebSocket connections to send the access token as a query string parameter
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
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

// Email sender (SMTP) - registers a simple implementation below
builder.Services.AddSingleton<OrbitApi.Services.IEmailSender, OrbitApi.Services.SmtpEmailSender>();

// Notification service registration
builder.Services.AddScoped<INotificationService, NotificationService>();

builder.Services.AddHostedService<OrbitApi.Services.ComplianceReminderService>();

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

app.Run();
