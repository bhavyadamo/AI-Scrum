using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AI_Scrum.Controllers
{
    [ApiController]
    [Route("api/recommendations")]
    public class RecommendationsController : ControllerBase
    {
        private readonly IRecommendationService _recommendationService;
        private readonly ILogger<RecommendationsController> _logger;

        public RecommendationsController(
            IRecommendationService recommendationService,
            ILogger<RecommendationsController> logger)
        {
            _recommendationService = recommendationService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<RecommendationDto>>> GetRecommendations()
        {
            try
            {
                var recommendations = await _recommendationService.GetRecommendationsAsync();
                return Ok(recommendations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving recommendations");
                return StatusCode(500, new { message = "An error occurred while retrieving recommendations" });
            }
        }
    }
} 