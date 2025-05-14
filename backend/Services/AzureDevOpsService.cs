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

                // Log found iterations for debugging
                _logger.LogInformation("Found {Count} iterations for project {Project}", iterationPaths.Count, _project);
                foreach (var path in iterationPaths.Take(5))
                {
                    _logger.LogInformation("Iteration path: {Path}", path);
                    var iteration = iterations.FirstOrDefault(i => i.Path == path);
                    if (iteration?.Attributes != null)
                    {
                        _logger.LogInformation("  Start date: {StartDate}, End date: {EndDate}", 
                            iteration.Attributes.StartDate, 
                            iteration.Attributes.FinishDate);
                    }
                }

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
                                 wi.AssignedTo.Equals(member.UniqueName, StringComparison.OrdinalIgnoreCase)));
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error calculating workload for team members");
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

        public async Task<List<AI_Scrum.Models.TeamMember>> GetTeamMembersByTeamAsync(string teamName, string iterationPath = null)
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

                // Get all teams and filter by name
                var teams = await teamClient.GetTeamsAsync(project.Id.ToString());
                if (teams == null || !teams.Any())
                {
                    _logger.LogError("No teams found in project {Project}", _project);
                    return GetDemoTeamMembers(iterationPath);
                }

                // Find the specified team or RND team
                var targetTeam = teams.FirstOrDefault(t => 
                    t.Name.Equals(teamName, StringComparison.OrdinalIgnoreCase) || 
                    (teamName.Equals("RND", StringComparison.OrdinalIgnoreCase) && 
                     (t.Name.Contains("RND", StringComparison.OrdinalIgnoreCase) || 
                      t.Name.Contains("R&D", StringComparison.OrdinalIgnoreCase) || 
                      t.Name.Contains("Research", StringComparison.OrdinalIgnoreCase))));

                if (targetTeam == null)
                {
                    _logger.LogWarning("Could not find team {TeamName} in project {Project}", teamName, _project);
                    return GetDemoTeamMembers(iterationPath);
                }

                _logger.LogInformation("Found team {TeamName} with ID {TeamId}", targetTeam.Name, targetTeam.Id);

                // Get team members
                var teamMembers = await teamClient.GetTeamMembersWithExtendedPropertiesAsync(
                    project.Id.ToString(),
                    targetTeam.Id.ToString());

                if (teamMembers == null || !teamMembers.Any())
                {
                    _logger.LogWarning("No team members found in team {Team}", targetTeam.Name);
                    return GetDemoTeamMembers(iterationPath);
                }

                var result = new List<AI_Scrum.Models.TeamMember>();
                foreach (var member in teamMembers)
                {
                    // Since we're already filtering by team and the Azure DevOps API call returns members of that team,
                    // we can simplify the R&D check to just use the team name
                    bool includeMember = true;

                    // If specifically requesting R&D team members but the team name doesn't explicitly indicate R&D,
                    // perform additional checks on the member's properties
                    if (teamName.Equals("RND", StringComparison.OrdinalIgnoreCase) && 
                        !targetTeam.Name.Contains("RND", StringComparison.OrdinalIgnoreCase) && 
                        !targetTeam.Name.Contains("R&D", StringComparison.OrdinalIgnoreCase) && 
                        !targetTeam.Name.Contains("Research", StringComparison.OrdinalIgnoreCase))
                    {
                        // Check description field or other properties if available
                        // For simplicity, we'll just log that we may need additional filtering
                        _logger.LogWarning("Team {TeamName} doesn't have R&D in its name, additional filtering may be required", 
                            targetTeam.Name);
                        
                        // Add additional member-specific checks here if needed
                        // For example, check if member's description contains R&D related keywords
                        // includeMember = CheckIfMemberIsRnD(member);
                    }
                    
                    if (includeMember)
                    {
                        result.Add(new AI_Scrum.Models.TeamMember
                        {
                            Id = member.Identity.Id.ToString(),
                            DisplayName = member.Identity.DisplayName,
                            Email = member.Identity.UniqueName,
                            CurrentWorkload = 0, // Set default workload - this would be calculated from active tasks
                            IsActive = true, // Assume all team members are active
                            UniqueName = member.Identity.UniqueName,
                            Team = targetTeam.Name // Add team information
                        });
                    }
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
                                 wi.AssignedTo.Equals(member.UniqueName, StringComparison.OrdinalIgnoreCase)));
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error calculating workload for team members");
                    }
                }

                _logger.LogInformation("Found {Count} team members in team {Team}", result.Count, targetTeam.Name);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting team members from Azure DevOps for team {TeamName}", teamName);
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
                // Check configuration for UseMockData - set to true for debugging
                var useMockData = _configuration.GetValue<bool>("AzureDevOps:UseMockData", true);
                
                // Force mock data for debugging and demos
                if (useMockData)
                {
                    _logger.LogInformation("Using mock task data for testing auto-assign functionality. Iteration path: {IterationPath}", 
                        iterationPath);
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
            var iterPath = iterationPath ?? "Techoil\\2.3.23";
            
            // Normalize the iterationPath to handle any potential double backslashes
            iterPath = iterPath.Replace("\\\\", "\\");
            
            _logger.LogInformation("Creating fallback mock tasks with normalized iteration path: {IterationPath}", iterPath);
            
            var demoItems = new List<AI_Scrum.Models.WorkItem>
            {
                // Add unassigned "Dev-New" tasks for testing auto-assign
                new AI_Scrum.Models.WorkItem { Id = 54993, Title = "Performance issue on month closure process", Status = "Dev-New", AssignedTo = "", Type = "Bug", Priority = "1", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 58865, Title = "Invoice flag is not update properly while raise the invoice", Status = "Dev-New", AssignedTo = "", Type = "Bug", Priority = "2", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 59894, Title = "Due date calculation is NOT same in Invoice Popup and Invoice details screen", Status = "Dev-New", AssignedTo = "", Type = "Bug", Priority = "2", IterationPath = iterPath },
                // Add variations of "Dev-New" status to ensure proper matching
                new AI_Scrum.Models.WorkItem { Id = 62135, Title = "Add validation for duplicate inventory items", Status = "dev-new", AssignedTo = "", Type = "User Story", Priority = "2", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 65432, Title = "Dashboard shows incorrect monthly summary", Status = "Dev - New", AssignedTo = "", Type = "Bug", Priority = "1", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 67890, Title = "User profile page loads slowly", Status = "DevNew", AssignedTo = "", Type = "Bug", Priority = "3", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 72345, Title = "Implement new reporting API", Status = "New-Dev", AssignedTo = "", Type = "Feature", Priority = "2", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 76543, Title = "Fix date formatting in export reports", Status = "DEV NEW", AssignedTo = "", Type = "Bug", Priority = "3", IterationPath = iterPath },
                
                // Add a few tasks that are assigned but with different statuses for testing
                new AI_Scrum.Models.WorkItem { Id = 60001, Title = "Refactor authentication module", Status = "Active", AssignedTo = "Herbert Albert", Type = "Task", Priority = "2", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 60002, Title = "Fix login page responsiveness", Status = "In Progress", AssignedTo = "Bhavya Damodharan", Type = "Bug", Priority = "3", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 60003, Title = "Update UI components to new design", Status = "Code Review", AssignedTo = "Suresh GM", Type = "User Story", Priority = "2", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 60004, Title = "Implement notification system", Status = "Complete", AssignedTo = "Vijayakumar Kanagasabai", Type = "Feature", Priority = "1", IterationPath = iterPath },
                
                // Add some tasks already assigned with Dev-New status to test reassignment logic
                new AI_Scrum.Models.WorkItem { Id = 60005, Title = "Optimize database queries", Status = "Dev-New", AssignedTo = "Dhinakaraj Sivakumar", Type = "Task", Priority = "1", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 60006, Title = "Add unit tests for payment module", Status = "Dev-New", AssignedTo = "Sivakumar Naganathan", Type = "Task", Priority = "2", IterationPath = iterPath },
                new AI_Scrum.Models.WorkItem { Id = 60007, Title = "Fix calculation error in tax report", Status = "Dev-New", AssignedTo = "Yoganandh Udayakumar", Type = "Bug", Priority = "1", IterationPath = iterPath }
            };
            
            // Log the number of Dev-New tasks
            var devNewCount = demoItems.Count(item => 
                item.Status != null && 
                (item.Status.Replace(" ", "").Equals("DevNew", StringComparison.OrdinalIgnoreCase) || 
                 item.Status.Replace(" ", "").Equals("Dev-New", StringComparison.OrdinalIgnoreCase) ||
                 item.Status.Replace(" ", "").Equals("NewDev", StringComparison.OrdinalIgnoreCase) ||
                 item.Status.Replace(" ", "").Equals("New-Dev", StringComparison.OrdinalIgnoreCase)));
                 
            var unassignedDevNewCount = demoItems.Count(item => 
                item.Status != null && 
                (item.Status.Replace(" ", "").Equals("DevNew", StringComparison.OrdinalIgnoreCase) || 
                 item.Status.Replace(" ", "").Equals("Dev-New", StringComparison.OrdinalIgnoreCase) ||
                 item.Status.Replace(" ", "").Equals("NewDev", StringComparison.OrdinalIgnoreCase) ||
                 item.Status.Replace(" ", "").Equals("New-Dev", StringComparison.OrdinalIgnoreCase)) && 
                string.IsNullOrEmpty(item.AssignedTo));
            
            _logger.LogInformation("Created mock data with {TotalCount} tasks, including {DevNewCount} Dev-New tasks ({UnassignedCount} unassigned)",
                demoItems.Count, devNewCount, unassignedDevNewCount);
            
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

        public async Task<SprintOverview> GetSprintDetailsByIterationPathAsync(string iterationPath)
        {
            try
            {
                if (string.IsNullOrEmpty(_pat) || string.IsNullOrEmpty(_organization) || string.IsNullOrEmpty(_project))
                {
                    _logger.LogWarning("Azure DevOps credentials not configured. Returning demo data for sprint.");
                    return GetDemoSprintDetails(iterationPath);
                }

                using var connection = GetConnection();
                var workClient = connection.GetClient<WorkHttpClient>();
                var projectClient = connection.GetClient<ProjectHttpClient>();
                var teamClient = connection.GetClient<TeamHttpClient>();

                // Get project
                var project = await projectClient.GetProject(_project);
                if (project == null)
                {
                    _logger.LogError("Project {Project} not found", _project);
                    return GetDemoSprintDetails(iterationPath);
                }

                // Get teams - need to get a team to access iterations
                var teams = await teamClient.GetTeamsAsync(project.Id.ToString());
                if (teams == null || !teams.Any())
                {
                    _logger.LogWarning("No teams found in project {Project}", _project);
                    return GetDemoSprintDetails(iterationPath);
                }

                var defaultTeam = teams.FirstOrDefault();
                if (defaultTeam == null)
                {
                    _logger.LogWarning("Could not find default team in project {Project}", _project);
                    return GetDemoSprintDetails(iterationPath);
                }

                // Create team context
                var teamContext = new TeamContext(project.Id.ToString())
                {
                    Team = defaultTeam.Id.ToString()
                };

                // Get all iterations for the team
                var iterations = await workClient.GetTeamIterationsAsync(teamContext);
                if (iterations == null || !iterations.Any())
                {
                    _logger.LogWarning("No iterations found for team {Team} in project {Project}", defaultTeam.Name, _project);
                    return GetDemoSprintDetails(iterationPath);
                }

                // Find the requested iteration
                var matchingIteration = iterations.FirstOrDefault(i => 
                    i.Path != null && 
                    i.Path.Equals(iterationPath, StringComparison.OrdinalIgnoreCase));

                if (matchingIteration == null)
                {
                    _logger.LogWarning("Iteration path {IterationPath} not found", iterationPath);
                    return GetDemoSprintDetails(iterationPath);
                }

                // Extract sprint name from path (last part after backslash)
                string sprintName = iterationPath;
                if (iterationPath.Contains("\\"))
                {
                    sprintName = iterationPath.Split('\\').Last();
                }

                // Calculate days remaining
                int daysRemaining = 0;
                if (matchingIteration.Attributes?.FinishDate != null)
                {
                    var endDate = matchingIteration.Attributes.FinishDate.Value;
                    if (endDate > DateTime.Now)
                    {
                        daysRemaining = (endDate - DateTime.Now).Days;
                    }
                }

                return new SprintOverview
                {
                    SprintName = sprintName,
                    StartDate = matchingIteration.Attributes?.StartDate ?? DateTime.Now,
                    EndDate = matchingIteration.Attributes?.FinishDate ?? DateTime.Now.AddDays(14),
                    DaysRemaining = daysRemaining,
                    IterationPath = iterationPath
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting sprint details for iteration {IterationPath}", iterationPath);
                return GetDemoSprintDetails(iterationPath);
            }
        }

        private SprintOverview GetDemoSprintDetails(string iterationPath)
        {
            // Extract sprint name from iteration path
            string sprintName = iterationPath;
            if (iterationPath.Contains("\\"))
            {
                sprintName = iterationPath.Split('\\').Last();
            }

            var now = DateTime.Now;
            return new SprintOverview
            {
                SprintName = sprintName,
                StartDate = now.AddDays(-10),
                EndDate = now.AddDays(4),
                DaysRemaining = 4,
                IterationPath = iterationPath
            };
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
        
        public async Task<ChatResponse> HandleChatQueryAsync(string query, string currentIterationPath)
        {
            _logger.LogInformation("Processing chat query: {Query} for iteration {IterationPath}", query, currentIterationPath);
            
            try
            {
                // Lowercase query for case-insensitive matching
                string lowercaseQuery = query.ToLower().Trim();
                
                // Task assignment - check if someone is trying to assign a task by ID
                if ((lowercaseQuery.Contains("assign") || lowercaseQuery.Contains("allocate")) && 
                    (lowercaseQuery.Contains("task") || lowercaseQuery.Contains("item") || lowercaseQuery.Contains("work")))
                {
                    // Try to extract task ID and assignee
                    int taskId = ExtractTaskIdFromQuery(lowercaseQuery);
                    string assignee = ExtractNameFromQuery(lowercaseQuery);
                    
                    if (taskId > 0 && !string.IsNullOrEmpty(assignee))
                    {
                        // Get team members to validate the assignee
                        var teamMembers = await GetTeamMembersAsync(currentIterationPath);
                        
                        // Try to find matching team member
                        var matchingMember = teamMembers.FirstOrDefault(m => 
                            m.DisplayName.ToLower().Contains(assignee) || 
                            m.Email.ToLower().Contains(assignee));
                            
                        if (matchingMember != null)
                        {
                            // Update the work item with the assigned to field
                            var updates = new Dictionary<string, object>
                            {
                                { "System.AssignedTo", matchingMember.DisplayName }
                            };
                            
                            bool success = await UpdateWorkItemAsync(taskId, updates);
                            
                            if (success)
                            {
                                return new ChatResponse
                                {
                                    Message = $"Task #{taskId} has been assigned to {matchingMember.DisplayName}.",
                                    Success = true,
                                    Data = new Dictionary<string, object>
                                    {
                                        { "taskId", taskId },
                                        { "assignedTo", matchingMember.DisplayName }
                                    }
                                };
                            }
                            else
                            {
                                return new ChatResponse
                                {
                                    Message = $"I couldn't assign task #{taskId} to {matchingMember.DisplayName}. Please check if the task ID is valid and try again.",
                                    Success = false
                                };
                            }
                        }
                        else
                        {
                            return new ChatResponse
                            {
                                Message = $"I couldn't find a team member matching '{assignee}'. Available team members are: {string.Join(", ", teamMembers.Take(5).Select(m => m.DisplayName))}.",
                                Success = false
                            };
                        }
                    }
                    else if (taskId > 0 && string.IsNullOrEmpty(assignee))
                    {
                        return new ChatResponse
                        {
                            Message = $"You want to assign task #{taskId}, but I need to know who to assign it to. Please specify a team member name.",
                            Success = false
                        };
                    }
                    else if (taskId <= 0 && !string.IsNullOrEmpty(assignee))
                    {
                        return new ChatResponse
                        {
                            Message = $"I need a valid task ID to assign work to {assignee}. Please specify which task to assign.",
                            Success = false
                        };
                    }
                }
                
                // Task distribution - show current workload distribution
                if (lowercaseQuery.Contains("task distribution") || 
                    lowercaseQuery.Contains("work distribution") || 
                    lowercaseQuery.Contains("workload distribution") ||
                    (lowercaseQuery.Contains("distribution") && lowercaseQuery.Contains("team")))
                {
                    var teamMembers = await GetTeamMembersAsync(currentIterationPath);
                    var workItems = await GetWorkItemsAsync(currentIterationPath);
                    
                    if (teamMembers.Any())
                    {
                        // Calculate workload for each team member
                        var workloadByMember = teamMembers
                            .Select(member => new 
                            {
                                Name = member.DisplayName,
                                TaskCount = workItems.Count(w => 
                                    !string.IsNullOrEmpty(w.AssignedTo) && 
                                    (w.AssignedTo.Equals(member.DisplayName, StringComparison.OrdinalIgnoreCase) ||
                                     w.AssignedTo.Equals(member.Email, StringComparison.OrdinalIgnoreCase)))
                            })
                            .OrderByDescending(x => x.TaskCount)
                            .ToList();
                            
                        // Calculate average workload
                        double averageWorkload = workloadByMember.Count > 0 
                            ? workloadByMember.Average(w => w.TaskCount) 
                            : 0;
                            
                        string message = $"Current task distribution for the sprint: ";
                        message += string.Join(", ", workloadByMember.Select(m => $"{m.Name}: {m.TaskCount} tasks"));
                        message += $". Average workload: {averageWorkload:F1} tasks per person.";
                        
                        // Identify overloaded/underloaded team members
                        var overloaded = workloadByMember.Where(w => w.TaskCount > averageWorkload * 1.5).ToList();
                        var underloaded = workloadByMember.Where(w => w.TaskCount < averageWorkload * 0.5 && w.TaskCount > 0).ToList();
                        var unassigned = workloadByMember.Where(w => w.TaskCount == 0).ToList();
                        
                        if (overloaded.Any())
                        {
                            message += $" Overloaded team members: {string.Join(", ", overloaded.Select(m => m.Name))}.";
                        }
                        
                        if (underloaded.Any())
                        {
                            message += $" Team members with lighter workloads: {string.Join(", ", underloaded.Select(m => m.Name))}.";
                        }
                        
                        if (unassigned.Any())
                        {
                            message += $" Team members with no tasks: {string.Join(", ", unassigned.Select(m => m.Name))}.";
                        }
                        
                        return new ChatResponse
                        {
                            Message = message,
                            Data = new Dictionary<string, object>
                            {
                                { "workloadDistribution", workloadByMember },
                                { "averageWorkload", averageWorkload }
                            }
                        };
                    }
                    else
                    {
                        return new ChatResponse
                        {
                            Message = "I couldn't find team member information for the current sprint.",
                            Success = false
                        };
                    }
                }
                
                // Suggest next task assignment based on workload
                if (lowercaseQuery.Contains("suggest") && 
                   (lowercaseQuery.Contains("assignment") || lowercaseQuery.Contains("assignee") || 
                    lowercaseQuery.Contains("team member") || lowercaseQuery.Contains("who should")))
                {
                    int taskId = ExtractTaskIdFromQuery(lowercaseQuery);
                    
                    // Get team members and their current workload
                    var teamMembers = await GetTeamMembersAsync(currentIterationPath);
                    
                    if (teamMembers.Any())
                    {
                        // Sort by current workload (ascending)
                        var sortedMembers = teamMembers
                            .Where(m => m.IsActive)
                            .OrderBy(m => m.CurrentWorkload)
                            .ToList();
                            
                        if (sortedMembers.Any())
                        {
                            var suggestedAssignee = sortedMembers.First();
                            
                            if (taskId > 0)
                            {
                                // Task ID was specified, include it in the response
                                return new ChatResponse
                                {
                                    Message = $"Based on current workload, I suggest assigning task #{taskId} to {suggestedAssignee.DisplayName} (current workload: {suggestedAssignee.CurrentWorkload} tasks). Do you want me to make this assignment?",
                                    Data = new Dictionary<string, object>
                                    {
                                        { "suggestedAssignee", suggestedAssignee.DisplayName },
                                        { "taskId", taskId },
                                        { "currentWorkload", suggestedAssignee.CurrentWorkload }
                                    }
                                };
                            }
                            else
                            {
                                // Just suggesting who should get the next task
                                return new ChatResponse
                                {
                                    Message = $"Based on current workload, {suggestedAssignee.DisplayName} would be a good candidate for the next task assignment (current workload: {suggestedAssignee.CurrentWorkload} tasks).",
                                    Data = new Dictionary<string, object>
                                    {
                                        { "suggestedAssignee", suggestedAssignee.DisplayName },
                                        { "currentWorkload", suggestedAssignee.CurrentWorkload }
                                    }
                                };
                            }
                        }
                    }
                    
                    return new ChatResponse
                    {
                        Message = "I couldn't find information about team members to make a suggestion.",
                        Success = false
                    };
                }
                
                // Current iteration information
                if (lowercaseQuery.Contains("current sprint") || 
                    lowercaseQuery.Contains("current iteration") || 
                    lowercaseQuery.Contains("sprint details") ||
                    lowercaseQuery.Contains("iteration details") ||
                    lowercaseQuery.Contains("sprint information"))
                {
                    var sprintDetails = await GetSprintDetailsByIterationPathAsync(currentIterationPath);
                    return new ChatResponse
                    {
                        Message = $"The current sprint is {sprintDetails.SprintName}, which runs from {sprintDetails.StartDate:MMM dd, yyyy} to {sprintDetails.EndDate:MMM dd, yyyy}. There are {sprintDetails.DaysRemaining} days remaining in this sprint.",
                        Data = new Dictionary<string, object>
                        {
                            { "sprintName", sprintDetails.SprintName },
                            { "startDate", sprintDetails.StartDate.ToString("yyyy-MM-dd") },
                            { "endDate", sprintDetails.EndDate.ToString("yyyy-MM-dd") },
                            { "daysRemaining", sprintDetails.DaysRemaining }
                        }
                    };
                }
                
                // Work items count and status
                if (lowercaseQuery.Contains("how many") && 
                   (lowercaseQuery.Contains("tasks") || lowercaseQuery.Contains("work items")))
                {
                    var workItems = await GetWorkItemsAsync(currentIterationPath);
                    
                    // Count items by status
                    var countsByStatus = workItems
                        .GroupBy(w => w.Status)
                        .Select(g => new { Status = g.Key, Count = g.Count() })
                        .OrderByDescending(x => x.Count)
                        .ToList();
                        
                    int totalCount = workItems.Count;
                    int activeCount = workItems.Count(w => 
                        !string.IsNullOrEmpty(w.Status) && 
                        (w.Status.Contains("Active") || 
                         w.Status.Contains("In Progress") || 
                         w.Status.Contains("Dev-WIP") ||
                         w.Status.Contains("Code Review")));
                    
                    string message = $"There are {totalCount} work items in the current sprint ({currentIterationPath}), with {activeCount} currently active. ";
                    
                    if (countsByStatus.Any())
                    {
                        message += "Breakdown by status: ";
                        message += string.Join(", ", countsByStatus.Take(5).Select(s => $"{s.Status}: {s.Count}"));
                        
                        if (countsByStatus.Count > 5)
                        {
                            message += ", and others.";
                        }
                    }
                    
                    return new ChatResponse
                    {
                        Message = message,
                        Data = new Dictionary<string, object>
                        {
                            { "totalCount", totalCount },
                            { "activeCount", activeCount },
                            { "statusBreakdown", countsByStatus.Select(s => new { s.Status, s.Count }).ToList() }
                        }
                    };
                }
                
                // Work items by type
                if (lowercaseQuery.Contains("by type") || 
                   (lowercaseQuery.Contains("how many") && 
                    (lowercaseQuery.Contains("bug") || 
                     lowercaseQuery.Contains("requirement") || 
                     lowercaseQuery.Contains("task") || 
                     lowercaseQuery.Contains("user story"))))
                {
                    var workItems = await GetWorkItemsAsync(currentIterationPath);
                    
                    // Count items by type
                    var countsByType = workItems
                        .GroupBy(w => w.Type)
                        .Select(g => new { Type = g.Key, Count = g.Count() })
                        .OrderByDescending(x => x.Count)
                        .ToList();
                        
                    string message = $"Work items by type in the current sprint ({currentIterationPath}): ";
                    message += string.Join(", ", countsByType.Select(s => $"{s.Type}: {s.Count}"));
                    
                    return new ChatResponse
                    {
                        Message = message,
                        Data = new Dictionary<string, object>
                        {
                            { "typeBreakdown", countsByType.Select(s => new { s.Type, s.Count }).ToList() }
                        }
                    };
                }
                
                // Work items by assignee
                if (lowercaseQuery.Contains("by assignee") || 
                    lowercaseQuery.Contains("by person") ||
                    lowercaseQuery.Contains("by team member") ||
                    (lowercaseQuery.Contains("how many") && lowercaseQuery.Contains("assigned")))
                {
                    var workItems = await GetWorkItemsAsync(currentIterationPath);
                    
                    // Count items by assignee
                    var countsByAssignee = workItems
                        .GroupBy(w => string.IsNullOrEmpty(w.AssignedTo) ? "Unassigned" : w.AssignedTo)
                        .Select(g => new { Assignee = g.Key, Count = g.Count() })
                        .OrderByDescending(x => x.Count)
                        .ToList();
                        
                    string message = $"Work items by assignee in the current sprint ({currentIterationPath}): ";
                    message += string.Join(", ", countsByAssignee.Take(8).Select(s => $"{s.Assignee}: {s.Count}"));
                    
                    if (countsByAssignee.Count > 8)
                    {
                        message += ", and others.";
                    }
                    
                    return new ChatResponse
                    {
                        Message = message,
                        Data = new Dictionary<string, object>
                        {
                            { "assigneeBreakdown", countsByAssignee.Select(s => new { s.Assignee, s.Count }).ToList() }
                        }
                    };
                }
                
                // Specific details for one person
                if (lowercaseQuery.Contains("assigned to ") || 
                    lowercaseQuery.Contains("tasks for ") ||
                    lowercaseQuery.Contains("items for "))
                {
                    string personName = ExtractNameFromQuery(lowercaseQuery);
                    if (!string.IsNullOrEmpty(personName))
                    {
                        var workItems = await GetWorkItemsAsync(currentIterationPath);
                        
                        // Filter items for the specified person
                        var personItems = workItems
                            .Where(w => !string.IsNullOrEmpty(w.AssignedTo) && 
                                   w.AssignedTo.ToLower().Contains(personName))
                            .ToList();
                            
                        if (personItems.Any())
                        {
                            // Group by status
                            var statusBreakdown = personItems
                                .GroupBy(w => w.Status)
                                .Select(g => new { Status = g.Key, Count = g.Count() })
                                .OrderByDescending(x => x.Count)
                                .ToList();
                                
                            string message = $"{personItems.Count} work items are assigned to {personItems[0].AssignedTo} in the current sprint. ";
                            message += $"Status breakdown: {string.Join(", ", statusBreakdown.Select(s => $"{s.Status}: {s.Count}"))}";
                            
                            return new ChatResponse
                            {
                                Message = message,
                                Data = new Dictionary<string, object>
                                {
                                    { "assignee", personItems[0].AssignedTo },
                                    { "totalCount", personItems.Count },
                                    { "statusBreakdown", statusBreakdown.Select(s => new { s.Status, s.Count }).ToList() },
                                    { "items", personItems.Take(10).Select(i => new { i.Id, i.Title, i.Status, i.Type }).ToList() }
                                }
                            };
                        }
                        else
                        {
                            return new ChatResponse
                            {
                                Message = $"No work items found assigned to anyone matching '{personName}' in the current sprint.",
                                Success = false
                            };
                        }
                    }
                }
                
                // Blocked items
                if (lowercaseQuery.Contains("blocked") || 
                    lowercaseQuery.Contains("impediment") ||
                    lowercaseQuery.Contains("issue"))
                {
                    var workItems = await GetWorkItemsAsync(currentIterationPath);
                    
                    // Find blocked items
                    var blockedItems = workItems
                        .Where(w => !string.IsNullOrEmpty(w.Status) && 
                               (w.Status.ToLower().Contains("blocked") || 
                                w.Status.ToLower().Contains("impediment")))
                        .ToList();
                        
                    if (blockedItems.Any())
                    {
                        string message = $"There are {blockedItems.Count} blocked items in the current sprint: ";
                        message += string.Join(", ", blockedItems.Take(5).Select(b => $"{b.Id}: {b.Title}"));
                        
                        if (blockedItems.Count > 5)
                        {
                            message += ", and others.";
                        }
                        
                        return new ChatResponse
                        {
                            Message = message,
                            Data = new Dictionary<string, object>
                            {
                                { "blockedCount", blockedItems.Count },
                                { "blockedItems", blockedItems.Take(10).Select(i => new { i.Id, i.Title, i.Status, i.AssignedTo }).ToList() }
                            }
                        };
                    }
                    else
                    {
                        return new ChatResponse
                        {
                            Message = "Good news! There are no blocked items in the current sprint.",
                            Data = new Dictionary<string, object>
                            {
                                { "blockedCount", 0 }
                            }
                        };
                    }
                }
                
                // Sprint progress/completion
                if (lowercaseQuery.Contains("progress") || 
                    lowercaseQuery.Contains("completion") ||
                    lowercaseQuery.Contains("how far") ||
                    lowercaseQuery.Contains("status of sprint"))
                {
                    var workItems = await GetWorkItemsAsync(currentIterationPath);
                    var sprintDetails = await GetSprintDetailsByIterationPathAsync(currentIterationPath);
                    
                    // Calculate completion percentage
                    int totalItems = workItems.Count;
                    int completedItems = workItems.Count(w => 
                        !string.IsNullOrEmpty(w.Status) && 
                        (w.Status.Contains("Done") || 
                         w.Status.Contains("Completed") || 
                         w.Status.Contains("Closed")));
                    
                    double completionPercentage = totalItems > 0 
                        ? Math.Round((double)completedItems / totalItems * 100, 1) 
                        : 0;
                        
                    // Calculate time percentage
                    double totalDays = (sprintDetails.EndDate - sprintDetails.StartDate).TotalDays;
                    double daysElapsed = totalDays - sprintDetails.DaysRemaining;
                    double timePercentage = totalDays > 0 
                        ? Math.Round(daysElapsed / totalDays * 100, 1) 
                        : 0;
                    
                    string message = $"Sprint progress: {completedItems} of {totalItems} work items completed ({completionPercentage}%). ";
                    message += $"Time progress: {timePercentage}% of sprint duration has elapsed ({Math.Round(daysElapsed, 1)} days out of {Math.Round(totalDays, 1)} total days).";
                    
                    if (timePercentage > completionPercentage + 10)
                    {
                        message += " The sprint appears to be behind schedule.";
                    }
                    else if (completionPercentage > timePercentage + 10)
                    {
                        message += " The sprint appears to be ahead of schedule.";
                    }
                    else
                    {
                        message += " The sprint appears to be on track.";
                    }
                    
                    return new ChatResponse
                    {
                        Message = message,
                        Data = new Dictionary<string, object>
                        {
                            { "totalItems", totalItems },
                            { "completedItems", completedItems },
                            { "completionPercentage", completionPercentage },
                            { "timePercentage", timePercentage },
                            { "daysElapsed", daysElapsed },
                            { "totalDays", totalDays }
                        }
                    };
                }
                
                // Fallback for unrecognized queries
                return new ChatResponse
                {
                    Message = "I can help you with information about your current sprint such as work items, task distribution, team progress, or specific tasks. Try asking about 'current sprint details', 'task distribution', 'how many tasks in this sprint', 'tasks by assignee', 'assign task 123 to John', or 'sprint progress'.",
                    Success = true
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing chat query: {Query}", query);
                return new ChatResponse
                {
                    Message = "I'm sorry, I encountered an error while processing your request. Please try again later.",
                    Success = false
                };
            }
        }
        
        // Helper method to extract a task ID from a query
        private int ExtractTaskIdFromQuery(string query)
        {
            // Common patterns where task ID might appear
            string[] patterns = {
                "task #",
                "task#",
                "task ",
                "item #",
                "item#",
                "item ",
                "work item #",
                "work item ",
                "workitem #",
                "workitem ",
                "id ",
                "id#",
                "#"
            };
            
            foreach (var pattern in patterns)
            {
                int index = query.IndexOf(pattern);
                if (index >= 0)
                {
                    // Extract the text after the pattern
                    string restOfText = query.Substring(index + pattern.Length);
                    
                    // Look for a number at the start of the rest of the text
                    var match = System.Text.RegularExpressions.Regex.Match(restOfText, @"^\d+");
                    if (match.Success)
                    {
                        // Found a task ID
                        if (int.TryParse(match.Value, out int taskId))
                        {
                            return taskId;
                        }
                    }
                }
            }
            
            // If specific patterns failed, try a more generic approach to find any number in the text
            var numberMatches = System.Text.RegularExpressions.Regex.Matches(query, @"\d+");
            if (numberMatches.Count > 0)
            {
                foreach (System.Text.RegularExpressions.Match match in numberMatches)
                {
                    if (int.TryParse(match.Value, out int taskId) && taskId > 0)
                    {
                        return taskId;
                    }
                }
            }
            
            return 0; // No task ID found
        }
        
        // Helper method to extract a person's name from a query
        private string ExtractNameFromQuery(string query)
        {
            string[] patterns = {
                "assigned to ",
                "assign to ",
                "assign ",
                "allocate to ",
                "tasks for ",
                "items for "
            };
            
            foreach (var pattern in patterns)
            {
                int index = query.IndexOf(pattern);
                if (index >= 0)
                {
                    string name = query.Substring(index + pattern.Length).Trim();
                    // Remove trailing punctuation or unnecessary words
                    name = name.TrimEnd('.', '?', '!', ' ');
                    
                    // If query contains additional phrases after the name, try to extract just the name
                    string[] endMarkers = { " and ", " with ", " who ", " that ", " which ", " to ", " for " };
                    foreach (var marker in endMarkers)
                    {
                        int endIndex = name.IndexOf(marker);
                        if (endIndex > 0)
                        {
                            name = name.Substring(0, endIndex);
                        }
                    }
                    
                    return name;
                }
            }
            
            return string.Empty;
        }
    }
} 
