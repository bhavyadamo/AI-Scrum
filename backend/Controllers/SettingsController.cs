using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AI_Scrum.Controllers
{
    [ApiController]
    [Route("api/settings")]
    public class SettingsController : ControllerBase
    {
        private readonly ISettingsService _settingsService;
        private readonly ILogger<SettingsController> _logger;

        public SettingsController(ISettingsService settingsService, ILogger<SettingsController> logger)
        {
            _settingsService = settingsService;
            _logger = logger;
        }

        // Get all settings (Admin only)
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<SettingsDto>> GetAllSettings()
        {
            try
            {
                var settings = await _settingsService.GetAllSettingsAsync();
                return Ok(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all settings");
                return StatusCode(500, new { message = "Error retrieving settings" });
            }
        }

        // User Role Management
        [HttpGet("users")]
        [Authorize(Roles = "Admin,ScrumMaster")]
        public async Task<ActionResult<List<UserRoleDto>>> GetUserRoles()
        {
            try
            {
                var userRoles = await _settingsService.GetUserRolesAsync();
                return Ok(userRoles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user roles");
                return StatusCode(500, new { message = "Error retrieving user roles" });
            }
        }

        [HttpPost("users")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateUserRole([FromBody] UpdateUserRoleRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _settingsService.UpdateUserRoleAsync(request);
                if (result)
                {
                    return Ok(new { message = "User role updated successfully" });
                }
                
                return BadRequest(new { message = "Failed to update user role" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user role");
                return StatusCode(500, new { message = "Error updating user role" });
            }
        }

        // Azure DevOps Settings
        [HttpGet("azure-devops-pat")]
        [Authorize(Roles = "Admin,ScrumMaster")]
        public async Task<ActionResult<AzureDevOpsSettingsDto>> GetAzureDevOpsSettings()
        {
            try
            {
                var settings = await _settingsService.GetAzureDevOpsSettingsAsync();
                return Ok(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Azure DevOps settings");
                return StatusCode(500, new { message = "Error retrieving Azure DevOps settings" });
            }
        }

        [HttpPost("azure-devops-pat")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateAzureDevOpsPAT([FromBody] UpdateAzureDevOpsPATRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _settingsService.UpdateAzureDevOpsPATAsync(request);
                if (result)
                {
                    return Ok(new { message = "Azure DevOps PAT updated successfully" });
                }
                
                return BadRequest(new { message = "Failed to update Azure DevOps PAT" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Azure DevOps PAT");
                return StatusCode(500, new { message = "Error updating Azure DevOps PAT" });
            }
        }

        // AI Model Settings
        [HttpGet("ai-model")]
        [Authorize(Roles = "Admin,ScrumMaster,Member")]
        public async Task<ActionResult<AiModelSettingsDto>> GetAiModelSettings()
        {
            try
            {
                var settings = await _settingsService.GetAiModelSettingsAsync();
                return Ok(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AI model settings");
                return StatusCode(500, new { message = "Error retrieving AI model settings" });
            }
        }

        [HttpPost("ai-model")]
        [Authorize(Roles = "Admin,ScrumMaster")]
        public async Task<ActionResult> UpdateAiModelSettings([FromBody] UpdateAiModelSettingsRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _settingsService.UpdateAiModelSettingsAsync(request);
                if (result)
                {
                    return Ok(new { message = "AI model settings updated successfully" });
                }
                
                return BadRequest(new { message = "Failed to update AI model settings" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating AI model settings");
                return StatusCode(500, new { message = "Error updating AI model settings" });
            }
        }
    }
} 