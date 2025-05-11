import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { WorkItem, TeamMember } from '../../models/task.model';

@Component({
  selector: 'app-task-distribution',
  templateUrl: './task-distribution.component.html',
  styleUrls: ['./task-distribution.component.scss']
})
export class TaskDistributionComponent implements OnInit {
  tasks: WorkItem[] = [];
  teamMembers: TeamMember[] = [];
  currentSprint: string = '';
  loading = {
    tasks: true,
    members: true,
    assign: false,
    autoAssign: false
  };
  error = {
    tasks: '',
    members: '',
    assign: '',
    autoAssign: ''
  };
  selectedTask: number | null = null;
  selectedMember: string = '';

  constructor(private taskService: TaskService) { }

  ngOnInit(): void {
    this.loadTeamMembers();
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.tasks = true;
    this.taskService.getTasks('Project\\Sprint 3').subscribe({
      next: (data) => {
        this.tasks = data;
        this.currentSprint = 'Project\\Sprint 3';
        this.loading.tasks = false;
        this.loadAutoAssignSuggestions();
      },
      error: (err) => {
        this.error.tasks = 'Failed to load tasks';
        this.loading.tasks = false;
        console.error('Error loading tasks:', err);
      }
    });
  }

  loadTeamMembers(): void {
    this.loading.members = true;
    this.taskService.getTeamMembers().subscribe({
      next: (data) => {
        this.teamMembers = data;
        this.loading.members = false;
      },
      error: (err) => {
        this.error.members = 'Failed to load team members';
        this.loading.members = false;
        console.error('Error loading team members:', err);
      }
    });
  }

  loadAutoAssignSuggestions(): void {
    this.taskService.getAutoAssignSuggestions(this.currentSprint).subscribe({
      next: (suggestions) => {
        this.tasks = this.tasks.map(task => {
          if (suggestions[task.id.toString()]) {
            return { ...task, autoAssignSuggestion: suggestions[task.id.toString()] };
          }
          return task;
        });
      },
      error: (err) => {
        console.error('Error loading auto-assign suggestions:', err);
      }
    });
  }

  openAssignModal(taskId: number): void {
    this.selectedTask = taskId;
    this.selectedMember = '';
  }

  assignTask(): void {
    if (!this.selectedTask || !this.selectedMember) {
      this.error.assign = 'Please select a team member';
      return;
    }

    this.loading.assign = true;
    this.error.assign = '';

    this.taskService.assignTask(this.selectedTask, this.selectedMember).subscribe({
      next: () => {
        this.loading.assign = false;
        // Update the assigned task in the local array
        this.tasks = this.tasks.map(task => {
          if (task.id === this.selectedTask) {
            const assignedMember = this.teamMembers.find(m => m.id === this.selectedMember);
            return { 
              ...task, 
              assignedTo: assignedMember ? assignedMember.displayName : this.selectedMember 
            };
          }
          return task;
        });
        this.selectedTask = null;
      },
      error: (err) => {
        this.error.assign = 'Failed to assign task';
        this.loading.assign = false;
        console.error('Error assigning task:', err);
      }
    });
  }

  autoAssignTasks(): void {
    this.loading.autoAssign = true;
    this.error.autoAssign = '';

    this.taskService.autoAssignTasks(this.currentSprint).subscribe({
      next: () => {
        this.loading.autoAssign = false;
        // Reload tasks to get updated assignments
        this.loadTasks();
      },
      error: (err) => {
        this.error.autoAssign = 'Failed to auto-assign tasks';
        this.loading.autoAssign = false;
        console.error('Error auto-assigning tasks:', err);
      }
    });
  }

  cancelAssign(): void {
    this.selectedTask = null;
    this.error.assign = '';
  }

  getTeamMemberWorkloadClass(workload: number): string {
    if (workload >= 8) return 'high-workload';
    if (workload >= 5) return 'medium-workload';
    return 'low-workload';
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case '1': return 'bg-danger';
      case '2': return 'bg-warning';
      case '3': return 'bg-info';
      default: return 'bg-secondary';
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed': 
      case 'done': return 'bg-success';
      case 'in progress': return 'bg-primary';
      case 'blocked': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }
} 