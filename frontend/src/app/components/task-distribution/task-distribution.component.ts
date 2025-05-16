import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { WorkItem, TeamMember } from '../../models/task.model';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { tap, switchMap } from 'rxjs/operators';

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
    memberTasks: boolean; // Added for loading member tasks in the modal
  } = {
    tasks: false,
    members: false,
    assign: false,
    autoAssign: false,
    iterationPaths: false,
    taskCounts: false, // Added for task counts loading
    preview: false, // Added for auto-assign preview loading
    memberTasks: false // Added for loading member tasks in the modal
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
    memberTasks: string | null; // Added for member tasks errors
  } = {
    tasks: null,
    members: null,
    assign: null,
    autoAssign: null,
    iterationPaths: null,
    taskCounts: null, // Added for task counts errors
    preview: null, // Added for auto-assign preview errors
    memberTasks: null // Added for member tasks errors
  };

  // Azure DevOps URL components from environment
  private azureDevOpsUrl: string = environment.azureDevOpsUrl;
  private organization: string = environment.organization;
  private project: string = environment.project;

  // Task popup properties
  showTaskPopup: boolean = false;
  popupPosition = { top: 0, left: 0 };
  selectedMemberTasks: WorkItem[] = [];
  selectedMemberName: string = '';
  
  // Member modal properties
  showMemberModal: boolean = false;
  selectedModalMemberName: string = '';
  selectedModalMemberTasks: WorkItem[] = [];
  lastFocusedElement: HTMLElement | null = null;

  constructor(
    private taskService: TaskService,
    private teamService: TeamService
  ) {}

  ngOnInit(): void {
    this.loadIterationPaths();
    
    // Load team filter settings from localStorage
    this.loadTeamFilterSettings();
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
    
    // Load team filter settings before starting the auto-assign process
    this.loadTeamFilterSettings();
    
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = this.currentIterationPath.replace(/\\\\/g, '\\');
    console.log('Using normalized iteration path for auto-assign preview:', normalizedPath);
    
    // Log team filter settings
    console.log('Team Filter Settings:', {
      applyFilter: this.applyTeamFilter,
      teamName: this.teamName,
      teamMembers: this.filteredTeamMembers.map(m => m.displayName)
    });
    
    // First, get all Dev-New tasks for the current iteration
    this.taskService.getTasks(normalizedPath).subscribe({
      next: (tasks) => {
        // Enhanced filtering for Dev-New tasks with broader matching criteria
        const allDevNewTasks = tasks.filter(task => {
          // Skip tasks without status
          if (!task.status) return false;
          
          // Normalize status by removing spaces, hyphens, and converting to lowercase
          const normalizedStatus = task.status.toLowerCase()
            .replace(/[\s\-]/g, ''); // Remove spaces and hyphens
          
          // Match against various formats of "Dev-New"
          const isDevNew = normalizedStatus === 'devnew' || 
                 normalizedStatus === 'newdev' ||
                 normalizedStatus.includes('devnew') ||
                 normalizedStatus.includes('newdev') ||
                 normalizedStatus.includes('developmentnew') ||
                 normalizedStatus.includes('newdevelopment');
                 
          return isDevNew;
        });
        
        console.log(`Found ${allDevNewTasks.length} Dev-New tasks for auto-assign preview out of ${tasks.length} total tasks`);
        console.log('Dev-New tasks:', allDevNewTasks);
        
        if (allDevNewTasks.length === 0) {
          this.error.preview = 'No Dev-New tasks found in the current iteration. Auto-assign requires tasks with Dev-New status.';
          this.loading.preview = false;
          return;
        }
        
        // Force using our default intelligent assignment logic even if there are no team-specific suggestions
        // This ensures tasks are always assigned regardless of API response
        this.getStandardAutoAssignSuggestions(allDevNewTasks, normalizedPath);
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
    
    // Step 1: Get team members with their current task counts
    this.loading.taskCounts = true;
    
    // Prepare to hold our different data sources
    let developerExpertise: any = {};
    let availableDevelopers: string[] = [];
    let teamMemberTaskCounts: Record<string, number> = {};
    
    // First, get strictly filtered team members if team filter is enabled
    let eligibleTeamMembers: string[] = [];
    
    if (this.applyTeamFilter) {
      // Check if we have team members from settings
      if (this.filteredTeamMembers.length === 0) {
        // Try to load from settings
        const savedSettings = localStorage.getItem('teamFilterSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.selectedMembers && settings.selectedMembers.length > 0) {
            this.filteredTeamMembers = settings.selectedMembers.map((m: any) => ({
              id: m.id || '',
              displayName: m.displayName || '',
              email: '',
              isSelected: true
            }));
          } else {
            // If no selected members in settings, fall back to filtering by team name
            this.filterRnDTeamMembers();
          }
        } else {
          // If no settings at all, fall back to filtering by team name
          this.filterRnDTeamMembers();
        }
      }
      
      // Get just the display names of filtered team members
      eligibleTeamMembers = this.filteredTeamMembers
        .map(m => m.displayName)
        .filter(Boolean);
      
      console.log(`Strict team filter enforcement: Only these ${eligibleTeamMembers.length} selected team members will be considered:`, eligibleTeamMembers);
      
      // If we don't have any eligible team members, show an error
      if (eligibleTeamMembers.length === 0) {
        this.error.preview = `No team members found in settings for team "${this.teamName}". Please update team filter settings or disable team filtering.`;
        this.loading.preview = false;
        this.loading.taskCounts = false;
        return;
      }
    }
    
    // First, get the team members with their task counts
    this.taskService.getTeamMemberTaskCounts(normalizedPath).pipe(
      tap(taskCounts => {
        // First store all task counts
        teamMemberTaskCounts = taskCounts;
        console.log('All team member task counts:', teamMemberTaskCounts);
        
        // If team filter is active, filter the task counts to only include eligible members
        if (this.applyTeamFilter && eligibleTeamMembers.length > 0) {
          const filteredCounts: Record<string, number> = {};
          const eligibleMembersLower = eligibleTeamMembers.map(m => m.toLowerCase());
          
          // Filter to only include counts for eligible team members
          Object.keys(teamMemberTaskCounts).forEach(member => {
            if (eligibleMembersLower.includes(member.toLowerCase())) {
              filteredCounts[member] = teamMemberTaskCounts[member];
            }
          });
          
          // Replace the original counts with filtered counts
          teamMemberTaskCounts = filteredCounts;
          console.log(`Filtered task counts to ${Object.keys(teamMemberTaskCounts).length} RND members:`, teamMemberTaskCounts);
        }
      }),
      // Then get developer expertise data from past 3 months
      switchMap(() => {
        // Get list of members from task counts (already filtered if team filter is active)
        let teamMembers = Object.keys(teamMemberTaskCounts);
        return this.taskService.getDeveloperExpertise(teamMembers);
      }),
      // Then get developers who have recently completed tasks
      switchMap(expertise => {
        developerExpertise = expertise;
        console.log('Developer expertise:', developerExpertise);
        return this.taskService.getAvailableDevelopers(normalizedPath);
      })
    ).subscribe({
      next: (available) => {
        availableDevelopers = available;
        console.log('Available developers (all):', availableDevelopers);
        
        // Filter available developers by team if needed
        if (this.applyTeamFilter && eligibleTeamMembers.length > 0) {
          const eligibleMembersLower = eligibleTeamMembers.map(m => m.toLowerCase());
          availableDevelopers = availableDevelopers.filter(dev => 
            eligibleMembersLower.includes(dev.toLowerCase())
          );
          console.log(`Filtered available developers to ${availableDevelopers.length} RND members:`, availableDevelopers);
        }
        
        // Get the final list of eligible members to assign tasks to
        let eligibleMembers = Object.keys(teamMemberTaskCounts);
        console.log(`${eligibleMembers.length} members eligible for task assignment:`, eligibleMembers);
        
        // Create the assignment suggestions
        this.assignPreviewSuggestions = {};
        
        // FIRST PASS: Try to evenly distribute tasks to members with fewest tasks
        
        // Create a prioritized list of members by task count (ascending)
        const membersByTaskCount = [...eligibleMembers].sort((a, b) => 
          (teamMemberTaskCounts[a] || 0) - (teamMemberTaskCounts[b] || 0)
        );
        
        console.log('Members sorted by task count (ascending):', 
          membersByTaskCount.map(m => `${m}: ${teamMemberTaskCounts[m] || 0} tasks`));
        
        // Map to keep track of assignments made in this run
        const assignmentsThisRun: Record<string, number> = {};
        membersByTaskCount.forEach(m => assignmentsThisRun[m] = 0);
        
        // For each task, find the best developer to assign it to
        allDevNewTasks.forEach(task => {
          let assignedDeveloper = '';
          let assignmentReason = '';
          
          // PRIORITY 1: Try to find an expertise match among members with lowest task count
          if (developerExpertise && developerExpertise.taskTypeExpertise) {
            const taskType = task.type || 'Unknown';
            const allExperts = developerExpertise.taskTypeExpertise[taskType] || [];
            
            // Filter to only include eligible team members
            const experts = allExperts.filter((expert: string) => 
              eligibleMembers.some(member => member.toLowerCase() === expert.toLowerCase())
            );
            
            if (experts.length > 0) {
              // Get the experts with the lowest current workload
              // Calculate total workload (existing + new assignments)
              const expertsByWorkload = [...experts].sort((a, b) => {
                const aTotal = (teamMemberTaskCounts[a] || 0) + (assignmentsThisRun[a] || 0);
                const bTotal = (teamMemberTaskCounts[b] || 0) + (assignmentsThisRun[b] || 0);
                return aTotal - bTotal;
              });
              
              assignedDeveloper = expertsByWorkload[0];
              assignmentReason = `past expertise in ${taskType} tasks`;
              console.log(`Task ${task.id}: Assigned to ${assignedDeveloper} based on expertise (has ${teamMemberTaskCounts[assignedDeveloper]} existing + ${assignmentsThisRun[assignedDeveloper]} new tasks)`);
            }
          }
          
          // PRIORITY 2: If no expertise match, try to assign to developers who have completed tasks
          if (!assignedDeveloper && availableDevelopers.length > 0) {
            // Sort by total workload (existing + new assignments)
            const availableByWorkload = [...availableDevelopers].sort((a, b) => {
              const aTotal = (teamMemberTaskCounts[a] || 0) + (assignmentsThisRun[a] || 0);
              const bTotal = (teamMemberTaskCounts[b] || 0) + (assignmentsThisRun[b] || 0);
              return aTotal - bTotal;
            });
            
            assignedDeveloper = availableByWorkload[0];
            assignmentReason = 'recently completed other tasks';
            console.log(`Task ${task.id}: Assigned to ${assignedDeveloper} based on recent completion (has ${teamMemberTaskCounts[assignedDeveloper]} existing + ${assignmentsThisRun[assignedDeveloper]} new tasks)`);
          }
          
          // PRIORITY 3: If still no assignment, use the team member with the lowest current task count
          if (!assignedDeveloper && eligibleMembers.length > 0) {
            // Sort by total workload (existing + new assignments)
            const membersByWorkload = [...eligibleMembers].sort((a, b) => {
              const aTotal = (teamMemberTaskCounts[a] || 0) + (assignmentsThisRun[a] || 0);
              const bTotal = (teamMemberTaskCounts[b] || 0) + (assignmentsThisRun[b] || 0);
              return aTotal - bTotal;
            });
            
            assignedDeveloper = membersByWorkload[0];
            assignmentReason = 'lowest current workload';
            console.log(`Task ${task.id}: Assigned to ${assignedDeveloper} based on lowest workload (has ${teamMemberTaskCounts[assignedDeveloper]} existing + ${assignmentsThisRun[assignedDeveloper]} new tasks)`);
          }
          
          // Final fallback: If all else fails, just assign to any eligible team member
          if (!assignedDeveloper && eligibleMembers.length > 0) {
            assignedDeveloper = eligibleMembers[0];
            assignmentReason = 'default assignment (fallback)';
            console.log(`Task ${task.id}: Default fallback to ${assignedDeveloper}`);
          }
          
          // Store the suggestion with the reason
          if (assignedDeveloper) {
            this.assignPreviewSuggestions[task.id] = `${assignedDeveloper} (${assignmentReason})`;
            // Update assignments this run to maintain balanced distribution
            assignmentsThisRun[assignedDeveloper] = (assignmentsThisRun[assignedDeveloper] || 0) + 1;
          }
        });
        
        // Filter tasks to only include those we have suggestions for
        this.assignPreviewTasks = allDevNewTasks.filter(task => 
          this.assignPreviewSuggestions[task.id]
        );
        
        console.log('Final assignment distribution:', assignmentsThisRun);
        console.log('Auto-assign suggestions:', this.assignPreviewSuggestions);
        console.log('Tasks to be assigned:', this.assignPreviewTasks);
        
        // Check if we have valid suggestions
        if (this.assignPreviewTasks.length === 0) {
          this.error.preview = 'No suitable tasks found for assignment. Check if there are unassigned Dev-New tasks.';
        }
        
        this.loading.preview = false;
        this.loading.taskCounts = false;
      },
      error: (err) => {
        console.error('Error loading data for intelligent assignment:', err);
        
        // Fallback to basic assignment if data loading fails
        this.fallbackToBasicAssignment(allDevNewTasks);
      }
    });
  }
  
  /**
   * Basic fallback assignment method if intelligent assignment fails
   */
  private fallbackToBasicAssignment(allDevNewTasks: WorkItem[]): void {
    console.log('Falling back to basic assignment logic');
    
    // Always ensure we have tasks to assign
    if (allDevNewTasks.length === 0) {
      this.error.preview = 'No Dev-New tasks found for assignment.';
      this.loading.preview = false;
      return;
    }
    
    // Get the list of RND team members if filter is active
    let eligibleTeamMembers: string[] = [];
    
    if (this.applyTeamFilter) {
      // Ensure we have the filtered team members
      if (this.filteredTeamMembers.length === 0) {
        this.filterRnDTeamMembers();
      }
      
      // Get just the display names of RND team members
      eligibleTeamMembers = this.filteredTeamMembers
        .map(m => m.displayName)
        .filter(Boolean);
      
      console.log(`Fallback with team filter: Only these ${eligibleTeamMembers.length} RND members will be considered:`, eligibleTeamMembers);
      
      // If we don't have any eligible team members, show an error
      if (eligibleTeamMembers.length === 0) {
        this.error.preview = `No team members found for team "${this.teamName}". Please add team members or disable team filtering.`;
        this.loading.preview = false;
        return;
      }
    }
    
    this.taskService.getAutoAssignSuggestions(this.currentIterationPath).subscribe({
      next: (suggestions) => {
        console.log('Got standard suggestions (basic fallback):', suggestions);
        
        // Check if we have any suggestions from the API
        if (Object.keys(suggestions).length > 0) {
          // If team filter is active, filter suggestions to only include RND team members
          if (this.applyTeamFilter && eligibleTeamMembers.length > 0) {
            const eligibleMembersLower = eligibleTeamMembers.map(m => m.toLowerCase());
            const filteredSuggestions: Record<string, string> = {};
            
            // Only keep suggestions for eligible team members
            Object.entries(suggestions).forEach(([taskId, suggestion]) => {
              const developerName = this.extractDeveloperName(suggestion).toLowerCase();
              if (eligibleMembersLower.includes(developerName)) {
                filteredSuggestions[taskId] = suggestion;
              } else {
                console.log(`Removed suggestion for task ${taskId}: ${suggestion} - not an RND team member`);
              }
            });
            
            this.assignPreviewSuggestions = filteredSuggestions;
            console.log(`Filtered suggestions to only include RND members: ${Object.keys(filteredSuggestions).length} remaining`);
          } else {
            // Use all suggestions if no team filter
            this.assignPreviewSuggestions = suggestions;
          }
          
          // Filter tasks to only include those in the suggestions
          const suggestedTaskIds = Object.keys(this.assignPreviewSuggestions).map(id => parseInt(id));
          this.assignPreviewTasks = allDevNewTasks.filter(task => 
            suggestedTaskIds.includes(task.id)
          );
        }
        
        // If we still don't have tasks to assign, use ALL Dev-New tasks with a simple balanced distribution
        if (this.assignPreviewTasks.length === 0) {
          console.log('No task suggestions matched. Using all Dev-New tasks for assignment.');
          // Include all Dev-New tasks, prioritizing unassigned ones
          this.assignPreviewTasks = [...allDevNewTasks];
          
          // Create simple suggestions for all tasks
          if (this.assignPreviewTasks.length > 0) {
            this.assignPreviewSuggestions = {};
            
            // Get available team members based on team filter setting
            let availableMembers: string[] = [];
            
            if (this.applyTeamFilter && eligibleTeamMembers.length > 0) {
              // Use strictly filtered team members if filter is applied
              availableMembers = [...eligibleTeamMembers];
              console.log(`Using ${availableMembers.length} filtered RND team members for fallback assignment`);
            } else if (this.teamMembers.length > 0) {
              // Otherwise use all team members
              availableMembers = this.teamMembers
                .filter(m => typeof m === 'object')
                .map(m => m.displayName)
                .filter(Boolean);
              console.log(`Using ${availableMembers.length} team members for fallback assignment`);
            }
            
            // Fallback if still no members
            if (availableMembers.length === 0) {
              this.error.preview = 'No team members available for assignment.';
              this.loading.preview = false;
              return;
            }
            
            // Get task counts for each member to ensure even distribution
            const memberTaskCounts: Record<string, number> = {};
            availableMembers.forEach(member => {
              memberTaskCounts[member] = 0;
            });
            
            // Count current tasks
            this.tasks.forEach(task => {
              const assignee = task.assignedTo;
              if (assignee && memberTaskCounts[assignee] !== undefined) {
                memberTaskCounts[assignee]++;
              }
            });
            
            // Sort members by task count (ascending)
            const sortedMembers = [...availableMembers].sort((a, b) => 
              (memberTaskCounts[a] || 0) - (memberTaskCounts[b] || 0)
            );
            
            console.log('Members sorted by task count for round-robin assignment:', 
              sortedMembers.map(m => `${m}: ${memberTaskCounts[m] || 0} tasks`));
            
            // Track new assignments to maintain balance
            const newAssignments: Record<string, number> = {};
            sortedMembers.forEach(m => newAssignments[m] = 0);
            
            // Round-robin assignment to team members, starting with those with fewest tasks
            this.assignPreviewTasks.forEach((task, index) => {
              // Find the member with the lowest total workload (existing + new)
              const membersByTotalLoad = [...sortedMembers].sort((a, b) => {
                const aTotal = (memberTaskCounts[a] || 0) + (newAssignments[a] || 0);
                const bTotal = (memberTaskCounts[b] || 0) + (newAssignments[b] || 0);
                return aTotal - bTotal;
              });
              
              const assignee = membersByTotalLoad[0];
              this.assignPreviewSuggestions[task.id] = `${assignee} (balanced workload distribution)`;
              
              // Update the member's task count for subsequent assignments
              newAssignments[assignee] = (newAssignments[assignee] || 0) + 1;
              
              console.log(`Task ${task.id}: Assigned to ${assignee} (has ${memberTaskCounts[assignee]} existing + ${newAssignments[assignee]} new tasks)`);
            });
            
            console.log('Final assignment distribution:', newAssignments);
          }
        }
        
        // Check if we have valid suggestions
        if (Object.keys(this.assignPreviewSuggestions).length === 0) {
          this.error.preview = 'Could not generate assignment suggestions.';
        }
        
        this.loading.preview = false;
      },
      error: (err) => {
        console.error('Error getting auto-assign suggestions:', err);
        this.error.preview = `Failed to get assignment suggestions: ${err.message}`;
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
   * Extract only the developer name from a suggestion string
   * Example: "John Doe (past expertise)" -> "John Doe"
   */
  extractDeveloperName(suggestion: string): string {
    if (!suggestion) return '';
    
    // Match everything before the opening parenthesis
    const match = suggestion.match(/^(.+?)\s*\(/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // If no parenthesis found, return the whole string
    return suggestion.trim();
  }
  
  /**
   * Extract just the explanation part from a suggestion string
   * Example: "John Doe (past expertise in Bug tasks)" -> "past expertise in Bug tasks"
   */
  extractLogicExplanation(suggestion: string): string {
    if (!suggestion) return '';
    
    // Match everything between parentheses
    const match = suggestion.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return '';
  }
  
  /**
   * Count assignments by specific reason keyword
   * @param reasonType The type of reason to count ('expertise', 'completed', 'workload', 'default', or 'team')
   * @returns The number of assignments made with that reason
   */
  getAssignmentsByReason(reasonType: string): number {
    if (!this.assignPreviewSuggestions) return 0;
    
    const suggestions = Object.values(this.assignPreviewSuggestions);
    
    // Map reason types to keywords that might appear in the explanation
    const reasonKeywords: Record<string, string[]> = {
      'expertise': ['expertise', 'expert'],
      'completed': ['completed', 'recently completed'],
      'workload': ['workload', 'least assigned', 'lowest'],
      'default': ['default assignment', 'could not determine', 'basic fallback', 'workload-based distribution'],
      'team': ['team filter', this.teamName]
    };
    
    // For team filter, just return how many assignments are made when team filter is on
    if (reasonType === 'team' && this.applyTeamFilter) {
      return suggestions.length;
    }
    
    // Count occurrences of keywords for the specified reason
    return suggestions.filter(suggestion => {
      const lowerSuggestion = suggestion.toLowerCase();
      return reasonKeywords[reasonType].some(keyword => 
        lowerSuggestion.includes(keyword.toLowerCase())
      );
    }).length;
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
    return this.filteredTasks.filter(task => {
      if (!task.status) return false;
      
      // Normalize status by removing spaces, hyphens, and converting to lowercase
      const normalizedStatus = task.status.toLowerCase().replace(/[\s\-]/g, '');
      
      // Use the same broad matching criteria as in showAutoAssignPreview
      return normalizedStatus === 'devnew' || 
             normalizedStatus === 'newdev' ||
             normalizedStatus.includes('devnew') ||
             normalizedStatus.includes('newdev') ||
             normalizedStatus.includes('developmentnew') ||
             normalizedStatus.includes('newdevelopment');
    });
  }

  /**
   * Get a list of unassigned Dev-New tasks
   * @returns List of unassigned Dev-New tasks
   */
  getUnassignedDevNewTasks(): WorkItem[] {
    // Use our improved getDevNewTasks method and filter for unassigned
    return this.getDevNewTasks().filter(task => !task.assignedTo);
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

  /**
   * Generates an Azure DevOps URL for a specific work item ID
   * @param taskId The ID of the work item to link to
   * @returns A URL to the work item in Azure DevOps
   */
  getAzureDevOpsTaskUrl(taskId: number): string {
    return `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_workitems/edit/${taskId}/`;
  }

  /**
   * Open task in Azure DevOps in a new tab
   * @param taskId The ID of the task to open
   * @param event The click event
   */
  openTaskInAzureDevOps(taskId: number, event: Event): void {
    // Prevent default behavior to avoid interference with other actions
    event.preventDefault();
    event.stopPropagation();
    
    // Open task in new tab
    const url = this.getAzureDevOpsTaskUrl(taskId);
    window.open(url, '_blank');
    
    console.log(`Opening task ${taskId} in Azure DevOps`);
  }

  /**
   * Show popup with tasks for a specific team member
   * @param event Click event
   * @param memberName Name of the team member
   */
  showMemberTasks(event: MouseEvent, memberName: string): void {
    // Prevent event propagation to avoid immediate closing
    event.preventDefault();
    event.stopPropagation();
    
    console.log(`Showing tasks for ${memberName}, fetching from ${this.tasks.length} total tasks`);
    
    // Get tasks for this member - search in all tasks, not just filtered tasks
    this.selectedMemberTasks = this.tasks.filter(
      task => task.assignedTo && task.assignedTo.toLowerCase() === memberName.toLowerCase()
    );
    
    this.selectedMemberName = memberName;
    
    // Calculate popup position - position it near the clicked element but ensure it's visible
    const clickedElement = event.currentTarget as HTMLElement;
    const rect = clickedElement.getBoundingClientRect();
    
    // Adjust position to ensure popup is visible within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = 400; // Same as in CSS
    const popupHeight = Math.min(300, this.selectedMemberTasks.length * 50 + 100); // Rough estimate
    
    // Position popup below the badge, but adjust if near viewport edges
    let left = rect.left;
    if (left + popupWidth > viewportWidth) {
      left = Math.max(10, viewportWidth - popupWidth - 10);
    }
    
    let top = rect.bottom + window.scrollY;
    if (top + popupHeight > viewportHeight + window.scrollY) {
      // Position above if not enough space below
      top = Math.max(10 + window.scrollY, rect.top + window.scrollY - popupHeight);
    }
    
    this.popupPosition = { top, left };
    
    // Make sure popup is shown
    this.showTaskPopup = true;
    
    console.log(`Showing tasks popup for ${memberName}: ${this.selectedMemberTasks.length} tasks at position:`, this.popupPosition);
  }
  
  /**
   * Close the task popup when clicking outside
   */
  @HostListener('document:click', ['$event'])
  closePopup(event?: MouseEvent): void {
    if (!event) return;
    
    // Don't close if this is the initial click that opened the popup or modal
    if (event.target && (
        (event.target as HTMLElement).closest('.task-count-badge') ||
        (event.target as HTMLElement).closest('.member-name-link')
      )) {
      return;
    }
    
    // Close task popup if it's open and click is outside
    if (this.showTaskPopup && !(event.target as HTMLElement).closest('.task-popup')) {
      this.showTaskPopup = false;
    }
    
    // Close member modal if it's open and click is outside
    if (this.showMemberModal && !(event.target as HTMLElement).closest('.member-modal-content')) {
      this.closeMemberModal();
    }
  }
  
  /**
   * Prevent popup from closing when clicking inside it
   * @param event Click event
   */
  keepPopupOpen(event: Event): void {
    event.stopPropagation();
  }

  /**
   * Show modal with tasks for a specific team member
   * @param event Click event 
   * @param memberName Name of the team member
   */
  showMemberTasksModal(event: MouseEvent | KeyboardEvent, memberName: string): void {
    // Prevent default behavior
    event.preventDefault();
    
    // Store the last focused element for when we close the modal
    this.lastFocusedElement = document.activeElement as HTMLElement;
    
    console.log(`Showing modal for ${memberName}, fetching from ${this.tasks.length} total tasks`);
    
    // Set loading state
    this.loading.memberTasks = true;
    this.error.memberTasks = null;
    
    // Clear previous data
    this.selectedModalMemberTasks = [];
    this.selectedModalMemberName = memberName;
    
    // Show the modal
    this.showMemberModal = true;
    
    // Get tasks for this member - search in all tasks, not just filtered tasks
    // We'll simulate an async call to match requirements
    setTimeout(() => {
      this.selectedModalMemberTasks = this.tasks.filter(
        task => task.assignedTo && task.assignedTo.toLowerCase() === memberName.toLowerCase()
      );
      
      this.loading.memberTasks = false;
      
      // Focus the close button in the modal for accessibility
      setTimeout(() => {
        const closeButton = document.querySelector('.member-modal-close') as HTMLElement;
        if (closeButton) {
          closeButton.focus();
        }
      }, 100);
      
      console.log(`Loaded ${this.selectedModalMemberTasks.length} tasks for ${memberName} in modal`);
    }, 500); // Simulate network delay
  }
  
  /**
   * Close the member tasks modal
   */
  closeMemberModal(): void {
    this.showMemberModal = false;
    
    // Return focus to the last focused element
    setTimeout(() => {
      if (this.lastFocusedElement) {
        this.lastFocusedElement.focus();
      }
    }, 100);
  }
  
  /**
   * Handle keyboard interaction in the modal for accessibility
   * @param event Keyboard event
   */
  handleModalKeydown(event: KeyboardEvent): void {
    // Close modal on Escape key
    if (event.key === 'Escape') {
      this.closeMemberModal();
    }
    
    // Trap focus inside the modal for accessibility
    if (event.key === 'Tab') {
      const modal = document.querySelector('.member-modal') as HTMLElement;
      if (!modal) return;
      
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length === 0) return;
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (event.shiftKey && document.activeElement === firstElement) {
        // If shift+tab and focus is on first element, move to last element
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        // If tab and focus is on last element, move to first element
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  // Load team filter settings from localStorage
  loadTeamFilterSettings(): void {
    const savedSettings = localStorage.getItem('teamFilterSettings');
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      this.applyTeamFilter = settings.enableTeamFilter ?? true;
      this.teamName = settings.teamName ?? 'RND';
      
      // Set the current iteration path from settings if available
      if (settings.defaultIterationPath) {
        this.currentIterationPath = settings.defaultIterationPath;
      }
      
      // Store selected team members for filtering
      this.filteredTeamMembers = settings.selectedMembers?.map((m: any) => ({
        id: m.id || '',
        displayName: m.displayName || '',
        email: '',
        isSelected: true
      })) || [];
      
      console.log('Loaded team filter settings:', {
        applyTeamFilter: this.applyTeamFilter,
        teamName: this.teamName,
        filteredTeamMembers: this.filteredTeamMembers
      });
    }
  }
}