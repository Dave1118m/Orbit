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
}
