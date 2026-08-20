using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Web;
using OrbitApi.Models;

namespace OrbitApi.Services;

/// <summary>
/// Google Calendar integration service handling URL templating, iCal (.ics) generation, and direct Google API synchronization.
/// </summary>
public class GoogleCalendarService : IGoogleCalendarService
{
    private readonly IHttpClientFactory _httpClientFactory;

    /// <summary>
    /// Initializes a new instance of <see cref="GoogleCalendarService"/>.
    /// </summary>
    public GoogleCalendarService(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Generates a Google Calendar web template URL that pre-populates event details with the task's title, dates, and description.
    /// </summary>
    public string GenerateGoogleCalendarWebUrl(TaskItem task, string? userEmail = null)
    {
        var title = HttpUtility.UrlEncode($"[Orbit Task] {task.Title}");
        var details = HttpUtility.UrlEncode($"Task: {task.Title}\nStatus: {task.Status}\nPriority: {task.Priority}\nProject ID: {task.ProjectId}");
        
        var start = task.Deadline ?? DateTime.UtcNow.AddDays(1);
        var end = start.AddHours(1);

        // Format dates as YYYYMMDDTHHmmssZ
        var startUtcStr = start.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");
        var endUtcStr = end.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");

        var url = $"https://calendar.google.com/calendar/render?action=TEMPLATE&text={title}&dates={startUtcStr}/{endUtcStr}&details={details}";
        if (!string.IsNullOrWhiteSpace(userEmail))
        {
            url += $"&add={HttpUtility.UrlEncode(userEmail)}";
        }

        return url;
    }

    /// <summary>
    /// Generates standard VCALENDAR iCalendar (.ics) string format for email attachments and offline calendar imports.
    /// </summary>
    public string GenerateICalContent(TaskItem task)
    {
        var start = task.Deadline ?? DateTime.UtcNow.AddDays(1);
        var end = start.AddHours(1);

        var startUtcStr = start.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");
        var endUtcStr = end.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");
        var nowUtcStr = DateTime.UtcNow.ToString("yyyyMMdd'T'HHmmss'Z'");

        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCALENDAR");
        sb.AppendLine("VERSION:2.0");
        sb.AppendLine("PRODID:-//Orbit Platform//Task Management//EN");
        sb.AppendLine("CALSCALE:GREGORIAN");
        sb.AppendLine("METHOD:PUBLISH");
        sb.AppendLine("BEGIN:VEVENT");
        sb.AppendLine($"UID:task-{task.Id}@orbit.app");
        sb.AppendLine($"DTSTAMP:{nowUtcStr}");
        sb.AppendLine($"DTSTART:{startUtcStr}");
        sb.AppendLine($"DTEND:{endUtcStr}");
        sb.AppendLine($"SUMMARY:[Orbit Task] {task.Title}");
        sb.AppendLine($"DESCRIPTION:Status: {task.Status} | Priority: {task.Priority}");
        sb.AppendLine("STATUS:CONFIRMED");
        sb.AppendLine("END:VEVENT");
        sb.AppendLine("END:VCALENDAR");

        return sb.ToString();
    }

    /// <summary>
    /// Authenticates with the Google Calendar API v3 using the supplied OAuth token and inserts an event on the user's primary calendar.
    /// </summary>
    public async Task<(bool Success, string? EventId, string? Error)> SyncTaskToGoogleCalendarAsync(TaskItem task, string accessToken)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var start = task.Deadline ?? DateTime.UtcNow.AddDays(1);
            var end = start.AddHours(1);

            var eventBody = new
            {
                summary = $"[Orbit Task] {task.Title}",
                description = $"Status: {task.Status}\nPriority: {task.Priority}\nProject ID: {task.ProjectId}",
                start = new { dateTime = start.ToString("o") },
                end = new { dateTime = end.ToString("o") }
            };

            var json = JsonSerializer.Serialize(eventBody);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync("https://www.googleapis.com/calendar/v3/calendars/primary/events", content);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync();
                return (false, null, $"Google Calendar API error ({response.StatusCode}): {errBody}");
            }

            var resJson = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(resJson);
            var eventId = doc.RootElement.GetProperty("id").GetString();

            return (true, eventId, null);
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }
    }
}
