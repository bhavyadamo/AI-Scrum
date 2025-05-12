using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace AI_Scrum.Controllers
{
    [ApiController]
    [Route("api/estimation")]
    public class TaskEstimationController : ControllerBase
    {
        private readonly ITaskEstimationService _estimationService;
        private readonly ILogger<TaskEstimationController> _logger;

        public TaskEstimationController(
            ITaskEstimationService estimationService,
            ILogger<TaskEstimationController> logger)
        {
            _estimationService = estimationService;
            _logger = logger;
        }

        [HttpPost("estimate-task-time")]
        public async Task<ActionResult<TaskEstimationResponse>> EstimateTaskTime([FromBody] TaskEstimationRequest request)
        {
            try
            {
                // Validate request
                if (string.IsNullOrWhiteSpace(request.Title))
                {
                    return BadRequest(new { message = "Task title is required" });
                }

                if (string.IsNullOrWhiteSpace(request.Type))
                {
                    return BadRequest(new { message = "Task type is required" });
                }

                if (string.IsNullOrWhiteSpace(request.Complexity))
                {
                    return BadRequest(new { message = "Task complexity is required" });
                }

                // Map to the existing service model
                var estimationRequest = new TaskEstimateRequest
                {
                    TaskTitle = request.Title,
                    TaskType = request.Type,
                    Complexity = request.Complexity,
                    // Pass assignee as the team context for the ML model
                    TeamContext = request.Assignee
                };

                // Call the estimation service
                var estimate = await _estimationService.EstimateTaskAsync(estimationRequest);

                // Map to response
                var response = new TaskEstimationResponse
                {
                    EstimatedHours = estimate.EstimatedHours,
                    ConfidenceScore = estimate.ConfidenceScore,
                    Factors = estimate.Factors
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error estimating task time");
                return StatusCode(500, new { message = "Error estimating task time" });
            }
        }
    }

    public class TaskEstimationRequest
    {
        [Required]
        public string Title { get; set; } = string.Empty;
        
        [Required]
        public string Type { get; set; } = string.Empty;
        
        public string Assignee { get; set; } = string.Empty;
        
        [Required]
        public string Complexity { get; set; } = string.Empty;
    }

    public class TaskEstimationResponse
    {
        public double EstimatedHours { get; set; }
        public float ConfidenceScore { get; set; }
        public List<string> Factors { get; set; } = new List<string>();
    }
} 