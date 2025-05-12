using AI_Scrum.Models;
using System.Net.Http.Json;

namespace AI_Scrum.Services
{
    public class TaskEstimationService : ITaskEstimationService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<TaskEstimationService> _logger;
        private readonly HttpClient _httpClient;
        private readonly Dictionary<string, float> _assigneeExperienceFactors;

        public TaskEstimationService(IConfiguration configuration, ILogger<TaskEstimationService> logger, IHttpClientFactory httpClientFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _httpClient = httpClientFactory?.CreateClient("EstimationAPI") ?? new HttpClient();
            
            // Simulated experience factors for different team members
            _assigneeExperienceFactors = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase)
            {
                { "Balakrishnan Krishnabose", 0.9f }, // Experienced - faster
                { "Bhavya Damodharan", 1.0f },        // Average speed
                { "Dhinakaraj Sivakumar", 0.85f },    // Very experienced - faster
                { "Dinesh Kumar", 1.1f },             // Less experienced - slower
                { "Dinesh Kumar K", 0.95f },          // Moderately experienced
                { "Ezhilarasan D.", 1.05f },          // Slightly less experienced
                { "Kalakriti Kamalakkannan", 1.0f },  // Average speed
                { "Mano Ranjini Krithiga", 0.9f }     // Experienced - faster
            };
        }

        public async Task<TaskEstimate> EstimateTaskAsync(TaskEstimateRequest request)
        {
            try
            {
                var endpointUrl = _configuration["AI:EstimationModelEndpoint"];
                
                if (string.IsNullOrEmpty(endpointUrl))
                {
                    _logger.LogWarning("Task estimation endpoint not configured. Using ML simulation.");
                    return GenerateMlSimulatedEstimate(request);
                }

                // In a real implementation, you would call an ML model API
                // For demo purposes, return simulated ML estimation
                return GenerateMlSimulatedEstimate(request);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error estimating task");
                return new TaskEstimate
                {
                    TaskId = request.TaskId,
                    TaskTitle = request.TaskTitle,
                    EstimatedHours = 8, // Default fallback
                    ConfidenceScore = 0.5f,
                    Factors = new List<string> { "Error in estimation" }
                };
            }
        }
        
        private TaskEstimate GenerateMlSimulatedEstimate(TaskEstimateRequest request)
        {
            // Base estimates by task type
            var baseEstimateByType = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase)
            {
                { "Bug", 4.0 },
                { "Change Request", 6.0 },
                { "Feature", 8.0 },
                { "Documentation", 3.0 },
                { "Test", 2.5 },
                { "Research", 5.0 }
            };

            // Default base estimate if type not found
            double estimatedHours = baseEstimateByType.TryGetValue(request.TaskType, out double baseEstimate)
                ? baseEstimate
                : 4.0;
                
            var factors = new List<string>();
            var confidence = 0.8f;
            
            // Add factor for the task type used in estimation
            factors.Add($"Task type: {request.TaskType}");
            
            // Adjust for task complexity
            switch (request.Complexity.ToLower())
            {
                case "high":
                    estimatedHours *= 1.75;
                    factors.Add("High complexity (1.75x)");
                    confidence -= 0.15f;
                    break;
                case "medium":
                    estimatedHours *= 1.0;
                    factors.Add("Medium complexity (baseline)");
                    break;
                case "low":
                    estimatedHours *= 0.6;
                    factors.Add("Low complexity (0.6x)");
                    confidence += 0.1f;
                    break;
                default:
                    factors.Add("Unknown complexity - using baseline");
                    break;
            }
            
            // Adjust for assignee experience if provided
            if (!string.IsNullOrEmpty(request.TeamContext))
            {
                string assignee = request.TeamContext;
                if (_assigneeExperienceFactors.TryGetValue(assignee, out float experienceFactor))
                {
                    estimatedHours *= experienceFactor;
                    
                    // Add factor for the assignee's experience
                    if (experienceFactor < 1.0f)
                    {
                        factors.Add($"Assignee {assignee} is experienced ({experienceFactor:F2}x)");
                    }
                    else if (experienceFactor > 1.0f)
                    {
                        factors.Add($"Assignee {assignee} has less experience ({experienceFactor:F2}x)");
                    }
                    else
                    {
                        factors.Add($"Assignee {assignee} has average experience");
                    }
                }
            }
            
            // For "ML simulation" - analyze the title for keywords that might affect estimation
            string normalizedTitle = request.TaskTitle.ToLower();
            if (normalizedTitle.Contains("refactor") || normalizedTitle.Contains("redesign"))
            {
                estimatedHours *= 1.3;
                factors.Add("Title suggests refactoring work (1.3x)");
                confidence -= 0.05f;
            }
            
            if (normalizedTitle.Contains("urgent") || normalizedTitle.Contains("critical") || normalizedTitle.Contains("emergency"))
            {
                estimatedHours *= 0.9; // Urgent tasks often get done faster due to focus
                factors.Add("Title suggests urgency (0.9x)");
                confidence -= 0.1f; // But with less confidence
            }
            
            if (normalizedTitle.Contains("fix") || normalizedTitle.Contains("patch"))
            {
                estimatedHours *= 0.85;
                factors.Add("Title suggests minor fix (0.85x)");
            }
            
            if (normalizedTitle.Contains("implement") || normalizedTitle.Contains("create new"))
            {
                estimatedHours *= 1.2;
                factors.Add("Title suggests new implementation (1.2x)");
            }
            
            // Round to one decimal place for a cleaner estimate
            estimatedHours = Math.Round(estimatedHours, 1);
            // Ensure we don't estimate less than 0.5 hours
            estimatedHours = Math.Max(0.5, estimatedHours);
            
            // Small random variation for realistic ML-like behavior
            var random = new Random();
            double randomFactor = 1.0 + (random.NextDouble() * 0.2 - 0.1); // +/- 10% random variation
            estimatedHours *= randomFactor;
            
            // Round again after random factor
            estimatedHours = Math.Round(estimatedHours, 1);
            
            return new TaskEstimate
            {
                TaskId = request.TaskId,
                TaskTitle = request.TaskTitle,
                EstimatedHours = estimatedHours,
                ConfidenceScore = Math.Min(0.95f, Math.Max(0.5f, confidence)),
                Factors = factors
            };
        }
        
        // Keep the original method for backward compatibility
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