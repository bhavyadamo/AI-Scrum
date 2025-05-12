using AI_Scrum.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AI_Scrum.Services
{
    public interface IRecommendationService
    {
        Task<List<RecommendationDto>> GetRecommendationsAsync();
    }
} 