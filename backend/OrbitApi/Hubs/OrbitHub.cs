using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace OrbitApi.Hubs;

/// <summary>
/// Real-time SignalR Hub facilitating live client subscriptions to project Kanban boards, organization notifications, and direct user alerts.
/// </summary>
[Authorize]
public class OrbitHub : Hub
{
    /// <summary>
    /// Joins the caller connection to a project-specific room (e.g. "project-123") to receive live board changes and comments.
    /// </summary>
    /// <param name="projectId">The project ID.</param>
    public async Task JoinProject(int projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"project-{projectId}");
    }

    /// <summary>
    /// Removes the caller connection from a project-specific room.
    /// </summary>
    /// <param name="projectId">The project ID.</param>
    public async Task LeaveProject(int projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project-{projectId}");
    }

    /// <summary>
    /// Joins the caller connection to an organization-wide room (e.g. "org-5") for broadcast alerts.
    /// </summary>
    /// <param name="organizationId">The organization ID.</param>
    public async Task JoinOrganization(int organizationId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"org-{organizationId}");
    }

    /// <summary>
    /// Removes the caller connection from an organization-wide room.
    /// </summary>
    /// <param name="organizationId">The organization ID.</param>
    public async Task LeaveOrganization(int organizationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"org-{organizationId}");
    }

    /// <summary>
    /// Automatically registers the authenticated client into a user-specific room ("user-{id}") on WebSocket connection.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
        }
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Cleanly unregisters the client from their user-specific room upon WebSocket disconnect.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
        }
        await base.OnDisconnectedAsync(exception);
    }
}
