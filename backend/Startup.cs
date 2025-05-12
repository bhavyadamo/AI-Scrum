using Microsoft.Extensions.DependencyInjection;

namespace AI_Scrum.Backend
{
    public class Startup
    {
        public void ConfigureServices(IServiceCollection services)
        {
            // Register services for dependency injection
            services.AddScoped<ISettingsService, SettingsService>();
            services.AddScoped<IRecommendationService, RecommendationService>();
        }
    }
} 