using System.Threading.Tasks;

namespace OrbitApi.Services;

public interface IEmailSender
{
    Task SendEmailAsync(string to, string subject, string htmlBody);
}
