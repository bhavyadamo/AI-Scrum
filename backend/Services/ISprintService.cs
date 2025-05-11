using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface ISprintService
    {
        Task<SprintOverview> GetCurrentSprintAsync();
        Task<SprintSummary> GetSprintSummaryAsync(string iterationPath);
        Task<ActivityFeed> GetActivityFeedAsync(int count = 10);
        Task<string> GetDailyTipAsync();
    }
} 