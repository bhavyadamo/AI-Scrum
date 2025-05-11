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

        public DashboardController(ISprintService sprintService)
        {
            _sprintService = sprintService;
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

        [HttpGet("summary")]
        public async Task<ActionResult<SprintSummary>> GetSprintSummary([FromQuery] string iterationPath)
        {
            try
            {
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
    }
} 