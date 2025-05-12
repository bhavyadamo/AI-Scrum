using AI_Scrum.Models;
using Microsoft.Extensions.Configuration;

namespace AI_Scrum.Services
{
    public class TaskService : ITaskService
    {
        private readonly IAzureDevOpsService _azureDevOpsService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<TaskService> _logger;

        public TaskService(
            IAzureDevOpsService azureDevOpsService,
            IConfiguration configuration,
            ILogger<TaskService> logger)
        {
            _azureDevOpsService = azureDevOpsService;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<List<WorkItem>> GetTasksAsync(string iterationPath)
        {
            try
            {
                _logger.LogInformation("Getting tasks for iteration {IterationPath}", iterationPath);
                return await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tasks for iteration {IterationPath}", iterationPath);
                throw;
            }
        }

        public async Task<bool> AssignTaskAsync(int taskId, string assignedTo)
        {
            try
            {
                _logger.LogInformation("Assigning task {TaskId} to {AssignedTo}", taskId, assignedTo);
                
                var teamMembers = await _azureDevOpsService.GetTeamMembersAsync();
                
                // Try to find the team member by ID or by DisplayName (for flexibility)
                var assignee = teamMembers.FirstOrDefault(m => 
                    m.Id == assignedTo || 
                    m.DisplayName.Equals(assignedTo, StringComparison.OrdinalIgnoreCase));
                
                if (assignee == null)
                {
                    _logger.LogWarning("Team member {AssignedTo} not found", assignedTo);
                    
                    // If team members list is empty and we have a valid name, create a dummy team member
                    // This helps when using demo/test data
                    if (!teamMembers.Any() && !string.IsNullOrEmpty(assignedTo))
                    {
                        _logger.LogInformation("Using fallback assignment with name {AssignedTo}", assignedTo);
                        
                        var taskUpdates = new Dictionary<string, object>
                        {
                            { "System.AssignedTo", assignedTo }
                        };

                        return await _azureDevOpsService.UpdateWorkItemAsync(taskId, taskUpdates);
                    }
                    
                    return false;
                }

                var assigneeUpdates = new Dictionary<string, object>
                {
                    { "System.AssignedTo", assignee.DisplayName }
                };

                return await _azureDevOpsService.UpdateWorkItemAsync(taskId, assigneeUpdates);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning task {TaskId} to {AssignedTo}", taskId, assignedTo);
                return false;
            }
        }

        public async Task<Dictionary<string, string>> GetAutoAssignSuggestionsAsync(string iterationPath)
        {
            try
            {
                _logger.LogInformation("Getting auto-assign suggestions for iteration {IterationPath}", iterationPath);
                
                var tasks = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                var teamMembers = await _azureDevOpsService.GetTeamMembersAsync();
                
                // Calculate current workload for each team member
                var workloadByMember = new Dictionary<string, int>();
                
                foreach (var member in teamMembers)
                {
                    int memberTasks = tasks.Count(t => t.AssignedTo.Contains(member.DisplayName));
                    workloadByMember[member.Id] = memberTasks;
                    member.CurrentWorkload = memberTasks; // Update the member's workload
                }
                
                // Get unassigned tasks
                var unassignedTasks = tasks
                    .Where(t => string.IsNullOrEmpty(t.AssignedTo) && t.Status != "Completed" && t.Status != "Done")
                    .ToList();
                
                // Make suggestions for unassigned tasks based on workload balance and priority
                var suggestions = new Dictionary<string, string>();
                
                foreach (var task in unassignedTasks)
                {
                    // Find member with the lowest workload
                    var memberWithLowestWorkload = teamMembers
                        .Where(m => m.IsActive)
                        .OrderBy(m => m.CurrentWorkload)
                        .FirstOrDefault();
                    
                    if (memberWithLowestWorkload != null)
                    {
                        suggestions[task.Id.ToString()] = $"{memberWithLowestWorkload.DisplayName} (lowest workload)";
                    }
                }
                
                return suggestions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting auto-assign suggestions for iteration {IterationPath}", iterationPath);
                
                // Return empty suggestions on error
                return new Dictionary<string, string>();
            }
        }

        public async Task<bool> AutoAssignTasksAsync(string iterationPath)
        {
            try
            {
                _logger.LogInformation("Auto-assigning tasks for iteration {IterationPath}", iterationPath);
                
                var tasks = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                var teamMembers = await _azureDevOpsService.GetTeamMembersAsync();
                
                // Skip if there are no team members or all tasks are assigned
                if (teamMembers.Count == 0 || tasks.All(t => !string.IsNullOrEmpty(t.AssignedTo)))
                {
                    return true;
                }
                
                // Get active members for assignment
                var activeMembers = teamMembers.Where(m => m.IsActive).ToList();
                
                // Calculate current workload for each team member
                var workloadByMember = new Dictionary<string, int>();
                
                foreach (var member in activeMembers)
                {
                    int memberTasks = tasks.Count(t => t.AssignedTo.Contains(member.DisplayName));
                    workloadByMember[member.Id] = memberTasks;
                    member.CurrentWorkload = memberTasks; // Update the member's workload
                }
                
                // Get unassigned tasks
                var unassignedTasks = tasks
                    .Where(t => string.IsNullOrEmpty(t.AssignedTo) && t.Status != "Completed" && t.Status != "Done")
                    .ToList();
                
                // Skip if there are no unassigned tasks
                if (unassignedTasks.Count == 0)
                {
                    return true;
                }
                
                // Assign tasks based on priority and workload balance
                bool success = true;
                
                // Sort tasks by priority (assuming lower number is higher priority)
                var tasksByPriority = unassignedTasks
                    .OrderBy(t => Convert.ToInt32(t.Priority))
                    .ToList();
                
                foreach (var task in tasksByPriority)
                {
                    // Find member with the lowest workload
                    var memberWithLowestWorkload = activeMembers
                        .OrderBy(m => m.CurrentWorkload)
                        .First();
                    
                    // Assign task to this member
                    var updates = new Dictionary<string, object>
                    {
                        { "System.AssignedTo", memberWithLowestWorkload.DisplayName }
                    };
                    
                    if (await _azureDevOpsService.UpdateWorkItemAsync(task.Id, updates))
                    {
                        // Increment the member's workload for future assignments
                        memberWithLowestWorkload.CurrentWorkload++;
                    }
                    else
                    {
                        success = false;
                    }
                }
                
                return success;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error auto-assigning tasks for iteration {IterationPath}", iterationPath);
                return false;
            }
        }

        public async Task<WorkItemDetails> GetTaskDetailsAsync(int taskId)
        {
            try
            {
                _logger.LogInformation("Getting details for task {TaskId}", taskId);
                
                // In a real implementation, you would get the work item from Azure DevOps
                // and map it to the WorkItemDetails model
                
                // For demo purposes, return mock data
                var tasks = await _azureDevOpsService.GetWorkItemsAsync("Project\\Sprint 3");
                var task = tasks.FirstOrDefault(t => t.Id == taskId);
                
                if (task == null)
                {
                    throw new KeyNotFoundException($"Task with ID {taskId} not found");
                }
                
                // Generate some mock details
                return new WorkItemDetails
                {
                    Id = task.Id,
                    Title = task.Title,
                    Description = "This is a detailed description for " + task.Title,
                    AssignedTo = task.AssignedTo,
                    Status = task.Status,
                    Priority = task.Priority,
                    Type = task.Type,
                    IterationPath = task.IterationPath,
                    CreatedDate = DateTime.Now.AddDays(-10),
                    CreatedBy = "Admin User",
                    RelatedWorkItems = new List<int> { task.Id + 1, task.Id + 2 },
                    Tags = new List<string> { "UI", "Frontend", "Sprint-3" },
                    EstimatedHours = 8,
                    RemainingHours = 4,
                    CompletedHours = 4
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting details for task {TaskId}", taskId);
                throw;
            }
        }
    }
} 