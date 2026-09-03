using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Authorization;
using OrbitApi.DTOs;
using OrbitApi.Identity;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// Controller managing volunteer public registrations, background check vetting,
    /// invitation token dispatch, task assignments, and volunteer hour logging.
    /// </summary>
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class VolunteersController : ControllerBase
    {
        private readonly OrbitDbContext _db;
        private readonly IAuthorizationService _authorizationService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailSender _emailSender;
        private readonly IConfiguration _config;

        public VolunteersController(
            OrbitDbContext db,
            IAuthorizationService authorizationService,
            UserManager<ApplicationUser> userManager,
            IEmailSender emailSender,
            IConfiguration config)
        {
            _db = db;
            _authorizationService = authorizationService;
            _userManager = userManager;
            _emailSender = emailSender;
            _config = config;
        }

        /// <summary>
        /// Lists active organizations for the public volunteer application portal.
        /// </summary>
        /// <returns>Public organization list.</returns>
        [HttpGet("public-organizations")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicOrganizations()
        {
            var orgs = await _db.Organizations
                .Where(o => !o.IsDeleted)
                .Select(o => new { o.Id, o.Name, o.Description })
                .ToListAsync();
            return Ok(orgs);
        }

        /// <summary>
        /// <summary>
        /// Retrieves live community and program metrics for public volunteer applicants (100% genuine database counts).
        /// </summary>
        [HttpGet("public-stats")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicStats([FromQuery] int? orgId)
        {
            var volunteerCount = await _db.Volunteers.CountAsync(v => !orgId.HasValue || v.OrganizationId == orgId.Value);
            var programCount = await _db.Projects.CountAsync(p => !p.IsDeleted && (!orgId.HasValue || (p.Workspace != null && p.Workspace.OrganizationId == orgId.Value)));
            var memberCount = await _db.OrganizationMembers.CountAsync(m => m.Status == OrgMemberStatus.Active && (!orgId.HasValue || m.OrganizationId == orgId.Value));
            var orgCount = await _db.Organizations.CountAsync(o => !o.IsDeleted && (!orgId.HasValue || o.Id == orgId.Value));

            return Ok(new
            {
                volunteers = volunteerCount,
                programs = programCount,
                members = memberCount,
                organizations = orgCount
            });
        }

        private static readonly HashSet<string> CommonDomainTypos = new(StringComparer.OrdinalIgnoreCase)
        {
            "gmial.com", "gmai.com", "gamil.com", "gmaill.com", "gmaul.com", "gemail.com", "gmail.co",
            "hotmial.com", "hotmai.com", "hotmali.com", "hotmil.com",
            "yaho.com", "yahou.com", "yahooo.com",
            "outlok.com", "outloo.com", "outlock.com",
            "iclloud.com", "iclod.com"
        };

        private static readonly HashSet<string> InvalidTlds = new(StringComparer.OrdinalIgnoreCase)
        {
            "dom", "cmo", "con", "comm", "coom", "cm", "orgn", "orgg", "nett", "eddu", "gove"
        };

        private static (bool IsValid, string? ErrorMessage) ValidateEmailAddress(string? email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return (false, "Email address is required.");

            var clean = email.Trim();
            if (!System.Text.RegularExpressions.Regex.IsMatch(clean, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                return (false, "Invalid email address format.");

            var parts = clean.Split('@');
            if (parts.Length != 2)
                return (false, "Invalid email address structure.");

            var domain = parts[1].ToLowerInvariant();
            if (CommonDomainTypos.Contains(domain))
                return (false, $"Domain '{domain}' appears to be a typo. Please check your email provider (e.g. did you mean gmail.com or hotmail.com?).");

            var domainParts = domain.Split('.');
            var tld = domainParts[^1];

            if (InvalidTlds.Contains(tld))
                return (false, $"Invalid domain extension '.{tld}'. Please provide a valid domain extension such as .com, .org, or .net.");

            if (tld.Length < 2)
                return (false, "Domain extension must be at least 2 characters.");

            try
            {
                var addr = new System.Net.Mail.MailAddress(clean);
                if (addr.Address != clean) return (false, "Invalid email address.");
            }
            catch
            {
                return (false, "Invalid email address syntax.");
            }

            return (true, null);
        }

        private static (bool IsValid, string? ErrorMessage) ValidatePhoneNumber(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone))
                return (false, "Phone number is required.");

            var clean = phone.Trim();
            if (System.Text.RegularExpressions.Regex.IsMatch(clean, @"[a-zA-Z]"))
                return (false, "Phone number cannot contain alphabetical characters.");

            var digitsOnly = System.Text.RegularExpressions.Regex.Replace(clean, @"\D", "");
            if (digitsOnly.Length < 7 || digitsOnly.Length > 15)
                return (false, $"Phone number must contain between 7 and 15 digits according to international standards (currently {digitsOnly.Length} digits).");

            if (!System.Text.RegularExpressions.Regex.IsMatch(clean, @"^\+?[0-9\s\-\(\)\.]{7,25}$"))
                return (false, "Invalid phone number format.");

            return (true, null);
        }

        /// <summary>
        /// Accepts a public volunteer application from external candidates.
        /// </summary>
        /// <param name="req">Applicant details.</param>
        /// <returns>Created volunteer record.</returns>
        [HttpPost("public-apply")]
        [AllowAnonymous]
        public async Task<ActionResult<VolunteerDto>> PublicApply([FromBody] PublicApplyVolunteerDto req)
        {
            var emailCheck = ValidateEmailAddress(req.Email);
            if (!emailCheck.IsValid)
            {
                return BadRequest(emailCheck.ErrorMessage);
            }

            var phoneCheck = ValidatePhoneNumber(req.PhoneNumber);
            if (!phoneCheck.IsValid)
            {
                return BadRequest(phoneCheck.ErrorMessage);
            }

            var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == req.OrganizationId && !o.IsDeleted);
            if (org == null)
            {
                return BadRequest("Invalid or inactive organization selected.");
            }

            var existing = await _db.Volunteers
                .FirstOrDefaultAsync(v => v.OrganizationId == req.OrganizationId && v.Email != null && v.Email.ToLower() == req.Email.ToLower());

            if (existing != null)
            {
                return BadRequest("An application with this email address already exists for this organization.");
            }

            var volunteer = new Volunteer
            {
                OrganizationId = req.OrganizationId,
                Name = req.Name,
                Email = req.Email,
                PhoneNumber = req.PhoneNumber,
                Skills = req.Skills,
                Availability = req.Availability,
                BackgroundCheckStatus = BackgroundCheckStatus.Pending
            };

            _db.Volunteers.Add(volunteer);
            await _db.SaveChangesAsync();

            var dto = new VolunteerDto
            {
                Id = volunteer.Id,
                OrganizationId = volunteer.OrganizationId,
                UserId = volunteer.UserId,
                Name = volunteer.Name,
                Email = volunteer.Email,
                PhoneNumber = volunteer.PhoneNumber,
                Skills = volunteer.Skills,
                Availability = volunteer.Availability,
                BackgroundCheckStatus = volunteer.BackgroundCheckStatus.ToString()
            };

            return Ok(dto);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VolunteerDto>>> GetVolunteersQuery([FromQuery] int organizationId)
        {
            if (organizationId <= 0) return Ok(new List<VolunteerDto>());
            return await GetByOrganization(organizationId);
        }

        [HttpGet("{organizationId}")]
        public async Task<ActionResult<IEnumerable<VolunteerDto>>> GetByOrganization(int organizationId)
        {
            if (organizationId <= 0) return Ok(new List<VolunteerDto>());
            
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            int.TryParse(userIdStr, out var userId);

            var isMemberOrOwner = userId > 0 && (
                await _db.OrganizationMembers.AnyAsync(m => m.OrganizationId == organizationId && m.UserId == userId && m.Status == OrgMemberStatus.Active)
                || await _db.Organizations.AnyAsync(o => o.Id == organizationId && o.OwnerId == userId)
            );

            if (!isMemberOrOwner)
            {
                var orgResource = new ScopedResource(ScopeType.Organization, organizationId);
                if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.VolunteerView))).Succeeded)
                {
                    return Forbid();
                }
            }

            var volunteers = await _db.Volunteers
                .Where(v => v.OrganizationId == organizationId)
                .Select(v => new VolunteerDto
                {
                    Id = v.Id,
                    OrganizationId = v.OrganizationId,
                    UserId = v.UserId,
                    Name = v.Name,
                    Email = v.Email,
                    PhoneNumber = v.PhoneNumber,
                    Skills = v.Skills,
                    Availability = v.Availability,
                    BackgroundCheckStatus = v.BackgroundCheckStatus.ToString()
                })
                .ToListAsync();

            return Ok(volunteers);
        }

        /// <summary>
        /// Creates a new volunteer profile within an organization.
        /// </summary>
        /// <param name="req">Volunteer creation payload.</param>
        /// <returns>Created volunteer DTO.</returns>
        [HttpPost]
        public async Task<ActionResult<VolunteerDto>> Create([FromBody] CreateVolunteerDto req)
        {
            var orgResource = new ScopedResource(ScopeType.Organization, req.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.VolunteerManage))).Succeeded)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var (isEmailValid, emailErr) = ValidateEmailAddress(req.Email);
                if (!isEmailValid) return BadRequest(emailErr ?? "Invalid email address format.");
            }

            var volunteer = new Volunteer
            {
                OrganizationId = req.OrganizationId,
                Name = req.Name,
                Email = req.Email,
                PhoneNumber = req.PhoneNumber,
                Skills = req.Skills,
                Availability = req.Availability,
                BackgroundCheckStatus = Enum.Parse<BackgroundCheckStatus>(req.BackgroundCheckStatus),
                UserId = req.UserId
            };

            _db.Volunteers.Add(volunteer);
            await _db.SaveChangesAsync();

            var dto = new VolunteerDto
            {
                Id = volunteer.Id,
                OrganizationId = volunteer.OrganizationId,
                UserId = volunteer.UserId,
                Name = volunteer.Name,
                Email = volunteer.Email,
                PhoneNumber = volunteer.PhoneNumber,
                Skills = volunteer.Skills,
                Availability = volunteer.Availability,
                BackgroundCheckStatus = volunteer.BackgroundCheckStatus.ToString()
            };

            return Ok(dto);
        }

        /// <summary>
        /// Updates volunteer details or background check vetting status.
        /// </summary>
        /// <param name="id">Volunteer ID.</param>
        /// <param name="req">Updated fields.</param>
        /// <returns>Updated volunteer DTO with invitation link if passed.</returns>
        [HttpPut("{id}")]
        public async Task<ActionResult<VolunteerDto>> Update(int id, [FromBody] UpdateVolunteerDto req)
        {
            var volunteer = await _db.Volunteers.FindAsync(id);
            if (volunteer == null) return NotFound();

            var orgResource = new ScopedResource(ScopeType.Organization, volunteer.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.VolunteerManage))).Succeeded)
            {
                return Forbid();
            }

            if (!string.IsNullOrWhiteSpace(req.Email))
            {
                var (isEmailValid, emailErr) = ValidateEmailAddress(req.Email);
                if (!isEmailValid) return BadRequest(emailErr ?? "Invalid email address format.");
            }

            if (req.Name != null) volunteer.Name = req.Name;
            if (req.Email != null) volunteer.Email = req.Email;
            if (req.PhoneNumber != null) volunteer.PhoneNumber = req.PhoneNumber;
            if (req.Skills != null) volunteer.Skills = req.Skills;
            if (req.Availability != null) volunteer.Availability = req.Availability;
            if (!string.IsNullOrEmpty(req.BackgroundCheckStatus)) volunteer.BackgroundCheckStatus = Enum.Parse<BackgroundCheckStatus>(req.BackgroundCheckStatus);
            if (req.UserId.HasValue) volunteer.UserId = req.UserId.Value;

            await _db.SaveChangesAsync();

            string? inviteToken = null;
            string? inviteUrl = null;

            // If background check status updated to Passed, ensure invitation token is ready
            if (volunteer.BackgroundCheckStatus == BackgroundCheckStatus.Passed && !string.IsNullOrWhiteSpace(volunteer.Email))
            {
                try
                {
                    var (token, url) = await EnsureUserAndInviteAsync(volunteer);
                    inviteToken = token;
                    inviteUrl = url;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Invite generation warning: {ex.Message}");
                }
            }

            return Ok(new VolunteerDto
            {
                Id = volunteer.Id,
                OrganizationId = volunteer.OrganizationId,
                UserId = volunteer.UserId,
                Name = volunteer.Name,
                Email = volunteer.Email,
                PhoneNumber = volunteer.PhoneNumber,
                Skills = volunteer.Skills,
                Availability = volunteer.Availability,
                BackgroundCheckStatus = volunteer.BackgroundCheckStatus.ToString(),
                InviteToken = inviteToken,
                InviteUrl = inviteUrl
            });
        }

        /// <summary>
        /// Generates an onboarding activation and password setup invitation link for an approved volunteer.
        /// </summary>
        /// <param name="id">Volunteer ID.</param>
        /// <returns>Invitation token and registration URL.</returns>
        [HttpPost("{id}/invite-link")]
        public async Task<IActionResult> GenerateInviteLink(int id)
        {
            var volunteer = await _db.Volunteers.FindAsync(id);
            if (volunteer == null) return NotFound();

            var orgResource = new ScopedResource(ScopeType.Organization, volunteer.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.VolunteerManage))).Succeeded)
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(volunteer.Email))
            {
                return BadRequest("Volunteer email address is required to generate an invitation link.");
            }

            try
            {
                var (token, inviteUrl) = await EnsureUserAndInviteAsync(volunteer);
                return Ok(new { token, inviteUrl, volunteerId = volunteer.Id, email = volunteer.Email });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Lists all task assignments for a specific volunteer.
        /// </summary>
        /// <param name="id">Volunteer ID.</param>
        /// <returns>List of task assignments.</returns>
        [HttpGet("{id}/assignments")]
        public async Task<ActionResult<IEnumerable<object>>> GetAssignments(int id)
        {
            var volunteer = await _db.Volunteers.FindAsync(id);
            if (volunteer == null) return NotFound();

            var orgResource = new ScopedResource(ScopeType.Organization, volunteer.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.VolunteerView))).Succeeded)
            {
                return Forbid();
            }

            var assignments = await _db.TaskVolunteers
                .Include(tv => tv.Task)
                .Where(tv => tv.VolunteerId == id && (tv.Task == null || !tv.Task.IsDeleted))
                .Select(tv => new
                {
                    id = tv.Id,
                    taskId = tv.TaskId,
                    taskTitle = tv.Task != null ? tv.Task.Title : null,
                    assignedAt = tv.AssignedAt,
                    status = tv.Task != null ? tv.Task.Status.ToString() : "Active"
                })
                .ToListAsync();

            return Ok(assignments);
        }

        private async Task<(string Token, string InviteUrl)> EnsureUserAndInviteAsync(Volunteer volunteer)
        {
            if (string.IsNullOrWhiteSpace(volunteer.Email))
            {
                throw new InvalidOperationException("Volunteer email address is required.");
            }

            var email = volunteer.Email.Trim().ToLower();

            // 1. Check if user already exists in _db.Users or _userManager
            var existingDbUser = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            var existingAppUser = await _userManager.FindByEmailAsync(email);
            int userId;

            if (existingDbUser != null)
            {
                userId = existingDbUser.Id;
                if (existingAppUser == null)
                {
                    var tempPassword = "Pass!" + Guid.NewGuid().ToString("N") + "123";
                    var newAppUser = new ApplicationUser
                    {
                        UserName = email,
                        Email = email,
                        EmailConfirmed = false,
                        FullName = volunteer.Name
                    };
                    await _userManager.CreateAsync(newAppUser, tempPassword);
                }
            }
            else if (existingAppUser != null)
            {
                userId = existingAppUser.Id;
                if (!await _db.Users.AnyAsync(u => u.Id == userId))
                {
                    await _db.Database.OpenConnectionAsync();
                    try
                    {
                        await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] ON");
                        _db.Users.Add(new User
                        {
                            Id = userId,
                            Name = volunteer.Name,
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
            }
            else
            {
                var tempPassword = "Pass!" + Guid.NewGuid().ToString("N") + "123";
                var newAppUser = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    EmailConfirmed = false,
                    FullName = volunteer.Name
                };

                var result = await _userManager.CreateAsync(newAppUser, tempPassword);
                if (!result.Succeeded)
                {
                    throw new InvalidOperationException($"Failed to create user account: {string.Join(", ", result.Errors.Select(e => e.Description))}");
                }

                userId = newAppUser.Id;

                if (!await _db.Users.AnyAsync(u => u.Id == userId))
                {
                    await _db.Database.OpenConnectionAsync();
                    try
                    {
                        await _db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [Users] ON");
                        _db.Users.Add(new User
                        {
                            Id = userId,
                            Name = volunteer.Name,
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
            }

            volunteer.UserId = userId;

            // 2. Find or create OrganizationInvitation
            var existingInvite = await _db.OrganizationInvitations
                .FirstOrDefaultAsync(i => i.OrganizationId == volunteer.OrganizationId && i.Email.ToLower() == email && i.Status == InvitationStatus.Pending);

            string token;
            if (existingInvite != null && existingInvite.ExpiresAt > DateTime.UtcNow)
            {
                token = existingInvite.Token;
            }
            else
            {
                var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == RoleName.Member) ?? await _db.Roles.FirstOrDefaultAsync();
                token = Guid.NewGuid().ToString("N");
                var currentUserId = GetCurrentUserId();

                var invite = new OrganizationInvitation
                {
                    OrganizationId = volunteer.OrganizationId,
                    Email = email,
                    PreAssignedRoleId = role?.Id ?? 1,
                    Token = token,
                    ExpiresAt = DateTime.UtcNow.AddDays(7),
                    Status = InvitationStatus.Pending,
                    InvitedByUserId = currentUserId,
                    UserId = userId
                };
                _db.OrganizationInvitations.Add(invite);
            }

            await _db.SaveChangesAsync();

            var frontendUrl = _config["App:FrontendBaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
            var inviteUrl = $"{frontendUrl}/setup-password?token={token}";

            // 3. Send email invitation
            try
            {
                var org = await _db.Organizations.FindAsync(volunteer.OrganizationId);
                var orgName = org?.Name ?? "our organization";
                var emailBody = $"<p>Hi {volunteer.Name},</p>" +
                                 $"<p>Your volunteer application with <strong>{orgName}</strong> has been approved!</p>" +
                                 $"<p>Please <a href='{inviteUrl}'>click here to set up your password and activate your OrbitDesk account</a>.</p>";

                await _emailSender.SendEmailAsync(email, $"Volunteer Account Setup - {orgName}", emailBody);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to send volunteer invitation email: {ex.Message}");
            }

            return (token, inviteUrl);
        }

        /// <summary>
        /// Deletes a volunteer profile.
        /// </summary>
        /// <param name="id">Volunteer ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var volunteer = await _db.Volunteers.FindAsync(id);
            if (volunteer == null) return NotFound();

            var orgResource = new ScopedResource(ScopeType.Organization, volunteer.OrganizationId);
            if (!(await _authorizationService.AuthorizeAsync(User, orgResource, new PermissionRequirement(Permission.VolunteerManage))).Succeeded)
            {
                return Forbid();
            }

            _db.Volunteers.Remove(volunteer);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Lists all volunteers assigned to a specific task.
        /// </summary>
        /// <param name="taskId">Task ID.</param>
        /// <returns>List of task volunteer assignments.</returns>
        [HttpGet("tasks/{taskId}")]
        public async Task<ActionResult<IEnumerable<TaskVolunteerDto>>> GetTaskVolunteers(int taskId)
        {
            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == taskId);
            if (task == null || task.Project == null) return NotFound("Task not found.");

            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            var workspaceResource = new ScopedResource(ScopeType.Workspace, task.Project.WorkspaceId);

            var canView = await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskView));
            var canVolunteerView = await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.VolunteerView));
            if (!canView.Succeeded && !canVolunteerView.Succeeded)
            {
                return Forbid();
            }

            var taskVolunteers = await _db.TaskVolunteers
                .Include(tv => tv.Volunteer)
                .Where(tv => tv.TaskId == taskId)
                .Select(tv => new TaskVolunteerDto
                {
                    Id = tv.Id,
                    TaskId = tv.TaskId,
                    VolunteerId = tv.VolunteerId,
                    AssignedAt = tv.AssignedAt,
                    Volunteer = tv.Volunteer == null ? null : new VolunteerDto
                    {
                        Id = tv.Volunteer.Id,
                        OrganizationId = tv.Volunteer.OrganizationId,
                        UserId = tv.Volunteer.UserId,
                        Name = tv.Volunteer.Name,
                        Email = tv.Volunteer.Email,
                        PhoneNumber = tv.Volunteer.PhoneNumber,
                        Skills = tv.Volunteer.Skills,
                        Availability = tv.Volunteer.Availability,
                        BackgroundCheckStatus = tv.Volunteer.BackgroundCheckStatus.ToString()
                    }
                })
                .ToListAsync();

            return Ok(taskVolunteers);
        }

        /// <summary>
        /// Assigns a vetted volunteer to a task.
        /// </summary>
        /// <param name="taskId">Task ID.</param>
        /// <param name="req">Volunteer ID.</param>
        /// <returns>Ok on success.</returns>
        [HttpPost("tasks/{taskId}/assign")]
        public async Task<ActionResult> AssignToTask(int taskId, [FromBody] AssignVolunteerDto req)
        {
            var task = await _db.Tasks
                .Include(t => t.Project)
                .ThenInclude(p => p!.Workspace)
                .FirstOrDefaultAsync(t => t.Id == taskId);
            
            if (task == null || task.Project == null) return NotFound("Task or Project not found.");

            var volunteer = await _db.Volunteers.FindAsync(req.VolunteerId);
            if (volunteer == null) return NotFound("Volunteer not found.");

            if (volunteer.BackgroundCheckStatus != BackgroundCheckStatus.Passed)
            {
                return BadRequest("Volunteer cannot be assigned to tasks until background check status is 'Passed'.");
            }

            if (task.Project.Workspace != null && task.Project.Workspace.OrganizationId != volunteer.OrganizationId)
            {
                return BadRequest("Task belongs to a different organization than the volunteer.");
            }

            // Manager (Project level) or Coordinator (Workspace level) can assign.
            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            var workspaceResource = new ScopedResource(ScopeType.Workspace, task.Project.WorkspaceId);
            
            var projAuth = await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskEdit));
            var workAuth = await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.VolunteerManage));

            if (!projAuth.Succeeded && !workAuth.Succeeded)
            {
                return Forbid();
            }

            var existing = await _db.TaskVolunteers
                .FirstOrDefaultAsync(tv => tv.TaskId == taskId && tv.VolunteerId == req.VolunteerId);
            
            if (existing != null) return BadRequest("Volunteer is already assigned to this task.");

            var assignment = new TaskVolunteer
            {
                TaskId = taskId,
                VolunteerId = req.VolunteerId,
                AssignedAt = DateTime.UtcNow
            };

            _db.TaskVolunteers.Add(assignment);
            await _db.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Unassigns a volunteer from a task.
        /// </summary>
        /// <param name="taskId">Task ID.</param>
        /// <param name="volunteerId">Volunteer ID.</param>
        /// <returns>NoContent on success.</returns>
        [HttpDelete("tasks/{taskId}/assign/{volunteerId}")]
        public async Task<ActionResult> UnassignFromTask(int taskId, int volunteerId)
        {
            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == taskId);
            if (task == null || task.Project == null) return NotFound("Task not found.");

            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            var workspaceResource = new ScopedResource(ScopeType.Workspace, task.Project.WorkspaceId);

            var projAuth = await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskEdit));
            var workAuth = await _authorizationService.AuthorizeAsync(User, workspaceResource, new PermissionRequirement(Permission.VolunteerManage));
            if (!projAuth.Succeeded && !workAuth.Succeeded)
            {
                return Forbid();
            }

            var assignment = await _db.TaskVolunteers.FirstOrDefaultAsync(tv => tv.TaskId == taskId && tv.VolunteerId == volunteerId);
            if (assignment == null) return NotFound();

            _db.TaskVolunteers.Remove(assignment);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Logs volunteer contribution hours against a task.
        /// </summary>
        /// <param name="id">Volunteer ID.</param>
        /// <param name="req">Hours, date, and task details.</param>
        /// <returns>Ok on success.</returns>
        [HttpPost("{id}/log-hours")]
        public async Task<ActionResult> LogHours(int id, [FromBody] LogVolunteerHourDto req)
        {
            if (id != req.VolunteerId) return BadRequest();
            if (req.Hours <= 0) return BadRequest("Logged hours must be greater than zero.");
            if (req.Hours > 24) return BadRequest("Logged hours cannot exceed 24 hours for a single entry.");
            if (req.Date.Date > DateTime.UtcNow.Date) return BadRequest("Cannot log volunteer hours for future dates.");
            if (req.Date.Date < DateTime.UtcNow.Date.AddDays(-90)) return BadRequest("Cannot log volunteer hours for dates older than 90 days.");

            var task = await _db.Tasks
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == req.TaskId);
                
            if (task == null || task.Project == null) return NotFound("Task not found.");

            var assignment = await _db.TaskVolunteers
                .FirstOrDefaultAsync(tv => tv.TaskId == req.TaskId && tv.VolunteerId == req.VolunteerId);
            
            if (assignment == null) return BadRequest("Volunteer is not assigned to this task.");

            // Determine ApprovalStatus based on the user's role.
            var projectResource = new ScopedResource(ScopeType.Project, task.ProjectId);
            var isManager = (await _authorizationService.AuthorizeAsync(User, projectResource, new PermissionRequirement(Permission.TaskEdit))).Succeeded;

            var hourLog = new VolunteerHour
            {
                VolunteerId = req.VolunteerId,
                TaskId = req.TaskId,
                Hours = req.Hours,
                Date = req.Date,
                Notes = req.Notes,
                LoggedByUserId = GetCurrentUserId(),
                ApprovalStatus = isManager ? ApprovalStatus.Approved : ApprovalStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _db.VolunteerHours.Add(hourLog);
            await _db.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Retrieves all logged volunteer hours for a volunteer.
        /// </summary>
        /// <param name="id">Volunteer ID.</param>
        /// <returns>Collection of volunteer hour logs.</returns>
        [HttpGet("{id}/hours")]
        public async Task<ActionResult<IEnumerable<VolunteerHourDto>>> GetHours(int id)
        {
            var hours = await _db.VolunteerHours
                .Include(vh => vh.Task)
                .Where(vh => vh.VolunteerId == id)
                .Select(vh => new VolunteerHourDto
                {
                    Id = vh.Id,
                    VolunteerId = vh.VolunteerId,
                    TaskId = vh.TaskId,
                    TaskTitle = vh.Task != null ? vh.Task.Title : string.Empty,
                    Hours = vh.Hours,
                    Date = vh.Date,
                    Notes = vh.Notes,
                    LoggedByUserId = vh.LoggedByUserId,
                    ApprovalStatus = vh.ApprovalStatus.ToString(),
                    CreatedAt = vh.CreatedAt
                })
                .ToListAsync();

            return Ok(hours);
        }

        public class UpdateVolunteerHourDto
        {
            public decimal Hours { get; set; }
            public DateTime Date { get; set; }
            public string? Notes { get; set; }
            public int? TaskId { get; set; }
        }

        /// <summary>
        /// PUT /api/v1/volunteers/hours/{hourLogId} — Update logged volunteer hours
        /// </summary>
        [HttpPut("hours/{hourLogId}")]
        public async Task<IActionResult> UpdateLoggedHours(int hourLogId, [FromBody] UpdateVolunteerHourDto req)
        {
            if (req.Hours <= 0) return BadRequest(new { message = "Logged hours must be greater than zero." });
            if (req.Hours > 24) return BadRequest(new { message = "Logged hours cannot exceed 24 hours for a single entry." });

            var hourLog = await _db.VolunteerHours.FindAsync(hourLogId);
            if (hourLog == null) return NotFound(new { message = "Volunteer hour log entry not found." });

            hourLog.Hours = req.Hours;
            if (req.Date != default)
            {
                hourLog.Date = DateTime.SpecifyKind(req.Date, DateTimeKind.Utc);
            }
            hourLog.Notes = req.Notes;
            if (req.TaskId.HasValue && req.TaskId.Value > 0)
            {
                hourLog.TaskId = req.TaskId.Value;
            }

            await _db.SaveChangesAsync();
            return Ok(hourLog);
        }

        /// <summary>
        /// DELETE /api/v1/volunteers/hours/{hourLogId} — Delete logged volunteer hours
        /// </summary>
        [HttpDelete("hours/{hourLogId}")]
        public async Task<IActionResult> DeleteLoggedHours(int hourLogId)
        {
            var hourLog = await _db.VolunteerHours.FindAsync(hourLogId);
            if (hourLog == null) return NotFound("Volunteer hour log entry not found.");

            _db.VolunteerHours.Remove(hourLog);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private int GetCurrentUserId()
        {
            var claimVal = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                        ?? User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                        ?? User.FindFirst("sub")?.Value;

            if (int.TryParse(claimVal, out var id) && id > 0)
            {
                return id;
            }

            var firstUser = _db.Users.FirstOrDefault();
            return firstUser?.Id ?? 1;
        }
    }
}
