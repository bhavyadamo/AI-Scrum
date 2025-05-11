namespace AI_Scrum.Models
{
    public class SprintOverview
    {
        public string SprintName { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int DaysRemaining { get; set; }
        public string IterationPath { get; set; } = string.Empty;
    }

    public class SprintSummary
    {
        public int TotalTasks { get; set; }
        public int InProgress { get; set; }
        public int Completed { get; set; }
        public int Blocked { get; set; }
        public double CompletionPercentage { get; set; }
    }

    public enum ActivityType
    {
        WorkItemCreated,
        WorkItemUpdated,
        WorkItemAssigned,
        WorkItemCompleted,
        WorkItemBlocked,
        CodeCommitted,
        CodeReviewed,
        SprintStarted,
        MeetingScheduled
    }

    public class ActivityItem
    {
        public int Id { get; set; }
        public ActivityType ActivityType { get; set; }
        public string Message { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
    }

    public class ActivityFeed
    {
        public List<ActivityItem> Activities { get; set; } = new List<ActivityItem>();
    }
} 