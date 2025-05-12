using System.ComponentModel.DataAnnotations;

namespace AI_Scrum.Models
{
    public enum UserRole
    {
        Member,
        ScrumMaster,
        Admin
    }

    public class UserRoleDto
    {
        [Required]
        public string UserId { get; set; } = string.Empty;
        
        [Required]
        public string UserName { get; set; } = string.Empty;
        
        [Required]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public UserRole Role { get; set; } = UserRole.Member;
    }

    public class AzureDevOpsSettingsDto
    {
        [Required]
        public string PersonalAccessToken { get; set; } = string.Empty;
        
        public string Organization { get; set; } = string.Empty;
        
        public string Project { get; set; } = string.Empty;
    }

    public class AiModelSettingsDto
    {
        [Required]
        public bool EnableAutoUpdate { get; set; } = false;
        
        public string ModelEndpoint { get; set; } = string.Empty;
        
        public string ApiKey { get; set; } = string.Empty;
    }

    public class SettingsDto
    {
        public List<UserRoleDto> UserRoles { get; set; } = new List<UserRoleDto>();
        
        public AzureDevOpsSettingsDto AzureDevOpsSettings { get; set; } = new AzureDevOpsSettingsDto();
        
        public AiModelSettingsDto AiModelSettings { get; set; } = new AiModelSettingsDto();
    }

    // Request DTOs for updating settings
    public class UpdateUserRoleRequest
    {
        [Required]
        public string UserId { get; set; } = string.Empty;
        
        [Required]
        public UserRole Role { get; set; }
    }

    public class UpdateAzureDevOpsPATRequest
    {
        [Required]
        public string PersonalAccessToken { get; set; } = string.Empty;
    }

    public class UpdateAiModelSettingsRequest
    {
        [Required]
        public bool EnableAutoUpdate { get; set; }
    }

    public class ApplicationSettings
    {
        public AzureDevOpsSettings AzureDevOps { get; set; } = new AzureDevOpsSettings();
        public AISettings AI { get; set; } = new AISettings();
        public List<UserRole> Users { get; set; } = new List<UserRole>();
    }

    public class AzureDevOpsSettings
    {
        public string Organization { get; set; } = string.Empty;
        public string Project { get; set; } = string.Empty;
        public string PAT { get; set; } = string.Empty;
        public string DefaultTeam { get; set; } = string.Empty;
    }

    public class AISettings
    {
        public bool EnableAutoAssign { get; set; } = true;
        public bool EnableEstimation { get; set; } = true;
        public bool EnableRecommendations { get; set; } = true;
        public string EstimationModelEndpoint { get; set; } = string.Empty;
    }

    public class UserRole
    {
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = "Member"; // Admin or Member
    }
} 