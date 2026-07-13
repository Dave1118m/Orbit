using OrbitApi.Models;

namespace OrbitApi.DTOs
{
    public class NotificationDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Message { get; set; } = null!;
        public string Channel { get; set; } = null!;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? Link { get; set; }
    }

    public class MarkNotificationsReadRequest
    {
        public List<int>? NotificationIds { get; set; } = new();
        public bool? MarkAllAsRead { get; set; }
    }

    public class UnreadCountDto
    {
        public int UnreadCount { get; set; }
    }
}
