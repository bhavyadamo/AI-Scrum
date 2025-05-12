using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Mvc;

namespace AI_Scrum.Controllers
{
    [ApiController]
    [Route("api/tasks")]
    public class TasksController : ControllerBase
    {
        private readonly ITaskService _taskService;
        private readonly IAzureDevOpsService _azureDevOpsService;

        public TasksController(ITaskService taskService, IAzureDevOpsService azureDevOpsService)
        {
            _taskService = taskService;
            _azureDevOpsService = azureDevOpsService;
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

        [HttpPost("assign")]
        public async Task<ActionResult> AssignTask([FromBody] AssignTaskRequest request)
        {
            try
            {
                var result = await _taskService.AssignTaskAsync(request.TaskId, request.AssignedTo);
                if (result)
                {
                    return Ok(new { message = "Task assigned successfully" });
                }
                return BadRequest(new { message = "Failed to assign task" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error assigning task: {ex.Message}");
            }
        }

        [HttpGet("team-members")]
        public async Task<ActionResult<List<TeamMember>>> GetTeamMembers([FromQuery] string iterationPath = null)
        {
            try
            {
                // Decode URL-encoded characters, especially backslashes
                if (!string.IsNullOrEmpty(iterationPath))
                {
                    iterationPath = Uri.UnescapeDataString(iterationPath);
                }
                
                var teamMembers = await _azureDevOpsService.GetTeamMembersAsync(iterationPath);
                return Ok(teamMembers);
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
                    iterationPath = Uri.UnescapeDataString(iterationPath);
                }
                
                var suggestions = await _taskService.GetAutoAssignSuggestionsAsync(iterationPath);
                return Ok(suggestions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving auto-assign suggestions: {ex.Message}");
            }
        }

        [HttpPost("auto-assign")]
        public async Task<ActionResult> AutoAssignTasks([FromBody] AutoAssignRequest request)
        {
            try
            {
                var result = await _taskService.AutoAssignTasksAsync(request.IterationPath);
                if (result)
                {
                    return Ok(new { message = "Tasks auto-assigned successfully" });
                }
                return BadRequest(new { message = "Failed to auto-assign tasks" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error auto-assigning tasks: {ex.Message}");
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
} 