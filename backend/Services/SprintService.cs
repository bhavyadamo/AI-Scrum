using AI_Scrum.Models;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace AI_Scrum.Services
{
    public class SprintService : ISprintService
    {
        private readonly IAzureDevOpsService _azureDevOpsService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<SprintService> _logger;

        public SprintService(
            IAzureDevOpsService azureDevOpsService,
            IConfiguration configuration,
            ILogger<SprintService> logger)
        {
            _azureDevOpsService = azureDevOpsService;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<SprintOverview> GetCurrentSprintAsync()
        {
            try
            {
                _logger.LogInformation("Getting current sprint information");
                return await _azureDevOpsService.GetCurrentSprintAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current sprint information");
                
                // Fallback for development/demo
                return new SprintOverview
                {
                    SprintName = "Sprint 3",
                    StartDate = DateTime.Now.AddDays(-10),
                    EndDate = DateTime.Now.AddDays(4),
                    DaysRemaining = 4,
                    IterationPath = "Project\\Sprint 3"
                };
            }
        }

        public async Task<SprintSummary> GetSprintSummaryAsync(string iterationPath)
        {
            try
            {
                _logger.LogInformation("Getting sprint summary for {IterationPath}", iterationPath);
                
                var tasks = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                
                var summary = new SprintSummary
                {
                    TotalTasks = tasks.Count,
                    InProgress = tasks.Count(t => t.Status == "In Progress"),
                    Completed = tasks.Count(t => t.Status == "Completed" || t.Status == "Done"),
                    Blocked = tasks.Count(t => t.Status == "Blocked")
                };
                
                summary.CompletionPercentage = summary.TotalTasks > 0 
                    ? (double)summary.Completed / summary.TotalTasks * 100 
                    : 0;
                
                return summary;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting sprint summary for {IterationPath}", iterationPath);
                
                // Fallback for development/demo
                return new SprintSummary
                {
                    TotalTasks = 15,
                    InProgress = 5,
                    Completed = 6,
                    Blocked = 1,
                    CompletionPercentage = 40
                };
            }
        }

        public async Task<ActivityFeed> GetActivityFeedAsync(int count = 10)
        {
            try
            {
                _logger.LogInformation("Getting activity feed");
                
                var activities = await _azureDevOpsService.GetActivityLogAsync(count);
                return new ActivityFeed { Activities = activities };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting activity feed");
                
                // Fallback for development/demo
                var demoActivities = new List<ActivityItem>
                {
                    new ActivityItem
                    {
                        Id = 1,
                        Type = "Updated",
                        Title = "Task #1234: Update UI components",
                        User = "Jane Smith",
                        Timestamp = DateTime.Now.AddHours(-2),
                        Details = "Changed status from 'In Progress' to 'Done'"
                    },
                    new ActivityItem
                    {
                        Id = 2,
                        Type = "Created",
                        Title = "Task #1235: Fix API integration",
                        User = "John Doe",
                        Timestamp = DateTime.Now.AddHours(-3),
                        Details = "New task created"
                    },
                    new ActivityItem
                    {
                        Id = 3,
                        Type = "Commented",
                        Title = "Task #1230: Database optimization",
                        User = "Sam Wilson",
                        Timestamp = DateTime.Now.AddHours(-5),
                        Details = "We should consider adding indexes to the customer table"
                    }
                };
                
                return new ActivityFeed { Activities = demoActivities };
            }
        }

        public async Task<string> GetDailyTipAsync()
        {
            try
            {
                _logger.LogInformation("Getting daily AI tip");
                
                // In a real implementation, this could come from an ML service
                // or a curated list of tips stored in a database
                string[] tips = new[]
                {
                    "Consider breaking down tasks that are taking more than 2 days to complete",
                    "Daily stand-ups should be timeboxed to 15 minutes max",
                    "Use story points for estimation rather than hours for better accuracy",
                    "Address blockers immediately - they impact the entire team's velocity",
                    "Keep your backlog refined and prioritized at all times",
                    "The ideal sprint velocity is when the team is productive but not burned out",
                    "Retrospectives should focus on actionable improvements",
                    "Update your tasks daily to keep the burndown chart accurate",
                    "Always have a clear Definition of Done for all tasks",
                    "Consider pair programming for complex features to improve quality"
                };
                
                // Use the day of the year to cycle through tips
                int dayOfYear = DateTime.Now.DayOfYear;
                return tips[dayOfYear % tips.Length];
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting daily AI tip");
                return "Remember to keep your tasks updated so everyone knows the sprint status!";
            }
        }
    }
} 