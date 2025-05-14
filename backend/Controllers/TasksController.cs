using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace AI_Scrum.Controllers
{
    [ApiController]
    [Route("api/tasks")]
    public class TasksController : ControllerBase
    {
        private readonly ITaskService _taskService;
        private readonly IAzureDevOpsService _azureDevOpsService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TasksController> _logger;

        public TasksController(ITaskService taskService, IAzureDevOpsService azureDevOpsService, IConfiguration configuration, ILogger<TasksController> logger)
        {
            _taskService = taskService;
            _azureDevOpsService = azureDevOpsService;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpGet("iteration-paths")]
        public async Task<ActionResult<List<string>>> GetIterationPaths()
        {
            try
            {
                var iterationPaths = await _azureDevOpsService.GetIterationPathsAsync();
                return Ok(iterationPaths);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving iteration paths: {ex.Message}");
            }
        }

        [HttpGet]
        public async Task<ActionResult<List<WorkItem>>> GetTasks([FromQuery] string iterationPath)
        {
            try
            {
                // Decode URL-encoded characters, especially backslashes
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    iterationPath = Uri.UnescapeDataString(iterationPath);
                }
                
                var tasks = await _taskService.GetTasksAsync(iterationPath);
                return Ok(tasks);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving tasks: {ex.Message}");
            }
        }

        [HttpPost("assign")]
        public async Task<ActionResult> AssignTask([FromBody] AssignTaskRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                // Get Azure DevOps configuration
                var organization = _configuration["AzureDevOps:Organization"];
                var project = _configuration["AzureDevOps:Project"];
                var pat = _configuration["AzureDevOps:PAT"];
                
                if (string.IsNullOrEmpty(organization) || string.IsNullOrEmpty(project) || string.IsNullOrEmpty(pat))
                {
                    _logger.LogError("Azure DevOps configuration is missing");
                    return StatusCode(500, new { message = "Azure DevOps configuration is missing" });
                }

                // Create HttpClient
                using var client = new HttpClient();
                client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "Basic", 
                    Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($":{pat}"))
                );

                // Prepare the API URL
                var apiUrl = $"https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{request.TaskId}?api-version=6.0";

                // Prepare the JSON patch document
                var patchDocument = new[]
                {
                    new
                    {
                        op = "add",
                        path = "/fields/System.AssignedTo",
                        value = request.AssignedTo
                    }
                };

                // Create the request
                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(patchDocument),
                    System.Text.Encoding.UTF8,
                    "application/json-patch+json"
                );

                // Send the request
                var response = await client.PatchAsync(apiUrl, content);

                // Check the response
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"Task {request.TaskId} assigned to {request.AssignedTo} successfully");
                    
                    // If we have a local database or cache, we should update it here
                    await _taskService.AssignTaskAsync(request.TaskId, request.AssignedTo);
                    
                    return Ok(new { success = true, message = "Task assigned successfully" });
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Failed to assign task {request.TaskId}. Status: {response.StatusCode}. Error: {errorContent}");
                    
                    return StatusCode((int)response.StatusCode, new { 
                        success = false, 
                        message = "Failed to assign task in Azure DevOps",
                        details = errorContent
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error assigning task {request.TaskId} to {request.AssignedTo}");
                return StatusCode(500, new { success = false, message = $"An error occurred: {ex.Message}" });
            }
        }

        [HttpGet("team-members")]
        public async Task<ActionResult<List<string>>> GetTeamMembers([FromQuery] string iterationPath = null, [FromQuery] string teamName = null)
        {
            try
            {
                // Decode URL-encoded characters, especially backslashes
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    iterationPath = Uri.UnescapeDataString(iterationPath);
                }
                
                // If team name is specified, get team members by team
                if (!string.IsNullOrEmpty(teamName))
                {
                    _logger.LogInformation("Getting team members for team {TeamName} and iteration path {IterationPath}", 
                        teamName, iterationPath ?? "not specified");
                        
                    var teamMembers = await _azureDevOpsService.GetTeamMembersByTeamAsync(teamName, iterationPath);
                    
                    // Return full TeamMember objects instead of just display names
                    return Ok(teamMembers);
                }
                
                // Check if we need to get team members from tasks or from Azure DevOps
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    // 1. Get all tasks for the given iteration path
                    var tasks = await _taskService.GetTasksAsync(iterationPath);
                    
                    // 2. Extract distinct, non-null assignedTo values
                    var teamMembers = tasks
                        .Where(t => !string.IsNullOrEmpty(t.AssignedTo))
                        .Select(t => t.AssignedTo)
                        .Distinct()
                        .OrderBy(name => name)
                        .ToList();
                    
                    return Ok(teamMembers);
                }
                else
                {
                    // Fallback to Azure DevOps team members if no iteration path is specified
                    var teamMembers = await _azureDevOpsService.GetTeamMembersAsync(iterationPath);
                    // Map to simple string list of display names for consistency
                    var memberNames = teamMembers
                        .Select(m => m.DisplayName)
                        .OrderBy(name => name)
                        .ToList();
                    
                    return Ok(memberNames);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving team members: {ex.Message}");
            }
        }

        [HttpGet("auto-assign-suggestions")]
        public async Task<ActionResult<Dictionary<string, string>>> GetAutoAssignSuggestions([FromQuery] string iterationPath)
        {
            try
            {
                // Decode URL-encoded characters, especially backslashes
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    // First unescape any URL encoding
                    iterationPath = Uri.UnescapeDataString(iterationPath);
                    
                    // Then normalize any double backslashes (in case it came from JSON serialization)
                    iterationPath = iterationPath.Replace("\\\\", "\\");
                    
                    _logger.LogInformation("Normalized iteration path for auto-assign suggestions: {IterationPath}", iterationPath);
                }
                else
                {
                    _logger.LogWarning("No iteration path provided for auto-assign suggestions");
                    return BadRequest("Iteration path is required");
                }
                
                var suggestions = await _taskService.GetAutoAssignSuggestionsAsync(iterationPath);
                
                // Log the suggestions returned for debugging
                _logger.LogInformation("Auto-assign suggestions count: {Count}", suggestions.Count);
                foreach (var kvp in suggestions.Take(5))
                {
                    _logger.LogInformation("Suggestion: Task {TaskId} -> {Assignee}", kvp.Key, kvp.Value);
                }
                
                return Ok(suggestions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving auto-assign suggestions for iteration {IterationPath}", iterationPath);
                return StatusCode(500, $"Error retrieving auto-assign suggestions: {ex.Message}");
            }
        }

        [HttpPost("auto-assign-suggestions/team")]
        public async Task<ActionResult<Dictionary<string, string>>> GetAutoAssignSuggestionsForTeam([FromBody] TeamAutoAssignRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    _logger.LogWarning("Invalid model state for auto-assign suggestions: {Errors}", 
                        string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                    return BadRequest(ModelState);
                }

                // Decode URL-encoded characters and normalize backslashes in the iteration path
                if (!string.IsNullOrEmpty(request.IterationPath))
                {
                    // First unescape any URL encoding
                    request.IterationPath = Uri.UnescapeDataString(request.IterationPath);
                    
                    // Then normalize any double backslashes (in case it came from JSON serialization)
                    request.IterationPath = request.IterationPath.Replace("\\\\", "\\");
                    
                    _logger.LogInformation("Normalized iteration path: {IterationPath}", request.IterationPath);
                }
                
                _logger.LogInformation("Getting auto-assign suggestions for {Count} team members in iteration path {IterationPath}", 
                    request.TeamMembers?.Count ?? 0, request.IterationPath);
                
                // If no team members provided, return empty suggestions
                if (request.TeamMembers == null || !request.TeamMembers.Any())
                {
                    _logger.LogWarning("No team members provided for team-specific auto-assign suggestions");
                    return Ok(new Dictionary<string, string>());
                }
                
                // Log the team members for debugging
                _logger.LogInformation("Team members for auto-assign: {TeamMembers}", 
                    string.Join(", ", request.TeamMembers));
                
                // Get auto-assign suggestions restricted to the provided team members
                var suggestions = await _taskService.GetAutoAssignSuggestionsForTeamAsync(
                    request.IterationPath, 
                    request.TeamMembers
                );
                
                _logger.LogInformation("Generated {Count} auto-assign suggestions", suggestions.Count);
                
                return Ok(suggestions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving team-specific auto-assign suggestions");
                return StatusCode(500, $"Error retrieving team-specific auto-assign suggestions: {ex.Message}");
            }
        }

        [HttpPost("auto-assign")]
        public async Task<ActionResult> AutoAssignTasks([FromBody] AutoAssignRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }
                
                // Normalize the iteration path
                if (!string.IsNullOrEmpty(request.IterationPath))
                {
                    // First unescape any URL encoding
                    request.IterationPath = Uri.UnescapeDataString(request.IterationPath);
                    
                    // Then normalize any double backslashes (in case it came from JSON serialization)
                    request.IterationPath = request.IterationPath.Replace("\\\\", "\\");
                    
                    _logger.LogInformation("Normalized iteration path for auto-assign tasks: {IterationPath}", request.IterationPath);
                }
                else
                {
                    _logger.LogWarning("No iteration path provided for auto-assign tasks");
                    return BadRequest("Iteration path is required");
                }
                
                var result = await _taskService.AutoAssignTasksAsync(request.IterationPath);
                if (result)
                {
                    return Ok(new { message = "Tasks auto-assigned successfully" });
                }
                return BadRequest(new { message = "Failed to auto-assign tasks" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error auto-assigning tasks for iteration {IterationPath}", request.IterationPath);
                return StatusCode(500, $"Error auto-assigning tasks: {ex.Message}");
            }
        }

        [HttpGet("team-member-task-counts")]
        public async Task<ActionResult<Dictionary<string, int>>> GetTeamMemberTaskCounts([FromQuery] string iterationPath)
        {
            try
            {
                // Decode URL-encoded characters, especially backslashes
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    iterationPath = Uri.UnescapeDataString(iterationPath);
                }
                
                var taskCounts = await _taskService.GetTeamMemberTaskCountsAsync(iterationPath);
                return Ok(taskCounts);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving team member task counts: {ex.Message}");
            }
        }

        [HttpGet("{taskId}")]
        public async Task<ActionResult<WorkItemDetails>> GetTaskDetails(int taskId)
        {
            try
            {
                var taskDetails = await _taskService.GetTaskDetailsAsync(taskId);
                return Ok(taskDetails);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving task details: {ex.Message}");
            }
        }
    }

    public class AssignTaskRequest
    {
        public int TaskId { get; set; }
        public string AssignedTo { get; set; } = string.Empty;
    }

    public class AutoAssignRequest
    {
        public string IterationPath { get; set; } = string.Empty;
    }

    public class TeamAutoAssignRequest
    {
        public string IterationPath { get; set; } = string.Empty;
        public List<string> TeamMembers { get; set; } = new List<string>();
    }
} 