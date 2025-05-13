using AI_Scrum.Services;
using Microsoft.OpenApi.Models;
using System;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "AI Scrum API", Version = "v1" });
});

// Add Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = "DefaultAuthScheme";
    options.DefaultChallengeScheme = "DefaultAuthScheme";
})
.AddCookie("DefaultAuthScheme", options =>
{
    options.Cookie.Name = "AIScrumAuth";
});

// Register Services
builder.Services.AddScoped<ISprintService, SprintService>();
builder.Services.AddScoped<ITaskService, TaskService>();
builder.Services.AddScoped<IAiRecommendationService, AiRecommendationService>();
builder.Services.AddScoped<ITaskEstimationService, TaskEstimationService>();
builder.Services.AddScoped<IAzureDevOpsService, AzureDevOpsService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();

// Add HttpClient for services
builder.Services.AddHttpClient("EstimationAPI", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["AI:EstimationModelEndpoint"] ?? "http://localhost:5002");
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",
                "http://localhost:5000",
                "https://localhost:5001"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .WithExposedHeaders("Content-Disposition");
    });
});

var app = builder.Build();

// Important: Apply CORS before any other middleware that might redirect or handle the response
app.UseCors("AllowAngularApp");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    // Do NOT use HTTPS redirection in Development
}
else
{
    // Only use HTTPS redirection in Production
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run(); 