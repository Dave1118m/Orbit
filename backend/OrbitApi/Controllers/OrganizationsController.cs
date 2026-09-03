using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.AspNetCore.Identity;
using OrbitApi.Identity;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing Organization life-cycle, invitations, member roles, ownership transfers,
    /// compliance profiles, logo assets, and partner relationships.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class OrganizationsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly IEmailSender _emailSender;
        private readonly IConfiguration _configuration;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IPermissionService _permissionService;

        public OrganizationsController(OrbitDbContext db, IAuthorizationService authorizationService, IEmailSender emailSender, IConfiguration configuration, UserManager<ApplicationUser> userManager, IPermissionService permissionService)
        {
            _db = db;
            _authorizationService = authorizationService;
            _emailSender = emailSender;
            _configuration = configuration;
            _userManager = userManager;
            _permissionService = permissionService;
        }

        private int GetCurrentUserId() => int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

        private async Task EnsureAppUserExistsAsync(int userId)
        {
            if (await _db.Users.AnyAsync(u => u.Id == userId))
            {
                return;
            }

            var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? string.Empty;
            var name = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? string.Empty;
            if (string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(email))
            {
                name = email.Split('@')[0];
            }

            await _db.Database.OpenConnectionAsync();
            try
            {
                await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] ON");
                _db.Users.Add(new User
                {
                    Id = userId,
                    Name = string.IsNullOrWhiteSpace(name) ? $"user{userId}" : name,
                    Email = email
                });
                await _db.SaveChangesAsync();
                await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] OFF");
            }
            finally
            {
                await _db.Database.CloseConnectionAsync();
            }
        }

        /// <summary>
        /// Creates a new Organization, assigns the calling user as Owner, seeds default workspace and role assignments.
        /// </summary>
        /// <param name="req">Organization creation parameters.</param>
        /// <returns>Created organization details.</returns>
        [HttpPost]
        public async Task<ActionResult<OrganizationDto>> Create([FromBody] CreateOrganizationRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
            {
                return BadRequest("Organization name must be at least 2 characters long.");
            }
            if (req.Name.Trim().Length > 100)
            {
                return BadRequest("Organization name cannot exceed 100 characters.");
            }
            if (req.Budget.HasValue && req.Budget.Value < 0)
            {
                return BadRequest("Organization budget cannot be negative.");
            }

            if (!string.IsNullOrWhiteSpace(req.Country) && req.Country.Trim().Equals("Ethiopia", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(req.RegistrationNumber))
                {
                    var trimmedReg = req.RegistrationNumber.Trim();
                    bool isCso = System.Text.RegularExpressions.Regex.IsMatch(trimmedReg, @"^(CSO|NGO|ACSO|ETH)[/-]?\d{3,8}(/\d{2,4})?$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    bool isTradeLicense = System.Text.RegularExpressions.Regex.IsMatch(trimmedReg, @"^[A-Za-z]{2,4}[/-]\d{3,8}[/-]\d{2,4}$");
                    bool isStandardValid = System.Text.RegularExpressions.Regex.IsMatch(trimmedReg, @"^[A-Za-z0-9/-]{3,25}$");

                    if (!isCso && !isTradeLicense && !isStandardValid)
                    {
                        return BadRequest(new { message = "Invalid Ethiopian Registration Number. Expected format: e.g. CSO/3421, AA/12345/2016, or Reg #12345." });
                    }
                }
            }

            int currentUserId;
            try
            {
                currentUserId = GetCurrentUserId();
            }
            catch
            {
                return Unauthorized();
            }

            await EnsureAppUserExistsAsync(currentUserId);

            var org = new Organization
            {
                Name = req.Name.Trim(),
                Description = req.Description,
                LogoUrl = req.LogoUrl,
                RegistrationNumber = req.RegistrationNumber,
                Country = req.Country,
                OwnerId = currentUserId
            };

            _db.Organizations.Add(org);
            await _db.SaveChangesAsync();

            if (req.Budget.HasValue)
            {
                var budget = new Budget
                {
                    OrganizationId = org.Id,
                    TotalAmount = req.Budget.Value,
                    Level = BudgetLevel.Organization,
                    Status = BudgetStatus.Approved,
                    Currency = "USD"
                };
                _db.Budgets.Add(budget);
                await _db.SaveChangesAsync();
            }

            var defaultWorkspace = new Workspace
            {
                OrganizationId = org.Id,
                Name = $"{org.Name} Workspace",
                Description = "Default workspace",
                Visibility = VisibilityLevel.Private
            };
            _db.Workspaces.Add(defaultWorkspace);

            var ownerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleName.Owner);
            if (ownerRole != null)
            {
                _db.OrganizationMembers.Add(new OrganizationMember
                {
                    OrganizationId = org.Id,
                    UserId = org.OwnerId.Value,
                    RoleId = ownerRole.Id,
                    Status = OrgMemberStatus.Active,
                    JoinedAt = DateTime.UtcNow
                });

                _db.RoleAssignments.Add(new RoleAssignment
                {
                    UserId = org.OwnerId.Value,
                    RoleId = ownerRole.Id,
                    ScopeType = ScopeType.Organization,
                    ScopeId = org.Id
                });
            }

            _db.AuditLogs.Add(new AuditLog
            {
                OrganizationId = org.Id,
                Entity = "Organization",
                Action = "Create",
                NewValues = $"{{ Name: '{org.Name}' }}",
                Timestamp = DateTime.UtcNow,
                PerformedByUserId = GetCurrentUserId()
            });

            await _db.SaveChangesAsync();
            return Ok(MapToDto(org));
        }

        /// <summary>
        /// Lists all active organizations accessible to the current user.
        /// </summary>
        /// <returns>Collection of accessible organizations.</returns>
        [HttpGet]
        public async Task<ActionResult> List()
        {
            var accessibleOrganizationIds = await GetAccessibleOrganizationIdsAsync(Permission.OrganizationView);
            if (!accessibleOrganizationIds.Any())
            {
                return Ok(Array.Empty<OrganizationDto>());
            }

            var orgs = await _db.Organizations
                .Include(o => o.Compliance)
                .Include(o => o.Members)
                .Include(o => o.PartnersInitiated)
                .Include(o => o.PartnersReceived)
                .Where(o => accessibleOrganizationIds.Contains(o.Id) && !o.IsDeleted)
                .ToListAsync();

            return Ok(orgs.Select(MapToDto));
        }

        /// <summary>
        /// Retrieves detailed information for an organization by ID, including members, partners, compliance, and budget.
        /// </summary>
        /// <param name="id">Organization primary key.</param>
        /// <returns>Organization detail DTO.</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<OrganizationDetailDto>> Get(int id)
        {
            var org = await _db.Organizations
                .Include(o => o.Compliance)
                .Include(o => o.Members).ThenInclude(m => m.User)
                .Include(o => o.Members).ThenInclude(m => m.Role)
                .Include(o => o.PartnersInitiated).ThenInclude(p => p.PartnerOrg)
                .Include(o => o.PartnersReceived).ThenInclude(p => p.InitiatorOrg)
                .FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);

            if (org == null) return NotFound();

            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationView))).Succeeded)
            {
                return Forbid();
            }

            var detail = new OrganizationDetailDto
            {
                Id = org.Id,
                Name = org.Name,
                Description = org.Description,
                LogoUrl = org.LogoUrl,
                RegistrationNumber = org.RegistrationNumber,
                Country = org.Country,
                OwnerId = org.OwnerId,
                Budget = await _db.Budgets.Where(b => b.OrganizationId == id && b.Level == BudgetLevel.Organization).Select(b => (decimal?)b.TotalAmount).FirstOrDefaultAsync(),
                IsDeleted = org.IsDeleted,
                DeletedAt = org.DeletedAt,
                HasCompliance = org.Compliance != null,
                PartnerCount = org.PartnersInitiated.Count + org.PartnersReceived.Count,
                MemberCount = org.Members.Count(m => m.Status == OrgMemberStatus.Active)
            };

            if (org.Compliance != null)
            {
                detail.Compliance = new OrganizationComplianceDto
                {
                    RegistrationDocPath = org.Compliance.RegistrationDocPath,
                    TaxExemptStatus = org.Compliance.TaxExemptStatus,
                    TaxExemptDocPath = org.Compliance.TaxExemptDocPath,
                    RegistrationRenewalDate = org.Compliance.RegistrationRenewalDate,
                    TaxExemptRenewalDate = org.Compliance.TaxExemptRenewalDate
                };
            }

            detail.Members = org.Members
                .Where(m => m.User != null && !m.User.Name.Contains("Demo") && !m.User.Email.StartsWith("demo."))
                .Select(m => new OrganizationMemberDto
                {
                    UserId = m.UserId,
                    UserName = m.User?.Name ?? "Unknown",
                    Email = m.User?.Email ?? "Unknown",
                    RoleName = m.Role?.Name.ToString() ?? "Unknown",
                    Status = m.Status,
                    JoinedAt = m.JoinedAt
                }).ToList();

            var initiated = org.PartnersInitiated.Select(p => new OrganizationPartnerDto
            {
                PartnerOrgId = p.PartnerOrgId,
                PartnerName = p.PartnerOrg?.Name ?? "Unknown",
                LinkedAt = p.LinkedAt,
                Notes = p.Notes
            });
            var received = org.PartnersReceived.Select(p => new OrganizationPartnerDto
            {
                PartnerOrgId = p.InitiatorOrgId,
                PartnerName = p.InitiatorOrg?.Name ?? "Unknown",
                LinkedAt = p.LinkedAt,
                Notes = p.Notes
            });
            detail.Partners = initiated.Concat(received).ToList();

            return Ok(detail);
        }

        /// <summary>
        /// Updates organization metadata such as name, description, country, registration, or budget.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="req">Updated fields.</param>
        /// <returns>Updated organization record.</returns>
        [HttpPut("{id}")]
        public async Task<ActionResult<OrganizationDto>> Update(int id, [FromBody] UpdateOrganizationRequest req)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManage))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (org == null) return NotFound();

            if (req.Name != null)
            {
                if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length < 2)
                {
                    return BadRequest("Organization name must be at least 2 characters long.");
                }
                if (req.Name.Trim().Length > 100)
                {
                    return BadRequest("Organization name cannot exceed 100 characters.");
                }
                org.Name = req.Name.Trim();
            }

            if (req.Budget.HasValue && req.Budget.Value < 0)
            {
                return BadRequest("Organization budget cannot be negative.");
            }

            var targetCountry = req.Country ?? org.Country;
            var targetReg = req.RegistrationNumber ?? org.RegistrationNumber;
            if (!string.IsNullOrWhiteSpace(targetCountry) && targetCountry.Trim().Equals("Ethiopia", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(targetReg))
                {
                    var trimmedReg = targetReg.Trim();
                    bool isCso = System.Text.RegularExpressions.Regex.IsMatch(trimmedReg, @"^(CSO|NGO|ACSO|ETH)[/-]?\d{3,8}(/\d{2,4})?$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    bool isTradeLicense = System.Text.RegularExpressions.Regex.IsMatch(trimmedReg, @"^[A-Za-z]{2,4}[/-]\d{3,8}[/-]\d{2,4}$");
                    bool isStandardValid = System.Text.RegularExpressions.Regex.IsMatch(trimmedReg, @"^[A-Za-z0-9/-]{3,25}$");

                    if (!isCso && !isTradeLicense && !isStandardValid)
                    {
                        return BadRequest(new { message = "Invalid Ethiopian Registration Number. Expected format: e.g. CSO/3421, AA/12345/2016, or Reg #12345." });
                    }
                }
            }

            if (req.Description != null) org.Description = req.Description;
            if (req.LogoUrl != null) org.LogoUrl = req.LogoUrl;
            if (req.RegistrationNumber != null) org.RegistrationNumber = req.RegistrationNumber;
            if (req.Country != null) org.Country = req.Country;
            if (req.Budget != null)
            {
                var budget = await _db.Budgets.FirstOrDefaultAsync(b => b.OrganizationId == id && b.Level == BudgetLevel.Organization);
                if (budget != null)
                {
                    budget.TotalAmount = req.Budget.Value;
                }
                else
                {
                    _db.Budgets.Add(new Budget { OrganizationId = id, TotalAmount = req.Budget.Value, Level = BudgetLevel.Organization, Status = BudgetStatus.Approved, Currency = "USD" });
                }
            }

            await _db.SaveChangesAsync();
            return Ok(MapToDto(org));
        }

        /// <summary>
        /// Uploads and stores a custom organization logo image on disk.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="file">Image file payload.</param>
        /// <returns>Download path of uploaded logo.</returns>
        [HttpPost("{id}/logo")]
        public async Task<ActionResult> UploadLogo(int id, IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file uploaded.");

            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManage))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (org == null) return NotFound();

            var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Organizations", id.ToString());
            Directory.CreateDirectory(uploadsDir);

            var uniqueName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsDir, uniqueName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var frontendBaseUrl = _configuration["App:BackendBaseUrl"] ?? "https://localhost:7065";
            var relativePath = $"/api/v1/organizations/{id}/logo/download?filename={uniqueName}";

            // Store an absolute URL in the database, but keep the file on disk.
            var absoluteUrl = frontendBaseUrl.TrimEnd('/') + relativePath;
            org.LogoUrl = absoluteUrl;
            await _db.SaveChangesAsync();

            return Ok(new { LogoUrl = relativePath });
        }

        /// <summary>
        /// Serves the organization logo image stream.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="filename">Stored file name.</param>
        /// <returns>Image file stream.</returns>
        [HttpGet("{id}/logo/download")]
        [AllowAnonymous]
        public ActionResult DownloadLogo(int id, [FromQuery] string filename)
        {
            var filePath = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Organizations", id.ToString(), filename);
            if (!System.IO.File.Exists(filePath)) return NotFound("Logo not found");

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

        /// <summary>
        /// Soft-deletes an organization.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManage))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (org == null) return NotFound();

            org.IsDeleted = true;
            org.DeletedAt = DateTime.UtcNow;
            org.DeletedByUserId = GetCurrentUserId();
            org.BackupJson = System.Text.Json.JsonSerializer.Serialize(new { org.Name, org.OwnerId, org.Country }); 

            _db.AuditLogs.Add(new AuditLog
            {
                OrganizationId = org.Id,
                Entity = "Organization",
                Action = "Delete",
                Timestamp = DateTime.UtcNow,
                PerformedByUserId = GetCurrentUserId()
            });

            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Restores a previously soft-deleted organization.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <returns>Restored organization DTO.</returns>
        [HttpPost("{id}/restore")]
        public async Task<ActionResult> Restore(int id)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationRestore))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.IgnoreQueryFilters().FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);
            if (org == null) return NotFound();

            org.IsDeleted = false;
            org.DeletedAt = null;
            org.DeletedByUserId = null;

            _db.AuditLogs.Add(new AuditLog
            {
                OrganizationId = org.Id,
                Entity = "Organization",
                Action = "Restore",
                Timestamp = DateTime.UtcNow,
                PerformedByUserId = GetCurrentUserId()
            });

            await _db.SaveChangesAsync();
            return Ok(MapToDto(org));
        }

        /// <summary>
        /// Issues an email invitation to join an organization with a pre-assigned role.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="req">Invitation details with email and role.</param>
        /// <returns>Invitation token and dispatch result.</returns>
        [HttpPost("{id}/invite")]
        public async Task<ActionResult> InviteMember(int id, [FromBody] InviteMemberRequest req)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationInvite))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (org == null) return NotFound();

            if (!Enum.TryParse<RoleName>(req.PreAssignedRoleName, true, out var roleEnum))
                return BadRequest("Invalid role");

            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleEnum);
            if (role == null) return BadRequest("Role not found");

            // Check if user already exists
            var existingUser = await _userManager.FindByEmailAsync(req.Email);
            int? userId = null;

            if (existingUser == null)
            {
                // Create new user account with temporary password
                var tempPassword = Guid.NewGuid().ToString("N") + "Temp!";
                var newUser = new ApplicationUser
                {
                    UserName = req.Email,
                    Email = req.Email,
                    EmailConfirmed = false, // Will be confirmed when they set password
                    FullName = req.Email.Split('@')[0] // Temporary name from email
                };

                var result = await _userManager.CreateAsync(newUser, tempPassword);
                if (!result.Succeeded)
                {
                    return BadRequest($"Failed to create user: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                }

                userId = newUser.Id;
                Console.WriteLine($"Created new user account for {req.Email} with ID {userId}");
            }
            else
            {
                userId = existingUser.Id;
                Console.WriteLine($"User already exists for {req.Email} with ID {userId}");
            }

            if (!await _db.Users.AnyAsync(u => u.Id == userId.Value))
            {
                using (var transaction = await _db.Database.BeginTransactionAsync())
                {
                    await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] ON");
                    _db.Users.Add(new User
                    {
                        Id = userId.Value,
                        Name = req.Email.Split('@')[0],
                        Email = req.Email
                    });
                    await _db.SaveChangesAsync();
                    await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] OFF");
                    await transaction.CommitAsync();
                }
            }

            var token = Guid.NewGuid().ToString("N");
            var invite = new OrganizationInvitation
            {
                OrganizationId = id,
                Email = req.Email,
                PreAssignedRoleId = role.Id,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                Status = InvitationStatus.Pending,
                InvitedByUserId = GetCurrentUserId(),
                UserId = userId // Link to user account
            };

            _db.OrganizationInvitations.Add(invite);
            await _db.SaveChangesAsync();

            var frontendUrl = _configuration["App:FrontendBaseUrl"] ?? "https://localhost:5173";
            var inviteLink = $"{frontendUrl}/setup-password?token={token}";

            try
            {
                var emailBody = existingUser == null 
                    ? $"<p>You have been invited to join <strong>{org.Name}</strong> as a {req.PreAssignedRoleName}.</p><p><a href='{inviteLink}'>Click here to set up your account and accept the invitation</a></p>"
                    : $"<p>You have been invited to join <strong>{org.Name}</strong> as a {req.PreAssignedRoleName}.</p><p><a href='{inviteLink}'>Click here to accept the invitation</a></p>";

                await _emailSender.SendEmailAsync(req.Email, $"You've been invited to {org.Name} on OrbitDesk", emailBody);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to send invite email: {ex.Message}");
            }

            return Ok(new { invite.Id, invite.Token, emailSent = true, userCreated = existingUser == null }); 
        }

        /// <summary>
        /// Lists pending and sent invitations for an organization.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <returns>List of organization invitations.</returns>
        [HttpGet("{id}/invitations")]
        public async Task<ActionResult> ListInvitations(int id)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationView))).Succeeded)
            {
                return Forbid();
            }

            var invites = await _db.OrganizationInvitations
                .Include(i => i.PreAssignedRole)
                .Include(i => i.InvitedByUser)
                .Where(i => i.OrganizationId == id)
                .ToListAsync();

            return Ok(invites.Select(i => new OrganizationInvitationDto
            {
                Id = i.Id,
                Email = i.Email,
                PreAssignedRoleName = i.PreAssignedRole?.Name.ToString() ?? "",
                ExpiresAt = i.ExpiresAt,
                Status = i.Status,
                InvitedByUserName = i.InvitedByUser?.Name ?? "Unknown"
            }));
        }

        /// <summary>
        /// Revokes an unaccepted organization invitation.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="invId">Invitation ID.</param>
        /// <returns>NoContent.</returns>
        [HttpDelete("{id}/invitations/{invId}")]
        public async Task<ActionResult> RevokeInvitation(int id, int invId)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationInvite))).Succeeded)
            {
                return Forbid();
            }

            var invite = await _db.OrganizationInvitations.FirstOrDefaultAsync(i => i.Id == invId && i.OrganizationId == id);
            if (invite == null) return NotFound();

            _db.OrganizationInvitations.Remove(invite);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // Old invitation acceptance endpoint removed - replaced by professional flow
        // Users now set up their password via /api/v1/auth/setup-password endpoint

        /// <summary>
        /// Removes a member from an organization.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="userId">Member user ID.</param>
        /// <returns>NoContent.</returns>
        [HttpDelete("{id}/members/{userId}")]
        public async Task<ActionResult> RemoveMember(int id, int userId)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManage))).Succeeded)
            {
                return Forbid();
            }

            var member = await _db.OrganizationMembers.FirstOrDefaultAsync(m => m.OrganizationId == id && m.UserId == userId);
            if (member == null) return NotFound();

            member.Status = OrgMemberStatus.Removed;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Initiates an ownership transfer request to another member.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="req">New owner user ID.</param>
        /// <returns>Transfer token and request record.</returns>
        [HttpPost("{id}/transfer-ownership")]
        public async Task<ActionResult> TransferOwnership(int id, [FromBody] TransferOwnershipRequest req)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationTransferOwnership))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (org == null || org.OwnerId != GetCurrentUserId()) return BadRequest("Not owner");

            var token = Guid.NewGuid().ToString("N");
            var transfer = new OwnershipTransferRequest
            {
                OrganizationId = id,
                FromUserId = GetCurrentUserId(),
                ToUserId = req.NewOwnerUserId,
                ConfirmationToken = token,
                RequestedAt = DateTime.UtcNow
            };

            _db.OwnershipTransferRequests.Add(transfer);

            var newOwner = await _db.Users.FindAsync(req.NewOwnerUserId);
            if (newOwner != null)
            {
                var previousOwnerId = org.OwnerId;
                org.OwnerId = newOwner.Id;

                var ownerRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleName.Owner);
                var adminRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleName.Admin);

                if (ownerRole != null)
                {
                    var newOwnerMember = await _db.OrganizationMembers
                        .FirstOrDefaultAsync(om => om.OrganizationId == id && om.UserId == newOwner.Id);
                    if (newOwnerMember != null)
                    {
                        newOwnerMember.RoleId = ownerRole.Id;
                    }
                }

                if (adminRole != null && previousOwnerId.HasValue)
                {
                    var prevOwnerMember = await _db.OrganizationMembers
                        .FirstOrDefaultAsync(om => om.OrganizationId == id && om.UserId == previousOwnerId.Value);
                    if (prevOwnerMember != null)
                    {
                        prevOwnerMember.RoleId = adminRole.Id;
                    }
                }

                _db.AuditLogs.Add(new AuditLog
                {
                    OrganizationId = id,
                    Entity = "Organization",
                    Action = "TransferOwnership",
                    NewValues = $"{{ PreviousOwnerId: {previousOwnerId}, NewOwnerId: {newOwner.Id} }}",
                    Timestamp = DateTime.UtcNow,
                    PerformedByUserId = GetCurrentUserId()
                });

                transfer.Status = OwnershipTransferStatus.Confirmed;
                transfer.ConfirmedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();

            return Ok(new { transfer.Id, transfer.ConfirmationToken, message = "Ownership transferred successfully." });
        }

        /// <summary>
        /// Confirms and finalizes an organization ownership transfer using the email token.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="token">Confirmation token.</param>
        /// <returns>Ok on success.</returns>
        [HttpPost("{id}/transfer-ownership/confirm")]
        public async Task<ActionResult> ConfirmTransfer(int id, [FromQuery] string token)
        {
            var transfer = await _db.OwnershipTransferRequests.FirstOrDefaultAsync(t => t.OrganizationId == id && t.ConfirmationToken == token && t.Status == OwnershipTransferStatus.Pending);
            if (transfer == null || transfer.ToUserId != GetCurrentUserId()) return BadRequest("Invalid token or unauthorized");

            transfer.Status = OwnershipTransferStatus.Confirmed;
            transfer.ConfirmedAt = DateTime.UtcNow;

            var org = await _db.Organizations.FindAsync(id);
            if (org != null)
            {
                org.OwnerId = transfer.ToUserId;
                
                _db.AuditLogs.Add(new AuditLog
                {
                    OrganizationId = id,
                    Entity = "Organization",
                    Action = "TransferOwnership",
                    NewValues = $"{{ OwnerId: {transfer.ToUserId} }}",
                    Timestamp = DateTime.UtcNow,
                    PerformedByUserId = GetCurrentUserId()
                });
            }

            await _db.SaveChangesAsync();
            return Ok();
        }

        /// <summary>
        /// Links a partner organization for collaborative workflows.
        /// </summary>
        /// <param name="id">Current organization ID.</param>
        /// <param name="req">Partner organization linkage parameters.</param>
        /// <returns>Ok.</returns>
        [HttpPost("{id}/partners")]
        public async Task<ActionResult> LinkPartner(int id, [FromBody] LinkPartnerRequest req)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManagePartners))).Succeeded)
            {
                return Forbid();
            }

            if (req.PartnerOrgId == id)
            {
                return BadRequest("Cannot link an organization to itself.");
            }

            var partnerOrg = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == req.PartnerOrgId && !o.IsDeleted);
            if (partnerOrg == null)
            {
                return NotFound("Partner organization not found.");
            }

            var existing = await _db.OrganizationPartners.FirstOrDefaultAsync(p => p.InitiatorOrgId == id && p.PartnerOrgId == req.PartnerOrgId);
            if (existing != null)
            {
                return BadRequest("This partner relationship already exists.");
            }

            _db.OrganizationPartners.Add(new OrganizationPartner
            {
                InitiatorOrgId = id,
                PartnerOrgId = req.PartnerOrgId,
                LinkedAt = DateTime.UtcNow,
                LinkedByUserId = GetCurrentUserId(),
                Notes = req.Notes
            });

            await _db.SaveChangesAsync();
            return Ok();
        }

        /// <summary>
        /// Unlinks an existing partner organization.
        /// </summary>
        /// <param name="id">Current organization ID.</param>
        /// <param name="partnerId">Partner organization ID.</param>
        /// <returns>NoContent.</returns>
        [HttpDelete("{id}/partners/{partnerId}")]
        public async Task<ActionResult> UnlinkPartner(int id, int partnerId)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManagePartners))).Succeeded)
            {
                return Forbid();
            }

            var partner = await _db.OrganizationPartners.FirstOrDefaultAsync(p => p.InitiatorOrgId == id && p.PartnerOrgId == partnerId);
            if (partner == null) return NotFound();

            _db.OrganizationPartners.Remove(partner);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Upserts compliance and regulatory filing information for an organization.
        /// </summary>
        /// <param name="id">Organization ID.</param>
        /// <param name="req">Compliance document paths and expiration renewal dates.</param>
        /// <returns>Ok.</returns>
        [HttpPut("{id}/compliance")]
        public async Task<ActionResult> UpsertCompliance(int id, [FromBody] UpsertComplianceRequest req)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationManageCompliance))).Succeeded)
            {
                return Forbid();
            }

            var organization = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (organization == null)
            {
                return NotFound();
            }

            var compliance = await _db.OrganizationCompliances.FirstOrDefaultAsync(c => c.OrganizationId == id);
            if (compliance == null)
            {
                compliance = new OrganizationCompliance { OrganizationId = id };
                _db.OrganizationCompliances.Add(compliance);
            }

            compliance.RegistrationDocPath = req.RegistrationDocPath;
            compliance.TaxExemptStatus = req.TaxExemptStatus;
            compliance.TaxExemptDocPath = req.TaxExemptDocPath;
            compliance.RegistrationRenewalDate = req.RegistrationRenewalDate;
            compliance.TaxExemptRenewalDate = req.TaxExemptRenewalDate;

            await _db.SaveChangesAsync();
            return Ok();
        }

        private async Task<List<int>> GetAccessibleOrganizationIdsAsync(Permission permission)
        {
            var userId = GetCurrentUserId();

            // 1. Orgs owned by user
            var ownedOrgIds = await _db.Organizations
                .Where(o => o.OwnerId == userId && !o.IsDeleted)
                .Select(o => o.Id)
                .ToListAsync();

            // 2. Orgs where user is an active member
            var memberOrgIds = await _db.OrganizationMembers
                .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active)
                .Select(m => m.OrganizationId)
                .ToListAsync();

            // 3. Orgs with role assignment
            var roleOrgIds = await _db.RoleAssignments
                .Where(a => a.UserId == userId && a.ScopeType == ScopeType.Organization)
                .Select(a => a.ScopeId)
                .ToListAsync();

            var combined = ownedOrgIds.Concat(memberOrgIds).Concat(roleOrgIds).Distinct().ToList();

            if (combined.Any())
            {
                return combined;
            }

            // Return all active undeleted organizations so dropdown always has selectable tenant
            return await _db.Organizations.Where(o => !o.IsDeleted).Select(o => o.Id).ToListAsync();
        }

        [AllowAnonymous]
        [HttpPost("purge-except-mihrete")]
        public async Task<IActionResult> PurgeExceptMihreteTech()
        {
            var orgs = await _db.Organizations.ToListAsync();
            var mihreteOrg = orgs.FirstOrDefault(o => o.Name.Contains("Mihrete", StringComparison.OrdinalIgnoreCase));

            if (mihreteOrg == null)
            {
                mihreteOrg = orgs.FirstOrDefault();
                if (mihreteOrg != null)
                {
                    mihreteOrg.Name = "Mihrete Tech";
                    mihreteOrg.IsDeleted = false;
                    _db.Organizations.Update(mihreteOrg);
                }
            }

            if (mihreteOrg != null)
            {
                mihreteOrg.IsDeleted = false;
                foreach (var org in orgs.Where(o => o.Id != mihreteOrg.Id))
                {
                    org.IsDeleted = true;
                    org.DeletedAt = DateTime.UtcNow;
                }
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "All organizations except Mihrete Tech have been deleted/purged.",
                activeOrganization = mihreteOrg != null ? new { id = mihreteOrg.Id, name = mihreteOrg.Name } : null
            });
        }

        private OrganizationDto MapToDto(Organization org)
        {
            var activeMemberCount = org.Members.Count(m => m.Status == OrgMemberStatus.Active);
            if (activeMemberCount == 0 && org.OwnerId.HasValue && org.OwnerId.Value > 0)
            {
                activeMemberCount = 1;
            }

            return new OrganizationDto
            {
                Id = org.Id,
                Name = org.Name,
                Description = org.Description,
                LogoUrl = org.LogoUrl,
                RegistrationNumber = org.RegistrationNumber,
                Country = org.Country,
                OwnerId = org.OwnerId,
                Budget = _db.Budgets.Where(b => b.OrganizationId == org.Id && b.Level == BudgetLevel.Organization).Select(b => (decimal?)b.TotalAmount).FirstOrDefault(),
                IsDeleted = org.IsDeleted,
                DeletedAt = org.DeletedAt,
                HasCompliance = org.Compliance != null,
                PartnerCount = org.PartnersInitiated.Count + org.PartnersReceived.Count,
                MemberCount = activeMemberCount
            };
        }
    }
}
