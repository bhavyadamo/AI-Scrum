using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface IAzureDevOpsService
    {
        Task<List<string>> GetIterationPathsAsync();
        Task<List<TeamMember>> GetTeamMembersAsync(string iterationPath = null);
        Task<List<TeamMember>> GetTeamMembersByTeamAsync(string teamName, string iterationPath = null);
        Task<List<WorkItem>> GetWorkItemsAsync(string iterationPath);
        Task<bool> UpdateWorkItemAsync(int id, Dictionary<string, object> updates);
        Task<SprintOverview> GetCurrentSprintAsync();
        Task<SprintOverview> GetSprintDetailsByIterationPathAsync(string iterationPath);
        Task<List<ActivityItem>> GetActivityLogAsync(int count = 10);
        Task<ChatResponse> HandleChatQueryAsync(string query, string currentIterationPath);
    }
} 