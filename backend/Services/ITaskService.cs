using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface ITaskService
    {
        Task<List<WorkItem>> GetTasksAsync(string iterationPath);
        Task<bool> AssignTaskAsync(int taskId, string assignedTo);
        Task<Dictionary<string, string>> GetAutoAssignSuggestionsAsync(string iterationPath);
        Task<Dictionary<string, string>> GetAutoAssignSuggestionsForTeamAsync(string iterationPath, List<string> teamMembers);
        Task<bool> AutoAssignTasksAsync(string iterationPath);
        Task<WorkItemDetails> GetTaskDetailsAsync(int taskId);
        Task<Dictionary<string, int>> GetTeamMemberTaskCountsAsync(string iterationPath);
    }
} 