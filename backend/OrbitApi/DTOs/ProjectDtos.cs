using System;
using System.Collections.Generic;

namespace OrbitApi.DTOs
{
    public enum ProjectStatus { Planning = 0, Active = 1, OnHold = 2, Completed = 3, Cancelled = 4, Archived = 5 }

    public class TeamSimpleDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
    }

    public class ProjectDto
    {
        public int Id { get; set; }
        public int WorkspaceId { get; set; }
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public ProjectStatus Status { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? Budget { get; set; }
        public int? DonorId { get; set; }
        public List<int>? DonorIds { get; set; }
        public string FundingType { get; set; } = "SingleDonor";
        public List<int>? TeamIds { get; set; }
        public List<TeamSimpleDto>? Teams { get; set; }
        public int TaskCount { get; set; }
        public int CompletedTaskCount { get; set; }
        public int Progress { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class CreateProjectRequest
    {
        public int WorkspaceId { get; set; }
        public string Title { get; set; } = null!;
        public string? Description { get; set; }
        public ProjectStatus Status { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? Budget { get; set; }
        public int? DonorId { get; set; }
        public List<int>? DonorIds { get; set; }
        public string FundingType { get; set; } = "SingleDonor";
    }

    public class UpdateProjectRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public ProjectStatus? Status { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public decimal? Budget { get; set; }
        public int? DonorId { get; set; }
        public List<int>? DonorIds { get; set; }
        public string? FundingType { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class PostponeProjectRequest
    {
        public DateTime NewEndDate { get; set; }
        public string Reason { get; set; } = null!;
    }

    public class ProjectPostponementDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public DateTime OldEndDate { get; set; }
        public DateTime NewEndDate { get; set; }
        public string Reason { get; set; } = null!;
        public int RequestedByUserId { get; set; }
        public int? ApprovedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ProjectLeadHistoryDto
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class AssignProjectLeadRequest
    {
        public int UserId { get; set; }
    }
}
