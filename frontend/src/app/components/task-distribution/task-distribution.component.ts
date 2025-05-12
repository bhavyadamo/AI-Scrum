import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { TeamService } from '../../services/team.service';
import { WorkItem, TeamMember } from '../../models/task.model';

@Component({
  selector: 'app-task-distribution',
  templateUrl: './task-distribution.component.html',
  styleUrls: ['./task-distribution.component.scss']
})
export class TaskDistributionComponent implements OnInit {
  tasks: WorkItem[] = [];
  teamMembers: TeamMember[] = [];
  filteredTeamMembers: TeamMember[] = []; // New property for filtered team members
  selectedTaskId: number | null = null;
  selectedTeamMemberId: string = '';
  selectedTask: number | null = null; // Added for modal display
  selectedMember: string = ''; // Added for member selection in modal
  currentIterationPath: string = 'Techoil\\2.3.23'; // Default value
  iterationPaths: string[] = []; // Will be loaded from API
  teamMemberTaskCounts: Record<string, number> = {}; // Added for task counts
  
  // Convert simple boolean to object with specific loading states
  loading: { 
    tasks: boolean; 
    members: boolean; 
    assign: boolean; 
    autoAssign: boolean;
    iterationPaths: boolean;
    taskCounts: boolean; // Added for task counts loading
  } = {
    tasks: false,
    members: false,
    assign: false,
    autoAssign: false,
    iterationPaths: false,
    taskCounts: false // Added for task counts loading
  };
  
  // Convert simple string to object with specific error states
  error: { 
    tasks: string | null; 
    members: string | null; 
    assign: string | null; 
    autoAssign: string | null;
    iterationPaths: string | null;
    taskCounts: string | null; // Added for task counts errors
  } = {
    tasks: null,
    members: null,
    assign: null,
    autoAssign: null,
    iterationPaths: null,
    taskCounts: null // Added for task counts errors
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
        
        // After loading tasks, update team workload
        if (this.teamMembers.length > 0) {
          this.updateTeamWorkload();
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

    // Use the taskService directly to get team members by iteration path
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
        console.log('Loaded team members:', this.teamMembers);
        this.loading.members = false;
        
        // Load team member task counts after loading team members
        this.loadTeamMemberTaskCounts();
        
        // If tasks are already loaded, update workload
        if (this.tasks.length > 0) {
          this.updateTeamWorkload();
        } else {
          // If no tasks are loaded yet, still show the team members
          this.filteredTeamMembers = [...this.teamMembers];
          console.log('No tasks loaded yet, showing all team members');
        }
      },
      error: (err) => {
        console.error('Error loading team members:', err);
        this.error.members = `Failed to load team members: ${err.message}`;
        this.loading.members = false;
        
        // Add fallback team members if API call fails
        this.teamMembers = [
          { id: '1', displayName: 'Ranjith Kumar S', email: 'ranjithkumar.s@inatech.onmicrosoft.com', currentWorkload: 0, isActive: true, uniqueName: 'ranjithkumar.s' },
          { id: '2', displayName: 'Rabirai Madhavan', email: 'rabiraj.m@example.com', currentWorkload: 0, isActive: true, uniqueName: 'rabiraj.m' },
          { id: '3', displayName: 'Dhinakarraj Sivakumar', email: 'dhivakarraj.s@example.com', currentWorkload: 0, isActive: true, uniqueName: 'dhivakarraj.s' }
        ];
        this.filteredTeamMembers = [...this.teamMembers];
        console.log('Using fallback team members:', this.teamMembers);
        
        // Try to load task counts even if team members loading fails
        this.loadTeamMemberTaskCounts();
      }
    });
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
    
    // Reset all workloads to 0
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
    
    // Update filtered team members
    this.filteredTeamMembers = [...this.teamMembers];
    console.log('Updated team workload:', this.teamMembers);
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

    // Get the iteration path for this specific task
    const task = this.tasks.find(t => t.id === taskId);
    if (task && task.iterationPath) {
      // Fetch team members specifically for this task's iteration path
      this.loading.members = true;
      this.taskService.getTeamMembers(task.iterationPath).subscribe({
        next: (response) => {
          // Check if response is an array of strings (names) or TeamMember objects
          if (response.length > 0 && typeof response[0] === 'string') {
            // It's an array of strings, convert to TeamMember objects
            const names = response as string[];
            this.filteredTeamMembers = names.map((name, index) => ({
              id: `member-${index}`,
              displayName: name,
              uniqueName: '',
              currentWorkload: 0,
              isActive: true,
              email: ''
            }));
          } else {
            // It's already an array of TeamMember objects
            this.filteredTeamMembers = response as TeamMember[];
          }
          this.loading.members = false;
          
          // Load task counts after team members are loaded
          this.loadTeamMemberTaskCountsForModal(task.iterationPath);
        },
        error: (err) => {
          console.error(`Error loading team members for iteration path ${task.iterationPath}:`, err);
          this.error.members = `Failed to load team members: ${err.message}`;
          this.loading.members = false;
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
    const task = this.tasks.find(t => t.id === selectedTaskId);
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
}