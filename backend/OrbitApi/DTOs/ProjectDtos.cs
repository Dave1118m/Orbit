using System;
using System.Collections.Generic;

namespace OrbitApi.DTOs
{
    public enum ProjectStatus { Draft = 0, Active = 1, OnHold = 2, Completed = 3, Cancelled = 4 }

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
        public List<int>? TeamIds { get; set; }
        public int TaskCount { get; set; }
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
        public byte[]? RowVersion { get; set; }
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
}
