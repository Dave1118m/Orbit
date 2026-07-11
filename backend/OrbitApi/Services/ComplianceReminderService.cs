using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;
using OrbitApi.Services;

namespace OrbitApi.Services
{
    public class ComplianceReminderService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ComplianceReminderService> _logger;

        public ComplianceReminderService(IServiceProvider serviceProvider, ILogger<ComplianceReminderService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("ComplianceReminderService running at: {time}", DateTimeOffset.Now);

                try
                {
                    await ProcessRemindersAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred processing compliance reminders.");
                }

                await Task.Delay(TimeSpan.FromDays(1), stoppingToken);
            }
        }

        private async Task ProcessRemindersAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

            var thresholdDate = DateTime.UtcNow.AddDays(30);

            var compliances = await db.OrganizationCompliances
                .Include(c => c.Organization)
                .Where(c => c.Organization != null && !c.Organization.IsDeleted)
                .Where(c => (c.RegistrationRenewalDate.HasValue && c.RegistrationRenewalDate <= thresholdDate)
                         || (c.TaxExemptRenewalDate.HasValue && c.TaxExemptRenewalDate <= thresholdDate))
                .ToListAsync(stoppingToken);

            foreach (var compliance in compliances)
            {
                if (compliance.LastReminderSentAt.HasValue && compliance.LastReminderSentAt.Value > DateTime.UtcNow.AddDays(-7))
                    continue;

                if (!compliance.Organization!.OwnerId.HasValue)
                    continue;

                var owner = await db.Users.FindAsync(compliance.Organization.OwnerId);
                if (owner == null)
                    continue;

                var message = $"Reminder: Compliance documents for {compliance.Organization.Name} are approaching their renewal dates.";
                
                db.Notifications.Add(new Notification
                {
                    UserId = owner.Id,
                    Message = message,
                    Channel = NotificationChannel.Email
                });

                await emailSender.SendEmailAsync(owner.Email, $"Compliance Renewal Reminder: {compliance.Organization.Name}", $"<p>{message}</p>");
                
                compliance.LastReminderSentAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync(stoppingToken);
        }
    }
}
