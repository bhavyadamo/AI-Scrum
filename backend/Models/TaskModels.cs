namespace AI_Scrum.Models
{
    public class WorkItem
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string AssignedTo { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string IterationPath { get; set; } = string.Empty;
        public string AutoAssignSuggestion { get; set; } = string.Empty;
    }

    public class WorkItemDetails : WorkItem
    {
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public List<int> RelatedWorkItems { get; set; } = new List<int>();
        public List<string> Tags { get; set; } = new List<string>();
        public double? EstimatedHours { get; set; }
        public double? RemainingHours { get; set; }
        public double? CompletedHours { get; set; }
    }

    public class TeamMember
    {
        public string Id { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int CurrentWorkload { get; set; }
        public bool IsActive { get; set; } = true;
    }
} 