using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Models;
using OrbitApi.Services;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class OrganizationsController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly IEmailSender _emailSender;
        private readonly IConfiguration _configuration;

        public OrganizationsController(OrbitDbContext db, IAuthorizationService authorizationService, IEmailSender emailSender, IConfiguration configuration)
        {
            _db = db;
            _authorizationService = authorizationService;
            _emailSender = emailSender;
            _configuration = configuration;
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

        [HttpPost]
        public async Task<ActionResult<OrganizationDto>> Create([FromBody] CreateOrganizationRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
            {
                return BadRequest("Organization name is required.");
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
                Name = req.Name,
                Description = req.Description,
                LogoUrl = req.LogoUrl,
                RegistrationNumber = req.RegistrationNumber,
                Country = req.Country,
                OwnerId = currentUserId,
                Budget = req.Budget
            };

            _db.Organizations.Add(org);
            await _db.SaveChangesAsync();

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
                Entity = "Organization",
                Action = "Create",
                NewValues = $"{{ Name: '{org.Name}' }}",
                Timestamp = DateTime.UtcNow,
                PerformedByUserId = GetCurrentUserId()
            });

            await _db.SaveChangesAsync();
            return Ok(MapToDto(org));
        }

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
                Budget = org.Budget,
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

            detail.Members = org.Members.Select(m => new OrganizationMemberDto
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

            if (req.Name != null) org.Name = req.Name;
            if (req.Description != null) org.Description = req.Description;
            if (req.LogoUrl != null) org.LogoUrl = req.LogoUrl;
            if (req.RegistrationNumber != null) org.RegistrationNumber = req.RegistrationNumber;
            if (req.Country != null) org.Country = req.Country;
            if (req.Budget != null) org.Budget = req.Budget;

            await _db.SaveChangesAsync();
            return Ok(MapToDto(org));
        }

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
                Entity = "Organization",
                Action = "Delete",
                Timestamp = DateTime.UtcNow,
                PerformedByUserId = GetCurrentUserId()
            });

            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id}/restore")]
        public async Task<ActionResult> Restore(int id)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, id);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.OrganizationRestore))).Succeeded)
            {
                return Forbid();
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);
            if (org == null) return NotFound();

            org.IsDeleted = false;
            org.DeletedAt = null;
            org.DeletedByUserId = null;

            _db.AuditLogs.Add(new AuditLog
            {
                Entity = "Organization",
                Action = "Restore",
                Timestamp = DateTime.UtcNow,
                PerformedByUserId = GetCurrentUserId()
            });

            await _db.SaveChangesAsync();
            return Ok(MapToDto(org));
        }

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

            var token = Guid.NewGuid().ToString("N");
            var invite = new OrganizationInvitation
            {
                OrganizationId = id,
                Email = req.Email,
                PreAssignedRoleId = role.Id,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                Status = InvitationStatus.Pending,
                InvitedByUserId = GetCurrentUserId()
            };

            _db.OrganizationInvitations.Add(invite);
            await _db.SaveChangesAsync();

            var frontendUrl = _configuration["App:FrontendBaseUrl"] ?? "https://localhost:5173";
            var inviteLink = $"{frontendUrl}/org-invite/accept?token={token}";

            await _emailSender.SendEmailAsync(req.Email, $"You've been invited to {org.Name} on OrbitDesk",
                $"<p>You have been invited to join <strong>{org.Name}</strong> as a {req.PreAssignedRoleName}.</p><p><a href='{inviteLink}'>Click here to accept</a></p>");

            return Ok(new { invite.Id, invite.Token }); 
        }

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

        [HttpPost("invite/accept")]
        public async Task<ActionResult> AcceptInvitation([FromQuery] string token)
        {
            var invite = await _db.OrganizationInvitations.FirstOrDefaultAsync(i => i.Token == token);
            if (invite == null || invite.Status != InvitationStatus.Pending || invite.ExpiresAt < DateTime.UtcNow)
                return BadRequest("Invalid or expired invitation");

            invite.Status = InvitationStatus.Accepted;

            var userId = GetCurrentUserId();
            var existingMember = await _db.OrganizationMembers.FirstOrDefaultAsync(m => m.OrganizationId == invite.OrganizationId && m.UserId == userId);
            if (existingMember == null)
            {
                _db.OrganizationMembers.Add(new OrganizationMember
                {
                    OrganizationId = invite.OrganizationId,
                    UserId = userId,
                    RoleId = invite.PreAssignedRoleId,
                    Status = OrgMemberStatus.Active,
                    JoinedAt = DateTime.UtcNow
                });
            }
            else
            {
                existingMember.Status = OrgMemberStatus.Active;
            }

            await _db.SaveChangesAsync();
            return Ok();
        }

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
            await _db.SaveChangesAsync();

            var newOwner = await _db.Users.FindAsync(req.NewOwnerUserId);
            if (newOwner != null)
            {
                var frontendUrl = _configuration["App:FrontendBaseUrl"] ?? "https://localhost:5173";
                var confirmLink = $"{frontendUrl}/orgs/{id}/transfer-confirm?token={token}";
                await _emailSender.SendEmailAsync(newOwner.Email, $"Ownership Transfer: {org.Name}",
                    $"<p>You have been requested to take ownership of {org.Name}.</p><p><a href='{confirmLink}'>Click here to confirm</a></p>");
            }

            return Ok(new { transfer.Id, transfer.ConfirmationToken });
        }

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
            var assignments = await _db.RoleAssignments.Include(a => a.Role)
                .Where(a => a.UserId == userId && a.Role != null)
                .ToListAsync();

            var memberAssignments = await _db.OrganizationMembers.Include(m => m.Role)
                .Where(m => m.UserId == userId && m.Status == OrgMemberStatus.Active)
                .ToListAsync();

            var organizationIds = new List<int>();
            var workspaceIds = new List<int>();
            var projectIds = new List<int>();

            foreach (var assignment in assignments)
            {
                if (!RolePermissionMapping.Defaults.TryGetValue(assignment.Role!.Name, out var perms) || !perms.Contains(permission))
                    continue;

                switch (assignment.ScopeType)
                {
                    case ScopeType.Organization:
                        organizationIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Workspace:
                        workspaceIds.Add(assignment.ScopeId);
                        break;
                    case ScopeType.Project:
                        projectIds.Add(assignment.ScopeId);
                        break;
                }
            }

            foreach (var member in memberAssignments)
            {
                 if (member.Role != null && RolePermissionMapping.Defaults.TryGetValue(member.Role.Name, out var perms) && perms.Contains(permission))
                 {
                     organizationIds.Add(member.OrganizationId);
                 }
            }

            if (workspaceIds.Any())
            {
                var workspaceOrganizations = await _db.Workspaces
                    .Where(w => workspaceIds.Contains(w.Id))
                    .Select(w => w.OrganizationId)
                    .ToListAsync();
                organizationIds.AddRange(workspaceOrganizations);
            }

            if (projectIds.Any())
            {
                var projectOrganizations = await _db.Projects
                    .Where(p => projectIds.Contains(p.Id) && p.Workspace != null)
                    .Select(p => p.Workspace.OrganizationId)
                    .ToListAsync();
                organizationIds.AddRange(projectOrganizations);
            }

            return organizationIds.Distinct().ToList();
        }

        private OrganizationDto MapToDto(Organization org)
        {
            return new OrganizationDto
            {
                Id = org.Id,
                Name = org.Name,
                Description = org.Description,
                LogoUrl = org.LogoUrl,
                RegistrationNumber = org.RegistrationNumber,
                Country = org.Country,
                OwnerId = org.OwnerId,
                Budget = org.Budget,
                IsDeleted = org.IsDeleted,
                DeletedAt = org.DeletedAt,
                HasCompliance = org.Compliance != null,
                PartnerCount = org.PartnersInitiated.Count + org.PartnersReceived.Count,
                MemberCount = org.Members.Count(m => m.Status == OrgMemberStatus.Active)
            };
        }
    }
}
