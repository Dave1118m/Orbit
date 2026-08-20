using OrbitApi.Models;

namespace OrbitApi.Services;

/// <summary>
/// Service contract for integrating Orbit tasks and milestone deadlines with Google Calendar and iCal formats.
/// </summary>
public interface IGoogleCalendarService
{
    /// <summary>
    /// Generates a direct web URL allowing a user to add a task deadline directly into Google Calendar with a single click.
    /// </summary>
    /// <param name="task">The task containing title, deadline, status, and project details.</param>
    /// <param name="userEmail">Optional email of the user to invite/add to the event.</param>
    /// <returns>A formatted HTTPS URL for Google Calendar template insertion.</returns>
    string GenerateGoogleCalendarWebUrl(TaskItem task, string? userEmail = null);

    /// <summary>
    /// Generates standard iCalendar (.ics) format file content representing the task event.
    /// </summary>
    /// <param name="task">The task item.</param>
    /// <returns>Standard RFC 5545 VCALENDAR text content.</returns>
    string GenerateICalContent(TaskItem task);

    /// <summary>
    /// Creates a calendar event directly in the user's primary Google Calendar via Google Calendar API v3.
    /// </summary>
    /// <param name="task">The task item to sync.</param>
    /// <param name="accessToken">The OAuth2 access token with Google Calendar scopes.</param>
    /// <returns>A tuple indicating success, Google Event ID if created, and any error message.</returns>
    Task<(bool Success, string? EventId, string? Error)> SyncTaskToGoogleCalendarAsync(TaskItem task, string accessToken);
}
