using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface IAzureDevOpsService
    {
        Task<List<string>> GetIterationPathsAsync();
        Task<List<TeamMember>> GetTeamMembersAsync();
        Task<List<WorkItem>> GetWorkItemsAsync(string iterationPath);
        Task<bool> UpdateWorkItemAsync(int id, Dictionary<string, object> updates);
        Task<SprintOverview> GetCurrentSprintAsync();
        Task<List<ActivityItem>> GetActivityLogAsync(int count = 10);
    }
} 