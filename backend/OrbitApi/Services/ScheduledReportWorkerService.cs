using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Services
{
    /// <summary>
    /// Hosted background worker that checks for due grant/donor report schedules and emails automated report notifications to donors.
    /// </summary>
    public class ScheduledReportWorkerService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ScheduledReportWorkerService> _logger;
        private readonly TimeSpan _pollInterval = TimeSpan.FromMinutes(1);

        /// <summary>
        /// Initializes a new instance of <see cref="ScheduledReportWorkerService"/>.
        /// </summary>
        public ScheduledReportWorkerService(IServiceProvider serviceProvider, ILogger<ScheduledReportWorkerService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Periodic loop checking for pending reports whose deadline date has arrived.
        /// </summary>
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ScheduledReportWorkerService started.");

            // Brief initial delay on startup
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessScheduledReportsAsync(stoppingToken);
                }
                catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
                {
                    _logger.LogError(ex, "Error processing scheduled report execution worker.");
                }

                try
                {
                    await Task.Delay(_pollInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }

            _logger.LogInformation("ScheduledReportWorkerService stopped.");
        }

        /// <summary>
        /// Queries the database for pending grant reports whose deadline date has arrived,
        /// generates and dispatches automated emails to donors, marks reports as submitted, and logs audit events.
        /// </summary>
        public async Task<int> ProcessScheduledReportsAsync(CancellationToken stoppingToken = default)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();

            var now = DateTime.UtcNow;

            // Find pending reports where deadline has reached (either timestamp passed or today's date arrived)
            var dueSchedules = await db.GrantReportSchedules
                .Include(s => s.Project)
                    .ThenInclude(p => p.Workspace)
                .Include(s => s.Project)
                    .ThenInclude(p => p.ProjectDonors)
                        .ThenInclude(pd => pd.Donor)
                .Include(s => s.Donor)
                .Where(s => s.Status == ReportStatus.Pending && (s.DeadlineDate <= now || s.DeadlineDate.Date <= now.Date))
                .ToListAsync(stoppingToken);

            if (!dueSchedules.Any())
            {
                return 0;
            }

            var processedCount = 0;

            foreach (var schedule in dueSchedules)
            {
                try
                {
                    _logger.LogInformation("Processing due scheduled report #{ScheduleId} ('{ReportType}') for Project #{ProjectId}",
                        schedule.Id, schedule.ReportType, schedule.ProjectId);

                    // Collect all target donor emails
                    var recipientMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                    // 1. Direct Donor on the schedule
                    if (schedule.Donor != null && !string.IsNullOrWhiteSpace(schedule.Donor.EmailAddress))
                    {
                        recipientMap[schedule.Donor.EmailAddress.Trim()] = schedule.Donor.Name;
                    }

                    // 2. Project-linked donors (if project-scoped report)
                    if (schedule.Project?.ProjectDonors != null)
                    {
                        foreach (var pd in schedule.Project.ProjectDonors)
                        {
                            if (pd.Donor != null && !string.IsNullOrWhiteSpace(pd.Donor.EmailAddress))
                            {
                                recipientMap[pd.Donor.EmailAddress.Trim()] = pd.Donor.Name;
                            }
                        }
                    }

                    var projectName = schedule.Project?.Title ?? "General Organization Portfolio";
                    var reportTypeStr = schedule.ReportType.ToString();
                    var formattedDeadline = schedule.DeadlineDate.ToString("MMMM dd, yyyy");
                    var submittedTimestamp = now.ToString("yyyy-MM-dd HH:mm UTC");

                    // Build clean, professional HTML report dispatch email
                    var emailHtml = $@"
<div style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);"">
  <div style=""background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); padding: 28px 24px; color: #ffffff;"">
    <div style=""display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"">
      <span style=""font-size: 20px; font-weight: 800; letter-spacing: -0.5px;"">ORBIT</span>
      <span style=""background: rgba(255, 255, 255, 0.2); font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;"">Automated Compliance Delivery</span>
    </div>
    <h2 style=""margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;"">Scheduled {reportTypeStr} Report Dispatched</h2>
    <p style=""margin: 6px 0 0 0; font-size: 13px; color: #c7d2fe;"">This report was scheduled for automatic transmission upon reaching the milestone date.</p>
  </div>

  <div style=""padding: 24px;"">
    <p style=""font-size: 14px; color: #334155; line-height: 1.6; margin-top: 0;"">
      Hello,
    </p>
    <p style=""font-size: 14px; color: #334155; line-height: 1.6;"">
      The scheduled <strong>{reportTypeStr}</strong> report for <strong>{projectName}</strong> has arrived at its milestone date (<strong>{formattedDeadline}</strong>) and has been automatically compiled and submitted by Orbit.
    </p>

    <div style=""background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;"">
      <table style=""width: 100%; border-collapse: collapse; font-size: 13px;"">
        <tr>
          <td style=""padding: 6px 0; color: #64748b; font-weight: 600; width: 40%;"">Report Schedule ID:</td>
          <td style=""padding: 6px 0; color: #0f172a; font-weight: 700;"">#{schedule.Id}</td>
        </tr>
        <tr>
          <td style=""padding: 6px 0; color: #64748b; font-weight: 600;"">Project Scope:</td>
          <td style=""padding: 6px 0; color: #0f172a;"">{projectName}</td>
        </tr>
        <tr>
          <td style=""padding: 6px 0; color: #64748b; font-weight: 600;"">Report Classification:</td>
          <td style=""padding: 6px 0; color: #4f46e5; font-weight: 700;"">{reportTypeStr} Report</td>
        </tr>
        <tr>
          <td style=""padding: 6px 0; color: #64748b; font-weight: 600;"">Scheduled Milestone:</td>
          <td style=""padding: 6px 0; color: #0f172a;"">{formattedDeadline}</td>
        </tr>
        <tr>
          <td style=""padding: 6px 0; color: #64748b; font-weight: 600;"">System Delivery Timestamp:</td>
          <td style=""padding: 6px 0; color: #0f172a;"">{submittedTimestamp}</td>
        </tr>
        <tr>
          <td style=""padding: 6px 0; color: #64748b; font-weight: 600;"">Submission Status:</td>
          <td style=""padding: 6px 0; color: #059669; font-weight: 700;"">✔ Submitted & Delivered</td>
        </tr>
      </table>
    </div>

    <div style=""text-align: center; margin: 28px 0 16px 0;"">
      <a href=""http://localhost:5173/reports"" style=""background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3);"">
        Access Reports in Orbit Portal &rarr;
      </a>
    </div>

    <p style=""font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;"">
      This is an automated system transmission generated by Orbit Grants & Compliance Service. If you have questions regarding this schedule, please contact your Orbit system administrator.
    </p>
  </div>
</div>";

                    var subject = $"[Orbit Automated Report] {reportTypeStr} Report - {projectName}";

                    // Send email to all donor recipients
                    if (recipientMap.Count > 0)
                    {
                        foreach (var (donorEmail, donorName) in recipientMap)
                        {
                            try
                            {
                                await emailSender.SendEmailAsync(donorEmail, subject, emailHtml);
                                _logger.LogInformation("Successfully emailed scheduled report #{ScheduleId} to donor '{DonorName}' <{Email}>",
                                    schedule.Id, donorName, donorEmail);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, "Failed to email scheduled report #{ScheduleId} to <{Email}>", schedule.Id, donorEmail);
                            }
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Scheduled report #{ScheduleId} has no donor email address configured. Marked as submitted.", schedule.Id);
                    }

                    // Update schedule status
                    schedule.Status = ReportStatus.Submitted;
                    schedule.SubmittedDate = now;

                    // Audit trail entry
                    var orgId = schedule.Donor?.OrganizationId ?? schedule.Project?.Workspace?.OrganizationId ?? 1;
                    var recipientsStr = recipientMap.Count > 0 ? string.Join(", ", recipientMap.Keys) : "No recipients specified";
                    db.AuditLogs.Add(new AuditLog
                    {
                        OrganizationId = orgId,
                        Entity = "GrantReportSchedule",
                        Action = "ScheduledReportAutoDispatched",
                        Timestamp = now,
                        NewValues = $"Automated {reportTypeStr} report #{schedule.Id} for '{projectName}' emailed to [{recipientsStr}] upon reaching milestone date {schedule.DeadlineDate:yyyy-MM-dd}."
                    });

                    processedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to execute scheduled report #{ScheduleId}", schedule.Id);
                }
            }

            await db.SaveChangesAsync(stoppingToken);
            _logger.LogInformation("Completed scheduled report processing cycle. Total processed: {Count}", processedCount);

            return processedCount;
        }
    }
}
