namespace OrbitApi.DTOs
{
    public class CreateRiskIssueRequest
    {
        public string Type { get; set; } = "Risk";
        public string? Likelihood { get; set; }
        public string? Impact { get; set; }
        public string? Owner { get; set; }
        public string? Status { get; set; }
    }

    public class UpdateRiskIssueRequest
    {
        public string? Likelihood { get; set; }
        public string? Impact { get; set; }
        public string? Owner { get; set; }
        public string? Status { get; set; }
    }
}
