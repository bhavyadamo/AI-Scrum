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
  
  // Convert simple boolean to object with specific loading states
  loading: { 
    tasks: boolean; 
    members: boolean; 
    assign: boolean; 
    autoAssign: boolean;
    iterationPaths: boolean;
  } = {
    tasks: false,
    members: false,
    assign: false,
    autoAssign: false,
    iterationPaths: false
  };
  
  // Convert simple string to object with specific error states
  error: { 
    tasks: string | null; 
    members: string | null; 
    assign: string | null; 
    autoAssign: string | null;
    iterationPaths: string | null;
  } = {
    tasks: null,
    members: null,
    assign: null,
    autoAssign: null,
    iterationPaths: null
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
      next: (members) => {
        this.teamMembers = members;
        console.log('Loaded team members:', members);
        this.loading.members = false;
        
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
      }
    });
  }

  /**
   * Calculate and update team members' workload based on task assignments
   */
  updateTeamWorkload(): void {
    console.log('Updating team workload');
    console.log('Team members before update:', JSON.stringify(this.teamMembers));
    console.log('Tasks for workload calculation:', JSON.stringify(this.tasks));
    
    // Reset all workloads to 0
    this.teamMembers.forEach(member => {
      member.currentWorkload = 0;
    });
    
    // Count assignments for each team member
    this.tasks.forEach(task => {
      if (task.assignedTo) {
        // Normalize the assignedTo value by removing leading/trailing spaces and converting to lowercase
        const normalizedAssignedTo = task.assignedTo.trim().toLowerCase();
        
        // Try to find matching team member with more flexible matching
        let matchedMember = this.teamMembers.find(member => {
          // Try exact match on displayName
          if (member.displayName.toLowerCase() === normalizedAssignedTo) {
            return true;
          }
          
          // Try match by ID
          if (member.id.toLowerCase() === normalizedAssignedTo) {
            return true;
          }
          
          // Try partial name match (e.g., "John Doe" should match "John")
          if (normalizedAssignedTo.includes(member.displayName.toLowerCase()) || 
              member.displayName.toLowerCase().includes(normalizedAssignedTo)) {
            return true;
          }
          
          // Try matching by email (username part)
          if (member.email && normalizedAssignedTo.includes(member.email.split('@')[0].toLowerCase())) {
            return true;
          }
          
          return false;
        });
        
        // If a member was found, increment their workload
        if (matchedMember) {
          console.log(`Task "${task.title}" (ID: ${task.id}) matched to team member: ${matchedMember.displayName}`);
          matchedMember.currentWorkload += 1;
        } else {
          console.log(`No team member found for task assignment: "${task.assignedTo}" (Task ID: ${task.id}, Title: ${task.title})`);
        }
      }
    });
    
    // Include all team members in the filtered list, even those without tasks
    // This ensures we always show team members even if they don't have tasks
    this.filteredTeamMembers = [...this.teamMembers];
    
    console.log('Updated team members workload:', JSON.stringify(this.teamMembers));
    console.log('Filtered team members:', JSON.stringify(this.filteredTeamMembers));
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
    
    console.log(`Assigning task ${this.selectedTask} to member ${this.selectedMember}`);
    
    this.taskService.assignTask(this.selectedTask, this.selectedMember).subscribe({
      next: (response) => {
        console.log('Task assignment successful:', response);
        // Close the modal
        this.cancelAssign();
        // Show success message (could be implemented with a toast/snackbar service)
        this.showSuccessMessage('Task assigned successfully');
        // Reload tasks to reflect changes
        this.loadTasks();
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
        this.loadTasks(); // Reload tasks to reflect changes
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

    // Ensure we have team members loaded before showing the modal
    if (this.filteredTeamMembers.length === 0 && !this.loading.members) {
      this.loadTeamMembers();
    }
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
    
    // Reset selected task if any
    this.selectedTask = null;
    
    // Load tasks and team members for the new iteration path
    this.loadTasks();
    this.loadTeamMembers(); // Now this will pass the current iteration path
  }
}