using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;
using System.ComponentModel.DataAnnotations;

namespace OrbitApi.Controllers;

/// <summary>
/// API Controller for handling public contact submissions, demo inquiries, admin reviews, and SendGrid email responses.
/// </summary>
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class ContactController : ControllerBase
{
    private readonly OrbitDbContext _context;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _config;

    /// <summary>
    /// Initializes a new instance of <see cref="ContactController"/>.
    /// </summary>
    public ContactController(OrbitDbContext context, IEmailSender emailSender, IConfiguration config)
    {
        _context = context;
        _emailSender = emailSender;
        _config = config;
    }

    /// <summary>
    /// Data transfer object representing a public contact inquiry or demo request.
    /// </summary>
    public class CreateContactDto
    {
        /// <summary>Sender's full name.</summary>
        [Required, StringLength(100)]
        public string Name { get; set; } = string.Empty;
        
        /// <summary>Sender's contact email address.</summary>
        [Required, EmailAddress, StringLength(150)]
        public string Email { get; set; } = string.Empty;
        
        /// <summary>Inquiry subject or topic.</summary>
        [StringLength(200)]
        public string Subject { get; set; } = string.Empty;
        
        /// <summary>Detailed message body.</summary>
        [Required, StringLength(2000)]
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>
    /// Public submission endpoint for contact and demo request inquiries.
    /// Saves inquiry to database and dispatches admin alert and sender confirmation emails via SendGrid.
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitInquiry([FromBody] CreateContactDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Message))
        {
            return BadRequest(new { message = "Name, email, and message are required." });
        }

        var inquiry = new ContactInquiry
        {
            Name = dto.Name.Trim(),
            Email = dto.Email.Trim(),
            Subject = string.IsNullOrWhiteSpace(dto.Subject) ? "General Inquiry" : dto.Subject.Trim(),
            Message = dto.Message.Trim(),
            CreatedAt = DateTime.UtcNow,
            IsResolved = false
        };

        try
        {
            _context.ContactInquiries.Add(inquiry);
            await _context.SaveChangesAsync();
        }
        catch (Exception dbEx)
        {
            Console.WriteLine($"[ContactController] DB Save failed: {dbEx.Message}");
            return StatusCode(500, new { message = "Failed to save inquiry to database due to an internal error." });
        }

        // Asynchronously attempt to send email notifications via SendGrid
        try
        {
            var adminEmail = _config["SendGrid:FromEmail"] ?? _config["AdminEmail"] ?? "support@orbitdesk.org";

            // 1. Admin Alert Email
            var adminSubject = $"[Orbit Inquiry #{inquiry.Id}] {inquiry.Subject} from {inquiry.Name}";
            var adminBody = $@"
                <h2>New Contact Inquiry Received</h2>
                <p><b>Inquiry ID:</b> #{inquiry.Id}</p>
                <p><b>Name:</b> {inquiry.Name}</p>
                <p><b>Sender Email:</b> {inquiry.Email}</p>
                <p><b>Topic:</b> {inquiry.Subject}</p>
                <p><b>Submitted At:</b> {inquiry.CreatedAt:yyyy-MM-dd HH:mm:ss} UTC</p>
                <hr />
                <h3>Message Details:</h3>
                <blockquote style='background:#f9f9f9; padding:12px; border-left:4px solid #6366f1;'>
                    {inquiry.Message}
                </blockquote>
            ";

            await _emailSender.SendEmailAsync(adminEmail, adminSubject, adminBody);

            // 2. Automated User Confirmation Email
            var userSubject = $"We received your message - Orbit Platform";
            var userBody = $@"
                <p>Dear {inquiry.Name},</p>
                <p>Thank you for contacting <b>Orbit Platform</b>.</p>
                <p>We have received your inquiry regarding <b>{inquiry.Subject}</b>. Our solutions engineering team will review your message and reach out to you at <b>{inquiry.Email}</b> shortly.</p>
                <br />
                <p>Best regards,<br /><b>Orbit Enterprise Team</b></p>
            ";

            await _emailSender.SendEmailAsync(inquiry.Email, userSubject, userBody);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ContactController] Email delivery notice: {ex.Message}");
        }

        return Ok(new
        {
            success = true,
            message = "Your inquiry has been logged successfully and our team has been notified.",
            inquiryId = inquiry.Id
        });
    }

    /// <summary>
    /// Admin endpoint to fetch list of all contact inquiries.
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetInquiries([FromQuery] bool? resolved)
    {
        var query = _context.ContactInquiries.AsQueryable();

        if (resolved.HasValue)
        {
            query = query.Where(i => i.IsResolved == resolved.Value);
        }

        var list = await query.OrderByDescending(i => i.CreatedAt).ToListAsync();
        return Ok(list);
    }

    /// <summary>
    /// Admin endpoint to mark an inquiry as resolved.
    /// </summary>
    [HttpPut("{id}/resolve")]
    [Authorize]
    public async Task<IActionResult> ResolveInquiry(int id, [FromBody] ResolveDto dto)
    {
        var item = await _context.ContactInquiries.FindAsync(id);
        if (item == null) return NotFound(new { message = "Inquiry not found." });

        item.IsResolved = true;
        item.AdminNotes = dto?.AdminNotes ?? "Marked resolved by administrator.";
        await _context.SaveChangesAsync();

        return Ok(item);
    }

    public class ResolveDto
    {
        [StringLength(1000)]
        public string? AdminNotes { get; set; }
    }

    public class SendReplyDto
    {
        [Required, StringLength(3000)]
        public string ReplyMessage { get; set; } = string.Empty;
    }

    /// <summary>
    /// Admin endpoint to send an official direct email response to a contact inquiry via SendGrid.
    /// </summary>
    [HttpPost("{id}/reply")]
    [Authorize]
    public async Task<IActionResult> ReplyInquiry(int id, [FromBody] SendReplyDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ReplyMessage))
        {
            return BadRequest(new { message = "Reply message cannot be empty." });
        }

        var inquiry = await _context.ContactInquiries.FindAsync(id);
        if (inquiry == null) return NotFound(new { message = "Inquiry not found." });

        var adminUserName = User.Identity?.Name ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "Orbit Admin";

        inquiry.ReplyMessage = dto.ReplyMessage.Trim();
        inquiry.RepliedAt = DateTime.UtcNow;
        inquiry.RepliedByUserName = adminUserName;
        inquiry.IsResolved = true;

        await _context.SaveChangesAsync();

        // Dispatch direct email response to sender via SendGrid
        try
        {
            var replySubject = $"Re: [Orbit Inquiry #{inquiry.Id}] {inquiry.Subject}";
            var replyBody = $@"
                <div style='font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6;'>
                    <div style='background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 20px; text-align: center; border-radius: 12px 12px 0 0;'>
                        <h2 style='color: #ffffff; margin: 0; font-size: 20px;'>Orbit Platform Response</h2>
                    </div>
                    <div style='padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background-color: #ffffff;'>
                        <p>Dear <b>{inquiry.Name}</b>,</p>
                        <p>Thank you for reaching out to us. Below is our official response regarding your inquiry on <b>{inquiry.Subject}</b>:</p>
                        
                        <div style='background: #f8fafc; padding: 16px; border-left: 4px solid #6366f1; border-radius: 6px; margin: 16px 0; font-size: 14px; color: #334155;'>
                            {inquiry.ReplyMessage.Replace("\n", "<br/>")}
                        </div>

                        <hr style='border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;' />
                        
                        <div style='background: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 12px; color: #64748b;'>
                            <p style='margin: 0; font-weight: bold;'>Your Original Inquiry (#{inquiry.Id}):</p>
                            <p style='margin: 4px 0 0 0; font-style: italic;'>""{inquiry.Message}""</p>
                        </div>
                        
                        <br />
                        <p style='margin: 0; font-size: 13px; color: #475569;'>Best regards,<br/><b>{adminUserName}</b><br/>Orbit Solutions Engineering Team</p>
                    </div>
                </div>
            ";

            await _emailSender.SendEmailAsync(inquiry.Email, replySubject, replyBody);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ContactController] Reply email delivery notice: {ex.Message}");
            return StatusCode(500, new { message = $"Response recorded, but email delivery via SendGrid failed: {ex.Message}" });
        }

        return Ok(new
        {
            success = true,
            message = $"Official email reply sent successfully to {inquiry.Email}.",
            inquiry
        });
    }
}
