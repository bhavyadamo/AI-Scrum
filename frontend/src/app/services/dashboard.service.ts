import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  SprintOverview, 
  SprintSummary, 
  ActivityFeed, 
  WorkItemDistribution, 
  LongTermDevNewItem, 
  SupportItem,
  AiDashboardTip,
  TaskStatusBoard,
  ChatMessage
} from '../models/sprint.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/dashboard`;
  private tasksApiUrl = `${environment.apiUrl}`;  // Base API URL for /api/tasks endpoints

  constructor(private http: HttpClient) { }

  // Helper method to properly encode iteration path
  private encodeIterationPath(iterationPath: string): string {
    // Use double-encoded backslashes (%255C) which is what the working API expects
    return iterationPath.replace(/\\/g, '%255C');
  }
  
  // Helper method to decode iteration path for display
  private decodeIterationPath(path: string): string {
    if (!path) return '';
    // Replace the encoded backslash with an actual backslash
    let decoded = path.replace(/%255C/g, '\\');
    decoded = decoded.replace(/%5C/g, '\\');
    decoded = decoded.replace(/%5c/g, '\\');
    return decoded;
  }

  getCurrentSprint(): Observable<SprintOverview> {
    return this.http.get<SprintOverview>(`${this.apiUrl}/sprint`);
  }

  getSprintSummary(iterationPath: string): Observable<SprintSummary> {
    const encodedPath = this.encodeIterationPath(iterationPath);
    let params = new HttpParams().set('iterationPath', encodedPath);
    return this.http.get<SprintSummary>(`${this.apiUrl}/summary`, { params });
  }

  getActivityFeed(count: number = 10): Observable<ActivityFeed> {
    return this.http.get<ActivityFeed>(`${this.apiUrl}/activity`, {
      params: { count: count.toString() }
    });
  }

  getDailyTip(): Observable<{ tip: string }> {
    return this.http.get<{ tip: string }>(`${this.apiUrl}/tip`);
  }

  getTaskDistribution(iterationPath: string): Observable<any> {
    const encodedPath = this.encodeIterationPath(iterationPath);
    let params = new HttpParams().set('iterationPath', encodedPath);
    
    return this.http.get(`${this.tasksApiUrl}/tasks`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching task distribution:', error);
          return of(null);
        })
      );
  }

  getWorkItemDistribution(iterationPath?: string): Observable<WorkItemDistribution> {
    let params = new HttpParams();
    if (iterationPath) {
      params = params.set('iterationPath', this.encodeIterationPath(iterationPath));
    }
    
    return this.http.get<WorkItemDistribution>(`${this.apiUrl}/distribution`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching work item distribution:', error);
          return of({ iterationPath: iterationPath || '', states: [], totalCount: 0 });
        })
      );
  }

  getStateDistribution(iterationPath?: string): Observable<WorkItemDistribution[]> {
    let params = new HttpParams();
    if (iterationPath) {
      params = params.set('iterationPath', this.encodeIterationPath(iterationPath));
    }
    
    return this.http.get<WorkItemDistribution[]>(`${this.apiUrl}/state-distribution`, { params });
  }

  getLongTermDevNewItems(maxItems: number = 5): Observable<LongTermDevNewItem[]> {
    return this.http.get<LongTermDevNewItem[]>(`${this.apiUrl}/long-term-dev-new`, {
      params: { count: maxItems.toString() }
    });
  }

  getSupportItems(months: number = 6): Observable<SupportItem[]> {
    return this.http.get<SupportItem[]>(`${this.apiUrl}/support-items`, {
      params: { months: months.toString() }
    });
  }

  getAiTips(): Observable<AiDashboardTip> {
    return this.http.get<AiDashboardTip>(`${this.apiUrl}/ai-tips`);
  }

  getTasksByStatus(iterationPath: string): Observable<TaskStatusBoard> {
    let params = new HttpParams().set('iterationPath', this.encodeIterationPath(iterationPath));
    
    return this.http.get<TaskStatusBoard>(`${this.apiUrl}/tasks-by-status`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching tasks by status:', error);
          return of({ items: [] });
        })
      );
  }

  sendChatMessage(data: { message: string, currentIterationPath: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/chat`, { 
      message: data.message,
      currentIterationPath: data.currentIterationPath 
    });
  }

  /**
   * Process AI Assistant task assignment commands
   * @param taskId The ID of the task to assign
   * @param assignee The name of the person to assign the task to
   * @returns Observable with the assignment result
   */
  processAiTaskAssignment(taskId: number, assignee: string): Observable<any> {
    return this.http.post<any>(`${this.tasksApiUrl}/tasks/assign`, {
      taskId,
      assignedTo: assignee
    });
  }

  getSprintDetailsByIterationPath(iterationPath: string): Observable<SprintOverview> {
    const encodedPath = this.encodeIterationPath(iterationPath);
    let params = new HttpParams().set('iterationPath', encodedPath);
    return this.http.get<SprintOverview>(`${this.apiUrl}/sprint-details`, { params });
  }
} 