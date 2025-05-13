namespace AI_Scrum.Models
{
    public class AzureWorkItem
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Assignee { get; set; } = string.Empty;
        public string Complexity { get; set; } = string.Empty;
        public string IterationPath { get; set; } = string.Empty;
    }

    public class TaskEstimationRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Assignee { get; set; } = string.Empty;
        public string Complexity { get; set; } = string.Empty;
    }

    public class TaskTimeEstimate
    {
        public string DevTime { get; set; } = string.Empty;
        public string QaTime { get; set; } = string.Empty;
        public string TotalEstimate { get; set; } = string.Empty;
        public double Confidence { get; set; }
        public List<string> FactorsConsidered { get; set; } = new List<string>();
    }
} 