using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using OrbitApi.Identity;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;
    private readonly IEmailSender _emailSender;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly OrbitDbContext _db;
    private readonly IPermissionService _permissionService;
    private readonly string _googleRedirectUri;

    public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, IConfiguration config, IEmailSender emailSender, IHttpClientFactory httpClientFactory, OrbitDbContext db, IPermissionService permissionService)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _config = config;
        _emailSender = emailSender;
        _httpClientFactory = httpClientFactory;
        _db = db;
        _permissionService = permissionService;
        _googleRedirectUri = _config["Google:RedirectUri"] ?? "https://localhost:7065/api/v1/auth/google-callback";
    }
    public class RevokeTokenRequest
    {
        public string TokenId { get; set; } = string.Empty;
        public int UserId { get; set; }
    }

    [Authorize]
    [HttpPost("revoke")]
    public async Task<IActionResult> RevokeToken()
    {
        var jti = User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(jti) || !int.TryParse(userIdStr, out var userId))
        {
            return BadRequest(new { message = "Invalid token claims." });
        }
        
        var revoked = new RevokedToken
        {
            TokenId = jti,
            UserId = userId,
            RevokedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };
        _db.RevokedTokens.Add(revoked);
        await _db.SaveChangesAsync();
        
        return Ok(new { message = "Token revoked successfully." });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 8)
        {
            return BadRequest("Password must be at least 8 characters long.");
        }

        var user = new ApplicationUser { UserName = req.Email, Email = req.Email, FullName = req.FullName };
        var res = await _userManager.CreateAsync(user, req.Password);
        if (!res.Succeeded) return BadRequest(res.Errors.Select(e => e.Description));

        // generate email confirmation token and send email
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var encoded = System.Net.WebUtility.UrlEncode(token);
        var confirmUrl = $"{Request.Scheme}://{Request.Host}/api/v1/auth/confirm-email?userId={user.Id}&token={encoded}";

        var subject = "Confirm your Orbit account";
        var body = $"<p>Hi {user.FullName ?? user.Email},</p><p>Please confirm your account by clicking <a href=\"{confirmUrl}\">this link</a>.</p>";
        
        try
        {
            await _emailSender.SendEmailAsync(user.Email!, subject, body);
            Console.WriteLine($"Confirmation email sent to {user.Email}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to send confirmation email: {ex.Message}");
            return BadRequest($"Registration succeeded but failed to send confirmation email: {ex.Message}");
        }

        return Ok(new { user.Id, user.Email, emailSent = true });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user == null) return Unauthorized();

        var signRes = await _signInManager.CheckPasswordSignInAsync(user, req.Password, false);
        if (!signRes.Succeeded) return Unauthorized();

        if (!user.EmailConfirmed)
        {
            return Unauthorized("Email not confirmed");
        }

        var token = GenerateToken(user);
        return Ok(new { token });
    }

    private string GenerateToken(ApplicationUser user)
    {
        var jwtKey = _config["Jwt:Key"] ?? "ReplaceThisDevKeyWithAStrongSecretInProduction!";
        var jwtIssuer = _config["Jwt:Issuer"] ?? "OrbitApi";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<(string? IdToken, string? Error)> ExchangeGoogleCodeForIdTokenAsync(string code)
    {
        var clientId = _config["Google:ClientId"];
        var clientSecret = _config["Google:ClientSecret"];
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            return (null, "Google client credentials are not configured.");

        var client = _httpClientFactory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "https://oauth2.googleapis.com/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["code"] = code,
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
                ["redirect_uri"] = _googleRedirectUri,
                ["grant_type"] = "authorization_code"
            })
        };

        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            return (null, $"Google token exchange failed: {body}");
        }

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        if (payload.ValueKind != JsonValueKind.Object)
            return (null, "Google token response was invalid.");

        if (!payload.TryGetProperty("id_token", out var idTokenEl))
            return (null, "Google token response missing id_token.");

        return (idTokenEl.GetString(), null);
    }

    private async Task<(ApplicationUser? User, string? Error)> SignInOrCreateGoogleUserAsync(string idToken)
    {
        var client = _httpClientFactory.CreateClient();
        var tokenInfoUri = $"https://oauth2.googleapis.com/tokeninfo?id_token={idToken}";
        var resp = await client.GetAsync(tokenInfoUri);
        if (!resp.IsSuccessStatusCode)
            return (null, "Google token verification failed.");

        var info = await resp.Content.ReadFromJsonAsync<JsonElement>();
        if (!info.TryGetProperty("email", out var emailEl))
            return (null, "Google response did not contain an email.");

        var email = emailEl.GetString();
        var aud = info.GetProperty("aud").GetString();
        var configured = _config["Google:ClientId"];
        if (!string.IsNullOrEmpty(configured) && aud != configured)
            return (null, "Google token audience does not match client ID.");

        var emailVerified = info.TryGetProperty("email_verified", out var ev) && ev.GetString() == "true";
        if (!emailVerified)
            return (null, "Google email not verified.");

        var user = await _userManager.FindByEmailAsync(email!);
        if (user == null)
        {
            user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true };
            var createRes = await _userManager.CreateAsync(user);
            if (!createRes.Succeeded)
                return (null, string.Join("; ", createRes.Errors.Select(e => e.Description)));
        }

        return (user, null);
    }

    [HttpGet("confirm-email")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmEmail([FromQuery] int userId, [FromQuery] string token)
    {
        var frontendUrl = _config["App:FrontendBaseUrl"] ?? "https://localhost:5173";
        Console.WriteLine($"Email confirmation attempt: userId={userId}, token={token}");
        
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            Console.WriteLine($"User not found with userId={userId}");
            return Redirect($"{frontendUrl}/login?error=user_not_found");
        }

        Console.WriteLine($"User found: {user.Email}, EmailConfirmed={user.EmailConfirmed}");

        var decoded = System.Net.WebUtility.UrlDecode(token);
        Console.WriteLine($"Decoded token: {decoded}");
        
        var res = await _userManager.ConfirmEmailAsync(user, decoded);
        if (!res.Succeeded)
        {
            Console.WriteLine($"Email confirmation failed for user {user.Email}");
            foreach (var error in res.Errors)
            {
                Console.WriteLine($"Error: {error.Description}");
            }
            return Redirect($"{frontendUrl}/login?error=email_confirm_failed");
        }

        Console.WriteLine($"Email confirmation successful for user {user.Email}");
        return Redirect($"{frontendUrl}/login?message=email_confirmed");
    }

    public record IdTokenRequest(string IdToken);

    public record ResendConfirmationRequest(string Email);

    public record SetupPasswordRequest(string Token, string Password, string FullName);

    [HttpPost("setup-password")]
    [AllowAnonymous]
    public async Task<IActionResult> SetupPassword([FromBody] SetupPasswordRequest req)
    {
        Console.WriteLine($"Password setup attempt with token: {req.Token}");
        
        // Find invitation by token
        var invite = await _db.OrganizationInvitations
            .Include(i => i.Organization)
            .Include(i => i.PreAssignedRole)
            .FirstOrDefaultAsync(i => i.Token == req.Token);
        
        if (invite == null)
        {
            Console.WriteLine("Invitation not found");
            return BadRequest("Invalid invitation token");
        }

        if (invite.Status != InvitationStatus.Pending)
        {
            Console.WriteLine($"Invitation already processed: {invite.Status}");
            return BadRequest("Invitation already processed");
        }

        if (invite.ExpiresAt < DateTime.UtcNow)
        {
            Console.WriteLine("Invitation expired");
            return BadRequest("Invitation has expired");
        }

        if (!invite.UserId.HasValue)
        {
            Console.WriteLine("No user associated with invitation");
            return BadRequest("No user account found for this invitation");
        }

        var user = await _userManager.FindByIdAsync(invite.UserId.Value.ToString());
        if (user == null)
        {
            Console.WriteLine($"User not found with ID {invite.UserId.Value}");
            return BadRequest("User account not found");
        }

        Console.WriteLine($"Setting password for user {user.Email}");

        // Set the new password
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, req.Password);
        
        if (!result.Succeeded)
        {
            Console.WriteLine($"Failed to set password: {string.Join(", ", result.Errors.Select(e => e.Description))}");
            return BadRequest($"Failed to set password: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }

        // Update user full name if provided
        if (!string.IsNullOrWhiteSpace(req.FullName))
        {
            user.FullName = req.FullName;
            await _userManager.UpdateAsync(user);
        }

        // Confirm email
        user.EmailConfirmed = true;
        await _userManager.UpdateAsync(user);

        Console.WriteLine($"Password set successfully for user {user.Email}");

        // Add user to organization
        var existingMember = await _db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == invite.OrganizationId && m.UserId == user.Id);
        
        if (existingMember == null)
        {
            _db.OrganizationMembers.Add(new OrganizationMember
            {
                OrganizationId = invite.OrganizationId,
                UserId = user.Id,
                RoleId = invite.PreAssignedRoleId,
                Status = OrgMemberStatus.Active,
                JoinedAt = DateTime.UtcNow
            });
            Console.WriteLine($"Added user {user.Email} to organization {invite.OrganizationId} with role {invite.PreAssignedRole?.Name}");
        }

        // Update invitation status
        invite.Status = InvitationStatus.Accepted;
        await _db.SaveChangesAsync();

        // Generate JWT token for auto-login
        var jwtToken = GenerateToken(user);
        
        var frontendUrl = _config["App:FrontendBaseUrl"] ?? "https://localhost:5173";
        var roleName = invite.PreAssignedRole?.Name.ToString() ?? "Member";
        
        Console.WriteLine($"Password setup complete. Redirecting to role-based dashboard for role: {roleName}");
        
        return Ok(new { 
            token = jwtToken, 
            redirectUrl = $"{frontendUrl}/dashboard?role={roleName}",
            organizationName = invite.Organization?.Name,
            roleName = roleName
        });
    }

    [HttpGet("google-client-id")]
    [AllowAnonymous]
    public IActionResult GetGoogleClientId()
    {
        var clientId = _config["Google:ClientId"];
        if (string.IsNullOrEmpty(clientId)) return NotFound("Google ClientId is not configured");
        return Ok(new { clientId });
    }

    [HttpPost("resend-confirmation")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendConfirmation([FromBody] ResendConfirmationRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user == null) return NotFound();
        if (user.EmailConfirmed) return BadRequest("Email already confirmed");

        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var encoded = System.Net.WebUtility.UrlEncode(token);
        var confirmUrl = $"{Request.Scheme}://{Request.Host}/api/v1/auth/confirm-email?userId={user.Id}&token={encoded}";

        var subject = "Confirm your Orbit account";
        var body = $"<p>Hi {user.FullName ?? user.Email},</p><p>Please confirm your account by clicking <a href=\"{confirmUrl}\">this link</a>.</p>";
        await _emailSender.SendEmailAsync(user.Email!, subject, body);

        return Ok(new { sentTo = user.Email });
    }

    [HttpPost("google")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleSignIn([FromBody] IdTokenRequest req)
    {
        var (user, error) = await SignInOrCreateGoogleUserAsync(req.IdToken);
        if (user == null)
            return Unauthorized(error ?? "Google authentication failed.");

        var token = GenerateToken(user);
        return Ok(new { token });
    }

    private string GetCurrentCallbackUrl()
    {
        var request = Request;
        return $"{request.Scheme}://{request.Host}{request.Path}";
    }

    [HttpGet("google-callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback([FromQuery] string code, [FromQuery] string? redirect_uri)
    {
        var frontendUrl = _config["App:FrontendBaseUrl"] ?? "https://localhost:5173";

        if (string.IsNullOrEmpty(code))
            return Redirect($"{frontendUrl}/login?error=missing_code");

        var (idToken, exchangeError) = await ExchangeGoogleCodeForIdTokenAsync(code);
        if (idToken == null)
            return Redirect($"{frontendUrl}/login?error=google_exchange_failed");

        var (user, signInError) = await SignInOrCreateGoogleUserAsync(idToken);
        if (user == null)
            return Redirect($"{frontendUrl}/login?error=google_signin_failed");

        var token = GenerateToken(user);
        var frontendRedirect = $"{frontendUrl}/dashboard?token={System.Net.WebUtility.UrlEncode(token)}";

        if (Request.Headers.TryGetValue("Accept", out var acceptHeader) && acceptHeader.ToString().Contains("application/json"))
        {
            return Ok(new { token, redirect = frontendRedirect });
        }

        return Redirect(frontendRedirect);
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user == null || !(await _userManager.IsEmailConfirmedAsync(user)))
        {
            // Don't reveal that the user does not exist or is not confirmed
            return Ok();
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var encodedToken = System.Net.WebUtility.UrlEncode(token);
        
        var frontendUrl = _config["App:FrontendBaseUrl"] ?? "https://localhost:5173";
        var resetUrl = $"{frontendUrl}/reset-password?email={System.Net.WebUtility.UrlEncode(user.Email)}&token={encodedToken}";

        var subject = "Reset your OrbitDesk Password";
        var body = $"<p>Hi {user.FullName ?? user.Email},</p><p>Please reset your password by clicking <a href=\"{resetUrl}\">this link</a>.</p>";
        
        await _emailSender.SendEmailAsync(user.Email!, subject, body);

        return Ok();
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user == null)
        {
            // Don't reveal that the user does not exist
            return Ok();
        }

        var result = await _userManager.ResetPasswordAsync(user, req.Token, req.NewPassword);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        return Ok();
    }

    [HttpPost("admin-reset-password")]
    [Authorize]
    public async Task<IActionResult> AdminResetPassword([FromBody] AdminResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
        {
            return BadRequest("Password must be at least 6 characters long.");
        }

        var dbUser = await _db.Users.FindAsync(req.UserId);
        if (dbUser == null) return NotFound("User not found.");

        var appUser = await _userManager.FindByEmailAsync(dbUser.Email);
        if (appUser == null)
        {
            return NotFound("Application identity account not found for user.");
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(appUser);
        var result = await _userManager.ResetPasswordAsync(appUser, token, req.NewPassword);

        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        try
        {
            var subject = "Your Orbit Password Has Been Reset by Admin";
            var body = $"<p>Hi {dbUser.Name},</p><p>An Organization Administrator has updated your Orbit account password.</p><p>Your new temporary password is: <strong>{req.NewPassword}</strong></p><p>Please log in and update your password immediately.</p>";
            await _emailSender.SendEmailAsync(dbUser.Email, subject, body);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AdminResetPassword] Email send notification warning: {ex.Message}");
        }

        return Ok(new { message = $"Password for {dbUser.Name} ({dbUser.Email}) was successfully reset." });
    }

    [HttpPost("switch-persona")]
    [AllowAnonymous]
    public async Task<IActionResult> SwitchPersona([FromBody] SwitchPersonaDto dto)
    {
        if (!Enum.TryParse<RoleName>(dto.RoleName, true, out var roleName))
        {
            return BadRequest(new { message = $"Invalid role name '{dto.RoleName}'. Valid roles: Owner, Admin, Coordinator, Manager, FinanceOfficer, Member, Viewer." });
        }

        var orgId = dto.OrganizationId ?? 1;
        var targetOrg = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId && !o.IsDeleted)
            ?? await _db.Organizations.FirstOrDefaultAsync(o => !o.IsDeleted);

        if (targetOrg == null)
        {
            return BadRequest(new { message = "No valid organization found." });
        }

        // Purge any old synthetic demo accounts from DB
        var demoUsers = await _db.Users
            .Where(u => u.Email.StartsWith("demo.") || u.Name.Contains("Demo Persona"))
            .ToListAsync();

        if (demoUsers.Any())
        {
            foreach (var demoUser in demoUsers)
            {
                var memberRecords = await _db.OrganizationMembers.Where(m => m.UserId == demoUser.Id).ToListAsync();
                _db.OrganizationMembers.RemoveRange(memberRecords);

                var assignRecords = await _db.RoleAssignments.Where(a => a.UserId == demoUser.Id).ToListAsync();
                _db.RoleAssignments.RemoveRange(assignRecords);

                var orgsOwned = await _db.Organizations.Where(o => o.OwnerId == demoUser.Id).ToListAsync();
                foreach (var o in orgsOwned)
                {
                    var firstReal = await _db.Users.FirstOrDefaultAsync(u => !u.Email.StartsWith("demo.") && !u.Name.Contains("Demo"));
                    if (firstReal != null) o.OwnerId = firstReal.Id;
                }

                _db.Users.Remove(demoUser);

                var identityUser = await _userManager.FindByEmailAsync(demoUser.Email);
                if (identityUser != null)
                {
                    await _userManager.DeleteAsync(identityUser);
                }
            }
            await _db.SaveChangesAsync();
        }

        // 1. Check if there is an existing REAL assigned user for this role in targetOrg
        User? realUser = null;

        if (roleName == RoleName.Owner && targetOrg.OwnerId.HasValue)
        {
            realUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == targetOrg.OwnerId.Value && !u.Email.StartsWith("demo.") && !u.Name.Contains("Demo"));
        }

        if (realUser == null)
        {
            var member = await _db.OrganizationMembers
                .Include(m => m.User)
                .Include(m => m.Role)
                .FirstOrDefaultAsync(m => m.OrganizationId == targetOrg.Id && m.Role != null && m.Role.Name == roleName && m.Status == OrgMemberStatus.Active);

            if (member?.User != null)
            {
                realUser = member.User;
            }
        }

        if (realUser == null)
        {
            var assignment = await _db.RoleAssignments
                .Include(a => a.User)
                .Include(a => a.Role)
                .FirstOrDefaultAsync(a => a.RoleId != 0 && a.Role!.Name == roleName && a.ScopeType == ScopeType.Organization && a.ScopeId == targetOrg.Id);

            if (assignment?.User != null)
            {
                realUser = assignment.User;
            }
        }

        ApplicationUser? appUser = null;

        if (realUser != null && !string.IsNullOrEmpty(realUser.Email))
        {
            appUser = await _userManager.FindByEmailAsync(realUser.Email)
                   ?? await _userManager.FindByIdAsync(realUser.Id.ToString());
        }

        // 2. If no real user is assigned to this role yet, use/create a clean role account without "Demo"
        if (appUser == null)
        {
            var cleanEmail = $"{roleName.ToString().ToLower()}@orbit.org";
            var cleanName = roleName switch
            {
                RoleName.Owner => "Organization Owner",
                RoleName.Admin => "System Executive",
                RoleName.Coordinator => "Program Coordinator",
                RoleName.Manager => "Project Manager",
                RoleName.FinanceOfficer => "Finance Officer",
                RoleName.Member => "Team Member",
                _ => "System Auditor"
            };

            appUser = await _userManager.FindByEmailAsync(cleanEmail);
            if (appUser == null)
            {
                appUser = new ApplicationUser
                {
                    UserName = cleanEmail,
                    Email = cleanEmail,
                    FullName = cleanName,
                    EmailConfirmed = true
                };
                var createRes = await _userManager.CreateAsync(appUser, "OrbitUser123!");
                if (!createRes.Succeeded && !createRes.Errors.Any(e => e.Code.Contains("Duplicate")))
                {
                    return BadRequest(createRes.Errors.Select(e => e.Description));
                }
                appUser = await _userManager.FindByEmailAsync(cleanEmail);
            }

            if (appUser == null)
            {
                return BadRequest("Failed to retrieve or create role identity.");
            }

            var userEntity = await _db.Users.FindAsync(appUser.Id);
            if (userEntity == null)
            {
                await _db.Database.OpenConnectionAsync();
                try
                {
                    await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] ON");
                    _db.Users.Add(new User
                    {
                        Id = appUser.Id,
                        Name = cleanName,
                        Email = cleanEmail
                    });
                    await _db.SaveChangesAsync();
                    await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] OFF");
                }
                catch
                {
                    // Key might already exist
                }
                finally
                {
                    await _db.Database.CloseConnectionAsync();
                }
                userEntity = await _db.Users.FindAsync(appUser.Id);
            }

            if (userEntity != null)
            {
                userEntity.Name = cleanName;
                await _db.SaveChangesAsync();
            }

            realUser = userEntity;
        }
        else if (realUser == null)
        {
            realUser = await _db.Users.FindAsync(appUser.Id);
        }

        // Ensure role assignment exists for targetOrg
        var dbRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName);
        if (dbRole == null)
        {
            dbRole = new Role { Name = roleName, Description = $"{roleName} System Role" };
            _db.Roles.Add(dbRole);
            await _db.SaveChangesAsync();
        }

        var existingAssignment = await _db.RoleAssignments
            .FirstOrDefaultAsync(a => a.UserId == appUser.Id && a.ScopeType == ScopeType.Organization && a.ScopeId == targetOrg.Id);
        if (existingAssignment == null)
        {
            _db.RoleAssignments.Add(new RoleAssignment
            {
                UserId = appUser.Id,
                RoleId = dbRole.Id,
                ScopeType = ScopeType.Organization,
                ScopeId = targetOrg.Id
            });
        }
        else
        {
            existingAssignment.RoleId = dbRole.Id;
        }

        var existingOrgMember = await _db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.UserId == appUser.Id && m.OrganizationId == targetOrg.Id);
        if (existingOrgMember == null)
        {
            _db.OrganizationMembers.Add(new OrganizationMember
            {
                UserId = appUser.Id,
                OrganizationId = targetOrg.Id,
                RoleId = dbRole.Id,
                Status = OrgMemberStatus.Active,
                JoinedAt = DateTime.UtcNow
            });
        }
        else
        {
            existingOrgMember.RoleId = dbRole.Id;
            existingOrgMember.Status = OrgMemberStatus.Active;
        }
        await _db.SaveChangesAsync();

        // Invalidate permission cache for the target role
        await _permissionService.InvalidateCacheAsync(roleName);

        if (roleName == RoleName.Owner && targetOrg.OwnerId != appUser.Id)
        {
            targetOrg.OwnerId = appUser.Id;
            await _db.SaveChangesAsync();
        }

        var token = GenerateToken(appUser);

        // Read permissions from DB via IPermissionService (single source of truth)
        var permissions = roleName == RoleName.Owner
            ? Enum.GetNames<Permission>().OrderBy(n => n).ToList()
            : await _permissionService.GetPermissionsForRoleAsync(roleName);

        var userDto = new UserDto
        {
            Id = appUser.Id,
            Name = realUser?.Name ?? appUser.FullName ?? appUser.Email ?? roleName.ToString(),
            Email = realUser?.Email ?? appUser.Email ?? string.Empty,
            PhotoUrl = realUser?.PhotoUrl,
            Roles = new List<RoleInfoDto>
            {
                new RoleInfoDto { Name = roleName.ToString(), ScopeType = ScopeType.Organization.ToString(), ScopeId = targetOrg.Id }
            },
            Permissions = permissions
        };

        return Ok(new { token, user = userDto });
    }
}

public record RegisterRequest(string Email, string Password, string? FullName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
public record AdminResetPasswordRequest(int UserId, string NewPassword);
public record SwitchPersonaDto(string RoleName, int? OrganizationId);
