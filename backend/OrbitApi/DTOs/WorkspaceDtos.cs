using System;

namespace OrbitApi.DTOs
{
    using OrbitApi.Models;

    public class WorkspaceDto
    {
        public int Id { get; set; }
        public int OrganizationId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public VisibilityLevel Visibility { get; set; }
        public decimal? BudgetCeiling { get; set; }
        public bool IsArchived { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class CreateWorkspaceRequest
    {
        public int OrganizationId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public VisibilityLevel Visibility { get; set; }
        public decimal? BudgetCeiling { get; set; }
        public bool? IsArchived { get; set; }
    }

    public class UpdateWorkspaceRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public VisibilityLevel? Visibility { get; set; }
        public decimal? BudgetCeiling { get; set; }
        public bool? IsArchived { get; set; }
        public byte[]? RowVersion { get; set; }
    }
}
