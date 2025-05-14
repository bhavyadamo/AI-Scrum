import { Component, OnInit, AfterViewInit } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { WorkItem, TeamMember } from '../../models/task.model';
import { forkJoin } from 'rxjs';

// Declare the global bootstrap variable for TypeScript
declare global {
  interface Window {
    bootstrap: any;
  }
}

@Component({
  selector: 'app-task-distribution',
  templateUrl: './task-distribution.component.html',
  styleUrls: ['./task-distribution.component.scss']
})
export class TaskDistributionComponent implements OnInit, AfterViewInit {
  tasks: WorkItem[] = [];
  filteredTasks: WorkItem[] = [];
  teamMembers: TeamMember[] = [];
  filteredTeamMembers: TeamMember[] = []; // New property for filtered team members
  selectedTaskId: number | null = null;
  selectedTeamMemberId: string = '';
  selectedTask: number | null = null; // Added for modal display
  selectedMember: string = ''; // Added for member selection in modal
  currentIterationPath: string = 'Techoil\\2.3.23'; // Default value
  manualIterationPath: string = ''; // For manual input
  teamName: string = 'RND'; // Default team name
  iterationPaths: string[] = []; // Will be loaded from API
  teamMemberTaskCounts: Record<string, number> = {}; // Added for task counts
  applyTeamFilter: boolean = true; // Whether to apply team name filter
  
  // Auto-assign preview properties
  showingPreview: boolean = false;
  assignPreviewTasks: WorkItem[] = [];
  assignPreviewSuggestions: Record<string, string> = {};
  
  // Track the active tab
  activeTab: string = 'distribution';
  
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

  /**
   * Handle tab change events
   * @param tabId The ID of the selected tab
   */
  onTabChange(tabId: string): void {
    console.log(`Tab changed to: ${tabId}`);
    this.activeTab = tabId;
    
    // Load specific data based on the selected tab
    if (tabId === 'workload') {
      // Force refresh team members and workload data
      this.loadTeamMembers();
      this.loadTeamMemberTaskCounts();
      console.log('Refreshing team workload data');
    } else if (tabId === 'distribution') {
      // Refresh tasks if needed
      if (this.filteredTasks.length === 0 && !this.loading.tasks) {
        this.loadTasks();
        console.log('Refreshing task distribution data');
      }
    }
  }

  ngAfterViewInit(): void {
    // Initialize Bootstrap tabs
    this.initializeBootstrapTabs();
  }

  /**
   * Initialize Bootstrap tabs programmatically
   */
  private initializeBootstrapTabs(): void {
    try {
      // Check if Bootstrap's Tab class is available globally
      if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Tab) {
        // Initialize all tabs
        const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
        tabElements.forEach(tabEl => {
          // Create tab instance
          const tab = new window.bootstrap.Tab(tabEl);
          
          // Add event listener for tab shown event
          tabEl.addEventListener('shown.bs.tab', (event: any) => {
            // Extract tab ID from the target
            const targetId = event.target.getAttribute('data-bs-target');
            const tabId = targetId === '#task-distribution' ? 'distribution' : 'workload';
            console.log(`Tab shown event: ${tabId}`);
            
            // Update active tab and ensure data is loaded
            this.activeTab = tabId;
            
            // Ensure tab content is loaded/refreshed
            if (tabId === 'workload' && this.filteredTeamMembers.length === 0 && !this.loading.members) {
              this.loadTeamMembers();
              this.loadTeamMemberTaskCounts();
            }
          });
        });
        
        console.log('Bootstrap tabs initialized successfully with event listeners');
      } else {
        console.warn('Bootstrap JavaScript not found. Tabs may not function properly.');
      }
    } catch (error) {
      console.error('Error initializing Bootstrap tabs:', error);
    }
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
          this.manualIterationPath = paths[0];
        }
        
        // We no longer automatically load data after loading iteration paths
        // Data will be loaded when the search button is clicked
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
        
        // We no longer automatically load data after loading iteration paths
        // Data will be loaded when the search button is clicked
      }
    });
  }

  /**
   * Search button handler - loads data based on manual inputs
   */
  searchClicked(): void {
    // Normalize the manual input iteration path
    const normalizedPath = this.manualIterationPath.replace(/\\\\/g, '\\');
    
    // Update the current iteration path with the normalized manual input
    this.currentIterationPath = normalizedPath;
    this.manualIterationPath = normalizedPath; // Update the displayed value too
    
    // Clear previous errors
    this.error.tasks = null;
    this.error.members = null;
    
    console.log(`Searching with team filter ${this.applyTeamFilter ? 'enabled' : 'disabled'}`);
    console.log(`Using normalized iteration path: ${normalizedPath}`);
    
    // Load data based on the manual inputs
    this.loadTasks();
    this.loadTeamMembers();
  }

  loadTasks(): void {
    this.loading.tasks = true;
    this.error.tasks = null;
    
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = this.currentIterationPath.replace(/\\\\/g, '\\');
    
    console.log(`Loading tasks for iteration path: ${normalizedPath}`);
    
    this.taskService.getTasks(normalizedPath).subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.loading.tasks = false;
        console.log(`Loaded ${tasks.length} tasks for iteration path ${normalizedPath}`);
        
        // After loading tasks, update team workload and filter tasks
        if (this.teamMembers.length > 0) {
          this.updateTeamWorkload();
          this.filterTasksByRnDTeamMembers();
        }
      },
      error: (err) => {
        console.error(`Error loading tasks for iteration path ${normalizedPath}:`, err);
        this.error.tasks = `Failed to load tasks: ${err.message}`;
        this.loading.tasks = false;
      }
    });
  }

  loadTeamMembers(): void {
    this.loading.members = true;
    this.error.members = null;

    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = this.currentIterationPath.replace(/\\\\/g, '\\');

    // Use the teamService directly to get team members by team name if filter is applied
    // Otherwise, just get all team members
    if (this.applyTeamFilter) {
      this.teamService.getTeamMembersByTeam(this.teamName, normalizedPath).subscribe({
        next: (teamMembers) => {
          this.teamMembers = teamMembers;
          console.log(`Loaded ${this.teamName} team members:`, this.teamMembers);
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
            console.log('No tasks loaded yet, showing filtered team members');
          }
        },
        error: (err) => {
          console.error(`Error loading ${this.teamName} team members:`, err);
          
          // Fallback to regular team members if team-specific call fails
          this.loadAllTeamMembers(normalizedPath);
        }
      });
    } else {
      // If team filter is not applied, load all team members
      this.loadAllTeamMembers(normalizedPath);
    }
  }

  /**
   * Helper method to load all team members without team filter
   */
  private loadAllTeamMembers(normalizedPath: string): void {
    this.taskService.getTeamMembers(normalizedPath).subscribe({
      next: (response) => {
        // Process the response as an array of TeamMember objects
        if (Array.isArray(response)) {
          // Handle string array response - convert strings to TeamMember objects
          if (response.length > 0 && typeof response[0] === 'string') {
            this.teamMembers = (response as string[]).map((name, index) => ({
              id: `member-${index}`,
              displayName: name,
              uniqueName: '',
              currentWorkload: 0,
              isActive: true,
              email: '',
              team: this.applyTeamFilter ? this.teamName : ''
            }));
          } else {
            // It's already an array of TeamMember objects
            this.teamMembers = response as TeamMember[];
          }
          
          // If team filter is applied, still filter out non-R&D team members
          if (this.applyTeamFilter) {
            this.filterRnDTeamMembers();
          } else {
            // If not applying team filter, all team members are filtered
            this.filteredTeamMembers = this.teamMembers;
          }
          
          // If tasks are already loaded, update team workload data
          if (this.tasks.length > 0) {
            this.updateTeamWorkload();
          }
        } else {
          console.error('Unexpected response format from getTeamMembers:', response);
          this.error.members = 'Failed to load team members: Invalid response format';
        }
        
        this.loading.members = false;
      },
      error: (memberErr) => {
        console.error(`Error loading team members for iteration path ${normalizedPath}:`, memberErr);
        this.error.members = `Failed to load team members: ${memberErr.message}`;
        this.loading.members = false;
      }
    });
  }

  /**
   * Filter team members to only include R&D team members
   */
  filterRnDTeamMembers(): void {
    // Convert any string team members to objects first
    this.teamMembers = this.teamMembers.map((member, index) => {
      if (typeof member === 'string') {
        return {
          id: `member-${index}`,
          displayName: member,
          uniqueName: '',
          currentWorkload: 0,
          isActive: true,
          email: '',
          team: this.applyTeamFilter ? this.teamName : ''
        };
      }
      return member;
    });
    
    // Filter out members that don't have an R&D-related team property
    this.filteredTeamMembers = this.teamMembers.filter(member => {
      // Ensure member is an object
      if (typeof member !== 'object') {
        console.warn(`Unexpected member type in filterRnDTeamMembers: ${typeof member}`);
        return false;
      }
      
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
    
    // Normalize the iteration path
    const normalizedPath = this.currentIterationPath.replace(/\\\\/g, '\\');
    
    this.taskService.getTeamMemberTaskCounts(normalizedPath).subscribe({
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
      // Ensure member is a TeamMember object and not a string
      if (typeof member === 'string') {
        console.warn(`Found string member instead of object: ${member}`);
        // Convert string to TeamMember object if needed
        const index = this.teamMembers.indexOf(member);
        if (index >= 0) {
          this.teamMembers[index] = {
            id: `member-${index}`,
            displayName: member,
            uniqueName: '',
            currentWorkload: 0,
            isActive: true,
            email: '',
            team: this.applyTeamFilter ? this.teamName : ''
          };
        }
      } else {
        // Reset workload for object
        member.currentWorkload = 0;
      }
    });
    
    // If we have task counts from the API, use those
    if (Object.keys(this.teamMemberTaskCounts).length > 0) {
      this.teamMembers.forEach(member => {
        // Skip if member is not an object
        if (typeof member === 'string') return;
        
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
            typeof member === 'object' && member.displayName.toLowerCase() === normalizedAssignedTo
          );
          
          if (matchedMember) {
            matchedMember.currentWorkload++;
          }
        }
      });
    }
    
    // Only filter for R&D team members if team filter is applied
    if (this.applyTeamFilter) {
      // Re-apply R&D filter to ensure we only show R&D team members
      this.filterRnDTeamMembers();
    } else {
      // If filter not applied, use all team members
      this.filteredTeamMembers = this.teamMembers;
    }
    
    // Also filter tasks to match team members or show all if filter not applied
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
   * Show preview of auto-assign suggestions before performing the assignment
   */
  showAutoAssignPreview(): void {
    this.loading.preview = true;
    this.error.preview = null;
    this.showingPreview = true;
    this.assignPreviewTasks = [];
    this.assignPreviewSuggestions = {};
    
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = this.currentIterationPath.replace(/\\\\/g, '\\');
    console.log('Using normalized iteration path for auto-assign preview:', normalizedPath);
    
    // First, get all Dev-New tasks for the current iteration
    this.taskService.getTasks(normalizedPath).subscribe({
      next: (tasks) => {
        // Enhanced filtering for Dev-New tasks - handle various status formats
        const allDevNewTasks = tasks.filter(task => {
          // Skip tasks without status
          if (!task.status) return false;
          
          // Normalize status by removing spaces, hyphens, and converting to lowercase
          const normalizedStatus = task.status.toLowerCase()
            .replace(/[\s\-]/g, ''); // Remove spaces and hyphens
          
          // Match against various formats of "Dev-New"
          return normalizedStatus === 'devnew' || 
                 normalizedStatus === 'newdev' ||
                 normalizedStatus.includes('devnew') ||
                 normalizedStatus.includes('newdev') ||
                 normalizedStatus.includes('developmentnew') ||
                 normalizedStatus.includes('newdevelopment');
        });
        
        console.log(`Found ${allDevNewTasks.length} Dev-New tasks for auto-assign preview out of ${tasks.length} total tasks`);
        console.log('Dev-New tasks:', allDevNewTasks);
        
        if (allDevNewTasks.length === 0) {
          this.error.preview = 'No Dev-New tasks found in the current iteration. Auto-assign requires tasks with Dev-New status.';
          this.loading.preview = false;
          return;
        }
        
        // If RnD team filter is applied, get team-specific suggestions
        if (this.applyTeamFilter && this.teamName === 'RND') {
          // Get RnD team members first
          this.teamService.getTeamMembersByTeam('RND', normalizedPath).subscribe({
            next: (teamMembers) => {
              console.log('Got RnD team members for auto-assign:', teamMembers);
              
              // Extract team member names
              const teamMemberNames = teamMembers.map(member => member.displayName);
              
              // Get auto-assign suggestions specifically for RnD team
              this.taskService.getAutoAssignSuggestionsForTeam(normalizedPath, teamMemberNames).subscribe({
                next: (suggestions) => {
                  this.assignPreviewSuggestions = suggestions;
                  console.log('Got team-specific suggestions:', suggestions);
                  
                  // Filter tasks to only include those in the suggestions (tasks to be reassigned)
                  const suggestedTaskIds = Object.keys(suggestions).map(id => parseInt(id));
                  this.assignPreviewTasks = allDevNewTasks.filter(task => 
                    suggestedTaskIds.includes(task.id)
                  );
                  
                  console.log('Filtered tasks to be reassigned:', this.assignPreviewTasks);
                  
                  // If no matches, try fallback to standard suggestions
                  if (this.assignPreviewTasks.length === 0 && Object.keys(suggestions).length > 0) {
                    console.warn('No matching tasks found for team-specific suggestions. Trying standard suggestions.');
                    this.getStandardAutoAssignSuggestions(allDevNewTasks, normalizedPath);
                  } else {
                    this.loading.preview = false;
                  }
                },
                error: (err) => {
                  console.error('Error loading team-specific auto-assign suggestions:', err);
                  // Fall back to standard auto-assign if team-specific fails
                  this.getStandardAutoAssignSuggestions(allDevNewTasks, normalizedPath);
                }
              });
            },
            error: (err) => {
              console.error('Error loading RnD team members for auto-assign:', err);
              // Fall back to the standard auto-assign if RnD team member loading fails
              this.getStandardAutoAssignSuggestions(allDevNewTasks, normalizedPath);
            }
          });
        } else {
          // Get standard auto-assign suggestions
          this.getStandardAutoAssignSuggestions(allDevNewTasks, normalizedPath);
        }
      },
      error: (err) => {
        this.error.preview = `Failed to load tasks: ${err.message}`;
        this.loading.preview = false;
      }
    });
  }
  
  /**
   * Fallback method to get standard auto-assign suggestions if RnD-specific fails
   */
  private getStandardAutoAssignSuggestions(allDevNewTasks: WorkItem[], normalizedPath: string): void {
    console.log('Getting standard auto-assign suggestions with path:', normalizedPath);
    console.log('Dev-New tasks available for assignment:', allDevNewTasks);
    
    this.taskService.getAutoAssignSuggestions(normalizedPath).subscribe({
      next: (suggestions) => {
        this.assignPreviewSuggestions = suggestions;
        console.log('Got standard suggestions (fallback):', suggestions);
        
        // Check if we have any suggestions
        if (Object.keys(suggestions).length === 0) {
          console.warn('No suggestions returned from the API');
          this.error.preview = 'No task assignment suggestions were generated. There may be no available tasks to assign.';
          this.loading.preview = false;
          return;
        }
        
        // Filter tasks to only include those in the suggestions (tasks to be reassigned)
        const suggestedTaskIds = Object.keys(suggestions).map(id => parseInt(id));
        console.log('Suggestion task IDs:', suggestedTaskIds);
        
        // Try more flexible matching if necessary
        if (suggestedTaskIds.length > 0 && allDevNewTasks.length > 0) {
          console.log('Applying task to suggestion matching...');
          console.log('Task IDs available:', allDevNewTasks.map(t => t.id));
          
          this.assignPreviewTasks = allDevNewTasks.filter(task => 
            suggestedTaskIds.includes(task.id)
          );
          
          // If no matches found, try string matching
          if (this.assignPreviewTasks.length === 0) {
            console.warn('No direct ID matches found, trying string matching');
            this.assignPreviewTasks = allDevNewTasks.filter(task => 
              suggestedTaskIds.includes(Number(task.id))
            );
            
            // If still no matches, try more flexible matching
            if (this.assignPreviewTasks.length === 0) {
              console.warn('No matches found even with string conversion, using available Dev-New tasks');
              // Just use the first few Dev-New tasks that aren't assigned
              this.assignPreviewTasks = allDevNewTasks
                .filter(task => !task.assignedTo || task.assignedTo.trim() === '')
                .slice(0, Math.min(5, allDevNewTasks.length));
              
              // Create suggestions for them
              if (this.assignPreviewTasks.length > 0) {
                console.log('Using', this.assignPreviewTasks.length, 'unassigned Dev-New tasks as fallback');
                // Create empty suggestions object
                this.assignPreviewSuggestions = {};
                
                // Get team members to suggest
                const availableMembers = this.filteredTeamMembers
                  .sort((a, b) => (a.currentWorkload || 0) - (b.currentWorkload || 0))
                  .map(m => m.displayName)
                  .filter(Boolean);
                
                // Assign members to tasks
                this.assignPreviewTasks.forEach((task, index) => {
                  const memberIndex = index % availableMembers.length;
                  const member = availableMembers[memberIndex];
                  this.assignPreviewSuggestions[task.id] = `${member} (least assigned)`;
                });
              }
            }
          }
        }
        
        console.log('Filtered tasks to be reassigned (fallback):', this.assignPreviewTasks);
        
        if (this.assignPreviewTasks.length === 0) {
          this.error.preview = 'No tasks available for assignment. Check if there are Dev-New tasks in the current iteration.';
        }
        
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
    
    // Normalize the path for consistent handling
    const normalizedPath = this.currentIterationPath.replace(/\\\\/g, '\\');
    
    const assignmentPromises = [];
    let assignmentCount = 0;
    
    // For each task with a suggestion, create an assignment
    for (const task of this.assignPreviewTasks) {
      if (this.assignPreviewSuggestions[task.id]) {
        const developerName = this.extractDeveloperName(this.assignPreviewSuggestions[task.id]);
        
        console.log(`Assigning task #${task.id} (${task.title}) to ${developerName}`);
        
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
          
          // Refresh the task list with normalized path
          this.loadTasks();
          
          // Also refresh the task counts to show updated workload
          this.loadTeamMemberTaskCounts();
          
          // Show success message
          this.showSuccessMessage(`Successfully assigned ${assignmentCount} tasks.`);
          
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
    
    // Handle new format: "Developer Name (expert in Bug, low load)"
    if (suggestion.includes('(')) {
      return suggestion.substring(0, suggestion.indexOf('(')).trim();
    } 
    
    // Fallback for simpler formats
    const parts = suggestion.split(' ');
    return parts[0]; // Just return the first word as the name
  }
  
  /**
   * Extract the logic explanation from the suggestion string
   * Format is typically "Name (explanation)"
   */
  extractLogicExplanation(suggestion: string): string {
    if (!suggestion) return '';
    
    // Match content inside parentheses
    const match = suggestion.match(/\((.*?)\)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // If no parentheses, return the part after the first space
    const spaceIndex = suggestion.indexOf(' ');
    if (spaceIndex !== -1) {
      return suggestion.substring(spaceIndex + 1).trim();
    }
    
    return '';
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
                      email: '',
                      team: this.applyTeamFilter ? this.teamName : ''
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
    
    // Normalize the iteration path
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    
    this.taskService.getTeamMemberTaskCounts(normalizedPath).subscribe({
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
      return 'status-to-do'; // Default for undefined status
    }
    
    const statusLower = status.toLowerCase();
    
    // Return the appropriate custom status class based on requested colors
    if (statusLower === 'active') {
      return 'status-active'; // Yellow
    } else if (statusLower === 'completed' || statusLower === 'done' || statusLower === 'closed' || statusLower === 'dev complete') {
      return 'status-dev-complete'; // Green
    } else if (statusLower === 'blocked') {
      return 'status-blocked'; // Red
    } else if (statusLower === 'dev-new' || statusLower === 'dev new') {
      return 'status-dev-new'; // Blue
    } else if (statusLower === 'code review') {
      return 'status-code-review'; // Purple
    } else if (statusLower === 'proposed') {
      return 'status-proposed'; // Gray
    } else if (statusLower === 'planned') {
      return 'status-planned'; // Orange
    } else if (statusLower === 'resolved') {
      return 'status-resolved'; // Teal
    } else if (statusLower.includes('progress')) {
      return 'status-in-progress'; // Cyan
    } else if (statusLower === 'to do' || statusLower === 'new') {
      return 'status-to-do'; // Gray
    } else {
      return 'status-to-do'; // Default for any other status
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
   * Handle changing the iteration path
   * @param iterationPath The new iteration path
   */
  changeIterationPath(iterationPath: string): void {
    console.log(`Changing iteration path to: ${iterationPath}`);
    
    if (this.currentIterationPath === iterationPath) {
      console.log('Iteration path unchanged, skipping reload');
      return;
    }
    
    // Update both the current and manual iteration paths
    this.currentIterationPath = iterationPath;
    this.manualIterationPath = iterationPath;
    
    // For backward compatibility, trigger the search (load data)
    this.searchClicked();
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
    if (!memberName) {
      console.warn('Called getTaskCount with empty memberName');
      return 0;
    }
    
    // First check if we have task counts from the API
    if (Object.keys(this.teamMemberTaskCounts).length > 0) {
      // Look for an exact match
      if (this.teamMemberTaskCounts[memberName] !== undefined) {
        return this.teamMemberTaskCounts[memberName];
      }
      
      // Try case-insensitive match
      const key = Object.keys(this.teamMemberTaskCounts).find(
        k => k && k.toLowerCase() === memberName.toLowerCase()
      );
      
      if (key) {
        return this.teamMemberTaskCounts[key];
      }
    }
    
    // Fall back to the currentWorkload from team members
    const member = this.teamMembers.find(
      m => typeof m === 'object' && m.displayName && m.displayName.toLowerCase() === memberName.toLowerCase()
    );
    
    return member && typeof member === 'object' ? member.currentWorkload : 0;
  }

  /**
   * Get a list of all tasks with Dev-New status
   * @returns List of Dev-New tasks
   */
  getDevNewTasks(): WorkItem[] {
    return this.filteredTasks.filter(task => 
      task.status && 
      (task.status.toLowerCase() === 'dev-new' ||
       task.status.toLowerCase() === 'dev new' ||
       task.status.toLowerCase().includes('dev-new') ||
       task.status.toLowerCase().includes('dev new') ||
       task.status.toLowerCase() === 'development - new')
    );
  }

  /**
   * Get a list of unassigned Dev-New tasks
   * @returns List of unassigned Dev-New tasks
   */
  getUnassignedDevNewTasks(): WorkItem[] {
    return this.filteredTasks.filter(task => 
      task.status && 
      (task.status.toLowerCase() === 'dev-new' ||
       task.status.toLowerCase() === 'dev new' ||
       task.status.toLowerCase().includes('dev-new') ||
       task.status.toLowerCase().includes('dev new') ||
       task.status.toLowerCase() === 'development - new') && 
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
    // If team filter is not applied, show all tasks
    if (!this.applyTeamFilter) {
      this.filteredTasks = this.tasks;
      console.log(`Team filter disabled. Showing all ${this.tasks.length} tasks.`);
      return;
    }
    
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