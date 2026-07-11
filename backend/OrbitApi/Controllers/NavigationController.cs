using Microsoft.AspNetCore.Mvc;

namespace OrbitApi.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class NavigationController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var menu = new[]
        {
            new
            {
                id = "dashboard",
                title = "Dashboard",
                route = "/dashboard",
                description = "Overview of active work, progress, and alerts.",
                subItems = new[]
                {
                    new { title = "Overview", route = "/dashboard" },
                    new { title = "Activity", route = "/dashboard/activity" },
                    new { title = "Notifications", route = "/dashboard/notifications" }
                }
            },
            new
            {
                id = "organizations",
                title = "Organizations",
                route = "/organizations",
                description = "Manage consortiums, partners, and entity compliance.",
                subItems = new[]
                {
                    new { title = "List", route = "/organizations" },
                    new { title = "Compliance", route = "/organizations/compliance" }
                }
            },
            new
            {
                id = "projects",
                title = "Projects",
                route = "/projects",
                description = "Manage projects, milestones, boards, and files.",
                subItems = new[]
                {
                    new { title = "Board", route = "/projects/board" },
                    new { title = "List", route = "/projects/list" },
                    new { title = "Timeline", route = "/projects/timeline" }
                }
            },
            new
            {
                id = "tasks",
                title = "My Tasks",
                route = "/tasks",
                description = "Work assigned to you with prioritization and filters.",
                subItems = new[]
                {
                    new { title = "Assigned to me", route = "/tasks" },
                    new { title = "Due soon", route = "/tasks/due-soon" },
                    new { title = "Completed", route = "/tasks/completed" }
                }
            },
            new
            {
                id = "teams",
                title = "Teams",
                route = "/teams",
                description = "Team composition, workload, and role assignments.",
                subItems = new[]
                {
                    new { title = "Roster", route = "/teams" },
                    new { title = "Assignments", route = "/teams/assignments" },
                    new { title = "Capacity", route = "/teams/capacity" }
                }
            },
            new
            {
                id = "reports",
                title = "Reports",
                route = "/reports",
                description = "Project, task, and financial dashboards with exports.",
                subItems = new[]
                {
                    new { title = "Project progress", route = "/reports" },
                    new { title = "Task trends", route = "/reports/task-trends" },
                    new { title = "Budget summary", route = "/reports/budget" }
                }
            }
        };

        return Ok(menu);
    }
}
