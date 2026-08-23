using SendGrid;
using SendGrid.Helpers.Mail;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace OrbitApi.Services;

/// <summary>
/// Email delivery provider implementing SendGrid API integration for sending password resets, invitations, and notifications.
/// Supports local/development simulated email logging when API key is unconfigured or a placeholder.
/// </summary>
public class SendGridEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ISendGridClient? _sendGridClient;
    private readonly bool _isConfigured;

    /// <summary>
    /// Initializes a new instance of <see cref="SendGridEmailSender"/> using configured SendGrid credentials.
    /// </summary>
    /// <param name="config">Configuration provider for reading API keys and sender addresses.</param>
    public SendGridEmailSender(IConfiguration config)
    {
        _config = config;
        var apiKey = _config["SendGrid:ApiKey"]
                  ?? _config["SendGrid__ApiKey"]
                  ?? _config["SENDGRID_API_KEY"]
                  ?? Environment.GetEnvironmentVariable("SendGrid__ApiKey")
                  ?? Environment.GetEnvironmentVariable("SENDGRID_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("YOUR_") || apiKey == "YOUR_SENDGRID_API_KEY_HERE")
        {
            _isConfigured = false;
            _sendGridClient = null;
            Console.WriteLine("[SendGridEmailSender] WARNING: SendGrid ApiKey is not set in .env. Falling back to dev console email logger.");
        }
        else
        {
            _isConfigured = true;
            _sendGridClient = new SendGridClient(apiKey.Trim());
            var maskedKey = apiKey.Length > 10 ? $"{apiKey[..6]}...{apiKey[^4..]}" : "***";
            Console.WriteLine($"[SendGridEmailSender] Initialized successfully with API Key from .env ({maskedKey})");
        }
    }

    /// <summary>
    /// Constructs and sends an HTML email message via SendGrid's mail send endpoint, or logs to console if in development/unconfigured.
    /// </summary>
    /// <param name="to">Recipient address.</param>
    /// <param name="subject">Email subject.</param>
    /// <param name="htmlBody">HTML body markup.</param>
    public async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        var fromEmail = _config["SendGrid:FromEmail"]
                     ?? _config["SendGrid__FromEmail"]
                     ?? _config["SENDGRID_FROM_EMAIL"]
                     ?? Environment.GetEnvironmentVariable("SendGrid__FromEmail")
                     ?? "noreply@orbitdesk.com";

        var fromName = _config["SendGrid:FromName"]
                    ?? _config["SendGrid__FromName"]
                    ?? _config["SENDGRID_FROM_NAME"]
                    ?? Environment.GetEnvironmentVariable("SendGrid__FromName")
                    ?? "OrbitDesk";

        if (!_isConfigured || _sendGridClient == null)
        {
            Console.WriteLine("================================================================================");
            Console.WriteLine($"[EMAIL DEV SIMULATOR] To: {to}");
            Console.WriteLine($"[EMAIL DEV SIMULATOR] Subject: {subject}");
            Console.WriteLine($"[EMAIL DEV SIMULATOR] Body:\n{htmlBody}");
            Console.WriteLine("================================================================================");
            return;
        }

        try
        {
            var from = new EmailAddress(fromEmail, fromName);
            var toAddress = new EmailAddress(to);

            // Generate clean plain-text fallback from HTML for high inbox deliverability
            var plainText = System.Text.RegularExpressions.Regex.Replace(htmlBody, "<[^>]*>", " ")
                .Replace("&nbsp;", " ")
                .Replace("&amp;", "&")
                .Replace("&lt;", "<")
                .Replace("&gt;", ">");
            plainText = System.Text.RegularExpressions.Regex.Replace(plainText, @"\s+", " ").Trim();

            var msg = MailHelper.CreateSingleEmail(from, toAddress, subject, plainText, htmlBody);
            
            Console.WriteLine($"[EmailSender] Dispatching email via SendGrid to {to}...");
            var response = await _sendGridClient.SendEmailAsync(msg);
            
            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[EmailSender] Email successfully dispatched to {to} via SendGrid.");
            }
            else
            {
                var responseBody = await response.Body.ReadAsStringAsync();
                Console.WriteLine($"[EmailSender] SendGrid Error: {response.StatusCode} - {responseBody}");
                Console.WriteLine("================================================================================");
                Console.WriteLine($"[EMAIL FALLBACK CONSOLE] Delivery via SendGrid returned {response.StatusCode}. Email content for {to}:");
                Console.WriteLine($"Subject: {subject}");
                Console.WriteLine($"Body:\n{htmlBody}");
                Console.WriteLine("================================================================================");
            }
        }
        catch (System.Exception ex)
        {
            Console.WriteLine($"[EmailSender] General Error sending email via SendGrid: {ex.Message}");
            Console.WriteLine("================================================================================");
            Console.WriteLine($"[EMAIL FALLBACK CONSOLE] Exception sending to {to}:");
            Console.WriteLine($"Subject: {subject}");
            Console.WriteLine($"Body:\n{htmlBody}");
            Console.WriteLine("================================================================================");
        }
    }
}
