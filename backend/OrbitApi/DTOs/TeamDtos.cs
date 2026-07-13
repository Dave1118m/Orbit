using System;
using System.Collections.Generic;

namespace OrbitApi.DTOs
{
    public class TeamDto
    {
        public int Id { get; set; }
        public int WorkspaceId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public int? TeamLeadUserId { get; set; }
        public bool IsArchived { get; set; }
        public List<TeamMemberDto>? Members { get; set; }
        public List<ProjectTeamDto>? Projects { get; set; }
    }

    public class CreateTeamRequest
    {
        public int WorkspaceId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public int? TeamLeadUserId { get; set; }
    }

    public class UpdateTeamRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public int? TeamLeadUserId { get; set; }
        public bool? IsArchived { get; set; }
    }

    public class TeamMemberDto
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public int UserId { get; set; }
        public DateTime JoinedAt { get; set; }
    }

    public class AddTeamMemberRequest
    {
        public int UserId { get; set; }
    }

    public class ProjectTeamDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public int TeamId { get; set; }
        public DateTime AssignedAt { get; set; }
    }

    public class AssignTeamToProjectRequest
    {
        public int ProjectId { get; set; }
    }

    public class ProjectTeamHistoryDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public int TeamId { get; set; }
        public DateTime AssignedAt { get; set; }
        public DateTime? RemovedAt { get; set; }
        public int? ReplacedByTeamId { get; set; }
    }

    public class TeamRosterDto
    {
        public int Id { get; set; }
        public int TeamId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public string UserEmail { get; set; } = null!;
        public string? UserPhotoUrl { get; set; }
        public string? CurrentRole { get; set; } // Primary role on the team
        public int OpenTaskCount { get; set; }
        public int OverdueTaskCount { get; set; }
        public DateTime JoinedAt { get; set; }
    }

    public class TeamWorkloadDto
    {
        public int TeamId { get; set; }
        public string TeamName { get; set; } = null!;
        public int TotalMembers { get; set; }
        public int OpenTasksTotal { get; set; }
        public int OverdueTasksTotal { get; set; }
        public decimal AverageTasksPerMember { get; set; }
        public List<TeamMemberWorkloadDto>? MemberWorkloads { get; set; }
    }

    public class TeamMemberWorkloadDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public int OpenTasks { get; set; }
        public int OverdueTasks { get; set; }
    }

    public class ReplaceTeamRequest
    {
        public int ProjectId { get; set; }
        public int NewTeamId { get; set; }
        public string? Reason { get; set; }
    }

    public class CopyTeamRequest
    {
        public int SourceTeamId { get; set; }
        public string NewTeamName { get; set; } = null!;
        public string? NewTeamDescription { get; set; }
        public int WorkspaceId { get; set; }
    }
}
