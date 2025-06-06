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
                var historyMonths = _configuration.GetValue<int>("TaskAssignment:HistoryMonths", 3); // Changed from 6 to 3 months
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
                           (devNewStatuses.Contains(t.Status.Trim(), StringComparer.OrdinalIgnoreCase) || 
                            t.Status.Trim().ToLower().Contains("dev-new") ||
                            t.Status.Trim().ToLower().Contains("dev new")))
                    .ToList();
                
                _logger.LogInformation("Found {Count} total Dev-New tasks", allNewDevTasks.Count);
                
                // If there are no tasks with the exact status strings, log detailed information about available statuses
                if (allNewDevTasks.Count == 0)
                {
                    var availableStatuses = tasks
                        .Where(t => !string.IsNullOrEmpty(t.Status))
                        .Select(t => t.Status.Trim())
                        .Distinct()
                        .ToList();
                        
                    _logger.LogWarning("No Dev-New tasks found. Available statuses in this iteration: {Statuses}", 
                        string.Join(", ", availableStatuses));
                        
                    // Fall back to a more relaxed search if needed
                    if (availableStatuses.Any(s => s.ToLower().Contains("new") || s.ToLower().Contains("dev")))
                    {
                        _logger.LogInformation("Trying fallback with relaxed status matching for 'new' or 'dev'");
                        allNewDevTasks = tasks
                            .Where(t => t.Status != null && 
                                (t.Status.Trim().ToLower().Contains("new") || 
                                 t.Status.Trim().ToLower().Contains("dev")))
                            .ToList();
                            
                        _logger.LogInformation("Fallback found {Count} potential Dev-New tasks", allNewDevTasks.Count);
                    }
                }
                
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
                
                // Calculate monthly breakdowns for the defined number of months
                var today = DateTime.Now;
                var monthlyBreakdowns = new List<(DateTime start, DateTime end, double weight)>();
                
                // Create monthly breakdowns with decreasing weights
                for (int i = 0; i < historyMonths; i++)
                {
                    var monthEnd = today.AddMonths(-i);
                    var monthStart = new DateTime(monthEnd.Year, monthEnd.Month, 1);
                    // Weight decreases by 0.25 each month back - higher emphasis on recent months
                    // Most recent month has weight 1.0, previous month 0.75, etc.
                    var weight = Math.Max(0.25, 1.0 - (i * 0.25)); 
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
                
                // Track expertise by task type per developer from completed tasks in recent history
                var developerExpertiseByType = new Dictionary<string, Dictionary<string, int>>();
                // Track expertise by keywords from task titles
                var developerExpertiseByKeywords = new Dictionary<string, Dictionary<string, int>>();

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
                    
                    // Initialize expertise trackers for this developer
                    developerExpertiseByType[developer] = new Dictionary<string, int>();
                    developerExpertiseByKeywords[developer] = new Dictionary<string, int>();
                    
                    // Count tasks by status and track expertise
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
                            developerTaskCounts[developer]["WeightedTotal"] += 1.0;
                        }
                        else if (activeStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["Active"]++;
                            developerTaskCounts[developer]["WeightedTotal"] += 1.0;
                        }
                        else if (reviewStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["Review"]++;
                            developerTaskCounts[developer]["WeightedTotal"] += 0.3;
                        }
                        else if (completeStatuses.Contains(status, StringComparer.OrdinalIgnoreCase))
                        {
                            developerTaskCounts[developer]["Complete"]++;
                            developerTaskCounts[developer]["WeightedTotal"] += 0.1;
                            
                            // Track expertise based on completed tasks by type
                            if (!string.IsNullOrEmpty(task.Type))
                            {
                                string taskType = task.Type.Trim();
                                if (!developerExpertiseByType[developer].ContainsKey(taskType))
                                {
                                    developerExpertiseByType[developer][taskType] = 0;
                                }
                                developerExpertiseByType[developer][taskType]++;
                            }

                            // Track expertise based on task title keywords
                            if (!string.IsNullOrEmpty(task.Title))
                            {
                                var keywords = ExtractKeywords(task.Title);
                                foreach (var keyword in keywords)
                                {
                                    if (!developerExpertiseByKeywords[developer].ContainsKey(keyword))
                                    {
                                        developerExpertiseByKeywords[developer][keyword] = 0;
                                    }
                                    developerExpertiseByKeywords[developer][keyword]++;
                                }
                            }
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
                
                // Calculate developer scores for each task based on title keywords
                var developerScores = new Dictionary<string, double>();
                var developerInfo = new Dictionary<string, string>();

                foreach (var developer in developerTasks.Keys)
                {
                    var devTasks = developerTasks[developer];
                    var activeTasks = devTasks.Count(t => activeStatuses.Contains(t.Status?.Trim() ?? "", StringComparer.OrdinalIgnoreCase));
                    var avgTaskCount = developerTaskCounts.Values.Average(d => d["WeightedTotal"]);
                    
                    // Calculate base score from workload
                    double score = 100.0 - (activeTasks / Math.Max(1, avgTaskCount) * 50.0);
                    
                    // Add expertise score based on keywords
                    foreach (var task in allNewDevTasks)
                    {
                        if (!string.IsNullOrEmpty(task.Title))
                        {
                            var taskKeywords = ExtractKeywords(task.Title);
                            foreach (var keyword in taskKeywords)
                            {
                                if (developerExpertiseByKeywords[developer].ContainsKey(keyword))
                                {
                                    score += developerExpertiseByKeywords[developer][keyword] * 10.0;
                                }
                            }
                        }
                    }
                    
                    developerScores[developer] = score;
                    developerInfo[developer] = BuildAssignmentLogicExplanation(
                        devTasks, 
                        completeStatuses, 
                        activeStatuses, 
                        activeTasks, 
                        avgTaskCount
                    );
                }

                // Build a lookup of completed task keywords for each developer
                var completeStatusSet = new HashSet<string>(completeStatuses.Select(s => s.ToLower()));
                var reviewStatusSet = new HashSet<string>(reviewStatuses.Select(s => s.ToLower()));
                var allExpertStatuses = new HashSet<string>(completeStatusSet.Concat(reviewStatusSet));

                var developerKeywordHistory = new Dictionary<string, List<string>>();
                foreach (var developer in developerTasks.Keys)
                {
                    var completedTasks = developerTasks[developer]
                        .Where(t => t.Status != null && allExpertStatuses.Contains(t.Status.Trim().ToLower()))
                        .ToList();
                    var keywords = new List<string>();
                    foreach (var task in completedTasks)
                    {
                        if (!string.IsNullOrEmpty(task.Title))
                        {
                            keywords.AddRange(ExtractKeywords(task.Title));
                        }
                    }
                    developerKeywordHistory[developer] = keywords;
                }

                // Make task-specific suggestions
                var suggestions = new Dictionary<string, string>();
                var batchAssignments = new Dictionary<string, int>();
                var sortedTasks = allNewDevTasks
                    .OrderBy(t => t.Priority != null ? int.Parse(t.Priority) : 99)
                    .ThenBy(t => t.Id)
                    .ToList();

                // Calculate max assignments per person for this batch
                int maxAssignmentsPerPerson = (int)Math.Ceiling((double)sortedTasks.Count / Math.Max(1, teamMembers.Count));

                foreach (var newTask in sortedTasks)
                {
                    var newTaskKeywords = !string.IsNullOrEmpty(newTask.Title) ? ExtractKeywords(newTask.Title) : new string[0];
                    var bestExpert = "";
                    int bestMatchCount = 0;
                    List<string> bestMatchedKeywords = new List<string>();
                    var expertCandidates = new List<(string dev, int matchCount, List<string> matchedKeywords)>();

                    foreach (var developer in developerKeywordHistory.Keys)
                    {
                        var devKeywords = developerKeywordHistory[developer];
                        var matched = newTaskKeywords.Intersect(devKeywords).ToList();
                        int matchCount = matched.Count;
                        if (matchCount > 0)
                        {
                            expertCandidates.Add((developer, matchCount, matched));
                        }
                    }

                    // Sort experts by match count (desc), then by current batch assignments (asc)
                    var sortedExperts = expertCandidates
                        .OrderByDescending(e => e.matchCount)
                        .ThenBy(e => batchAssignments.GetValueOrDefault(e.dev, 0))
                        .ToList();

                    string assignedDev = null;
                    string assignmentReason = null;

                    foreach (var expert in sortedExperts)
                    {
                        if (batchAssignments.GetValueOrDefault(expert.dev, 0) < maxAssignmentsPerPerson)
                        {
                            assignedDev = expert.dev;
                            assignmentReason = $"expertise in [{string.Join(", ", expert.matchedKeywords)}], completions: {expert.matchCount}";
                            batchAssignments[assignedDev] = batchAssignments.GetValueOrDefault(assignedDev, 0) + 1;
                            break;
                        }
                    }

                    if (assignedDev == null && teamMembers.Any())
                    {
                        // No expert available or all experts are at max, assign to least busy
                        var leastBusyMember = teamMembers
                            .OrderBy(m => developerTaskCounts.ContainsKey(m.DisplayName) ? developerTaskCounts[m.DisplayName]["WeightedTotal"] : 0)
                            .ThenBy(m => batchAssignments.GetValueOrDefault(m.DisplayName, 0))
                            .First();
                        assignedDev = leastBusyMember.DisplayName;
                        assignmentReason = "balanced workload distribution";
                        batchAssignments[assignedDev] = batchAssignments.GetValueOrDefault(assignedDev, 0) + 1;
                    }

                    if (assignedDev != null)
                    {
                        suggestions[newTask.Id.ToString()] = $"{assignedDev} ({assignmentReason})";
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
                    // Format is typically "Developer Name (expertise info, workload info)"
                    string developerName;
                    if (suggestion.Value.Contains("("))
                    {
                        developerName = suggestion.Value.Substring(0, suggestion.Value.IndexOf('(')).Trim();
                    }
                    else
                    {
                        // Fallback - take the first word as the name if no parentheses are found
                        developerName = suggestion.Value.Split(' ')[0];
                    }
                    
                    // Check if this developer is in our R&D team members list
                    if (teamMemberLookup.Contains(developerName.ToLower()))
                    {
                        filteredSuggestions[suggestion.Key] = suggestion.Value;
                        _logger.LogInformation("Keeping suggestion for task {TaskId}: {Developer} is an R&D team member", 
                            suggestion.Key, developerName);
                    }
                    else
                    {
                        _logger.LogInformation("Filtering out suggestion for task {TaskId}: {Developer} is not an R&D team member", 
                            suggestion.Key, developerName);
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
                    
                    // Extract just the developer name from the suggestion
                    // Format is typically "Developer Name (expertise, workload)"
                    string assigneeName;
                    if (suggestion.Value.Contains("("))
                    {
                        assigneeName = suggestion.Value.Substring(0, suggestion.Value.IndexOf('(')).Trim();
                    }
                    else
                    {
                        assigneeName = suggestion.Value.Split(' ')[0]; // Fallback to simple extraction
                    }
                    
                    _logger.LogInformation("Assigning task {TaskId} to {Developer} based on auto-assignment criteria", 
                        taskId, assigneeName);
                    
                    var updates = new Dictionary<string, object>
                    {
                        { "System.AssignedTo", assigneeName }
                    };
                    
                    if (await _azureDevOpsService.UpdateWorkItemAsync(taskId, updates))
                    {
                        _logger.LogInformation("Task {TaskId} auto-assigned to {Developer} successfully", 
                            taskId, assigneeName);
                    }
                    else
                    {
                        _logger.LogError("Failed to auto-assign task {TaskId} to {Developer}", 
                            taskId, assigneeName);
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

        // Helper function to extract keywords from text
        string[] ExtractKeywords(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return new string[0];
            
            // Normalize text
            var normalized = System.Text.RegularExpressions.Regex.Replace(text, @"([a-z])([A-Z])", "$1 $2");
            normalized = normalized.Replace("_", " ").Replace("-", " ").Replace(",", " ").Replace(".", " ")
                .Replace(":", " ").Replace(";", " ").ToLowerInvariant();
            
            // Split into words and filter
            var words = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length > 3)
                .ToList();
            
            // Common stopwords to filter out
            var stopwords = new HashSet<string> { 
                "should", "not", "display", "non", "fields", "with", "from", "this", "that", 
                "have", "been", "for", "the", "and", "but", "are", "was", "has", "had", 
                "all", "any", "can", "will", "just", "more", "less", "than", "then", 
                "into", "out", "about", "over", "under", "such", "only", "own", "same", 
                "so", "too", "very", "yet", "each", "few", "most", "other", "some", 
                "their", "there", "which", "who", "whose", "why", "how", "when", "where", "what" 
            };
            
            return words.Where(w => !stopwords.Contains(w)).ToArray();
        }
    }
} 