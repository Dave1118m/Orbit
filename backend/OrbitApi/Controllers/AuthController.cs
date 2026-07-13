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
using OrbitApi.Models;

namespace OrbitApi.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _config;
    private readonly OrbitApi.Services.IEmailSender _emailSender;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly OrbitDbContext _db;
    private readonly string _googleRedirectUri;

        public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, IConfiguration config, OrbitApi.Services.IEmailSender emailSender, IHttpClientFactory httpClientFactory, OrbitDbContext db)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _config = config;
            _emailSender = emailSender;
            _httpClientFactory = httpClientFactory;
            _db = db;
            _googleRedirectUri = _config["Google:RedirectUri"] ?? "https://localhost:7065/api/v1/auth/google-callback";
        }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
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
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())
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
        if (string.IsNullOrEmpty(code))
            return BadRequest("Missing code.");

        var (idToken, exchangeError) = await ExchangeGoogleCodeForIdTokenAsync(code);
        if (idToken == null)
            return BadRequest(exchangeError);

        var (user, signInError) = await SignInOrCreateGoogleUserAsync(idToken);
        if (user == null)
            return Unauthorized(signInError ?? "Google sign-in failed.");

        var token = GenerateToken(user);
        var frontendRedirect = $"https://localhost:5173/dashboard?token={System.Net.WebUtility.UrlEncode(token)}";

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
}

public record RegisterRequest(string Email, string Password, string? FullName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
