using AI_Scrum.Models;

namespace AI_Scrum.Services
{
    public interface ISettingsService
    {
        Task<ApplicationSettings> GetSettingsAsync();
        Task<bool> UpdateSettingsAsync(ApplicationSettings settings);
        Task<bool> ValidateAzureDevOpsConnectionAsync(AzureDevOpsSettings settings);
    }
} 