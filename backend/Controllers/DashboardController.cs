using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Mvc;

namespace AI_Scrum.Controllers
{
    [ApiController]
    [Route("api/dashboard")]
    public class DashboardController : ControllerBase
    {
        private readonly ISprintService _sprintService;
        private readonly IAzureDevOpsService _azureDevOpsService;

        public DashboardController(ISprintService sprintService, IAzureDevOpsService azureDevOpsService)
        {
            _sprintService = sprintService;
            _azureDevOpsService = azureDevOpsService;
        }

        [HttpGet("sprint")]
        public async Task<ActionResult<SprintOverview>> GetCurrentSprint()
        {
            try
            {
                var sprint = await _sprintService.GetCurrentSprintAsync();
                return Ok(sprint);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving sprint: {ex.Message}");
            }
        }

        // Helper method to decode iteration path
        private string DecodeIterationPath(string iterationPath)
        {
            if (string.IsNullOrEmpty(iterationPath))
                return iterationPath;
                
            // Decode URL-encoded characters
            iterationPath = Uri.UnescapeDataString(iterationPath);
            
            // Handle any additional encoding that might have occurred
            iterationPath = iterationPath.Replace("%5C", "\\").Replace("%5c", "\\");
            
            return iterationPath;
        }

        [HttpGet("sprint-details")]
        public async Task<ActionResult<IterationInfo>> GetSprintDetails([FromQuery] string iterationPath)
        {
            try
            {
                // Decode iterationPath if it's URL-encoded
                iterationPath = DecodeIterationPath(iterationPath);
                
                var sprint = await _sprintService.GetSprintDetailsByIterationPathAsync(iterationPath);
                
                // Extract the sprint name properly from the iteration path
                string sprintName = iterationPath;
                if (iterationPath.Contains("\\"))
                {
                    var parts = iterationPath.Split('\\');
                    sprintName = parts.Last();
                }
                
                // Convert to IterationInfo for consistent serialization
                var iterationInfo = new IterationInfo
                {
                    SprintName = sprintName,
                    StartDate = sprint.StartDate.ToString("yyyy-MM-dd"),
                    EndDate = sprint.EndDate.ToString("yyyy-MM-dd"),
                    DaysRemaining = sprint.DaysRemaining,
                    IterationPath = iterationPath
                };
                
                return Ok(iterationInfo);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving sprint details: {ex.Message}");
            }
        }

        [HttpGet("summary")]
        public async Task<ActionResult<SprintSummary>> GetSprintSummary([FromQuery] string iterationPath)
        {
            try
            {
                // Decode iterationPath if it's URL-encoded
                iterationPath = DecodeIterationPath(iterationPath);
                
                var summary = await _sprintService.GetSprintSummaryAsync(iterationPath);
                return Ok(summary);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving sprint summary: {ex.Message}");
            }
        }

        [HttpGet("activity")]
        public async Task<ActionResult<ActivityFeed>> GetActivityFeed([FromQuery] int count = 10)
        {
            try
            {
                var activity = await _sprintService.GetActivityFeedAsync(count);
                return Ok(activity);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving activity feed: {ex.Message}");
            }
        }

        [HttpGet("tip")]
        public async Task<ActionResult<string>> GetDailyTip()
        {
            try
            {
                var tip = await _sprintService.GetDailyTipAsync();
                return Ok(new { tip });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error retrieving daily tip: {ex.Message}");
            }
        }

        [HttpPost("chat")]
        public async Task<ActionResult<ChatResponse>> ProcessChatMessage([FromBody] ChatQuery query)
        {
            try
            {
                if (string.IsNullOrEmpty(query.Message))
                {
                    return BadRequest("Message cannot be empty");
                }

                // Use current iteration path from the query or default
                string iterationPath = !string.IsNullOrEmpty(query.CurrentIterationPath) 
                    ? DecodeIterationPath(query.CurrentIterationPath) 
                    : "Techoil\\2.3.23"; // Fallback to default iteration path
                
                // Process the chat query
                var response = await _azureDevOpsService.HandleChatQueryAsync(query.Message, iterationPath);
                
                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ChatResponse 
                { 
                    Message = $"Error processing chat message: {ex.Message}",
                    Success = false
                });
            }
        }
    }
} 