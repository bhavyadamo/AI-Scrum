using AI_Scrum.Models;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace AI_Scrum.Services
{
    public class SettingsService : ISettingsService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SettingsService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IAzureDevOpsService _azureDevOpsService;
        
        // Sample mock data for demo purposes
        private readonly List<UserRoleDto> _mockUsers = new List<UserRoleDto>
        {
            new UserRoleDto { UserId = "user1", UserName = "Balakrishnan Krishnabose", Email = "balakrishnan.k@example.com", Role = UserRole.Admin },
            new UserRoleDto { UserId = "user2", UserName = "Bhavya Damodharan", Email = "bhavya.d@example.com", Role = UserRole.ScrumMaster },
            new UserRoleDto { UserId = "user3", UserName = "Dhinakaraj Sivakumar", Email = "dhinakaraj.s@example.com", Role = UserRole.Member },
            new UserRoleDto { UserId = "user4", UserName = "Dinesh Kumar", Email = "dinesh.kumar@example.com", Role = UserRole.Member },
            new UserRoleDto { UserId = "user5", UserName = "Dinesh Kumar K", Email = "dinesh.k@example.com", Role = UserRole.Member }
        };
        
        private AzureDevOpsSettingsDto _azureDevOpsSettings = new AzureDevOpsSettingsDto
        {
            PersonalAccessToken = "masked-for-security",
            Organization = "techoil",
            Project = "AI-Scrum"
        };
        
        private AiModelSettingsDto _aiModelSettings = new AiModelSettingsDto
        {
            EnableAutoUpdate = true,
            ModelEndpoint = "https://api.openai.com/v1/chat/completions",
            ApiKey = "masked-for-security"
        };

        public SettingsService(IConfiguration configuration, ILogger<SettingsService> logger, IHttpClientFactory httpClientFactory, IAzureDevOpsService azureDevOpsService)
        {
            _configuration = configuration;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _azureDevOpsService = azureDevOpsService;
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

        public Task<List<UserRoleDto>> GetUserRolesAsync()
        {
            // In a real implementation, these would come from a database
            _logger.LogInformation("Retrieving user roles");
            return Task.FromResult(_mockUsers);
        }

        public Task<bool> UpdateUserRoleAsync(UpdateUserRoleRequest request)
        {
            try
            {
                _logger.LogInformation("Updating role for user {UserId} to {Role}", request.UserId, request.Role);
                
                var user = _mockUsers.FirstOrDefault(u => u.UserId == request.UserId);
                if (user == null)
                {
                    _logger.LogWarning("User {UserId} not found", request.UserId);
                    return Task.FromResult(false);
                }
                
                user.Role = request.Role;
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user role");
                return Task.FromResult(false);
            }
        }

        public Task<AzureDevOpsSettingsDto> GetAzureDevOpsSettingsAsync()
        {
            // In a real implementation, this would come from a secure storage
            _logger.LogInformation("Retrieving Azure DevOps settings");
            
            // Always mask the PAT when returning
            var settings = new AzureDevOpsSettingsDto
            {
                PersonalAccessToken = MaskPAT(_azureDevOpsSettings.PersonalAccessToken),
                Organization = _azureDevOpsSettings.Organization,
                Project = _azureDevOpsSettings.Project
            };
            
            return Task.FromResult(settings);
        }

        public Task<bool> UpdateAzureDevOpsPATAsync(UpdateAzureDevOpsPATRequest request)
        {
            try
            {
                _logger.LogInformation("Updating Azure DevOps PAT");
                
                // In a real implementation, this would be stored securely
                _azureDevOpsSettings.PersonalAccessToken = request.PersonalAccessToken;
                
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Azure DevOps PAT");
                return Task.FromResult(false);
            }
        }

        public Task<AiModelSettingsDto> GetAiModelSettingsAsync()
        {
            _logger.LogInformation("Retrieving AI model settings");
            return Task.FromResult(_aiModelSettings);
        }

        public Task<bool> UpdateAiModelSettingsAsync(UpdateAiModelSettingsRequest request)
        {
            try
            {
                _logger.LogInformation("Updating AI model auto-update setting to: {EnableAutoUpdate}", request.EnableAutoUpdate);
                
                _aiModelSettings.EnableAutoUpdate = request.EnableAutoUpdate;
                
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating AI model settings");
                return Task.FromResult(false);
            }
        }

        public async Task<SettingsDto> GetAllSettingsAsync()
        {
            _logger.LogInformation("Retrieving all settings");
            
            var settings = new SettingsDto
            {
                UserRoles = await GetUserRolesAsync(),
                AzureDevOpsSettings = await GetAzureDevOpsSettingsAsync(),
                AiModelSettings = await GetAiModelSettingsAsync()
            };
            
            return settings;
        }
        
        private string MaskPAT(string pat)
        {
            if (string.IsNullOrEmpty(pat) || pat.Length <= 4)
            {
                return "****";
            }
            
            // Return first 4 characters followed by asterisks
            return pat.Substring(0, 4) + new string('*', pat.Length - 4);
        }
    }
} 