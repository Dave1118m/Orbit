using System.ComponentModel.DataAnnotations;

namespace OrbitApi.DTOs
{
    public class CreateRiskIssueRequest
    {
        /// <summary>"Risk" or "Issue"</summary>
        public string Type { get; set; } = "Risk";

        [Required]
        public string Description { get; set; } = string.Empty;

        /// <summary>Qualitative label, e.g. "Possible", "Likely"</summary>
        public string? Likelihood { get; set; }

        /// <summary>Qualitative label, e.g. "Minor", "Major"</summary>
        public string? Impact { get; set; }

        /// <summary>Numeric score 1–5</summary>
        [Range(1, 5)]
        public int LikelihoodScore { get; set; } = 1;

        /// <summary>Numeric score 1–5</summary>
        [Range(1, 5)]
        public int ImpactScore { get; set; } = 1;

        /// <summary>Risk type only — planned mitigation steps</summary>
        public string? MitigationPlan { get; set; }

        public string? Owner { get; set; }

        /// <summary>Open | InProgress | Mitigated | Resolved | Closed</summary>
        public string? Status { get; set; }
    }

    public class UpdateRiskIssueRequest
    {
        public string? Description { get; set; }
        public string? Likelihood { get; set; }
        public string? Impact { get; set; }

        [Range(1, 5)]
        public int? LikelihoodScore { get; set; }

        [Range(1, 5)]
        public int? ImpactScore { get; set; }

        public string? MitigationPlan { get; set; }
        public string? Owner { get; set; }

        /// <summary>Open | InProgress | Mitigated | Resolved | Closed</summary>
        public string? Status { get; set; }

        /// <summary>Resolution details for Issue type</summary>
        public string? ResolutionNotes { get; set; }

        /// <summary>Set to true to mark as resolved (sets ResolvedAt + ResolvedByUserId automatically)</summary>
        public bool? MarkResolved { get; set; }
    }
}
