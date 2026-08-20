using Microsoft.AspNetCore.SignalR;
using OrbitApi.Hubs;
using OrbitApi.Models;

namespace OrbitApi.Services;

/// <summary>
/// Service contract for dispatching persisted in-app and external notifications to users.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Persists and sends a notification to a specific user via in-app SignalR and optional external channels.
    /// </summary>
    /// <param name="userId">The ID of the user recipient.</param>
    /// <param name="message">The notification text message.</param>
    /// <param name="channel">The notification delivery channel (InApp, Email, SMS, Push).</param>
    Task NotifyUserAsync(int userId, string message, NotificationChannel channel = NotificationChannel.InApp);

    /// <summary>
    /// Persists and broadcasts notifications in bulk to multiple user recipients.
    /// </summary>
    /// <param name="userIds">Collection of recipient user IDs.</param>
    /// <param name="message">The notification text message.</param>
    /// <param name="channel">The notification delivery channel.</param>
    Task NotifyUsersAsync(IEnumerable<int> userIds, string message, NotificationChannel channel = NotificationChannel.InApp);
}

/// <summary>
/// Implements notification persistence in OrbitDbContext and immediate real-time dispatch via SignalR Hub.
/// </summary>
public class NotificationService : INotificationService
{
    private readonly OrbitDbContext _db;
    private readonly IHubContext<OrbitHub> _hubContext;

    /// <summary>
    /// Initializes a new instance of <see cref="NotificationService"/>.
    /// </summary>
    /// <param name="db">The primary database context.</param>
    /// <param name="hubContext">The SignalR hub context for real-time client push notifications.</param>
    public NotificationService(OrbitDbContext db, IHubContext<OrbitHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Persists a notification record to the database and pushes it to the user's real-time SignalR group.
    /// </summary>
    /// <param name="userId">The ID of the user recipient.</param>
    /// <param name="message">The notification message.</param>
    /// <param name="channel">Delivery channel (default is InApp).</param>
    public async Task NotifyUserAsync(int userId, string message, NotificationChannel channel = NotificationChannel.InApp)
    {
        var notification = new Notification
        {
            UserId = userId,
            Message = message,
            Channel = channel,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        await _hubContext.Clients.Group($"user-{userId}").SendAsync("NotificationReceived", new
        {
            Id = notification.Id,
            UserId = notification.UserId,
            Message = notification.Message,
            Channel = notification.Channel.ToString(),
            IsRead = notification.IsRead,
            CreatedAt = notification.CreatedAt,
            Link = notification.Link
        });
    }

    /// <summary>
    /// Persists notifications in bulk to the database and pushes real-time SignalR messages to each recipient's group.
    /// </summary>
    /// <param name="userIds">Collection of recipient user IDs.</param>
    /// <param name="message">The notification message.</param>
    /// <param name="channel">Delivery channel.</param>
    public async Task NotifyUsersAsync(IEnumerable<int> userIds, string message, NotificationChannel channel = NotificationChannel.InApp)
    {
        var distinctUserIds = userIds.Where(id => id > 0).Distinct().ToList();
        if (!distinctUserIds.Any()) return;

        var notifications = distinctUserIds.Select(userId => new Notification
        {
            UserId = userId,
            Message = message,
            Channel = channel,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();

        foreach (var notification in notifications)
        {
            await _hubContext.Clients.Group($"user-{notification.UserId}").SendAsync("NotificationReceived", new
            {
                Id = notification.Id,
                UserId = notification.UserId,
                Message = notification.Message,
                Channel = notification.Channel.ToString(),
                IsRead = notification.IsRead,
                CreatedAt = notification.CreatedAt,
                Link = notification.Link
            });
        }
    }
}
