using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AI_Scrum.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi;
using Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models;
using Microsoft.VisualStudio.Services.Common;
using Microsoft.VisualStudio.Services.WebApi;
using Microsoft.VisualStudio.Services.WebApi.Patch;
using Microsoft.VisualStudio.Services.WebApi.Patch.Json;
using Microsoft.TeamFoundation.Core.WebApi;
using Microsoft.TeamFoundation.Work.WebApi;
using Microsoft.TeamFoundation.Core.WebApi.Types;
using AzDOWorkItem = Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models.WorkItem;
using AzDOTeamMember = Microsoft.VisualStudio.Services.WebApi.TeamMember;

namespace AI_Scrum.Services
{
    public class AzureDevOpsService : IAzureDevOpsService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AzureDevOpsService> _logger;
        private readonly string _organization;
        private readonly string _project;
        private readonly string _pat;

        public AzureDevOpsService(IConfiguration configuration, ILogger<AzureDevOpsService> logger)
        {
            _configuration = configuration;
            _logger = logger;
            
            _organization = _configuration["AzureDevOps:Organization"] ?? "";
            _project = _configuration["AzureDevOps:Project"] ?? "";
            _pat = _configuration["AzureDevOps:PAT"] ?? "";
        }

        private VssConnection GetConnection()
        {
            var credentials = new VssBasicCredential(string.Empty, _pat);
            var uri = new Uri($"https://dev.azure.com/{_organization}");
            return new VssConnection(uri, credentials);
        }

        public async Task<List<string>> GetIterationPathsAsync()
        {
            try
            {
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Returning demo data for iteration paths.");
                    return GetDemoIterationPaths();
                }

                using var connection = GetConnection();
                var projectClient = connection.GetClient<ProjectHttpClient>();
                var teamClient = connection.GetClient<TeamHttpClient>();

                // Get project
                var project = await projectClient.GetProject(_project);
                if (project == null)
                {
                    _logger.LogError("Project {Project} not found", _project);
                    return GetDemoIterationPaths();
                }

                // Get team context - fix for TeamContext not found
                var teams = await teamClient.GetTeamsAsync(project.Id.ToString());
                if (teams == null || !teams.Any())
                {
                    _logger.LogWarning("No teams found in project {Project}", _project);
                    return GetDemoIterationPaths();
                }

                var defaultTeam = teams.FirstOrDefault();
                if (defaultTeam == null)
                {
                    _logger.LogWarning("Could not find default team in project {Project}", _project);
                    return GetDemoIterationPaths();
                }

                // Get iterations using team and project
                var workClient = connection.GetClient<WorkHttpClient>();
                // Create a proper TeamContext object
                var teamContext = new TeamContext(project.Id.ToString())
                {
                    Team = defaultTeam.Id.ToString()
                };
                var iterations = await workClient.GetTeamIterationsAsync(teamContext);
                if (iterations == null || !iterations.Any())
                {
                    _logger.LogWarning("No iterations found for project {Project}", _project);
                    return GetDemoIterationPaths();
                }

                // Extract iteration paths
                var iterationPaths = iterations
                    .OrderByDescending(i => i.Attributes?.StartDate)
                    .Select(i => i.Path)
                    .Where(p => !string.IsNullOrEmpty(p))
                    .ToList();

                return iterationPaths;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting iteration paths from Azure DevOps");
                return GetDemoIterationPaths();
            }
        }

        private List<string> GetDemoIterationPaths()
        {
            // Return demo data for development/when Azure DevOps is not configured
            return new List<string>
            {
                "Techoil\\2.3.23",
                "Techoil\\2.3.24",
                "Techoil\\2.3.25",
                "Techoil\\2.3.26"
            };
        }

        public async Task<List<AI_Scrum.Models.TeamMember>> GetTeamMembersAsync()
        {
            try
            {
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Returning demo data.");
                    return GetDemoTeamMembers();
                }

                using var connection = GetConnection();
                var projectClient = connection.GetClient<ProjectHttpClient>();
                var teamClient = connection.GetClient<TeamHttpClient>();

                // Get project
                var project = await projectClient.GetProject(_project);
                if (project == null)
                {
                    _logger.LogError("Project {Project} not found", _project);
                    return GetDemoTeamMembers();
                }

                // Get default team (or you could list all teams and select one)
                var teams = await teamClient.GetTeamsAsync(project.Id.ToString());
                if (teams == null || !teams.Any())
                {
                    _logger.LogError("No teams found in project {Project}", _project);
                    return GetDemoTeamMembers();
                }

                var defaultTeam = teams.FirstOrDefault();
                if (defaultTeam == null)
                {
                    _logger.LogError("Could not find default team in project {Project}", _project);
                    return GetDemoTeamMembers();
                }

                // Get team members
                var teamMembers = await teamClient.GetTeamMembersWithExtendedPropertiesAsync(
                    project.Id.ToString(),
                    defaultTeam.Id.ToString());

                if (teamMembers == null || !teamMembers.Any())
                {
                    _logger.LogWarning("No team members found in team {Team}", defaultTeam.Name);
                    return GetDemoTeamMembers();
                }

                var result = new List<AI_Scrum.Models.TeamMember>();
                foreach (var member in teamMembers)
                {
                    result.Add(new AI_Scrum.Models.TeamMember
                    {
                        Id = member.Identity.Id.ToString(),
                        DisplayName = member.Identity.DisplayName,
                        Email = member.Identity.UniqueName,
                        CurrentWorkload = 0, // Set default workload - this would be calculated from active tasks
                        IsActive = true // Assume all team members are active
                    });
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting team members from Azure DevOps");
                return GetDemoTeamMembers();
            }
        }

        private List<AI_Scrum.Models.TeamMember> GetDemoTeamMembers()
        {
            // Return demo data for development/when Azure DevOps is not configured
            return new List<AI_Scrum.Models.TeamMember>
            {
                new AI_Scrum.Models.TeamMember { Id = "user1", DisplayName = "John Doe", Email = "john@example.com", CurrentWorkload = 3, IsActive = true },
                new AI_Scrum.Models.TeamMember { Id = "user2", DisplayName = "Jane Smith", Email = "jane@example.com", CurrentWorkload = 5, IsActive = true },
                new AI_Scrum.Models.TeamMember { Id = "user3", DisplayName = "Sam Wilson", Email = "sam@example.com", CurrentWorkload = 2, IsActive = true },
                new AI_Scrum.Models.TeamMember { Id = "user4", DisplayName = "Alex Johnson", Email = "alex@example.com", CurrentWorkload = 4, IsActive = true }
            };
        }

        public async Task<List<AI_Scrum.Models.WorkItem>> GetWorkItemsAsync(string iterationPath)
        {
            try
            {
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Returning demo data.");
                    return GetDemoWorkItems();
                }

                using var connection = GetConnection();
                var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

                // Query for work items in the specified iteration
                var wiql = new Wiql
                {
                    Query = $"SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.WorkItemType], [System.Tags] " +
                           $"FROM WorkItems " +
                           $"WHERE [System.TeamProject] = '{_project}' " +
                           $"AND [System.IterationPath] = '{iterationPath}' " +
                           $"ORDER BY [System.Id]"
                };

                var queryResult = await witClient.QueryByWiqlAsync(wiql);
                
                if (queryResult.WorkItems.Count() == 0)
                {
                    return new List<AI_Scrum.Models.WorkItem>();
                }
                
                // Get work item details for the results
                var ids = queryResult.WorkItems.Select(wi => wi.Id).ToArray();
                var workItemRefs = await witClient.GetWorkItemsAsync(ids, 
                    expand: Microsoft.TeamFoundation.WorkItemTracking.WebApi.Models.WorkItemExpand.All);
                
                var workItems = new List<AI_Scrum.Models.WorkItem>();
                
                foreach (var item in workItemRefs)
                {
                    var workItem = new AI_Scrum.Models.WorkItem
                    {
                        Id = item.Id.Value,
                        Title = item.Fields["System.Title"]?.ToString() ?? "",
                        Status = item.Fields["System.State"]?.ToString() ?? "",
                        Type = item.Fields["System.WorkItemType"]?.ToString() ?? "",
                        AssignedTo = item.Fields.ContainsKey("System.AssignedTo") 
                            ? (item.Fields["System.AssignedTo"] is Microsoft.VisualStudio.Services.WebApi.IdentityRef assignedToRef 
                                ? assignedToRef.DisplayName 
                                : item.Fields["System.AssignedTo"]?.ToString() ?? "")
                            : "",
                        Priority = item.Fields.ContainsKey("Microsoft.VSTS.Common.Priority") 
                            ? item.Fields["Microsoft.VSTS.Common.Priority"]?.ToString() ?? "3" 
                            : "3",
                        IterationPath = item.Fields["System.IterationPath"]?.ToString() ?? ""
                    };
                    
                    workItems.Add(workItem);
                }
                
                return workItems;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting work items for iteration {IterationPath}", iterationPath);
                return GetDemoWorkItems();
            }
        }

        private List<AI_Scrum.Models.WorkItem> GetDemoWorkItems()
        {
            // Return demo data for development/when Azure DevOps is not configured
            return new List<AI_Scrum.Models.WorkItem>
            {
                new AI_Scrum.Models.WorkItem { Id = 1001, Title = "Create login screen", Status = "Completed", AssignedTo = "Jane Smith", Type = "Task", Priority = "2", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1002, Title = "Implement user authentication", Status = "In Progress", AssignedTo = "John Doe", Type = "Task", Priority = "1", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1003, Title = "Design database schema", Status = "Completed", AssignedTo = "Sam Wilson", Type = "Task", Priority = "1", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1004, Title = "Create API endpoints", Status = "In Progress", AssignedTo = "Jane Smith", Type = "Task", Priority = "2", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1005, Title = "Implement dashboard UI", Status = "In Progress", AssignedTo = "Alex Johnson", Type = "Task", Priority = "2", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1006, Title = "Write unit tests", Status = "To Do", AssignedTo = "", Type = "Task", Priority = "3", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1007, Title = "Setup CI/CD pipeline", Status = "Blocked", AssignedTo = "John Doe", Type = "Task", Priority = "2", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1008, Title = "Implement error logging", Status = "Completed", AssignedTo = "Sam Wilson", Type = "Task", Priority = "3", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1009, Title = "Create user documentation", Status = "To Do", AssignedTo = "", Type = "Task", Priority = "4", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1010, Title = "Performance optimization", Status = "To Do", AssignedTo = "", Type = "Task", Priority = "3", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1011, Title = "Security audit", Status = "To Do", AssignedTo = "", Type = "Task", Priority = "1", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1012, Title = "Integration testing", Status = "To Do", AssignedTo = "", Type = "Task", Priority = "2", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1013, Title = "Implement feedback from testers", Status = "Completed", AssignedTo = "Alex Johnson", Type = "Task", Priority = "2", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1014, Title = "Deploy to staging", Status = "Completed", AssignedTo = "John Doe", Type = "Task", Priority = "1", IterationPath = "Project\\Sprint 3" },
                new AI_Scrum.Models.WorkItem { Id = 1015, Title = "Final QA review", Status = "In Progress", AssignedTo = "Jane Smith", Type = "Task", Priority = "1", IterationPath = "Project\\Sprint 3" }
            };
        }

        public async Task<bool> UpdateWorkItemAsync(int id, Dictionary<string, object> updates)
        {
            try
            {
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Simulating update success.");
                    return true;
                }

                using var connection = GetConnection();
                var witClient = connection.GetClient<WorkItemTrackingHttpClient>();
                
                var patchDocument = new JsonPatchDocument();
                
                foreach (var update in updates)
                {
                    patchDocument.Add(new JsonPatchOperation()
                    {
                        Operation = Operation.Add,
                        Path = $"/fields/{update.Key}",
                        Value = update.Value
                    });
                }
                
                try
                {
                    var result = await witClient.UpdateWorkItemAsync(patchDocument, id);
                    return result != null;
                }
                catch (VssUnauthorizedException)
                {
                    _logger.LogError("Azure DevOps authorization failed. Check your PAT token permissions.");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating work item {Id}", id);
                return false;
            }
        }

        public async Task<SprintOverview> GetCurrentSprintAsync()
        {
            try
            {
                // In a full implementation, you would use the Microsoft.TeamFoundation.Work.WebApi
                // to get the current iteration information
                
                // For demo purposes, return static data
                var now = DateTime.Now;
                return new SprintOverview
                {
                    SprintName = "Sprint 3",
                    StartDate = now.AddDays(-10),
                    EndDate = now.AddDays(4),
                    DaysRemaining = 4,
                    IterationPath = "Project\\Sprint 3"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current sprint");
                throw;
            }
        }

        public async Task<List<ActivityItem>> GetActivityLogAsync(int count = 10)
        {
            try
            {
                // In a full implementation, you would use various Azure DevOps APIs
                // to get activity information from work items, commits, etc.
                
                // For demo purposes, return static data
                var now = DateTime.Now;
                return new List<ActivityItem>
                {
                    new ActivityItem { Id = 1, ActivityType = ActivityType.WorkItemUpdated, Message = "Jane Smith updated task 'Create API endpoints'", Timestamp = now.AddHours(-1), User = "Jane Smith" },
                    new ActivityItem { Id = 2, ActivityType = ActivityType.WorkItemAssigned, Message = "Task 'Write unit tests' assigned to Sam Wilson", Timestamp = now.AddHours(-2), User = "John Doe" },
                    new ActivityItem { Id = 3, ActivityType = ActivityType.CodeCommitted, Message = "John Doe committed code: 'Implement user authentication'", Timestamp = now.AddHours(-3), User = "John Doe" },
                    new ActivityItem { Id = 4, ActivityType = ActivityType.WorkItemCreated, Message = "Alex Johnson created task 'Setup monitoring'", Timestamp = now.AddHours(-5), User = "Alex Johnson" },
                    new ActivityItem { Id = 5, ActivityType = ActivityType.WorkItemCompleted, Message = "Sam Wilson completed task 'Design database schema'", Timestamp = now.AddHours(-6), User = "Sam Wilson" },
                    new ActivityItem { Id = 6, ActivityType = ActivityType.CodeReviewed, Message = "Jane Smith reviewed code: 'Implement dashboard UI'", Timestamp = now.AddHours(-7), User = "Jane Smith" },
                    new ActivityItem { Id = 7, ActivityType = ActivityType.WorkItemBlocked, Message = "Task 'Setup CI/CD pipeline' blocked by John Doe", Timestamp = now.AddHours(-9), User = "John Doe" },
                    new ActivityItem { Id = 8, ActivityType = ActivityType.WorkItemUpdated, Message = "Alex Johnson updated task 'Implement dashboard UI'", Timestamp = now.AddHours(-10), User = "Alex Johnson" },
                    new ActivityItem { Id = 9, ActivityType = ActivityType.SprintStarted, Message = "Sprint 3 started", Timestamp = now.AddDays(-10), User = "System" },
                    new ActivityItem { Id = 10, ActivityType = ActivityType.MeetingScheduled, Message = "Daily Standup scheduled for 10:00 AM", Timestamp = now.AddHours(-23), User = "System" }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting activity log");
                throw;
            }
        }
    }
} 
