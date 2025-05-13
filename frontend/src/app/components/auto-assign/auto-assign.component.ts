import { Component, OnInit } from '@angular/core';
import { TaskService } from '../../services/task.service';
import { WorkItem } from '../../models/task.model';
import { forkJoin, Observable } from 'rxjs';

@Component({
  selector: 'app-auto-assign',
  templateUrl: './auto-assign.component.html',
  styleUrls: ['./auto-assign.component.scss']
})
export class AutoAssignComponent implements OnInit {
  tasks: WorkItem[] = [];
  currentIterationPath: string = '';
  autoAssignSuggestions: Record<string, string> = {};
  assignmentSuccess: boolean = false;
  loading = {
    tasks: false,
    suggestions: false,
    assign: false
  };
  error = {
    tasks: null as string | null,
    suggestions: null as string | null,
    assign: null as string | null
  };

  constructor(private taskService: TaskService) { }

  ngOnInit(): void {
    // For demo purposes, use a default iteration path
    this.currentIterationPath = 'Techoil\\2.3.23';
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.tasks = true;
    this.error.tasks = null;
    this.assignmentSuccess = false;
    
    this.taskService.getTasks(this.currentIterationPath).subscribe({
      next: (tasks) => {
        // Filter for Dev-New tasks, removing type filter to match requirements
        this.tasks = tasks.filter(t => 
          t.status === 'Dev-New' && 
          !t.assignedTo
        );
        this.loading.tasks = false;
        
        // If we have tasks, load the suggestions
        if (this.tasks.length > 0) {
          this.loadAutoAssignSuggestions();
        }
      },
      error: (err) => {
        this.error.tasks = `Failed to load tasks: ${err.message}`;
        this.loading.tasks = false;
      }
    });
  }

  loadAutoAssignSuggestions(): void {
    this.loading.suggestions = true;
    this.error.suggestions = null;
    
    this.taskService.getAutoAssignSuggestions(this.currentIterationPath).subscribe({
      next: (suggestions) => {
        this.autoAssignSuggestions = suggestions;
        this.loading.suggestions = false;
      },
      error: (err) => {
        this.error.suggestions = `Failed to load auto-assign suggestions: ${err.message}`;
        this.loading.suggestions = false;
      }
    });
  }

  assignTask(taskId: number, assignedTo: string): void {
    this.loading.assign = true;
    this.error.assign = null;
    this.assignmentSuccess = false;
    
    // Extract just the name from the suggestion string
    const developerName = this.extractDeveloperName(assignedTo);
    
    this.taskService.assignTask(taskId, developerName).subscribe({
      next: () => {
        // Remove the assigned task from the list
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.loading.assign = false;
        this.assignmentSuccess = true;
        
        // Reset success message after a delay
        setTimeout(() => this.assignmentSuccess = false, 5000);
      },
      error: (err) => {
        this.error.assign = `Failed to assign task: ${err.message}`;
        this.loading.assign = false;
      }
    });
  }

  /**
   * Extracts just the developer name from the suggestion string
   * Format is typically "Name (explanation)"
   */
  extractDeveloperName(suggestion: string): string {
    if (!suggestion) return '';
    const parts = suggestion.split(' (');
    return parts[0];
  }

  /**
   * Extracts the logic explanation from the suggestion string
   * Format is typically "Name (explanation)"
   */
  extractLogicExplanation(suggestion: string): string {
    if (!suggestion) return '';
    const match = suggestion.match(/\((.*?)\)/);
    return match ? match[1] : '';
  }

  /**
   * Check if bulk assign should be disabled
   */
  bulkAssignDisabled(): boolean {
    // Disable if no tasks or no suggestions
    return this.tasks.length === 0 || 
           Object.keys(this.autoAssignSuggestions).length === 0 ||
           this.tasks.some(task => !this.autoAssignSuggestions[task.id]);
  }

  /**
   * Confirm and assign all tasks to their suggested developers
   */
  confirmAndAssignAll(): void {
    this.loading.assign = true;
    this.error.assign = null;
    this.assignmentSuccess = false;
    
    // Create an array of assignment observables
    const assignmentObservables: Observable<any>[] = [];
    
    this.tasks.forEach(task => {
      if (this.autoAssignSuggestions[task.id]) {
        const developerName = this.extractDeveloperName(this.autoAssignSuggestions[task.id]);
        assignmentObservables.push(this.taskService.assignTask(task.id, developerName));
      }
    });
    
    // Execute all assignments in parallel
    if (assignmentObservables.length > 0) {
      forkJoin(assignmentObservables).subscribe({
        next: () => {
          this.loading.assign = false;
          this.assignmentSuccess = true;
          
          // Reload tasks to refresh the list
          this.loadTasks();
        },
        error: (err) => {
          this.error.assign = `Failed to assign some tasks: ${err.message}`;
          this.loading.assign = false;
          
          // Reload tasks to refresh the list
          this.loadTasks();
        }
      });
    } else {
      this.loading.assign = false;
    }
  }
} 