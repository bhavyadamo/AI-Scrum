using Microsoft.Extensions.DependencyInjection;
using AI_Scrum.Services;

namespace AI_Scrum.Backend
{
    public class Startup
    {
        public void ConfigureServices(IServiceCollection services)
        {
            // Register services for dependency injection
            services.AddScoped<ITaskService, TaskService>();
            services.AddScoped<IAzureDevOpsService, AzureDevOpsService>();
            services.AddScoped<ITaskEstimationService, TaskEstimationService>();
        }
    }
} 