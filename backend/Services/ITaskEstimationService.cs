using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface ITaskEstimationService
    {
        Task<TaskEstimate> EstimateTaskAsync(TaskEstimateRequest request);
    }
} 