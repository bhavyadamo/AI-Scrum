namespace AI_Scrum.Models
{
    public enum ConfidenceLevel
    {
        Low,
        Medium,
        High
    }

    public class TaskEstimateRequest
    {
        public int TaskId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Complexity { get; set; } = "Medium"; // Low, Medium, High
        public string Priority { get; set; } = "3";
        public List<string> RequiredSkills { get; set; } = new List<string>();
        public string TaskType { get; set; } = string.Empty;
        public string TeamContext { get; set; } = string.Empty;
    }

    public class TaskEstimate
    {
        public int TaskId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public double EstimatedHours { get; set; }
        public float ConfidenceScore { get; set; }
        public List<string> Factors { get; set; } = new List<string>();
        public DateTime EstimatedAt { get; set; } = DateTime.Now;
    }
} 