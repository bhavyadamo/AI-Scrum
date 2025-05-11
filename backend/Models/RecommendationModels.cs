namespace AI_Scrum.Models
{
    public enum RecommendationType
    {
        Blocker,
        Workload,
        Priority,
        General,
        WorkItemManagement,
        TeamWorkload,
        BlockerResolution
    }

    public class Recommendation
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public RecommendationType Type { get; set; }
        public double Confidence { get; set; }
        public string Impact { get; set; } = string.Empty;
        public List<int> RelatedWorkItemIds { get; set; } = new List<int>();
        public List<string> RelatedItems { get; set; } = new List<string>();
        public DateTime CreatedDate { get; set; } = DateTime.Now;
        public string ActionUrl { get; set; } = string.Empty;
    }
} 