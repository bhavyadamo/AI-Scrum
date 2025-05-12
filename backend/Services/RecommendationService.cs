using AI_Scrum.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace AI_Scrum.Services
{
    public class RecommendationService : IRecommendationService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<RecommendationService> _logger;
        private readonly IConfiguration _configuration;
        private readonly string _aiEngineBaseUrl;

        public RecommendationService(
            IHttpClientFactory httpClientFactory,
            ILogger<RecommendationService> logger,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _configuration = configuration;
            _aiEngineBaseUrl = _configuration["AIEngine:BaseUrl"] ?? "http://localhost:8000";
        }

        public async Task<List<RecommendationDto>> GetRecommendationsAsync()
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                
                // Get current tasks (in a real implementation, this would come from a task service)
                var tasks = await GetCurrentSprintTasksAsync();
                
                // Call the FastAPI recommendation endpoint
                var response = await client.PostAsJsonAsync($"{_aiEngineBaseUrl}/recommend", tasks);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to get recommendations from AI engine: {response.StatusCode}");
                    return new List<RecommendationDto>();
                }
                
                var aiRecommendations = await response.Content.ReadFromJsonAsync<List<AIRecommendation>>();
                
                if (aiRecommendations == null || aiRecommendations.Count == 0)
                {
                    return new List<RecommendationDto>();
                }
                
                // Map AI engine recommendations to our DTOs
                var recommendations = new List<RecommendationDto>();
                foreach (var aiRec in aiRecommendations)
                {
                    recommendations.Add(new RecommendationDto
                    {
                        Message = aiRec.Message,
                        Severity = aiRec.Severity,
                        Timestamp = DateTime.UtcNow
                    });
                }
                
                return recommendations;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting recommendations from AI engine");
                
                // If we're in development mode, return mock data
                if (_configuration["Environment"] == "Development")
                {
                    return GetMockRecommendations();
                }
                
                return new List<RecommendationDto>();
            }
        }
        
        private async Task<List<TaskDto>> GetCurrentSprintTasksAsync()
        {
            // In a real implementation, this would fetch tasks from a database or service
            // For now, we'll return mock data
            return new List<TaskDto>
            {
                new TaskDto { Id = "1", Title = "Implement login page", Status = "In Progress", Priority = "High" },
                new TaskDto { Id = "2", Title = "Design database schema", Status = "Completed", Priority = "High" },
                new TaskDto { Id = "7", Title = "Create API endpoints", Status = "To Do", Priority = "Medium" },
                new TaskDto { Id = "12", Title = "Write unit tests", Status = "To Do", Priority = "Medium" }
            };
        }
        
        private List<RecommendationDto> GetMockRecommendations()
        {
            return new List<RecommendationDto>
            {
                new RecommendationDto
                {
                    Message = "🧠 Complete Task #7 to unblock 2 other tasks",
                    Severity = "Info",
                    Timestamp = DateTime.UtcNow
                },
                new RecommendationDto
                {
                    Message = "📈 Prioritize Task #12 due to upcoming deadline",
                    Severity = "Warning",
                    Timestamp = DateTime.UtcNow.AddMinutes(-30)
                },
                new RecommendationDto
                {
                    Message = "⚠️ Sprint velocity is 30% below target",
                    Severity = "Critical",
                    Timestamp = DateTime.UtcNow.AddHours(-2)
                }
            };
        }
    }
    
    // Internal models for AI Engine communication
    internal class AIRecommendation
    {
        public string Message { get; set; } = string.Empty;
        public string Severity { get; set; } = "Info";
    }
    
    internal class TaskDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
    }
} 