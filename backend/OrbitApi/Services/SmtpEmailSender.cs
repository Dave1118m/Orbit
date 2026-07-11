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

        using var client = new SmtpClient(smtp, port)
        {
            EnableSsl = enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Credentials = string.IsNullOrEmpty(user) ? CredentialCache.DefaultNetworkCredentials : new NetworkCredential(user, pass)
        };

        using var msg = new MailMessage(from, to, subject, htmlBody) { IsBodyHtml = true };
        await client.SendMailAsync(msg);
    }
}
