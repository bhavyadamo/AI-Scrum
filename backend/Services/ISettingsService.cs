using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface ISettingsService
    {
        // User role management
        Task<List<UserRoleDto>> GetUserRolesAsync();
        Task<bool> UpdateUserRoleAsync(UpdateUserRoleRequest request);
        
        // Azure DevOps integration settings
        Task<AzureDevOpsSettingsDto> GetAzureDevOpsSettingsAsync();
        Task<bool> UpdateAzureDevOpsPATAsync(UpdateAzureDevOpsPATRequest request);
        
        // AI model settings
        Task<AiModelSettingsDto> GetAiModelSettingsAsync();
        Task<bool> UpdateAiModelSettingsAsync(UpdateAiModelSettingsRequest request);
        
        // Get all settings (for admin view)
        Task<SettingsDto> GetAllSettingsAsync();
    }
} 