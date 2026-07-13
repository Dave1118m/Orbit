using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace OrbitApi.Services;

public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;

    public SmtpEmailSender(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        var smtp = _config["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(smtp))
        {
            throw new InvalidOperationException("SMTP host is not configured. Set Smtp__Host in .env or environment variables.");
        }

        var port = int.Parse(_config["Smtp:Port"] ?? "25");
        var user = _config["Smtp:Username"];
        var pass = _config["Smtp:Password"];
        var from = _config["Smtp:From"] ?? user ?? "no-reply@example.com";
        var enableSsl = bool.Parse(_config["Smtp:EnableSsl"] ?? "true");

        Console.WriteLine($"SMTP Configuration: Host={smtp}, Port={port}, Username={user}, From={from}, SSL={enableSsl}");

        try
        {
            using var client = new SmtpClient(smtp, port)
            {
                EnableSsl = enableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Credentials = string.IsNullOrEmpty(user) ? CredentialCache.DefaultNetworkCredentials : new NetworkCredential(user, pass)
            };

            using var msg = new MailMessage(from, to, subject, htmlBody) { IsBodyHtml = true };
            Console.WriteLine($"Attempting to send email to {to} via {smtp}:{port}");
            await client.SendMailAsync(msg);
            Console.WriteLine($"Email successfully sent to {to}");
        }
        catch (SmtpException smtpEx)
        {
            Console.WriteLine($"SMTP Error: {smtpEx.Message}");
            Console.WriteLine($"SMTP Status Code: {smtpEx.StatusCode}");
            if (smtpEx.InnerException != null)
            {
                Console.WriteLine($"Inner Exception: {smtpEx.InnerException.Message}");
            }
            throw new InvalidOperationException($"Failed to send email: {smtpEx.Message}", smtpEx);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"General Error sending email: {ex.Message}");
            Console.WriteLine($"Exception Type: {ex.GetType().Name}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Inner Exception: {ex.InnerException.Message}");
            }
            throw new InvalidOperationException($"Failed to send email: {ex.Message}", ex);
        }
    }
}
