using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;
using System.Linq;
using System.Security.Claims;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing user profiles, role introspection, preferences,
    /// dynamic permissions, and profile picture avatar uploads.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly IConfiguration _configuration;
        private readonly IPermissionService _permissionService;

        public UsersController(OrbitDbContext db, IAuthorizationService authorizationService, IConfiguration configuration, IPermissionService permissionService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _configuration = configuration;
            _permissionService = permissionService;
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
            if (user == null)
            {
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
                    user = new User
                    {
                        Id = userId,
                        Name = name,
                        Email = email
                    };
                    _db.Users.Add(user);
                    await _db.SaveChangesAsync();
                    await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] OFF");
                }
                finally
                {
                    await _db.Database.CloseConnectionAsync();
                }
            }
            else if (string.IsNullOrWhiteSpace(user.Name) && !string.IsNullOrWhiteSpace(user.Email))
            {
                user.Name = user.Email.Split('@')[0];
                _db.Users.Update(user);
                await _db.SaveChangesAsync();
            }

            await EnsureUserHasOwnerAccessAsync(userId);
            return user;
        }

        private async Task EnsureUserHasOwnerAccessAsync(int userId)
        {
            // Removed automatic organization creation and blind Owner assignments.
            // This was causing duplicate "Orbit Global Organization" and making every new user
            // an Owner of all existing organizations. 
            // Organization creation should be explicitly requested by users.
            await Task.CompletedTask;
        }

        /// <summary>
        /// Lists users scoped to the active organization or workspace (Multi-tenancy isolated).
        /// </summary>
        /// <param name="orgId">Optional organization ID filter.</param>
        /// <param name="workspaceId">Optional workspace ID filter.</param>
        /// <returns>Collection of user DTOs belonging to the organization.</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<UserDto>>> List([FromQuery] int? orgId, [FromQuery] int? workspaceId)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue) return Unauthorized();

            int? targetOrgId = orgId;
            if (!targetOrgId.HasValue && Request.Headers.TryGetValue("X-Organization-Id", out var orgHeader) && int.TryParse(orgHeader, out var parsedOrgId) && parsedOrgId > 0)
            {
                targetOrgId = parsedOrgId;
            }

            if (!targetOrgId.HasValue && workspaceId.HasValue)
            {
                targetOrgId = await _db.Workspaces
                    .Where(w => w.Id == workspaceId.Value)
                    .Select(w => (int?)w.OrganizationId)
                    .FirstOrDefaultAsync();
            }

            if (!targetOrgId.HasValue)
            {
                targetOrgId = await _db.OrganizationMembers
                    .Where(m => m.UserId == currentUserId.Value && m.Status == OrgMemberStatus.Active)
                    .Select(m => (int?)m.OrganizationId)
                    .FirstOrDefaultAsync();

                if (!targetOrgId.HasValue)
                {
                    targetOrgId = await _db.Organizations
                        .Where(o => o.OwnerId == currentUserId.Value && !o.IsDeleted)
                        .Select(o => (int?)o.Id)
                        .FirstOrDefaultAsync();
                }
            }

            IQueryable<User> query;

            if (targetOrgId.HasValue && targetOrgId.Value > 0)
            {
                var effectiveOrg = targetOrgId.Value;
                var memberUserIds = await _db.OrganizationMembers
                    .Where(m => m.OrganizationId == effectiveOrg && m.Status == OrgMemberStatus.Active)
                    .Select(m => m.UserId)
                    .ToListAsync();

                var ownerUserId = await _db.Organizations
                    .Where(o => o.Id == effectiveOrg && !o.IsDeleted)
                    .Select(o => o.OwnerId)
                    .ToListAsync();

                var scopedRoleUserIds = await _db.RoleAssignments
                    .Where(ra => ra.ScopeType == ScopeType.Organization && ra.ScopeId == effectiveOrg)
                    .Select(ra => ra.UserId)
                    .ToListAsync();

                var workspaceIds = await _db.Workspaces
                    .Where(w => w.OrganizationId == effectiveOrg && !w.IsArchived)
                    .Select(w => w.Id)
                    .ToListAsync();

                var workspaceRoleUserIds = await _db.RoleAssignments
                    .Where(ra => ra.ScopeType == ScopeType.Workspace && workspaceIds.Contains(ra.ScopeId))
                    .Select(ra => ra.UserId)
                    .ToListAsync();

                var allowedUserIds = new HashSet<int>(memberUserIds);
                foreach (var o in ownerUserId) if (o.HasValue) allowedUserIds.Add(o.Value);
                foreach (var s in scopedRoleUserIds) allowedUserIds.Add(s);
                foreach (var w in workspaceRoleUserIds) allowedUserIds.Add(w);

                query = _db.Users.Where(u => allowedUserIds.Contains(u.Id));
            }
            else
            {
                query = _db.Users.Where(u => u.Id == currentUserId.Value);
            }

            var users = await query.Distinct().ToListAsync();
            var dtos = new List<UserDto>();
            foreach (var u in users)
            {
                var roles = await GetUserRolesAsync(u.Id);
                dtos.Add(MapToDto(u, roles));
            }
            return Ok(dtos);
        }

        /// <summary>
        /// Returns profile and permission matrix details for the currently authenticated user.
        /// </summary>
        /// <returns>Current user DTO.</returns>
        [HttpGet("me")]
        public async Task<ActionResult<UserDto>> Me()
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                return Unauthorized();
            }

            var user = await EnsureAppUserExistsAsync(currentUserId.Value);
            var roles = await GetUserRolesAsync(currentUserId.Value);

            // Build permissions from DB via IPermissionService
            var roleNames = roles
                .Select(r => Enum.TryParse<RoleName>(r.Name, out var rn) ? (RoleName?)rn : null)
                .Where(r => r.HasValue).Select(r => r!.Value).Distinct().ToList();
            var dbPermissions = await _permissionService.GetPermissionsForRolesAsync(roleNames);

            return Ok(MapToDto(user, roles, dbPermissions));
        }

        /// <summary>
        /// Retrieves a user by ID.
        /// </summary>
        /// <param name="id">User ID.</param>
        /// <returns>User DTO.</returns>
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

            var roles = await GetUserRolesAsync(user.Id);
            return Ok(MapToDto(user, roles));
        }

        /// <summary>
        /// Updates profile information, preferred language, MFA status, or avatar URL.
        /// </summary>
        /// <param name="id">User ID.</param>
        /// <param name="req">Updated user parameters.</param>
        /// <returns>Updated user DTO.</returns>
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
            var roles = await GetUserRolesAsync(user.Id);
            return Ok(MapToDto(user, roles));
        }

        /// <summary>
        /// Uploads and sets a custom profile avatar photo for a user.
        /// </summary>
        /// <param name="id">User ID.</param>
        /// <param name="file">Image file payload.</param>
        /// <returns>Photo download path and updated user record.</returns>
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

            var roles = await GetUserRolesAsync(user.Id);
            
            var roleNames = roles.Select(r => Enum.Parse<RoleName>(r.Name)).ToList();
            var dynamicPermissions = await _db.Roles
                .Where(r => roleNames.Contains(r.Name))
                .SelectMany(r => r.RolePermissions.Select(rp => rp.Permission!.Name))
                .ToListAsync();

            return Ok(new { PhotoUrl = relativePath, User = MapToDto(user, roles, dynamicPermissions) });
        }

        /// <summary>
        /// Serves the avatar photo image file stream.
        /// </summary>
        /// <param name="id">User ID.</param>
        /// <param name="filename">File name.</param>
        /// <returns>Image file stream.</returns>
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

        private static UserDto MapToDto(User user, List<RoleInfoDto> roles, List<string>? dynamicPermissions = null)
        {
            var isOwner = roles.Any(r => r.Name == RoleName.Owner.ToString());
            var permissions = isOwner
                ? Enum.GetValues<Permission>().Select(p => p.ToString()).OrderBy(p => p).ToList()
                : (dynamicPermissions ?? new List<string>()).Distinct().OrderBy(p => p).ToList();

            return new UserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                PhotoUrl = user.PhotoUrl,
                MFAEnabled = user.MFAEnabled,
                PreferredLanguage = user.PreferredLanguage,
                PhoneNumber = user.PhoneNumber,
                Roles = roles,
                Permissions = permissions
            };
        }

        private async Task<List<RoleInfoDto>> GetUserRolesAsync(int userId)
        {
            var assignments = await _db.RoleAssignments.Include(a => a.Role).Where(a => a.UserId == userId).ToListAsync();
            var roles = assignments
                .Where(a => a.Role != null)
                .Select(a => new RoleInfoDto
                {
                    Name = a.Role!.Name.ToString(),
                    ScopeType = a.ScopeType.ToString(),
                    ScopeId = a.ScopeId
                })
                .ToList();

            var memberRoles = await _db.OrganizationMembers.Include(m => m.Role)
                .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active)
                .ToListAsync();

            foreach (var member in memberRoles)
            {
                if (member.Role == null) continue;
                if (!roles.Any(r => r.Name == member.Role.Name.ToString() && r.ScopeType == ScopeType.Organization.ToString() && r.ScopeId == member.OrganizationId))
                {
                    roles.Add(new RoleInfoDto
                    {
                        Name = member.Role.Name.ToString(),
                        ScopeType = ScopeType.Organization.ToString(),
                        ScopeId = member.OrganizationId
                    });
                }
            }

            var ownedOrgs = await _db.Organizations.Where(o => o.OwnerId == userId && !o.IsDeleted).ToListAsync();
            foreach (var org in ownedOrgs)
            {
                if (!roles.Any(r => r.Name == RoleName.Owner.ToString() && r.ScopeType == ScopeType.Organization.ToString() && r.ScopeId == org.Id))
                {
                    roles.Add(new RoleInfoDto
                    {
                        Name = RoleName.Owner.ToString(),
                        ScopeType = ScopeType.Organization.ToString(),
                        ScopeId = org.Id
                    });
                }
            }

            return roles;
        }
    }
}
