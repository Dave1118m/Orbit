using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace OrbitApi.Hubs;

[Authorize]
public class OrbitHub : Hub
{
    /// <summary>
    /// Join a project-specific group to receive real-time updates for that project.
    /// </summary>
    public async Task JoinProject(int projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"project-{projectId}");
    }

    /// <summary>
    /// Leave a project-specific group.
    /// </summary>
    public async Task LeaveProject(int projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project-{projectId}");
    }

    /// <summary>
    /// Join an organization-specific group to receive org-wide notifications.
    /// </summary>
    public async Task JoinOrganization(int organizationId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"org-{organizationId}");
    }

    /// <summary>
    /// Leave an organization-specific group.
    /// </summary>
    public async Task LeaveOrganization(int organizationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"org-{organizationId}");
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
        }
        await base.OnConnectedAsync();
    }

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
