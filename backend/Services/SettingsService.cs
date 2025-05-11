using AI_Scrum.Models;
using System.Net.Http;
using System.Threading.Tasks;

namespace AI_Scrum.Services
{
    public class SettingsService : ISettingsService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SettingsService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;

        public SettingsService(IConfiguration configuration, ILogger<SettingsService> logger, IHttpClientFactory httpClientFactory)
        {
            _configuration = configuration;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        public Task<ApplicationSettings> GetSettingsAsync()
        {
            try
            {
                var settings = new ApplicationSettings
                {
                    AI = new AISettings
                    {
                        EnableRecommendations = Convert.ToBoolean(_configuration["AI:EnableRecommendations"] ?? "true"),
                        EnableEstimation = Convert.ToBoolean(_configuration["AI:EnableEstimation"] ?? "true"),
                        EnableAutoAssign = Convert.ToBoolean(_configuration["AI:EnableAutoAssign"] ?? "true"),
                        EstimationModelEndpoint = _configuration["AI:EstimationModelEndpoint"] ?? ""
                    },
                    AzureDevOps = new AzureDevOpsSettings
                    {
                        Organization = _configuration["AzureDevOps:Organization"] ?? "",
                        Project = _configuration["AzureDevOps:Project"] ?? "",
                        PAT = _configuration["AzureDevOps:PAT"] ?? "",
                        DefaultTeam = _configuration["AzureDevOps:DefaultTeam"] ?? ""
                    }
                };

                return Task.FromResult(settings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving settings");
                throw;
            }
        }

        public Task<bool> UpdateSettingsAsync(ApplicationSettings settings)
        {
            try
            {
                // In a real implementation, you would persist these settings
                // For demo purposes, we'll just log the update
                _logger.LogInformation("Settings updated: {Settings}", 
                    System.Text.Json.JsonSerializer.Serialize(settings));
                
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating settings");
                return Task.FromResult(false);
            }
        }

        public async Task<bool> ValidateAzureDevOpsConnectionAsync(AzureDevOpsSettings settings)
        {
            try
            {
                if (string.IsNullOrEmpty(settings.Organization) || 
                    string.IsNullOrEmpty(settings.Project) || 
                    string.IsNullOrEmpty(settings.PAT))
                {
                    return false;
                }

                // In a real implementation, we would validate the connection with Azure DevOps
                // For demo purposes, we'll simulate a successful connection
                await Task.Delay(500); // Simulate API call

                _logger.LogInformation("Azure DevOps connection validated for organization: {Organization}, project: {Project}", 
                    settings.Organization, settings.Project);
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating Azure DevOps connection");
                return false;
            }
        }
    }
} 