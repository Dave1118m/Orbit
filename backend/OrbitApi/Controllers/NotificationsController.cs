using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;

namespace OrbitApi.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly OrbitDbContext _db;

        public NotificationsController(OrbitDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<NotificationDto>>> List([FromQuery] int? limit, [FromQuery] bool? unreadOnly)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            var query = _db.Notifications.Where(n => n.UserId == userId);

            if (unreadOnly == true)
            {
                query = query.Where(n => !n.IsRead);
            }

            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(limit ?? 50)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    UserId = n.UserId,
                    Message = n.Message,
                    Channel = n.Channel.ToString(),
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    Link = n.Link
                })
                .ToListAsync();

            return Ok(notifications);
        }

        [HttpGet("unread-count")]
        public async Task<ActionResult<UnreadCountDto>> GetUnreadCount()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            var unreadCount = await _db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .CountAsync();

            return Ok(new UnreadCountDto { UnreadCount = unreadCount });
        }

        [HttpPut("mark-read")]
        public async Task<IActionResult> MarkRead([FromBody] MarkNotificationsReadRequest req)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            if (req.MarkAllAsRead == true)
            {
                var allUnread = await _db.Notifications
                    .Where(n => n.UserId == userId && !n.IsRead)
                    .ToListAsync();

                foreach (var notification in allUnread)
                {
                    notification.IsRead = true;
                }

                await _db.SaveChangesAsync();
            }
            else if (req.NotificationIds?.Any() == true)
            {
                var notifications = await _db.Notifications
                    .Where(n => n.UserId == userId && req.NotificationIds.Contains(n.Id))
                    .ToListAsync();

                foreach (var notification in notifications)
                {
                    notification.IsRead = true;
                }

                await _db.SaveChangesAsync();
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

            var notification = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
            if (notification == null) return NotFound();

            _db.Notifications.Remove(notification);
            await _db.SaveChangesAsync();

            return NoContent();
        }
    }
}
