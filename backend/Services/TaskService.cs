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
                
                // Read configuration values or use defaults
                // If configuration values aren't set, use these defaults
                var historyMonths = _configuration.GetValue<int>("TaskAssignment:HistoryMonths", 6);
                var devNewStatusValues = _configuration.GetSection("TaskAssignment:DevNewStatuses").Get<string[]>() ?? 
                    new[] { "Dev-New", "dev-new", "Dev New", "Development - New", "New Development" };
                var completeStatusValues = _configuration.GetSection("TaskAssignment:CompleteStatuses").Get<string[]>() ?? 
                    new[] { "Dev Complete", "dev complete", "Development Complete", "Resolved", "Done", "Completed", "Verified" };
                var activeStatusValues = _configuration.GetSection("TaskAssignment:ActiveStatuses").Get<string[]>() ?? 
                    new[] { "Dev-New", "dev-new", "In Progress", "Active", "Dev In progress", "Development" };
                var reviewStatusValues = _configuration.GetSection("TaskAssignment:ReviewStatuses").Get<string[]>() ?? 
                    new[] { "Code Review", "Review", "In Review" };
                
                // Define status values that should be considered as "Dev-New"
                var devNewStatuses = devNewStatusValues.ToList();
                var completeStatuses = completeStatusValues.ToList();
                var activeStatuses = activeStatusValues.ToList();
                var reviewStatuses = reviewStatusValues.ToList();
                
                // Get ALL Dev-New tasks regardless of assignment status
                var allNewDevTasks = tasks
                    .Where(t => t.Status != null && 
                           devNewStatuses.Contains(t.Status.Trim(), StringComparer.OrdinalIgnoreCase))
                    .ToList();
                
                _logger.LogInformation("Found {Count} total Dev-New tasks", allNewDevTasks.Count);
                
                // Log additional information about assigned vs unassigned
                var unassignedDevNewTasks = allNewDevTasks.Where(t => string.IsNullOrEmpty(t.AssignedTo)).ToList();
                var assignedDevNewTasks = allNewDevTasks.Where(t => !string.IsNullOrEmpty(t.AssignedTo)).ToList();
                
                _logger.LogInformation("Dev-New tasks breakdown: {UnassignedCount} unassigned, {AssignedCount} already assigned", 
                    unassignedDevNewTasks.Count, assignedDevNewTasks.Count);

                // If there are no Dev-New tasks at all, return empty suggestions
                if (allNewDevTasks.Count == 0)
                {
                    return new Dictionary<string, string>();
                }

                // Get all tasks to analyze history and current load
                var allTasks = tasks.ToList();
                
                // Calculate monthly breakdowns for the last 6 months
                var today = DateTime.Now;
                var monthlyBreakdowns = new List<(DateTime start, DateTime end, double weight)>();
                
                // Create 6 monthly breakdowns with decreasing weights
                for (int i = 0; i < historyMonths; i++)
                {
                    var monthEnd = today.AddMonths(-i);
                    var monthStart = new DateTime(monthEnd.Year, monthEnd.Month, 1);
                    // Weight decreases by 0.2 each month back
                    // Most recent month has weight 1.0, previous month 0.8, etc.
                    var weight = Math.Max(0.2, 1.0 - (i * 0.2)); 
                    monthlyBreakdowns.Add((monthStart, monthEnd, weight));
                }
                
                // Group tasks by assigned developer
                var developerTasks = allTasks
                    .Where(t => !string.IsNullOrEmpty(t.AssignedTo))
                    .GroupBy(t => t.AssignedTo)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Count specific task types per developer with weighted counts
                var developerTaskCounts = new Dictionary<string, Dictionary<string, double>>();
                var developerDevNewCounts = new Dictionary<string, int>();

                // Initialize counters
                foreach (var developer in developerTasks.Keys)
                {
                    var devTasks = developerTasks[developer];
                    
                    // Create different counters for each status type
                    developerTaskCounts[developer] = new Dictionary<string, double>
                    {
                        ["DevNew"] = 0,
                        ["Active"] = 0,
                        ["Review"] = 0,
                        ["Complete"] = 0,
                        ["Total"] = 0,
                        ["WeightedTotal"] = 0
                    };
                    
                    // Count tasks by status
                    foreach (var task in devTasks)
                    {
                        if (task.Status == null) continue;
                        
                        string status = task.Status.Trim();
                        
                        // Increment total count
                        developerTaskCounts[developer]["Total"]++;
                        
                        // Categorize and add weighted values
                        if (devNewStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["DevNew"]++;
                            // Full weight for dev-new tasks
                            developerTaskCounts[developer]["WeightedTotal"] += 1.0;
                        }
                        else if (activeStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["Active"]++;
                            // Full weight for active tasks
                            developerTaskCounts[developer]["WeightedTotal"] += 1.0;
                        }
                        else if (reviewStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["Review"]++;
                            // Medium weight for review tasks
                            developerTaskCounts[developer]["WeightedTotal"] += 0.3;
                        }
                        else if (completeStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["Complete"]++;
                            // Low weight for completed tasks
                            developerTaskCounts[developer]["WeightedTotal"] += 0.1;
                        }
                    }
                    
                    // Store specific Dev-New counts for determining overloaded developers
                    developerDevNewCounts[developer] = (int)developerTaskCounts[developer]["DevNew"];
                }
                
                // Calculate average Dev-New task count
                var avgDevNewCount = developerDevNewCounts.Any() ? 
                    developerDevNewCounts.Values.Average() : 0;
                
                // Identify overloaded developers (those with more Dev-New tasks than average + threshold)
                double overloadThreshold = 1.5; // Consider developers with 50% more than average as overloaded
                int minimumOverloadCount = 3; // Consider developers with at least 3 Dev-New tasks as potential candidates
                
                var overloadedDevelopers = developerDevNewCounts
                    .Where(kv => kv.Value > Math.Max(avgDevNewCount * overloadThreshold, minimumOverloadCount))
                    .Select(kv => kv.Key)
                    .ToList();
                
                // If no developers are overloaded, consider the one with the most Dev-New tasks as overloaded
                if (!overloadedDevelopers.Any() && developerDevNewCounts.Any())
                {
                    var maxDevNewCount = developerDevNewCounts.Values.Max();
                    // Only consider as overloaded if they have at least 2 tasks
                    if (maxDevNewCount >= 2)
                    {
                        overloadedDevelopers = developerDevNewCounts
                            .Where(kv => kv.Value == maxDevNewCount)
                            .Select(kv => kv.Key)
                            .ToList();
                    }
                }
                
                _logger.LogInformation("Identified {Count} overloaded developers with more than {Threshold} Dev-New tasks (avg: {Average})", 
                    overloadedDevelopers.Count, avgDevNewCount * overloadThreshold, avgDevNewCount);
                
                foreach (var dev in overloadedDevelopers)
                {
                    _logger.LogInformation("Overloaded developer: {Developer} with {Count} Dev-New tasks", 
                        dev, developerDevNewCounts[dev]);
                }
                
                // Get average weighted task count
                var avgWeightedTaskCount = developerTaskCounts.Any() ? 
                    developerTaskCounts.Values.Average(d => d["WeightedTotal"]) : 0;
                
                // Calculate developer expertise scores
                var developerScores = new Dictionary<string, Dictionary<int, double>>();
                var developerInfo = new Dictionary<string, string>();
                // Track expertise per developer
                var developerExpertise = new Dictionary<string, int>();

                foreach (var developer in developerTasks.Keys)
                {
                    var devTasks = developerTasks[developer];
                    developerScores[developer] = new Dictionary<int, double>();
                    // Initialize expertise counter for this developer
                    developerExpertise[developer] = 0;
                    
                    // For each Dev-New task, calculate a score for this developer
                    foreach (var newTask in allNewDevTasks)
                    {
                        // Only consider reassigning tasks from overloaded developers or unassigned tasks
                        if (!string.IsNullOrEmpty(newTask.AssignedTo) && 
                            !overloadedDevelopers.Contains(newTask.AssignedTo) && 
                            newTask.AssignedTo != developer)
                        {
                            // Skip tasks that are assigned to non-overloaded developers
                            continue;
                        }
                        
                        double score = 0;
                        
                        // Check task type history
                        int taskTypeMatches = 0;
                        
                        // PRIORITY 1: Monthly History Analysis for this specific task type
                        foreach (var month in monthlyBreakdowns)
                        {
                            // Tasks of similar type completed by this developer
                            var matchingTasks = devTasks
                                .Where(t => t.Status != null && 
                                       completeStatuses.Contains(t.Status.Trim(), StringComparer.OrdinalIgnoreCase) && 
                                       t.Type == newTask.Type)
                                .ToList();
                            
                            // Higher score for more recent similar completed tasks
                            score += matchingTasks.Count * 30 * month.weight;
                            taskTypeMatches += matchingTasks.Count;
                        }
                        
                        // Add to developer's expertise count
                        if (taskTypeMatches > 0)
                        {
                            developerExpertise[developer] += taskTypeMatches;
                        }
                        
                        // PRIORITY 2: Task completion ratio - developers who complete tasks get priority
                        double completionRatio = 0;
                        
                        if (developerTaskCounts[developer]["Total"] > 0)
                        {
                            completionRatio = developerTaskCounts[developer]["Complete"] / 
                                               developerTaskCounts[developer]["Total"];
                            
                            // Bonus points for completing tasks
                            score += completionRatio * 40;
                        }
                        
                        // PRIORITY 3: Load Balancing - current workload
                        var currentWeightedLoad = developerTaskCounts[developer]["WeightedTotal"];
                        
                        // Penalize developers with more tasks than average
                        if (currentWeightedLoad > avgWeightedTaskCount)
                        {
                            // Progressive penalty for more tasks beyond average
                            var loadFactor = 1 + ((currentWeightedLoad - avgWeightedTaskCount) / 
                                               Math.Max(1, avgWeightedTaskCount));
                            score -= 25 * loadFactor;
                        }
                        else if (currentWeightedLoad < avgWeightedTaskCount)
                        {
                            // Boost for developers with fewer tasks than average
                            score += 15 * ((avgWeightedTaskCount - currentWeightedLoad) / 
                                        Math.Max(1, avgWeightedTaskCount));
                            
                            // PRIORITY BOOST: Give significant bonus to developers with only 1 task
                            // This implements the requirement to prioritize devs with just 1 task first
                            if (developerTaskCounts[developer]["Total"] <= 1)
                            {
                                score += 50; // Significant bonus for developers with just 1 task
                                _logger.LogInformation("Developer {Developer} has only 1 task, adding priority boost", developer);
                            }
                        }
                        
                        // If this task is already assigned to this developer, add a stability bonus
                        if (newTask.AssignedTo == developer)
                        {
                            score += 5;
                        }
                        
                        // Store the score for this developer for this task
                        developerScores[developer][newTask.Id] = score;
                    }
                    
                    // Create explanation of assignment logic for this developer
                    string expertise = developerExpertise[developer] > 0 ? 
                        $"past expertise ({developerExpertise[developer]} similar tasks)" : "no specific expertise";
                    
                    string workload;
                    double weightedLoad = developerTaskCounts[developer]["WeightedTotal"];
                    bool isPriority = developerTaskCounts[developer]["Total"] <= 1;
                    
                    if (weightedLoad < avgWeightedTaskCount * 0.7)
                        workload = isPriority ? 
                            $"priority (only 1 task), below avg load" : 
                            $"below avg load ({Math.Round(weightedLoad, 1)}/{Math.Round(avgWeightedTaskCount, 1)} avg)";
                    else if (weightedLoad <= avgWeightedTaskCount * 1.3)
                        workload = isPriority ? 
                            $"priority (only 1 task), average load" : 
                            $"average load ({Math.Round(weightedLoad, 1)}/{Math.Round(avgWeightedTaskCount, 1)} avg)";
                    else
                        workload = $"high load ({Math.Round(weightedLoad, 1)}/{Math.Round(avgWeightedTaskCount, 1)} avg)";
                    
                    developerInfo[developer] = $"{expertise}, {workload}";
                }

                // Make task-specific suggestions with load balancing
                var suggestions = new Dictionary<string, string>();
                // Keep track of assignment count per developer for this batch
                var batchAssignments = new Dictionary<string, int>();
                
                // First, sort tasks by priority (if available) or ID
                var sortedTasks = allNewDevTasks
                    .OrderBy(t => t.Priority != null ? int.Parse(t.Priority) : 99) // Lower priority number first
                    .ThenBy(t => t.Id)
                    .ToList();
                
                foreach (var newTask in sortedTasks)
                {
                    // Skip tasks that aren't from overloaded developers
                    if (!string.IsNullOrEmpty(newTask.AssignedTo) && 
                        !overloadedDevelopers.Contains(newTask.AssignedTo))
                    {
                        _logger.LogInformation("Skipping task {TaskId} as current assignee {Assignee} is not overloaded", 
                            newTask.Id, newTask.AssignedTo);
                        continue;
                    }
                    
                    // Find developer with highest score for this specific task
                    KeyValuePair<string, double> bestMatch = new KeyValuePair<string, double>("", -1000);
                    
                    foreach (var developer in developerScores.Keys)
                    {
                        if (developerScores[developer].ContainsKey(newTask.Id))
                        {
                            double score = developerScores[developer][newTask.Id];
                            
                            // Adjust score based on how many tasks already assigned in this batch
                            int batchCount = batchAssignments.GetValueOrDefault(developer, 0);
                            if (batchCount > 0)
                            {
                                // Reduce score by 15% for each task already assigned in this batch
                                score *= Math.Max(0.5, 1.0 - (batchCount * 0.15));
                            }
                            
                            if (score > bestMatch.Value)
                            {
                                bestMatch = new KeyValuePair<string, double>(developer, score);
                            }
                        }
                    }
                    
                    if (!string.IsNullOrEmpty(bestMatch.Key))
                    {
                        // Don't reassign to the same person
                        if (bestMatch.Key == newTask.AssignedTo)
                        {
                            _logger.LogInformation("Task {TaskId} best match is current assignee {Assignee}, keeping assignment", 
                                newTask.Id, newTask.AssignedTo);
                            continue;
                        }
                        
                        // Increment batch assignment count for this developer
                        batchAssignments[bestMatch.Key] = batchAssignments.GetValueOrDefault(bestMatch.Key, 0) + 1;
                        
                        // Check if this is a reassignment
                        bool isReassignment = !string.IsNullOrEmpty(newTask.AssignedTo);
                        string reassignmentInfo = isReassignment ? $" (reassigned from {newTask.AssignedTo})" : "";
                        
                        suggestions[newTask.Id.ToString()] = $"{bestMatch.Key} ({developerInfo[bestMatch.Key]}){reassignmentInfo}";
                    }
                    else if (teamMembers.Any() && string.IsNullOrEmpty(newTask.AssignedTo))
                    {
                        // Only for unassigned tasks - find the team member with the least tasks
                        var leastBusyMember = teamMembers
                            .OrderBy(m => 
                                developerTaskCounts.ContainsKey(m.DisplayName) ? 
                                developerTaskCounts[m.DisplayName]["WeightedTotal"] : 0)
                            .ThenBy(m => 
                                batchAssignments.GetValueOrDefault(m.DisplayName, 0))
                            .First();
                        
                        suggestions[newTask.Id.ToString()] = $"{leastBusyMember.DisplayName} (least assigned)";
                        
                        // Increment batch assignment count
                        batchAssignments[leastBusyMember.DisplayName] = 
                            batchAssignments.GetValueOrDefault(leastBusyMember.DisplayName, 0) + 1;
                    }
                }
                
                // Log the assignments made for debugging
                foreach (var dev in batchAssignments.Keys)
                {
                    _logger.LogInformation("Auto-assign batch: {Developer} assigned {Count} tasks", 
                        dev, batchAssignments[dev]);
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

        private string BuildAssignmentLogicExplanation(List<WorkItem> devTasks, List<string> completeStatuses, 
            List<string> activeStatuses, int taskCount, double avgTaskCount)
        {
            // Count tasks with different statuses using flexible status lists
            int completedTasks = devTasks.Count(t => t.Status != null && 
                completeStatuses.Contains(t.Status.Trim(), StringComparer.OrdinalIgnoreCase));
            
            int activeTasks = taskCount;
            int totalTasks = devTasks.Count;
            
            // Count recently completed tasks - assume they were completed recently
            int recentlyCompletedTasks = devTasks.Count(t => 
                t.Status != null && 
                completeStatuses.Contains(t.Status.Trim(), StringComparer.OrdinalIgnoreCase));
            
            // Build explanation based on our priority rules
            if (recentlyCompletedTasks > 0 && activeTasks < avgTaskCount)
            {
                return $"recent expertise ({recentlyCompletedTasks} tasks last month), below avg load";
            }
            else if (recentlyCompletedTasks > 0)
            {
                return $"recent expertise ({recentlyCompletedTasks} tasks last month), {activeTasks} active";
            }
            else if (completedTasks > 0 && activeTasks < avgTaskCount)
            {
                return $"past expertise ({completedTasks} tasks), below avg load";
            }
            else if (activeTasks < avgTaskCount)
            {
                return $"below average load ({activeTasks}/{Math.Round(avgTaskCount, 1)} avg)";
            }
            else if (activeTasks <= avgTaskCount + 1)
            {
                return $"average workload ({activeTasks}/{Math.Round(avgTaskCount, 1)} avg)";
            }
            else
            {
                return $"high workload ({activeTasks}/{Math.Round(avgTaskCount, 1)} avg)";
            }
        }

        public async Task<Dictionary<string, string>> GetAutoAssignSuggestionsForTeamAsync(string iterationPath, List<string> teamMembers)
        {
            try
            {
                _logger.LogInformation("Getting auto-assign suggestions for R&D team members in iteration {IterationPath}", iterationPath);
                
                // First get all suggestions using the existing method
                var allSuggestions = await GetAutoAssignSuggestionsAsync(iterationPath);
                
                if (allSuggestions.Count == 0 || teamMembers == null || !teamMembers.Any())
                {
                    // No suggestions or no team members to filter by
                    return new Dictionary<string, string>();
                }
                
                // Create a case-insensitive lookup of team member names
                var teamMemberLookup = new HashSet<string>(
                    teamMembers.Select(name => name.ToLower()),
                    StringComparer.OrdinalIgnoreCase
                );
                
                _logger.LogInformation("Filtering {AllCount} suggestions for {TeamCount} R&D team members", 
                    allSuggestions.Count, teamMemberLookup.Count);
                
                // Filter suggestions to only include R&D team members as assignees
                var filteredSuggestions = new Dictionary<string, string>();
                
                foreach (var suggestion in allSuggestions)
                {
                    // Extract just the developer name from the suggestion value
                    // Format is typically "Name (explanation)"
                    string developerName = suggestion.Value;
                    if (suggestion.Value.Contains("("))
                    {
                        developerName = suggestion.Value.Substring(0, suggestion.Value.IndexOf('(')).Trim();
                    }
                    
                    // Check if this developer is in our R&D team members list
                    if (teamMemberLookup.Contains(developerName.ToLower()))
                    {
                        filteredSuggestions[suggestion.Key] = suggestion.Value;
                    }
                }
                
                _logger.LogInformation("Filtered to {FilteredCount} suggestions for R&D team members", 
                    filteredSuggestions.Count);
                
                return filteredSuggestions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting auto-assign suggestions for R&D team in iteration {IterationPath}", iterationPath);
                return new Dictionary<string, string>();
            }
        }

        public async Task<bool> AutoAssignTasksAsync(string iterationPath)
        {
            try
            {
                _logger.LogInformation("Auto-assigning tasks for iteration {IterationPath}", iterationPath);
                
                // Get suggestions first
                var suggestions = await GetAutoAssignSuggestionsAsync(iterationPath);
                
                if (suggestions.Count == 0)
                {
                    _logger.LogInformation("No suggestions available for auto-assignment");
                    return true;
                }
                
                // Assign tasks based on suggestions
                bool success = true;
                
                foreach (var suggestion in suggestions)
                {
                    int taskId = int.Parse(suggestion.Key);
                    string assigneeName = suggestion.Value.Split(' ')[0]; // Extract just the name
                    
                    var updates = new Dictionary<string, object>
                    {
                        { "System.AssignedTo", assigneeName }
                    };
                    
                    if (await _azureDevOpsService.UpdateWorkItemAsync(taskId, updates))
                    {
                        _logger.LogInformation("Task {TaskId} auto-assigned to {Developer}", taskId, assigneeName);
                    }
                    else
                    {
                        _logger.LogError("Failed to auto-assign task {TaskId} to {Developer}", taskId, assigneeName);
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

        public async Task<Dictionary<string, int>> GetTeamMemberTaskCountsAsync(string iterationPath)
        {
            try
            {
                _logger.LogInformation("Getting task counts for team members in iteration {IterationPath}", iterationPath);
                
                // Get all tasks for the iteration
                var tasks = await _azureDevOpsService.GetWorkItemsAsync(iterationPath);
                
                // Count tasks per team member
                var taskCounts = new Dictionary<string, int>();
                
                foreach (var task in tasks)
                {
                    if (!string.IsNullOrEmpty(task.AssignedTo))
                    {
                        if (taskCounts.ContainsKey(task.AssignedTo))
                        {
                            taskCounts[task.AssignedTo]++;
                        }
                        else
                        {
                            taskCounts[task.AssignedTo] = 1;
                        }
                    }
                }
                
                return taskCounts;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting task counts for team members in iteration {IterationPath}", iterationPath);
                return new Dictionary<string, int>();
            }
        }
    }
} 