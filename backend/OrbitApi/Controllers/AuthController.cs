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
    public async Task<IActionResult> RevokeToken([FromBody] RevokeTokenRequest? req = null)
    {
        var callerUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(callerUserIdStr, out var callerUserId))
        {
            return BadRequest(new { message = "Invalid token claims." });
        }

        int targetUserId = callerUserId;
        string tokenId = User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value ?? Guid.NewGuid().ToString("N");

        if (req != null && req.UserId > 0)
        {
            // Allow admin or user themselves to revoke session
            targetUserId = req.UserId;
            tokenId = string.IsNullOrWhiteSpace(req.TokenId) ? "*" : req.TokenId;
        }

        var revoked = new RevokedToken
        {
            TokenId = tokenId,
            UserId = targetUserId,
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
            return BadRequest(new { message = "Password must be at least 8 characters long." });
        }

        var existingUser = await _userManager.FindByEmailAsync(req.Email);
        if (existingUser != null)
        {
            if (!existingUser.EmailConfirmed)
            {
                // Update password and fullname if user is re-registering before confirming
                var resetToken = await _userManager.GeneratePasswordResetTokenAsync(existingUser);
                await _userManager.ResetPasswordAsync(existingUser, resetToken, req.Password);
                if (!string.IsNullOrWhiteSpace(req.FullName))
                {
                    existingUser.FullName = req.FullName;
                    await _userManager.UpdateAsync(existingUser);
                }

                var resendToken = await _userManager.GenerateEmailConfirmationTokenAsync(existingUser);
                var resendEncoded = System.Net.WebUtility.UrlEncode(resendToken);
                var resendConfirmUrl = $"{Request.Scheme}://{Request.Host}/api/v1/auth/confirm-email?userId={existingUser.Id}&token={resendEncoded}";

                var resendSubject = "Confirm your Orbit account";
                var resendBody = $"<p>Hi {existingUser.FullName ?? existingUser.Email},</p><p>Please confirm your account by clicking <a href=\"{resendConfirmUrl}\">this link</a>.</p>";

                try
                {
                    await _emailSender.SendEmailAsync(existingUser.Email!, resendSubject, resendBody);
                    Console.WriteLine($"[Register] Re-sent confirmation for unconfirmed user {existingUser.Email}. Confirm link: {resendConfirmUrl}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Register] Email notice: {ex.Message}. Confirm link: {resendConfirmUrl}");
                }

                return Ok(new { existingUser.Id, existingUser.Email, emailSent = true, confirmUrl = resendConfirmUrl });
            }

            return BadRequest(new { message = "An account with this email address already exists. Please sign in instead." });
        }

        var user = new ApplicationUser { UserName = req.Email, Email = req.Email, FullName = req.FullName };
        var res = await _userManager.CreateAsync(user, req.Password);
        if (!res.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", res.Errors.Select(e => e.Description)) });
        }

        // generate email confirmation token and send email
        var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        var encoded = System.Net.WebUtility.UrlEncode(token);
        var confirmUrl = $"{Request.Scheme}://{Request.Host}/api/v1/auth/confirm-email?userId={user.Id}&token={encoded}";

        var subject = "Confirm your Orbit account";
        var body = $"<p>Hi {user.FullName ?? user.Email},</p><p>Please confirm your account by clicking <a href=\"{confirmUrl}\">this link</a>.</p>";
        
        try
        {
            await _emailSender.SendEmailAsync(user.Email!, subject, body);
            Console.WriteLine($"[Register] Confirmation email processed for {user.Email}. Confirm link: {confirmUrl}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Register] Email sender notice: {ex.Message}. Confirm link: {confirmUrl}");
        }

        return Ok(new { user.Id, user.Email, emailSent = true, confirmUrl });
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
        Console.WriteLine($"Email confirmation attempt: userId={userId}");
        
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            Console.WriteLine($"User not found with userId={userId}");
            return Redirect($"{frontendUrl}/login?error=user_not_found");
        }

        Console.WriteLine($"User found: {user.Email}, EmailConfirmed={user.EmailConfirmed}");

        if (user.EmailConfirmed)
        {
            return Redirect($"{frontendUrl}/login?message=email_confirmed");
        }

        // ASP.NET Core model binder already URL-decodes the query parameter.
        // Try confirmation with token as bound, and fallback with spaces restored to '+' if corrupted in transit.
        var res = await _userManager.ConfirmEmailAsync(user, token);
        if (!res.Succeeded && token.Contains(' '))
        {
            res = await _userManager.ConfirmEmailAsync(user, token.Replace(' ', '+'));
        }

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
        else
        {
            existingMember.RoleId = invite.PreAssignedRoleId;
            existingMember.Status = OrgMemberStatus.Active;
        }

        // Also ensure RoleAssignment exists
        var existingAssignment = await _db.RoleAssignments
            .FirstOrDefaultAsync(ra => ra.UserId == user.Id && ra.ScopeType == ScopeType.Organization && ra.ScopeId == invite.OrganizationId);
        if (existingAssignment == null)
        {
            _db.RoleAssignments.Add(new RoleAssignment
            {
                UserId = user.Id,
                RoleId = invite.PreAssignedRoleId,
                ScopeType = ScopeType.Organization,
                ScopeId = invite.OrganizationId
            });
        }
        else
        {
            existingAssignment.RoleId = invite.PreAssignedRoleId;
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

        // Purge any synthetic mock accounts (@orbit.org or demo.)
        var mockUsers = await _db.Users
            .Where(u => u.Email.Contains("@orbit.org") || u.Email.StartsWith("demo.") || u.Name.Contains("Demo Persona"))
            .ToListAsync();

        if (mockUsers.Any())
        {
            var mockIds = mockUsers.Select(u => u.Id).ToList();
            var teamMembers = await _db.TeamMembers.Where(m => mockIds.Contains(m.UserId)).ToListAsync();
            _db.TeamMembers.RemoveRange(teamMembers);

            var memberRecords = await _db.OrganizationMembers.Where(m => mockIds.Contains(m.UserId)).ToListAsync();
            _db.OrganizationMembers.RemoveRange(memberRecords);

            var assignRecords = await _db.RoleAssignments.Where(a => mockIds.Contains(a.UserId)).ToListAsync();
            _db.RoleAssignments.RemoveRange(assignRecords);

            _db.Users.RemoveRange(mockUsers);

            foreach (var mu in mockUsers)
            {
                var idUser = await _userManager.FindByEmailAsync(mu.Email);
                if (idUser != null)
                {
                    await _userManager.DeleteAsync(idUser);
                }
            }
            await _db.SaveChangesAsync();
        }

        // 1. Determine active real user: prefer current authenticated user, else an existing member in targetOrg
        User? realUser = null;
        var callerUserIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;

        if (int.TryParse(callerUserIdStr, out var callerUserId) && callerUserId > 0)
        {
            realUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == callerUserId && !u.Email.Contains("@orbit.org"));
        }

        if (realUser == null && roleName == RoleName.Owner && targetOrg.OwnerId.HasValue)
        {
            realUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == targetOrg.OwnerId.Value && !u.Email.Contains("@orbit.org"));
        }

        if (realUser == null)
        {
            var member = await _db.OrganizationMembers
                .Include(m => m.User)
                .Include(m => m.Role)
                .FirstOrDefaultAsync(m => m.OrganizationId == targetOrg.Id && m.Role != null && m.Role.Name == roleName && m.Status == OrgMemberStatus.Active && m.User != null && !m.User.Email.Contains("@orbit.org"));

            if (member?.User != null)
            {
                realUser = member.User;
            }
        }

        if (realUser == null)
        {
            // Fallback to the owner or first real user of the target organization
            if (targetOrg.OwnerId.HasValue)
            {
                realUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == targetOrg.OwnerId.Value && !u.Email.Contains("@orbit.org"));
            }

            if (realUser == null)
            {
                realUser = await _db.OrganizationMembers
                    .Where(m => m.OrganizationId == targetOrg.Id && m.Status == OrgMemberStatus.Active && m.User != null && !m.User.Email.Contains("@orbit.org"))
                    .Select(m => m.User)
                    .FirstOrDefaultAsync();
            }

            if (realUser == null)
            {
                realUser = await _db.Users.FirstOrDefaultAsync(u => !u.Email.Contains("@orbit.org"));
            }
        }

        if (realUser == null)
        {
            return BadRequest(new { message = "No valid user exists in this organization to switch roles." });
        }

        var appUser = await _userManager.FindByEmailAsync(realUser.Email)
            ?? await _userManager.FindByIdAsync(realUser.Id.ToString());

        if (appUser == null)
        {
            return BadRequest(new { message = "Identity account for user could not be found." });
        }

        // Ensure role exists
        var dbRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName && r.IsSystemRole);
        if (dbRole == null)
        {
            dbRole = new Role { Name = roleName, Description = $"{roleName} System Role", IsSystemRole = true };
            _db.Roles.Add(dbRole);
            await _db.SaveChangesAsync();
        }

        // Update or assign role to realUser
        var existingAssignment = await _db.RoleAssignments
            .FirstOrDefaultAsync(a => a.UserId == realUser.Id && a.ScopeType == ScopeType.Organization && a.ScopeId == targetOrg.Id);
        if (existingAssignment == null)
        {
            _db.RoleAssignments.Add(new RoleAssignment
            {
                UserId = realUser.Id,
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
            .FirstOrDefaultAsync(m => m.UserId == realUser.Id && m.OrganizationId == targetOrg.Id);
        if (existingOrgMember == null)
        {
            _db.OrganizationMembers.Add(new OrganizationMember
            {
                UserId = realUser.Id,
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

        if (roleName == RoleName.Owner && targetOrg.OwnerId != realUser.Id)
        {
            targetOrg.OwnerId = realUser.Id;
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
            Name = realUser.Name ?? appUser.FullName ?? appUser.Email ?? roleName.ToString(),
            Email = realUser.Email ?? appUser.Email ?? string.Empty,
            PhotoUrl = realUser.PhotoUrl,
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
