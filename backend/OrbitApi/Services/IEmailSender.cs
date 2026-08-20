using System.Threading.Tasks;

namespace OrbitApi.Services;

/// <summary>
/// Service contract for dispatching transactional and notification emails.
/// </summary>
public interface IEmailSender
{
    /// <summary>
    /// Delivers an HTML-formatted email to a single recipient.
    /// </summary>
    /// <param name="to">The recipient's email address.</param>
    /// <param name="subject">The subject line of the email.</param>
    /// <param name="htmlBody">The HTML content payload.</param>
    Task SendEmailAsync(string to, string subject, string htmlBody);
}
