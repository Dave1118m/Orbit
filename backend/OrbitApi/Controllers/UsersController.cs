using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using System.Security.Claims;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly IConfiguration _configuration;

        public UsersController(OrbitDbContext db, IAuthorizationService authorizationService, IConfiguration configuration)
        {
            _db = db;
            _authorizationService = authorizationService;
            _configuration = configuration;
        }

        private int? GetCurrentUserId()
        {
            var idValue = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub)?.Value;
            return int.TryParse(idValue, out var id) ? id : null;
        }

        private string? GetCurrentUserEmail()
        {
            return User.FindFirst(ClaimTypes.Email)?.Value;
        }

        private string? GetCurrentUserName()
        {
            return User.FindFirst(ClaimTypes.Name)?.Value
                ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Name)?.Value;
        }

        private async Task<User> EnsureAppUserExistsAsync(int userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user != null)
            {
                return user;
            }

            var email = GetCurrentUserEmail() ?? string.Empty;
            var name = GetCurrentUserName();
            if (string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(email))
            {
                name = email.Split('@')[0];
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                name = $"user{userId}";
            }

            await _db.Database.OpenConnectionAsync();
            try
            {
                await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] ON");
                _db.Users.Add(new User
                {
                    Id = userId,
                    Name = name,
                    Email = email
                });
                await _db.SaveChangesAsync();
                await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] OFF");
            }
            finally
            {
                await _db.Database.CloseConnectionAsync();
            }

            return await _db.Users.FindAsync(userId)!;
        }

        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> Me()
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized();
            }

            var user = await EnsureAppUserExistsAsync(currentUserId.Value);
            return Ok(MapToDto(user));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<UserDto>> Get(int id)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized();
            }

            if (currentUserId.Value != id && !(await _authorizationService.AuthorizeAsync(User, null, new PermissionRequirement(Permission.UserManage))).Succeeded)
            {
                return Forbid();
            }

            var user = await _db.Users.FindAsync(id) ?? await EnsureAppUserExistsAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            return Ok(MapToDto(user));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<UserDto>> Update(int id, [FromBody] UpdateUserRequest req)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized();
            }

            if (currentUserId.Value != id && !(await _authorizationService.AuthorizeAsync(User, null, new PermissionRequirement(Permission.UserManage))).Succeeded)
            {
                return Forbid();
            }

            var user = await _db.Users.FindAsync(id) ?? await EnsureAppUserExistsAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            if (req.Name != null) user.Name = req.Name;
            if (req.PhotoUrl != null) user.PhotoUrl = req.PhotoUrl;
            if (req.PreferredLanguage != null) user.PreferredLanguage = req.PreferredLanguage;
            if (req.PhoneNumber != null) user.PhoneNumber = req.PhoneNumber;
            if (req.MFAEnabled.HasValue) user.MFAEnabled = req.MFAEnabled.Value;

            await _db.SaveChangesAsync();
            return Ok(MapToDto(user));
        }

        [HttpPost("{id}/photo")]
        public async Task<ActionResult> UploadPhoto(int id, IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue) return Unauthorized();

            if (currentUserId.Value != id && !(await _authorizationService.AuthorizeAsync(User, null, new PermissionRequirement(Permission.UserManage))).Succeeded)
            {
                return Forbid();
            }

            var user = await _db.Users.FindAsync(id) ?? await EnsureAppUserExistsAsync(id);
            if (user == null) return NotFound();

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Users", id.ToString());
            Directory.CreateDirectory(uploadsDir);

            var uniqueName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsDir, uniqueName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var relativePath = $"/api/v1/users/{id}/photo/download?filename={uniqueName}";
            
            user.PhotoUrl = relativePath;
            await _db.SaveChangesAsync();

            return Ok(new { PhotoUrl = relativePath });
        }

        [HttpGet("{id}/photo/download")]
        [AllowAnonymous]
        public ActionResult DownloadPhoto(int id, [FromQuery] string filename)
        {
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Users", id.ToString(), filename);
            if (!System.IO.File.Exists(filePath)) return NotFound("Photo not found");

            var ext = Path.GetExtension(filename).ToLowerInvariant();
            var mimeType = ext switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".svg" => "image/svg+xml",
                _ => "application/octet-stream"
            };

            var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
            return File(stream, mimeType);
        }

        private static UserDto MapToDto(User user)
        {
            return new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                PhotoUrl = user.PhotoUrl,
                MFAEnabled = user.MFAEnabled,
                PreferredLanguage = user.PreferredLanguage,
                PhoneNumber = user.PhoneNumber
            };
        }
    }
}
