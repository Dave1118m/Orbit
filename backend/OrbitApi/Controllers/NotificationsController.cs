using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OrbitApi.DTOs;
using OrbitApi.Models;

namespace OrbitApi.Controllers
{
    /// <summary>
    /// In-app notification hub controller managing user alerts, unread counts,
    /// read status acknowledgments, and notification clearing.
    /// </summary>
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

        /// <summary>
        /// Lists notification alerts for the current user.
        /// </summary>
        /// <param name="limit">Max results to return.</param>
        /// <param name="unreadOnly">Filter only unread messages.</param>
        /// <returns>Collection of notification DTOs.</returns>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<NotificationDto>>> List([FromQuery] int? limit, [FromQuery] bool? unreadOnly)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            int.TryParse(userIdStr, out var userId);
            if (userId <= 0) userId = 1;

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

        /// <summary>
        /// Retrieves the current count of unread notifications for badge counters.
        /// </summary>
        /// <returns>Unread count payload.</returns>
        [HttpGet("unread-count")]
        public async Task<ActionResult<UnreadCountDto>> GetUnreadCount()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            int.TryParse(userIdStr, out var userId);
            if (userId <= 0) userId = 1;

            var unreadCount = await _db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .CountAsync();

            return Ok(new UnreadCountDto { UnreadCount = unreadCount });
        }

        /// <summary>
        /// Marks specified notifications or all notifications as read.
        /// </summary>
        /// <param name="req">Notification IDs or mark-all flag.</param>
        /// <returns>NoContent on success.</returns>
        [HttpPut("mark-read")]
        public async Task<IActionResult> MarkRead([FromBody] MarkNotificationsReadRequest req)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            int.TryParse(userIdStr, out var userId);
            if (userId <= 0) userId = 1;

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

        /// <summary>
        /// Deletes an individual notification.
        /// </summary>
        /// <param name="id">Notification ID.</param>
        /// <returns>NoContent on success.</returns>
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

        /// <summary>
        /// Clears all notifications for the current user.
        /// </summary>
        /// <returns>Cleared confirmation.</returns>
        [HttpDelete("clear-all")]
        public async Task<IActionResult> ClearAll()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
            int.TryParse(userIdStr, out var userId);
            if (userId <= 0) userId = 1;

            var userNotifs = _db.Notifications.Where(n => n.UserId == userId);
            _db.Notifications.RemoveRange(userNotifs);
            await _db.SaveChangesAsync();

            return Ok(new { message = "All notifications cleared." });
        }
    }
}
