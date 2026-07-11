using System;

namespace OrbitApi.DTOs
{
    public enum WorkspaceVisibility { Private = 0, Public = 1 }

    public class WorkspaceDto
    {
        public int Id { get; set; }
        public int OrganizationId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public WorkspaceVisibility Visibility { get; set; }
        public decimal? BudgetCeiling { get; set; }
        public bool IsArchived { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class CreateWorkspaceRequest
    {
        public int OrganizationId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public WorkspaceVisibility Visibility { get; set; }
        public decimal? BudgetCeiling { get; set; }
        public bool? IsArchived { get; set; }
    }

    public class UpdateWorkspaceRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public WorkspaceVisibility? Visibility { get; set; }
        public decimal? BudgetCeiling { get; set; }
        public bool? IsArchived { get; set; }
        public byte[]? RowVersion { get; set; }
    }
}
