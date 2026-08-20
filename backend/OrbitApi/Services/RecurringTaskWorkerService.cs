using Microsoft.EntityFrameworkCore;
using OrbitApi.Models;

namespace OrbitApi.Services
{
    /// <summary>
    /// Hosted background worker that runs periodically to clone and instantiate recurring task templates on schedule.
    /// </summary>
    public class RecurringTaskWorkerService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<RecurringTaskWorkerService> _logger;

        /// <summary>
        /// Initializes a new instance of <see cref="RecurringTaskWorkerService"/>.
        /// </summary>
        public RecurringTaskWorkerService(IServiceProvider serviceProvider, ILogger<RecurringTaskWorkerService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        /// <summary>
        /// Execution loop running continuously while the API host is active, checking tasks daily.
        /// </summary>
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("RecurringTaskWorkerService processing recurring tasks at: {time}", DateTimeOffset.Now);
                    await InstantiateRecurringTasksAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred in RecurringTaskWorkerService.");
                }

                // Check once every 24 hours for scheduled recurring tasks
                await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
            }
        }

        /// <summary>
        /// Scans for template tasks containing '[Recurring]' and generates a new monthly task instance if one does not already exist.
        /// </summary>
        private async Task InstantiateRecurringTasksAsync(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<OrbitDbContext>();

            // Find all template tasks designated as recurring distributions
            var recurringTemplates = await db.Tasks
                .Where(t => !t.IsDeleted && t.Title.Contains("[Recurring]"))
                .ToListAsync(stoppingToken);

            foreach (var template in recurringTemplates)
            {
                var now = DateTime.UtcNow;
                var monthStart = new DateTime(now.Year, now.Month, 1);

                // Check if an instance for this month already exists
                var instanceExists = await db.Tasks.AnyAsync(t =>
                    t.ProjectId == template.ProjectId &&
                    t.ParentTaskId == template.Id &&
                    t.Deadline >= monthStart,
                    stoppingToken);

                if (!instanceExists)
                {
                    var cleanTitle = template.Title.Replace("[Recurring]", "").Trim();
                    var newInstance = new TaskItem
                    {
                        ProjectId = template.ProjectId,
                        ParentTaskId = template.Id,
                        Title = $"{cleanTitle} - {now:MMMM yyyy}",
                        Status = OrbitApi.Models.TaskStatus.ToDo,
                        Priority = template.Priority,
                        StartDate = now,
                        Deadline = now.AddDays(14),
                        IsDeleted = false
                    };

                    db.Tasks.Add(newInstance);
                    _logger.LogInformation("Instantiated monthly recurring task: '{Title}' for Project #{ProjectId}", newInstance.Title, newInstance.ProjectId);
                }
            }

            await db.SaveChangesAsync(stoppingToken);
        }
    }
}
