namespace AI_Scrum.Models
{
    public class ApplicationSettings
    {
        public AzureDevOpsSettings AzureDevOps { get; set; } = new AzureDevOpsSettings();
        public AISettings AI { get; set; } = new AISettings();
        public List<UserRole> Users { get; set; } = new List<UserRole>();
    }

    public class AzureDevOpsSettings
    {
        public string Organization { get; set; } = string.Empty;
        public string Project { get; set; } = string.Empty;
        public string PAT { get; set; } = string.Empty;
        public string DefaultTeam { get; set; } = string.Empty;
    }

    public class AISettings
    {
        public bool EnableAutoAssign { get; set; } = true;
        public bool EnableEstimation { get; set; } = true;
        public bool EnableRecommendations { get; set; } = true;
        public string EstimationModelEndpoint { get; set; } = string.Empty;
    }

    public class UserRole
    {
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = "Member"; // Admin or Member
    }
} 