using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface IAiRecommendationService
    {
        Task<List<Recommendation>> GetRecommendationsAsync(string iterationPath);
        Task<List<Recommendation>> GetBlockerRecommendationsAsync(string iterationPath);
        Task<List<Recommendation>> GetWorkloadRecommendationsAsync(string iterationPath);
    }
} 