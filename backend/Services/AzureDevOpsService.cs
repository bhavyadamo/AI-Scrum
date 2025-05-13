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
                "Techoil\\2.3.23"
                // Removed non-existent iteration paths that were causing errors
            };
        }

        public async Task<List<AI_Scrum.Models.TeamMember>> GetTeamMembersAsync(string iterationPath = null)
        {
            try
            {
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Returning demo data.");
                    return GetDemoTeamMembers(iterationPath);
                }

                using var connection = GetConnection();
                var projectClient = connection.GetClient<ProjectHttpClient>();
                var teamClient = connection.GetClient<TeamHttpClient>();
                var witClient = connection.GetClient<WorkItemTrackingHttpClient>();

                // Get project
                var project = await projectClient.GetProject(_project);
                if (project == null)
                {
                    _logger.LogError("Project {Project} not found", _project);
                    return GetDemoTeamMembers(iterationPath);
                }

                // Get default team (or you could list all teams and select one)
                var teams = await teamClient.GetTeamsAsync(project.Id.ToString());
                if (teams == null || !teams.Any())
                {
                    _logger.LogError("No teams found in project {Project}", _project);
                    return GetDemoTeamMembers(iterationPath);
                }

                var defaultTeam = teams.FirstOrDefault();
                if (defaultTeam == null)
                {
                    _logger.LogError("Could not find default team in project {Project}", _project);
                    return GetDemoTeamMembers(iterationPath);
                }

                // Get team members
                var teamMembers = await teamClient.GetTeamMembersWithExtendedPropertiesAsync(
                    project.Id.ToString(),
                    defaultTeam.Id.ToString());

                if (teamMembers == null || !teamMembers.Any())
                {
                    _logger.LogWarning("No team members found in team {Team}", defaultTeam.Name);
                    return GetDemoTeamMembers(iterationPath);
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
                        IsActive = true, // Assume all team members are active
                        UniqueName = member.Identity.UniqueName
                    });
                }

                // If we have an iteration path, calculate workload for each member based on tasks in that iteration
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    try
                    {
                        // Get work items for the iteration
                        var workItems = await GetWorkItemsAsync(iterationPath);
                        
                        // Calculate workload for each team member
                        foreach (var member in result)
                        {
                            member.CurrentWorkload = workItems.Count(wi => 
                                !string.IsNullOrEmpty(wi.AssignedTo) && 
                                (wi.AssignedTo.Equals(member.DisplayName, StringComparison.OrdinalIgnoreCase) || 
                                 wi.AssignedTo.Contains(member.Email, StringComparison.OrdinalIgnoreCase) ||
                                 wi.AssignedTo.Contains(member.UniqueName, StringComparison.OrdinalIgnoreCase)));
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error calculating workload for team members in iteration {IterationPath}", iterationPath);
                    }
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting team members from Azure DevOps");
                return GetDemoTeamMembers(iterationPath);
            }
        }

        private List<AI_Scrum.Models.TeamMember> GetDemoTeamMembers(string iterationPath = null)
        {
            // Return demo data for development/when Azure DevOps is not configured
            var demoMembers = new List<AI_Scrum.Models.TeamMember>
            {
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user1", 
                    DisplayName = "Ranjith Kumar S", 
                    Email = "ranjithkumar.s@inatech.onmicrosoft.com", 
                    CurrentWorkload = 0, 
                    IsActive = true,
                    UniqueName = "ranjithkumar.s"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user2", 
                    DisplayName = "Bhavya Damodharan", 
                    Email = "bhavya.d@example.com", 
                    CurrentWorkload = 1, 
                    IsActive = true,
                    UniqueName = "bhavya.d"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user3", 
                    DisplayName = "Suresh GM", 
                    Email = "suresh.gm@example.com", 
                    CurrentWorkload = 3, 
                    IsActive = true,
                    UniqueName = "suresh.gm"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user4", 
                    DisplayName = "Dinesh Kumar K", 
                    Email = "dinesh.k@example.com", 
                    CurrentWorkload = 3, 
                    IsActive = true,
                    UniqueName = "dinesh.k"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user5", 
                    DisplayName = "Vijayakumar Kanagasabai", 
                    Email = "vijayakumar.k@example.com", 
                    CurrentWorkload = 1, 
                    IsActive = true,
                    UniqueName = "vijayakumar.k"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user6", 
                    DisplayName = "Venkateshwaran K", 
                    Email = "venkateshwaran.k@example.com", 
                    CurrentWorkload = 1, 
                    IsActive = true,
                    UniqueName = "venkateshwaran.k"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user7", 
                    DisplayName = "Balakrishnan Krishnabose", 
                    Email = "balakrishnan.k@example.com", 
                    CurrentWorkload = 1, 
                    IsActive = true,
                    UniqueName = "balakrishnan.k"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user8", 
                    DisplayName = "Test User One", 
                    Email = "test.user1@example.com", 
                    CurrentWorkload = 0, 
                    IsActive = true,
                    UniqueName = "test.user1"
                },
                new AI_Scrum.Models.TeamMember 
                { 
                    Id = "user9", 
                    DisplayName = "Test User Two", 
                    Email = "test.user2@example.com", 
                    CurrentWorkload = 0, 
                    IsActive = true,
                    UniqueName = "test.user2"
                }
            };

            // If we have an iteration path, simulate workload for demo data
            if (!string.IsNullOrEmpty(iterationPath))
            {
                // Just for demo purposes, adjust workload based on iteration path
                var iterationNumber = iterationPath.Contains("2.3.23") ? 23 : 
                                     (iterationPath.Contains("2.3.24") ? 24 : 
                                     (iterationPath.Contains("2.3.25") ? 25 : 26));
                
                // For demo purposes, make workload vary by iteration
                demoMembers[0].CurrentWorkload = (iterationNumber % 4);
                demoMembers[1].CurrentWorkload = ((iterationNumber + 1) % 4);
                demoMembers[2].CurrentWorkload = ((iterationNumber + 2) % 5);
                demoMembers[3].CurrentWorkload = ((iterationNumber + 3) % 5);
                demoMembers[4].CurrentWorkload = ((iterationNumber + 1) % 3);
                demoMembers[5].CurrentWorkload = ((iterationNumber + 2) % 3);
                demoMembers[6].CurrentWorkload = ((iterationNumber + 3) % 3);
            }

            return demoMembers;
        }

        public async Task<List<AI_Scrum.Models.WorkItem>> GetWorkItemsAsync(string iterationPath)
        {
            try
            {
                var useMockData = _configuration.GetValue<bool>("AzureDevOps:UseMockData");
                
                if (useMockData)
                {
                    _logger.LogInformation("Mock data is enabled in configuration. Using mock task data instead of Azure DevOps.");
                    return GetDemoWorkItems(iterationPath);
                }
                
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Organization: {Organization}, Project: {Project}, PAT Length: {PatLength}",
                        string.IsNullOrEmpty(_organization) ? "Missing" : _organization,
                        string.IsNullOrEmpty(_project) ? "Missing" : _project,
                        string.IsNullOrEmpty(_pat) ? 0 : _pat.Length);
                    
                    return GetDemoWorkItems(iterationPath);
                }

                _logger.LogInformation("Connecting to Azure DevOps with Organization: {Organization}, Project: {Project}",
                    _organization, _project);
                
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

                _logger.LogInformation("Executing WIQL query for iteration path: {IterationPath}", iterationPath);
                
                try
                {
                    var queryResult = await witClient.QueryByWiqlAsync(wiql);
                    
                    _logger.LogInformation("WIQL query returned {Count} work items", queryResult.WorkItems.Count());
                    
                    if (queryResult.WorkItems.Count() == 0)
                    {
                        return new List<AI_Scrum.Models.WorkItem>();
                    }
                    
                    // Get work item details for the results
                    var ids = queryResult.WorkItems.Select(wi => wi.Id).ToArray();
                    
                    _logger.LogInformation("Fetching detailed work item information for {Count} items", ids.Length);
                    
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
                    
                    _logger.LogInformation("Successfully loaded {Count} work items from Azure DevOps", workItems.Count);
                    _logger.LogInformation("Status distribution: {StatusCounts}", 
                        string.Join(", ", workItems.GroupBy(w => w.Status).Select(g => $"{g.Key}: {g.Count()}")));
                    
                    // Log Dev-New tasks specifically for debugging
                    var devNewTasks = workItems.Where(w => w.Status?.ToLower() == "dev-new").ToList();
                    _logger.LogInformation("Found {Count} Dev-New tasks in total, {UnassignedCount} unassigned", 
                        devNewTasks.Count, 
                        devNewTasks.Count(t => string.IsNullOrEmpty(t.AssignedTo)));
                    
                    return workItems;
                }
                catch (VssServiceException ex) when (ex.Message.Contains("iteration path does not exist"))
                {
                    _logger.LogWarning("Iteration path '{IterationPath}' does not exist in Azure DevOps. Error: {Error}", 
                        iterationPath, ex.Message);
                    return GetDemoWorkItems(iterationPath);
                }
                catch (VssServiceException ex)
                {
                    _logger.LogError(ex, "Azure DevOps API error when querying work items: {Message}", ex.Message);
                    return GetDemoWorkItems(iterationPath);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting work items for iteration {IterationPath}. Exception type: {ExceptionType}, Message: {Message}", 
                    iterationPath, ex.GetType().Name, ex.Message);
                
                if (ex.InnerException != null)
                {
                    _logger.LogError("Inner exception: {Type} - {Message}", 
                        ex.InnerException.GetType().Name, ex.InnerException.Message);
                }
                
                return GetDemoWorkItems(iterationPath);
            }
        }

        private List<AI_Scrum.Models.WorkItem> GetDemoWorkItems(string iterationPath = null)
        {
            try
            {
                var useMockData = _configuration.GetValue<bool>("AzureDevOps:UseMockData");
                var mockDataPath = _configuration.GetValue<string>("AzureDevOps:MockDataPath");
                
                _logger.LogInformation("Using mock task data from configuration. UseMockData: {UseMockData}, Path: {MockDataPath}", 
                    useMockData, mockDataPath);
                
                if (useMockData && !string.IsNullOrEmpty(mockDataPath) && File.Exists(mockDataPath))
                {
                    // Load mock data from JSON file
                    _logger.LogInformation("Loading mock task data from file: {MockDataPath}", mockDataPath);
                    var json = File.ReadAllText(mockDataPath);
                    var tasks = System.Text.Json.JsonSerializer.Deserialize<List<AI_Scrum.Models.WorkItem>>(json);
                    
                    if (tasks != null && tasks.Any())
                    {
                        // If iteration path is specified, filter tasks to match the requested path
                        if (!string.IsNullOrEmpty(iterationPath))
                        {
                            tasks = tasks.Where(t => t.IterationPath == iterationPath).ToList();
                        }
                        
                        _logger.LogInformation("Loaded {Count} mock tasks from file", tasks.Count);
                        return tasks;
                    }
                }
                
                // If mock data loading failed or is disabled, return fallback mock data
                _logger.LogWarning("Mock data loading failed or disabled. Using fallback mock data.");
                return GetFallbackMockTasks(iterationPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading mock task data from file. Using fallback mock data.");
                return GetFallbackMockTasks(iterationPath);
            }
        }
        
        private List<AI_Scrum.Models.WorkItem> GetFallbackMockTasks(string iterationPath = null)
        {
            // Fallback mock data in case file loading fails
            var demoItems = new List<AI_Scrum.Models.WorkItem>
            {
                // Add a few basic tasks as absolute fallback
                new AI_Scrum.Models.WorkItem { Id = 54993, Title = "Performance issue on month closure process", Status = "Dev-New", AssignedTo = "", Type = "Bug", Priority = "3", IterationPath = iterationPath ?? "Techoil\\2.3.23" },
                new AI_Scrum.Models.WorkItem { Id = 58865, Title = "Invoice flag is not update properly while raise the invoice", Status = "Dev-New", AssignedTo = "", Type = "Bug", Priority = "4", IterationPath = iterationPath ?? "Techoil\\2.3.23" },
                new AI_Scrum.Models.WorkItem { Id = 59894, Title = "Due date calculation is NOT same in Invoice Popup and Invoice details screen", Status = "Dev-New", AssignedTo = "", Type = "Bug", Priority = "2", IterationPath = iterationPath ?? "Techoil\\2.3.23" }
            };
            
            return demoItems;
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
