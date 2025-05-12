import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EstimationService, TaskEstimationResponse } from '../../services/estimation.service';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-estimation',
  templateUrl: './task-estimation.component.html',
  styleUrls: ['./task-estimation.component.scss']
})
export class TaskEstimationComponent implements OnInit {
  estimationForm: FormGroup;
  teamMembers: string[] = [];
  taskTypes: string[] = [
    'Bug',
    'Change Request',
    'Feature',
    'Documentation',
    'Test',
    'Research'
  ];
  complexityLevels: string[] = [
    'Low',
    'Medium',
    'High'
  ];
  
  loading = false;
  error: string | null = null;
  estimationResult: TaskEstimationResponse | null = null;
  showResult = false;

  constructor(
    private fb: FormBuilder,
    private estimationService: EstimationService,
    private taskService: TaskService
  ) {
    this.estimationForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      type: ['Feature', Validators.required],
      assignee: [''],
      complexity: ['Medium', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadTeamMembers();
  }

  loadTeamMembers(): void {
    this.taskService.getTeamMembers().subscribe({
      next: (response) => {
        if (Array.isArray(response)) {
          if (typeof response[0] === 'string') {
            // It's an array of strings
            this.teamMembers = response as string[];
          } else {
            // It's an array of TeamMember objects
            this.teamMembers = (response as any[]).map(m => m.displayName || m.name);
          }
        }
      },
      error: (err) => {
        console.error('Error loading team members:', err);
        this.error = 'Failed to load team members';
      }
    });
  }

  estimateTaskTime(): void {
    if (this.estimationForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.estimationForm.controls).forEach(key => {
        this.estimationForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.error = null;
    this.estimationResult = null;
    this.showResult = false;

    const request = {
      title: this.estimationForm.value.title,
      type: this.estimationForm.value.type,
      assignee: this.estimationForm.value.assignee,
      complexity: this.estimationForm.value.complexity
    };

    this.estimationService.estimateTaskTime(request).subscribe({
      next: (result) => {
        this.estimationResult = result;
        this.showResult = true;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'An error occurred during estimation';
        this.loading = false;
      }
    });
  }

  resetForm(): void {
    this.estimationForm.reset({
      title: '',
      type: 'Feature',
      assignee: '',
      complexity: 'Medium'
    });
    this.error = null;
    this.estimationResult = null;
    this.showResult = false;
  }

  getConfidenceClass(score: number): string {
    if (score >= 0.8) return 'bg-success';
    if (score >= 0.6) return 'bg-info';
    if (score >= 0.4) return 'bg-warning';
    return 'bg-danger';
  }

  formatConfidence(score: number): string {
    return (score * 100).toFixed(0) + '%';
  }
} 