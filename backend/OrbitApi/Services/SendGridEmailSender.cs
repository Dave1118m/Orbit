using SendGrid;
using SendGrid.Helpers.Mail;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace OrbitApi.Services;

public class SendGridEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ISendGridClient _sendGridClient;

    public SendGridEmailSender(IConfiguration config)
    {
        _config = config;
        var apiKey = _config["SendGrid:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("SendGrid API key is not configured. Set SendGrid__ApiKey in appsettings.json or environment variables.");
        }
        _sendGridClient = new SendGridClient(apiKey);
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        var fromEmail = _config["SendGrid:FromEmail"];
        var fromName = _config["SendGrid:FromName"] ?? "OrbitDesk";
        
        if (string.IsNullOrWhiteSpace(fromEmail))
        {
            throw new InvalidOperationException("SendGrid FromEmail is not configured. Set SendGrid__FromEmail in appsettings.json.");
        }

        Console.WriteLine($"SendGrid Configuration: From={fromEmail}, To={to}, Subject={subject}");

        try
        {
            var from = new EmailAddress(fromEmail, fromName);
            var toAddress = new EmailAddress(to);
            var msg = MailHelper.CreateSingleEmail(from, toAddress, subject, null, htmlBody);
            
            Console.WriteLine($"Attempting to send email via SendGrid to {to}");
            var response = await _sendGridClient.SendEmailAsync(msg);
            
            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Email successfully sent to {to} via SendGrid");
            }
            else
            {
                var responseBody = await response.Body.ReadAsStringAsync();
                Console.WriteLine($"SendGrid Error: {response.StatusCode}");
                Console.WriteLine($"SendGrid Response Body: {responseBody}");
                throw new InvalidOperationException($"Failed to send email via SendGrid: {response.StatusCode} - {responseBody}");
            }
        }
        catch (System.Exception ex)
        {
            Console.WriteLine($"General Error sending email via SendGrid: {ex.Message}");
            Console.WriteLine($"Exception Type: {ex.GetType().Name}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Inner Exception: {ex.InnerException.Message}");
            }
            throw new InvalidOperationException($"Failed to send email via SendGrid: {ex.Message}", ex);
        }
    }
}
