using AI_Scrum.Models;
using System.Net.Http.Json;

namespace AI_Scrum.Services
{
    public class TaskEstimationService : ITaskEstimationService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TaskEstimationService> _logger;
        private readonly HttpClient _httpClient;

        public TaskEstimationService(IConfiguration configuration, ILogger<TaskEstimationService> logger, IHttpClientFactory httpClientFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _httpClient = httpClientFactory?.CreateClient("EstimationAPI") ?? new HttpClient();
        }

        public async Task<TaskEstimate> EstimateTaskAsync(TaskEstimateRequest request)
        {
            try
            {
                var endpointUrl = _configuration["AI:EstimationModelEndpoint"];
                
                if (string.IsNullOrEmpty(endpointUrl))
                {
                    _logger.LogWarning("Task estimation endpoint not configured. Using mock estimates.");
                    return GenerateMockEstimate(request);
                }
                
                // In a real implementation, you would call an ML model API
                // For demo purposes, return mock data
                return GenerateMockEstimate(request);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error estimating task");
                return new TaskEstimate
                {
                    TaskId = request.TaskId,
                    EstimatedHours = 8, // Default fallback
                    ConfidenceScore = 0.5f,
                    Factors = new List<string> { "Error in estimation" }
                };
            }
        }
        
        private TaskEstimate GenerateMockEstimate(TaskEstimateRequest request)
        {
            // Generate time estimate based on simplified rules
            var estimatedHours = 4; // Default base estimate
            var factors = new List<string>();
            var confidence = 0.8f;
            
            // Adjust for task complexity
            if (request.Complexity.ToLower() == "high")
            {
                estimatedHours *= 2;
                factors.Add("High complexity");
                confidence -= 0.1f;
            }
            else if (request.Complexity.ToLower() == "low")
            {
                estimatedHours = Math.Max(1, estimatedHours / 2);
                factors.Add("Low complexity");
                confidence += 0.1f;
            }
            
            // Adjust for priority
            if (!string.IsNullOrEmpty(request.Priority) && int.TryParse(request.Priority, out int priorityValue))
            {
                if (priorityValue <= 1)
                {
                    estimatedHours += 2;
                    factors.Add("High priority");
                }
            }
            
            // Adjust for skills required
            if (request.RequiredSkills != null && request.RequiredSkills.Any())
            {
                if (request.RequiredSkills.Count > 2)
                {
                    estimatedHours += request.RequiredSkills.Count - 2;
                    factors.Add($"Multiple skills required ({request.RequiredSkills.Count})");
                    confidence -= 0.05f * (request.RequiredSkills.Count - 2);
                }
            }
            
            // Random variation for demo purposes
            var random = new Random();
            estimatedHours = Math.Max(1, estimatedHours + random.Next(-1, 2));
            
            return new TaskEstimate
            {
                TaskId = request.TaskId,
                TaskTitle = request.TaskTitle,
                EstimatedHours = estimatedHours,
                ConfidenceScore = Math.Min(0.95f, Math.Max(0.5f, confidence)),
                Factors = factors
            };
        }
    }
} 