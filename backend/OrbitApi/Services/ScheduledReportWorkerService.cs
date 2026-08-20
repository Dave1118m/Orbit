using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Services
{
    /// <summary>
    /// Hosted background worker that checks for due grant/donor report schedules and emails automated report notifications.
    /// </summary>
    public class ScheduledReportWorkerService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ScheduledReportWorkerService> _logger;

        /// <summary>
        /// Initializes a new instance of <see cref="ScheduledReportWorkerService"/>.
        /// </summary>
        public ScheduledReportWorkerService(IServiceProvider serviceProvider, ILogger<ScheduledReportWorkerService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Periodic loop checking for pending reports every hour.
        /// </summary>
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("ScheduledReportWorkerService processing active report schedules at: {time}", DateTimeOffset.Now);
                    await ProcessScheduledReportsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing scheduled report execution worker.");
                }

                // Check every hour for due scheduled reports
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }

        /// <summary>
        /// Queries the database for pending grant reports whose deadline date has passed, sends donor emails, and marks reports as submitted.
        /// </summary>
        private async Task ProcessScheduledReportsAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

            var now = DateTime.UtcNow;
            var dueSchedules = await db.GrantReportSchedules
                .Include(s => s.Project)
                .Include(s => s.Donor)
                .Where(s => s.Status == ReportStatus.Pending && s.DeadlineDate <= now)
                .ToListAsync(stoppingToken);

            foreach (var schedule in dueSchedules)
            {
                try
                {
                    _logger.LogInformation("Executing scheduled report #{ScheduleId} ('{ReportType}')", schedule.Id, schedule.ReportType);

                    if (schedule.Donor != null && !string.IsNullOrWhiteSpace(schedule.Donor.EmailAddress))
                    {
                        var body = $"<h3>OrbitDesk Automated Report Delivery</h3>" +
                                   $"<p>Scheduled <strong>{schedule.ReportType}</strong> report for project '{schedule.Project?.Title}' is ready for review.</p>";

                        await emailSender.SendEmailAsync(schedule.Donor.EmailAddress, $"[OrbitDesk Scheduled Report] Project #{schedule.ProjectId}", body);
                    }

                    schedule.Status = ReportStatus.Submitted;
                    schedule.SubmittedDate = now;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to execute scheduled report #{ScheduleId}", schedule.Id);
                }
            }

            await db.SaveChangesAsync(stoppingToken);
        }
    }
}
