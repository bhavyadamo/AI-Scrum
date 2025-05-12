using System;

namespace AI_Scrum.Models
{
    public class RecommendationDto
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Message { get; set; } = string.Empty;
        public string Severity { get; set; } = "Info"; // Info, Warning, Critical
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
} 