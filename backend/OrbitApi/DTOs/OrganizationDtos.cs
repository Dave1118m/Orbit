using System;
using System.Collections.Generic;
using OrbitApi.Models;

namespace OrbitApi.DTOs
{
    public class OrganizationDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public string? LogoUrl { get; set; }
        public string? RegistrationNumber { get; set; }
        public string? Country { get; set; }
        public int? OwnerId { get; set; }
        public decimal? Budget { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public bool HasCompliance { get; set; }
        public int PartnerCount { get; set; }
        public int MemberCount { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class CreateOrganizationRequest
    {
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public string? LogoUrl { get; set; }
        public string? RegistrationNumber { get; set; }
        public string? Country { get; set; }
        public int? OwnerId { get; set; }
        public decimal? Budget { get; set; }
    }

    public class UpdateOrganizationRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? LogoUrl { get; set; }
        public string? RegistrationNumber { get; set; }
        public string? Country { get; set; }
        public int? OwnerId { get; set; }
        public decimal? Budget { get; set; }
        public byte[]? RowVersion { get; set; }
    }

    public class OrganizationDetailDto : OrganizationDto
    {
        public OrganizationComplianceDto? Compliance { get; set; }
        public List<OrganizationPartnerDto> Partners { get; set; } = new();
        public List<OrganizationMemberDto> Members { get; set; } = new();
    }

    public class OrganizationMemberDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public OrgMemberStatus Status { get; set; }
        public DateTime JoinedAt { get; set; }
    }

    public class OrganizationPartnerDto
    {
        public int PartnerOrgId { get; set; }
        public string PartnerName { get; set; } = string.Empty;
        public DateTime LinkedAt { get; set; }
        public string? Notes { get; set; }
    }

    public class InviteMemberRequest
    {
        public string Email { get; set; } = string.Empty;
        public string PreAssignedRoleName { get; set; } = string.Empty;
    }

    public class OrganizationInvitationDto
    {
        public int Id { get; set; }
        public string Email { get; set; } = string.Empty;
        public string PreAssignedRoleName { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public InvitationStatus Status { get; set; }
        public string InvitedByUserName { get; set; } = string.Empty;
    }

    public class TransferOwnershipRequest
    {
        public int NewOwnerUserId { get; set; }
    }

    public class LinkPartnerRequest
    {
        public int PartnerOrgId { get; set; }
        public string? Notes { get; set; }
    }

    public class OrganizationComplianceDto
    {
        public string? RegistrationDocPath { get; set; }
        public TaxExemptStatus TaxExemptStatus { get; set; }
        public string? TaxExemptDocPath { get; set; }
        public DateTime? RegistrationRenewalDate { get; set; }
        public DateTime? TaxExemptRenewalDate { get; set; }
    }

    public class UpsertComplianceRequest
    {
        public string? RegistrationDocPath { get; set; }
        public TaxExemptStatus TaxExemptStatus { get; set; }
        public string? TaxExemptDocPath { get; set; }
        public DateTime? RegistrationRenewalDate { get; set; }
        public DateTime? TaxExemptRenewalDate { get; set; }
    }
}
