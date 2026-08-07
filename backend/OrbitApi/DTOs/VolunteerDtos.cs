using System.ComponentModel.DataAnnotations;
using OrbitApi.Models;

namespace OrbitApi.DTOs;

public class VolunteerDto
{
    public int Id { get; set; }
    public int OrganizationId { get; set; }
    public int? UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Skills { get; set; }
    public string? Availability { get; set; }
    public string BackgroundCheckStatus { get; set; } = string.Empty;
    public string? InviteToken { get; set; }
    public string? InviteUrl { get; set; }
}

public class CreateVolunteerDto
{
    [Required]
    public int OrganizationId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    [EmailAddress]
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Skills { get; set; }
    public string? Availability { get; set; }
    public string BackgroundCheckStatus { get; set; } = "Pending";
    public int? UserId { get; set; }
}

public class PublicApplyVolunteerDto
{
    [Required]
    public int OrganizationId { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Skills { get; set; }
    public string? Availability { get; set; }
}

public class UpdateVolunteerDto
{
    public string? Name { get; set; }
    [EmailAddress]
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Skills { get; set; }
    public string? Availability { get; set; }
    public string? BackgroundCheckStatus { get; set; }
    public int? UserId { get; set; }
}

public class AssignVolunteerDto
{
    [Required]
    public int VolunteerId { get; set; }
}

public class TaskVolunteerDto
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    public int VolunteerId { get; set; }
    public DateTime AssignedAt { get; set; }
    public VolunteerDto? Volunteer { get; set; }
}

public class LogVolunteerHourDto
{
    [Required]
    public int VolunteerId { get; set; }
    [Required]
    public int TaskId { get; set; }
    [Required]
    [Range(0.1, 1000)]
    public decimal Hours { get; set; }
    [Required]
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
}

public class VolunteerHourDto
{
    public int Id { get; set; }
    public int VolunteerId { get; set; }
    public int TaskId { get; set; }
    public decimal Hours { get; set; }
    public DateTime Date { get; set; }
    public string? Notes { get; set; }
    public int LoggedByUserId { get; set; }
    public string ApprovalStatus { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? TaskTitle { get; set; }
    public string? VolunteerName { get; set; }
}
