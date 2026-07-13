using Microsoft.AspNetCore.SignalR;
using OrbitApi.Hubs;
using OrbitApi.Models;

namespace OrbitApi.Services;

public interface INotificationService
{
    Task NotifyUserAsync(int userId, string message, NotificationChannel channel = NotificationChannel.InApp);
    Task NotifyUsersAsync(IEnumerable<int> userIds, string message, NotificationChannel channel = NotificationChannel.InApp);
}

public class NotificationService : INotificationService
{
    private readonly OrbitDbContext _db;
    private readonly IHubContext<OrbitHub> _hubContext;

    public NotificationService(OrbitDbContext db, IHubContext<OrbitHub> hubContext)
    {
        _db = db;
        _hubContext = hubContext;
    }

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
