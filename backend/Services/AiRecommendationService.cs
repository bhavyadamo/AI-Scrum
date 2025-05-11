using AI_Scrum.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AI_Scrum.Services
{
    public class AiRecommendationService : IAiRecommendationService
    {
        private readonly ILogger<AiRecommendationService> _logger;
        private readonly IAzureDevOpsService _azureDevOpsService;

        public AiRecommendationService(ILogger<AiRecommendationService> logger, IAzureDevOpsService azureDevOpsService)
        {
            _logger = logger;
            _azureDevOpsService = azureDevOpsService;
        }

        public async Task<List<Recommendation>> GetRecommendationsAsync(string iterationPath)
        {
            try
            {
                // In a full implementation, you would analyze data, use ML models, etc.
                // For demo purposes, return static data
                var workItems = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                
                return new List<Recommendation>
                {
                    new Recommendation
                    {
                        Id = 1,
                        Title = "Consider breaking down large tasks",
                        Description = "Some tasks are taking longer than expected. Consider breaking them down into smaller units.",
                        Impact = "High",
                        Type = RecommendationType.WorkItemManagement,
                        RelatedItems = new List<string> { "Task #1002", "Task #1007" }
                    },
                    new Recommendation
                    {
                        Id = 2,
                        Title = "Team capacity is unbalanced",
                        Description = "Some team members have significantly more work assigned than others.",
                        Impact = "Medium",
                        Type = RecommendationType.TeamWorkload,
                        RelatedItems = new List<string> { "Jane Smith", "Sam Wilson" }
                    },
                    new Recommendation
                    {
                        Id = 3,
                        Title = "Consider addressing blocked items",
                        Description = "There are blocked items that are critical for sprint completion.",
                        Impact = "High",
                        Type = RecommendationType.BlockerResolution,
                        RelatedItems = new List<string> { "Task #1007" }
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating recommendations");
                return new List<Recommendation>();
            }
        }

        public async Task<List<Recommendation>> GetBlockerRecommendationsAsync(string iterationPath)
        {
            try
            {
                var workItems = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                var blockedItems = workItems.Where(wi => wi.Status == "Blocked").ToList();
                
                if (!blockedItems.Any())
                {
                    return new List<Recommendation>();
                }
                
                return new List<Recommendation>
                {
                    new Recommendation
                    {
                        Id = 1,
                        Title = "Escalate blocked CI/CD pipeline task",
                        Description = "The CI/CD pipeline task has been blocked for 2 days. Consider escalating or reassigning.",
                        Impact = "High",
                        Type = RecommendationType.BlockerResolution,
                        RelatedItems = new List<string> { "Task #1007" }
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating blocker recommendations");
                return new List<Recommendation>();
            }
        }

        public async Task<List<Recommendation>> GetWorkloadRecommendationsAsync(string iterationPath)
        {
            try
            {
                var workItems = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                var teamMembers = await _azureDevOpsService.GetTeamMembersAsync();
                
                // In a real implementation, you would analyze workload distribution
                return new List<Recommendation>
                {
                    new Recommendation
                    {
                        Id = 1,
                        Title = "Redistribute tasks from Jane Smith",
                        Description = "Jane Smith has 5 active tasks, which is above team average. Consider redistributing some tasks.",
                        Impact = "Medium",
                        Type = RecommendationType.TeamWorkload,
                        RelatedItems = new List<string> { "Jane Smith", "Task #1004", "Task #1015" }
                    },
                    new Recommendation
                    {
                        Id = 2,
                        Title = "Assign unassigned tasks",
                        Description = "There are 5 unassigned tasks. Consider assigning them to team members with capacity.",
                        Impact = "Medium",
                        Type = RecommendationType.TeamWorkload,
                        RelatedItems = new List<string> { "Task #1006", "Task #1009", "Task #1010", "Task #1011", "Task #1012" }
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating workload recommendations");
                return new List<Recommendation>();
            }
        }
    }
} 