import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { WorkItem, TeamMember } from '../../models/task.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-task-distribution',
  templateUrl: './task-distribution.component.html',
  styleUrls: ['./task-distribution.component.scss']
})
export class TaskDistributionComponent implements OnInit {
  tasks: WorkItem[] = [];
  filteredTasks: WorkItem[] = [];
  teamMembers: TeamMember[] = [];
  filteredTeamMembers: TeamMember[] = []; // New property for filtered team members
  selectedTaskId: number | null = null;
  selectedTeamMemberId: string = '';
  selectedTask: number | null = null; // Added for modal display
  selectedMember: string = ''; // Added for member selection in modal
  currentIterationPath: string = 'Techoil\\2.3.23'; // Default value
  iterationPaths: string[] = []; // Will be loaded from API
  teamMemberTaskCounts: Record<string, number> = {}; // Added for task counts
  
  // Auto-assign preview properties
  showingPreview: boolean = false;
  assignPreviewTasks: WorkItem[] = [];
  assignPreviewSuggestions: Record<string, string> = {};
  
  // Convert simple boolean to object with specific loading states
  loading: { 
    tasks: boolean; 
    members: boolean; 
    assign: boolean; 
    autoAssign: boolean;
    iterationPaths: boolean;
    taskCounts: boolean; // Added for task counts loading
    preview: boolean; // Added for auto-assign preview loading
  } = {
    tasks: false,
    members: false,
    assign: false,
    autoAssign: false,
    iterationPaths: false,
    taskCounts: false, // Added for task counts loading
    preview: false // Added for auto-assign preview loading
  };
  
  // Convert simple string to object with specific error states
  error: { 
    tasks: string | null; 
    members: string | null; 
    assign: string | null; 
    autoAssign: string | null;
    iterationPaths: string | null;
    taskCounts: string | null; // Added for task counts errors
    preview: string | null; // Added for auto-assign preview errors
  } = {
    tasks: null,
    members: null,
    assign: null,
    autoAssign: null,
    iterationPaths: null,
    taskCounts: null, // Added for task counts errors
    preview: null // Added for auto-assign preview errors
  };

  constructor(
    private taskService: TaskService,
    private teamService: TeamService
  ) {}

  ngOnInit(): void {
    this.loadIterationPaths();
  }

  loadIterationPaths(): void {
    this.loading.iterationPaths = true;
    this.error.iterationPaths = null;

    this.taskService.getIterationPaths().subscribe({
      next: (paths) => {
        this.iterationPaths = paths;
        this.loading.iterationPaths = false;
        
        if (paths.length > 0) {
          // Use the first path as default if available
          this.currentIterationPath = paths[0];
        }
        
        // After loading iteration paths, load tasks and team members
        this.loadTasks();
        this.loadTeamMembers();
      },
      error: (err) => {
        console.error('Error loading iteration paths:', err);
        this.error.iterationPaths = `Failed to load iteration paths: ${err.message}`;
        this.loading.iterationPaths = false;
        
        // Add fallback iteration paths if API call fails
        this.iterationPaths = [
          'Techoil\\2.3.23',
          'Techoil\\2.3.24',
          'Techoil\\2.3.25',
          'Techoil\\2.3.26'
        ];
        console.log('Using fallback iteration paths:', this.iterationPaths);
        
        // Even if iteration paths loading fails, try to load tasks and team members
        this.loadTasks();
        this.loadTeamMembers();
      }
    });
  }

  loadTasks(): void {
    this.loading.tasks = true;
    this.error.tasks = null;
    
    console.log(`Loading tasks for iteration path: ${this.currentIterationPath}`);
    
    this.taskService.getTasks(this.currentIterationPath).subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.loading.tasks = false;
        console.log(`Loaded ${tasks.length} tasks for iteration path ${this.currentIterationPath}`);
        
        // After loading tasks, update team workload and filter tasks
        if (this.teamMembers.length > 0) {
          this.updateTeamWorkload();
          this.filterTasksByRnDTeamMembers();
        }
      },
      error: (err) => {
        console.error(`Error loading tasks for iteration path ${this.currentIterationPath}:`, err);
        this.error.tasks = `Failed to load tasks: ${err.message}`;
        this.loading.tasks = false;
      }
    });
  }

  loadTeamMembers(): void {
    this.loading.members = true;
    this.error.members = null;

    // Use the taskService directly to get team members by RND team
    this.teamService.getTeamMembersByTeam('RND', this.currentIterationPath).subscribe({
      next: (teamMembers) => {
        this.teamMembers = teamMembers;
        console.log('Loaded RND team members:', this.teamMembers);
        this.loading.members = false;
        
        // Filter out non-R&D team members
        this.filterRnDTeamMembers();
        
        // Load team member task counts after loading team members
        this.loadTeamMemberTaskCounts();
        
        // If tasks are already loaded, update workload
        if (this.tasks.length > 0) {
          this.updateTeamWorkload();
        } else {
          // If no tasks are loaded yet, still show the team members
          console.log('No tasks loaded yet, showing filtered RND team members');
        }
      },
      error: (err) => {
        console.error('Error loading RND team members:', err);
        
        // Fallback to regular team members if RND team fails
        this.taskService.getTeamMembers(this.currentIterationPath).subscribe({
          next: (response) => {
            // Check if response is an array of strings (names) or TeamMember objects
            if (response.length > 0 && typeof response[0] === 'string') {
              // It's an array of strings, convert to TeamMember objects
              const names = response as string[];
              this.teamMembers = names.map((name, index) => ({
                id: `member-${index}`,
                displayName: name,
                uniqueName: '',
                currentWorkload: 0,
                isActive: true,
                email: ''
              }));
            } else {
              // It's already an array of TeamMember objects
              this.teamMembers = response as TeamMember[];
            }
            console.log('Loaded fallback team members:', this.teamMembers);
            this.loading.members = false;
            
            // Filter out non-R&D team members even with fallback approach
            this.filterRnDTeamMembers();
            
            // Load team member task counts after loading team members
            this.loadTeamMemberTaskCounts();
            
            // If tasks are already loaded, update workload
            if (this.tasks.length > 0) {
              this.updateTeamWorkload();
            }
          },
          error: (innerErr) => {
            console.error('Error loading fallback team members:', innerErr);
            this.error.members = `Failed to load team members: ${err.message}`;
            this.loading.members = false;
            
            // Add fallback team members if API call fails
            this.teamMembers = [
              { id: '1', displayName: 'Ranjith Kumar S', email: 'ranjithkumar.s@inatech.onmicrosoft.com', currentWorkload: 0, isActive: true, uniqueName: 'ranjithkumar.s', team: 'R&D' },
              { id: '2', displayName: 'Rabirai Madhavan', email: 'rabiraj.m@example.com', currentWorkload: 0, isActive: true, uniqueName: 'rabiraj.m', team: 'R&D' },
              { id: '3', displayName: 'Dhinakarraj Sivakumar', email: 'dhivakarraj.s@example.com', currentWorkload: 0, isActive: true, uniqueName: 'dhivakarraj.s', team: 'R&D' }
            ];
            this.filterRnDTeamMembers();
            console.log('Using fallback team members:', this.teamMembers);
            
            // Try to load task counts even if team members loading fails
            this.loadTeamMemberTaskCounts();
          }
        });
      }
    });
  }

  /**
   * Filter team members to only include R&D team members
   */
  filterRnDTeamMembers(): void {
    // Filter out members that don't have an R&D-related team property
    this.filteredTeamMembers = this.teamMembers.filter(member => {
      // If member has a team property and it contains R&D-related terms
      if (member.team) {
        return member.team.toLowerCase().includes('r&d') || 
               member.team.toLowerCase().includes('rnd') || 
               member.team.toLowerCase().includes('research');
      }
      
      // Log members without team info
      console.log(`Team member without team info: ${member.displayName}`);
      
      // If no team property, default to including the member (backend should have already filtered)
      return true;
    });
    
    // Log the results
    console.log(`Filtered ${this.teamMembers.length} team members down to ${this.filteredTeamMembers.length} R&D members`);
  }

  /**
   * Load task counts for each team member from the API
   */
  loadTeamMemberTaskCounts(): void {
    this.loading.taskCounts = true;
    this.error.taskCounts = null;
    
    this.taskService.getTeamMemberTaskCounts(this.currentIterationPath).subscribe({
      next: (counts) => {
        this.teamMemberTaskCounts = counts;
        this.loading.taskCounts = false;
        console.log('Loaded team member task counts:', this.teamMemberTaskCounts);
        
        // Update the team members with their task counts
        this.updateTeamWorkload();
      },
      error: (err) => {
        console.error('Error loading team member task counts:', err);
        this.error.taskCounts = `Failed to load task counts: ${err.message}`;
        this.loading.taskCounts = false;
        
        // Fall back to counting tasks manually
        this.updateTeamWorkload();
      }
    });
  }

  /**
   * Calculate and update team members' workload based on task assignments
   */
  updateTeamWorkload(): void {
    console.log('Updating team workload');
    
    // Reset all workloads to 0 for all team members
    this.teamMembers.forEach(member => {
      member.currentWorkload = 0;
    });
    
    // If we have task counts from the API, use those
    if (Object.keys(this.teamMemberTaskCounts).length > 0) {
      this.teamMembers.forEach(member => {
        // Try to find this member in the task counts
        const counts = Object.entries(this.teamMemberTaskCounts).find(
          ([name, _]) => name.toLowerCase() === member.displayName.toLowerCase()
        );
        
        if (counts) {
          member.currentWorkload = counts[1]; // Set the count from the API
        }
      });
    } else {
      // Fall back to counting from tasks array
      this.tasks.forEach(task => {
        if (task.assignedTo) {
          // Normalize the assignedTo value
          const normalizedAssignedTo = task.assignedTo.trim().toLowerCase();
          
          // Find matching team member
          const matchedMember = this.teamMembers.find(member => 
            member.displayName.toLowerCase() === normalizedAssignedTo
          );
          
          if (matchedMember) {
            matchedMember.currentWorkload++;
          }
        }
      });
    }
    
    // Re-apply R&D filter to ensure we only show R&D team members
    this.filterRnDTeamMembers();
    
    // Also filter tasks to match R&D team members
    this.filterTasksByRnDTeamMembers();
    
    console.log('Updated team workload for filtered members:', this.filteredTeamMembers);
  }

  /**
   * Check if a team member is part of the current iteration team
   * This is a placeholder - you may need to implement actual logic based on your data model
   */
  isPartOfCurrentIterationTeam(member: TeamMember): boolean {
    // By default, include all team members
    // You might want to enhance this with actual iteration team membership logic
    return true;
  }

  assignTask(): void {
    if (!this.selectedTask) {
      this.error.assign = 'Error: No task selected for assignment';
      return;
    }
    
    if (!this.selectedMember) {
      this.error.assign = 'Please select a team member for assignment';
      return;
    }

    this.loading.assign = true;
    this.error.assign = null;
    
    // Use the selected member name directly for the API call
    console.log(`Assigning task ${this.selectedTask} to member ${this.selectedMember}`);
    
    this.taskService.assignTask(this.selectedTask, this.selectedMember).subscribe({
      next: (response) => {
        console.log('Task assignment successful:', response);
        // Close the modal
        this.cancelAssign();
        // Show success message (could be implemented with a toast/snackbar service)
        this.showSuccessMessage('Task assigned successfully');
        // Reload tasks and task counts to reflect changes
        this.loadTasks();
        this.loadTeamMemberTaskCounts();
      },
      error: (err) => {
        console.error('Error assigning task:', err);
        this.error.assign = `Failed to assign task: ${err.message}`;
        this.loading.assign = false;
      }
    });
  }

  // Helper method to show success message (placeholder for toast/snackbar)
  showSuccessMessage(message: string): void {
    console.log('SUCCESS:', message);
    // In a real implementation, you would use a toast/snackbar service
    // Example: this.toastService.show(message, { classname: 'bg-success' });
    
    // For now, create a simple alert element that disappears after a few seconds
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success position-fixed top-0 end-0 m-3';
    alertDiv.textContent = message;
    alertDiv.style.zIndex = '9999';
    document.body.appendChild(alertDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
      alertDiv.remove();
    }, 3000);
  }

  /**
   * Show auto-assign preview before actually assigning tasks
   */
  showAutoAssignPreview(): void {
    this.loading.preview = true;
    this.error.preview = null;
    this.showingPreview = true;
    
    // First get all tasks for the iteration path
    this.taskService.getTasks(this.currentIterationPath).subscribe({
      next: (tasks) => {
        console.log('Got tasks from service:', tasks);
        console.log('Tasks with Dev-New status:', tasks.filter(t => 
          t.status && t.status.toLowerCase() === 'dev-new'
        ));
        
        // First, get all Dev-New tasks
        const allDevNewTasks = tasks.filter(t => 
          t.status && t.status.toLowerCase() === 'dev-new'
        );
        
        console.log('All Dev-New tasks:', allDevNewTasks);
        
        // Get R&D team members for this iteration path
        this.teamService.getTeamMembersByTeam('RND', this.currentIterationPath).subscribe({
          next: (rndMembers) => {
            console.log('Got R&D team members for auto-assign:', rndMembers);
            
            // Extract the list of R&D team member names for the API
            const rndMemberNames = rndMembers.map(m => m.displayName);
            
            // Then, get suggestions for which tasks should be reassigned
            // Pass the R&D team member names to the API for filtering
            this.taskService.getAutoAssignSuggestionsForTeam(this.currentIterationPath, rndMemberNames).subscribe({
              next: (suggestions: Record<string, string>) => {
                this.assignPreviewSuggestions = suggestions;
                console.log('Got suggestions for R&D members:', suggestions);
                
                // Filter tasks to only include those in the suggestions (tasks to be reassigned)
                const suggestedTaskIds = Object.keys(suggestions).map(id => parseInt(id));
                this.assignPreviewTasks = allDevNewTasks.filter(task => 
                  suggestedTaskIds.includes(task.id)
                );
                
                console.log('Filtered tasks to be reassigned:', this.assignPreviewTasks);
                this.loading.preview = false;
              },
              error: (err: Error) => {
                // Fall back to the standard auto-assign if the R&D-specific endpoint fails
                console.error('Failed to get R&D-specific suggestions, falling back to standard auto-assign:', err);
                this.getStandardAutoAssignSuggestions(allDevNewTasks);
              }
            });
          },
          error: (err: Error) => {
            console.error('Error loading R&D team members for auto-assign:', err);
            // Fall back to the standard auto-assign if R&D team member loading fails
            this.getStandardAutoAssignSuggestions(allDevNewTasks);
          }
        });
      },
      error: (err) => {
        this.error.preview = `Failed to load tasks: ${err.message}`;
        this.loading.preview = false;
      }
    });
  }
  
  /**
   * Fallback method to get standard auto-assign suggestions if R&D-specific fails
   */
  private getStandardAutoAssignSuggestions(allDevNewTasks: WorkItem[]): void {
    this.taskService.getAutoAssignSuggestions(this.currentIterationPath).subscribe({
      next: (suggestions) => {
        this.assignPreviewSuggestions = suggestions;
        console.log('Got standard suggestions (fallback):', suggestions);
        
        // Filter tasks to only include those in the suggestions (tasks to be reassigned)
        const suggestedTaskIds = Object.keys(suggestions).map(id => parseInt(id));
        this.assignPreviewTasks = allDevNewTasks.filter(task => 
          suggestedTaskIds.includes(task.id)
        );
        
        console.log('Filtered tasks to be reassigned (fallback):', this.assignPreviewTasks);
        this.loading.preview = false;
      },
      error: (err) => {
        this.error.preview = `Failed to load auto-assign suggestions: ${err.message}`;
        this.loading.preview = false;
      }
    });
  }
  
  /**
   * Check if there are valid assignment suggestions
   */
  hasAssignmentSuggestions(): boolean {
    return this.assignPreviewSuggestions && Object.keys(this.assignPreviewSuggestions).length > 0;
  }
  
  /**
   * Cancel auto-assign preview and close the modal
   */
  cancelAutoAssignPreview(): void {
    this.showingPreview = false;
    this.assignPreviewTasks = [];
    this.assignPreviewSuggestions = {};
    this.error.preview = null;
  }
  
  /**
   * Confirm and perform the auto-assignments
   */
  confirmAutoAssign(): void {
    this.loading.autoAssign = true;
    this.error.autoAssign = null;
    
    const assignmentPromises = [];
    let assignmentCount = 0;
    
    // For each task with a suggestion, create an assignment
    for (const task of this.assignPreviewTasks) {
      if (this.assignPreviewSuggestions[task.id]) {
        const developerName = this.extractDeveloperName(this.assignPreviewSuggestions[task.id]);
        assignmentPromises.push(
          this.taskService.assignTask(task.id, developerName)
        );
        assignmentCount++;
      }
    }
    
    // If we have assignments to make, execute them all in parallel
    if (assignmentPromises.length > 0) {
      forkJoin(assignmentPromises).subscribe({
        next: () => {
          // Hide the preview after successful assignment
          this.showingPreview = false;
          
          // Refresh the task list
          this.loadTasks();
          
          // Show success message
          alert(`Successfully assigned ${assignmentCount} tasks.`);
          
          this.loading.autoAssign = false;
        },
        error: (err) => {
          this.error.autoAssign = `Error assigning tasks: ${err.message}`;
          this.loading.autoAssign = false;
        }
      });
    } else {
      this.loading.autoAssign = false;
      this.error.preview = "No tasks available for assignment.";
    }
  }
  
  /**
   * Extract just the developer name from the suggestion string
   * Format is typically "Name (explanation)"
   */
  extractDeveloperName(suggestion: string): string {
    if (!suggestion) return '';
    const parts = suggestion.split(' (');
    return parts[0];
  }
  
  /**
   * Extract the logic explanation from the suggestion string
   * Format is typically "Name (explanation)"
   */
  extractLogicExplanation(suggestion: string): string {
    if (!suggestion) return '';
    const match = suggestion.match(/\((.*?)\)/);
    return match ? match[1] : '';
  }

  /**
   * Original auto-assign tasks method - replaced with preview workflow
   */
  autoAssignTasks(): void {
    this.loading.autoAssign = true;
    this.error.autoAssign = null;
    
    this.taskService.autoAssignTasks(this.currentIterationPath).subscribe({
      next: () => {
        // Reload tasks and task counts to reflect changes
        this.loadTasks();
        this.loadTeamMemberTaskCounts();
        this.loading.autoAssign = false;
      },
      error: (err) => {
        this.error.autoAssign = `Failed to auto-assign tasks: ${err.message}`;
        this.loading.autoAssign = false;
      }
    });
  }

  openAssignModal(taskId: number): void {
    this.selectedTask = taskId;
    this.selectedMember = '';
    this.error.assign = null;

    // Get the iteration path for this specific task - first try filtered tasks
    let task = this.filteredTasks.find(t => t.id === taskId);
    
    // If not found, check all tasks (in case this is accessing a non-filtered task)
    if (!task) {
      task = this.tasks.find(t => t.id === taskId);
    }
    
    if (task && task.iterationPath) {
      // Fetch R&D team members specifically for this task's iteration path
      this.loading.members = true;
      
      this.teamService.getTeamMembersByTeam('RND', task.iterationPath).subscribe({
        next: (members) => {
          this.teamMembers = members;
          this.loading.members = false;
          
          // Filter to R&D team members
          this.filterRnDTeamMembers();
          
          // Load task counts after team members are loaded
          if (task && task.iterationPath) {
            this.loadTeamMemberTaskCountsForModal(task.iterationPath);
          }
        },
        error: (err) => {
          console.error(`Error loading R&D team members for iteration path ${task?.iterationPath ?? 'unknown'}:`, err);
          this.error.members = `Failed to load team members: ${err.message}`;
          this.loading.members = false;
          
          // Fallback to regular team members if R&D team fetch fails
          if (task && task.iterationPath) {
            this.taskService.getTeamMembers(task.iterationPath).subscribe({
              next: (response) => {
                if (Array.isArray(response) && response.length > 0) {
                  if (typeof response[0] === 'string') {
                    // String array response
                    const names = response as string[];
                    this.teamMembers = names.map((name, index) => ({
                      id: `member-${index}`,
                      displayName: name,
                      uniqueName: '',
                      currentWorkload: 0,
                      isActive: true,
                      email: ''
                    }));
                  } else {
                    // TeamMember array response
                    this.teamMembers = response as TeamMember[];
                  }
                } else {
                  this.teamMembers = [];
                }
                
                this.loading.members = false;
                
                // Filter to R&D team members even with fallback response
                this.filterRnDTeamMembers();
                
                if (task && task.iterationPath) {
                  this.loadTeamMemberTaskCountsForModal(task.iterationPath);
                }
              },
              error: (fallbackErr) => {
                console.error(`Error loading fallback team members:`, fallbackErr);
                this.error.members = `Failed to load team members: ${fallbackErr.message}`;
                this.loading.members = false;
              }
            });
          } else {
            console.error('Cannot load team members: task or iterationPath is undefined');
            this.loading.members = false;
          }
        }
      });
    } else {
      // Ensure we have team members loaded before showing the modal
      if (this.filteredTeamMembers.length === 0 && !this.loading.members) {
        this.loadTeamMembers();
      }
      
      // Make sure we have task counts loaded
      if (Object.keys(this.teamMemberTaskCounts).length === 0) {
        this.loadTeamMemberTaskCounts();
      }
    }
  }

  /**
   * Load task counts specifically for the modal dialogue
   * This ensures counts are up-to-date when assigning tasks
   */
  loadTeamMemberTaskCountsForModal(iterationPath: string): void {
    this.loading.taskCounts = true;
    
    this.taskService.getTeamMemberTaskCounts(iterationPath).subscribe({
      next: (counts) => {
        this.teamMemberTaskCounts = counts;
        this.loading.taskCounts = false;
        console.log('Loaded team member task counts for modal:', this.teamMemberTaskCounts);
      },
      error: (err) => {
        console.error('Error loading team member task counts for modal:', err);
        this.loading.taskCounts = false;
      }
    });
  }

  cancelAssign(): void {
    this.selectedTask = null;
    this.selectedMember = '';
    this.error.assign = null;
    this.loading.assign = false;
  }

  /**
   * Get CSS class for priority badge
   * @param priority Priority value (number or string)
   * @returns CSS class name
   */
  getPriorityClass(priority: number | string): string {
    // Convert priority to number if it's a string
    const priorityNum = typeof priority === 'string' ? parseInt(priority, 10) : priority;
    
    if (isNaN(priorityNum)) {
      return 'bg-secondary'; // Default for invalid priority
    }
    
    switch (priorityNum) {
      case 1:
        return 'bg-danger';
      case 2:
        return 'bg-warning text-dark';
      case 3:
        return 'bg-info text-dark';
      case 4:
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  }

  /**
   * Get CSS class for status badge
   * @param status Status string or undefined
   * @returns CSS class name
   */
  getStatusClass(status: string | undefined): string {
    if (!status) {
      return 'bg-secondary'; // Default for undefined status
    }
    
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('progress') || statusLower === 'active') {
      return 'bg-primary';
    } else if (statusLower === 'completed' || statusLower === 'done' || statusLower === 'closed') {
      return 'bg-success';
    } else if (statusLower === 'blocked') {
      return 'bg-danger';
    } else if (statusLower === 'to do' || statusLower === 'new') {
      return 'bg-secondary';
    } else {
      return 'bg-info';
    }
  }

  /**
   * Get CSS class for team member workload indicator
   * @param workload Current workload value
   * @returns CSS class name
   */
  getTeamMemberWorkloadClass(workload: number): string {
    if (workload === 0) {
      return 'bg-secondary';
    } else if (workload < 3) {
      return 'bg-success';
    } else if (workload < 7) {
      return 'bg-warning text-dark';
    } else {
      return 'bg-danger';
    }
  }

  /**
   * Get the progress bar class based on workload
   * @param workload Current workload
   * @returns Bootstrap progress bar class
   */
  getProgressBarClass(workload: number): string {
    if (workload === 0) {
      return 'bg-secondary';
    } else if (workload < 3) {
      return 'bg-success';
    } else if (workload < 7) {
      return 'bg-warning';
    } else {
      return 'bg-danger';
    }
  }

  /**
   * Calculate workload as a percentage (for progress bar width)
   * @param workload Current workload
   * @returns Percentage value (0-100)
   */
  getWorkloadPercentage(workload: number): number {
    // Using 10 as maximum reasonable workload
    const maxWorkload = 10;
    return Math.min(100, (workload / maxWorkload) * 100);
  }

  /**
   * Change the iteration path and reload tasks
   * @param iterationPath New iteration path to load tasks from
   */
  changeIterationPath(iterationPath: string): void {
    console.log(`Changing iteration path to: ${iterationPath}`);
    this.currentIterationPath = iterationPath;
    
    // Reset data
    this.tasks = [];
    this.filteredTasks = [];
    this.teamMembers = [];
    this.filteredTeamMembers = [];
    this.teamMemberTaskCounts = {};
    
    // Load new data
    this.loadTasks();
    this.loadTeamMembers();
  }

  /**
   * Get the title of the currently selected task
   * @returns The task title or a fallback message
   */
  getSelectedTaskTitle(): string {
    if (this.selectedTask === null) {
      return 'No task selected';
    }
    
    const selectedTaskId = this.selectedTask;
    // First try to find in filtered tasks
    let task = this.filteredTasks.find(t => t.id === selectedTaskId);
    
    // If not found (could be a non-R&D task), look in all tasks
    if (!task) {
      task = this.tasks.find(t => t.id === selectedTaskId);
    }
    
    return task ? task.title : 'Unknown Task';
  }

  /**
   * Get the task count for a specific team member
   * @param memberName The name of the team member
   * @returns The number of tasks assigned to that member
   */
  getTaskCount(memberName: string): number {
    // First check if we have task counts from the API
    if (Object.keys(this.teamMemberTaskCounts).length > 0) {
      // Look for an exact match
      if (this.teamMemberTaskCounts[memberName] !== undefined) {
        return this.teamMemberTaskCounts[memberName];
      }
      
      // Try case-insensitive match
      const key = Object.keys(this.teamMemberTaskCounts).find(
        k => k.toLowerCase() === memberName.toLowerCase()
      );
      
      if (key) {
        return this.teamMemberTaskCounts[key];
      }
    }
    
    // Fall back to the currentWorkload from team members
    const member = this.teamMembers.find(
      m => m.displayName.toLowerCase() === memberName.toLowerCase()
    );
    
    return member ? member.currentWorkload : 0;
  }

  /**
   * Get a list of all tasks with Dev-New status
   * @returns List of Dev-New tasks
   */
  getDevNewTasks(): WorkItem[] {
    return this.filteredTasks.filter(task => 
      task.status && task.status.toLowerCase() === 'dev-new'
    );
  }

  /**
   * Get a list of unassigned Dev-New tasks
   * @returns List of unassigned Dev-New tasks
   */
  getUnassignedDevNewTasks(): WorkItem[] {
    return this.filteredTasks.filter(task => 
      task.status && 
      task.status.toLowerCase() === 'dev-new' && 
      !task.assignedTo
    );
  }
  
  /**
   * Get a summary of task status distribution
   * @returns Array of status counts
   */
  getStatusDistribution(): {status: string, count: number}[] {
    const statusCounts: {[key: string]: number} = {};
    
    this.filteredTasks.forEach(task => {
      const status = task.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      status, 
      count
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Filter tasks to only show those assigned to R&D team members
   */
  filterTasksByRnDTeamMembers(): void {
    // First ensure we have filtered team members
    if (this.filteredTeamMembers.length === 0) {
      this.filterRnDTeamMembers();
    }
    
    // Get a list of display names of filtered R&D team members
    const rndMemberNames = this.filteredTeamMembers.map(member => 
      member.displayName.toLowerCase()
    );
    
    console.log('R&D team member names for task filtering:', rndMemberNames);
    
    // Filter tasks to only include those assigned to R&D members and unassigned tasks
    this.filteredTasks = this.tasks.filter(task => {
      // Always include unassigned tasks
      if (!task.assignedTo) {
        return true;
      }
      
      // Check if task is assigned to an R&D team member
      return rndMemberNames.includes(task.assignedTo.toLowerCase());
    });
    
    console.log(`Filtered ${this.tasks.length} tasks down to ${this.filteredTasks.length} tasks assigned to R&D members or unassigned`);
  }
}