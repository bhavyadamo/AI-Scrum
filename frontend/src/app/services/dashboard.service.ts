import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
    // Support shorthand notation like "#48044 assign to Bhavya"
    return this.http.post<any>(`${this.tasksApiUrl}/tasks/assign`, {
      taskId,
      assignedTo: assignee
    });
  }

  /**
   * Get task recommendations for smart assignment
   * @param teamName Optional team name to filter recommendations
   * @returns Observable with task assignment recommendations
   */
  getTaskAssignmentRecommendations(teamName?: string): Observable<any> {
    let params = new HttpParams();
    if (teamName) {
      params = params.set('teamName', teamName);
    }
    
    return this.http.get<any>(`${this.apiUrl}/task-recommendations`, { params })
      .pipe(
        catchError(error => {
          console.error('Error fetching task recommendations:', error);
          return of({ recommendations: [] });
        })
      );
  }

  getSprintDetailsByIterationPath(iterationPath: string): Observable<SprintOverview> {
    const encodedPath = this.encodeIterationPath(iterationPath);
    let params = new HttpParams().set('iterationPath', encodedPath);
    return this.http.get<SprintOverview>(`${this.apiUrl}/sprint-details`, { params });
  }

  /**
   * Get tasks with a specific status in a specific iteration path
   * @param status The status to filter tasks by
   * @param iterationPath The iteration path to filter tasks in
   * @returns Observable with the matching tasks
   */
  getTasksByStatusInIteration(status: string, iterationPath: string): Observable<any[]> {
    // First, normalize the iteration path (remove any extra quotes or spaces)
    iterationPath = iterationPath.trim().replace(/^["']|["']$/g, '');
    
    // Then normalize the status (case insensitive comparison)
    const normalizedStatus = status.trim().toLowerCase();
    
    // Encode the iteration path for the API
    const encodedPath = this.encodeIterationPath(iterationPath);
    let params = new HttpParams().set('iterationPath', encodedPath);
    
    // Get all tasks for the iteration path, then filter by status
    return this.http.get<any[]>(`${this.tasksApiUrl}/tasks`, { params })
      .pipe(
        map(tasks => {
          // Filter tasks by the normalized status
          return tasks.filter((task: any) => {
            const taskStatus = task.status || '';
            return taskStatus.toLowerCase().includes(normalizedStatus);
          });
        }),
        catchError(error => {
          console.error(`Error fetching tasks with status ${status} in iteration ${iterationPath}:`, error);
          return of([]);
        })
      );
  }

  /**
   * Get dashboard card information
   * @param iterationPath The iteration path to get card information for
   * @returns Observable with task status card information
   */
  getDashboardCardInformation(iterationPath: string): Observable<{message: string}> {
    // First, normalize and encode the iteration path
    const encodedPath = this.encodeIterationPath(iterationPath.trim());
    let params = new HttpParams().set('iterationPath', encodedPath);
    
    // Make API call to get the card information
    return this.http.get<any[]>(`${this.tasksApiUrl}/tasks`, { params })
      .pipe(
        map(tasks => {
          if (!tasks || tasks.length === 0) {
            return { message: 'No tasks found for the current iteration.' };
          }
          
          // Group tasks by status
          const statusGroups: {[key: string]: any[]} = {};
          tasks.forEach(task => {
            const status = task.status || 'Unknown';
            if (!statusGroups[status]) {
              statusGroups[status] = [];
            }
            statusGroups[status].push(task);
          });
          
          // Format the response
          let message = `<p>Task distribution by status in ${this.decodeIterationPath(iterationPath)}:</p>`;
          message += '<div class="row">';
          
          // Add cards for each status
          Object.keys(statusGroups).forEach(status => {
            const count = statusGroups[status].length;
            const bgColor = this.getStatusCardColor(status);
            
            message += `
              <div class="col-md-3 col-sm-6 mb-3">
                <div class="card h-100" style="border-color: ${bgColor};">
                  <div class="card-body text-center" style="background-color: ${bgColor}; color: white;">
                    <h3 class="card-title">${count}</h3>
                    <p class="card-text">${status}</p>
                  </div>
                </div>
              </div>
            `;
          });
          
          message += '</div>';
          return { message };
        }),
        catchError(error => {
          console.error('Error fetching dashboard card information:', error);
          return of({ message: 'Unable to retrieve dashboard card information. Please try again later.' });
        })
      );
  }
  
  /**
   * Get a color for a status card
   * @param status The status to get a color for
   * @returns A color for the status card
   */
  private getStatusCardColor(status: string): string {
    const statusColorMap: {[key: string]: string} = {
      'Active': '#0078d4',
      'Code Review': '#6264a7',
      'CS-New': '#c239b3',
      'Dev In Progress': '#ff4081',
      'Dev-New': '#107c10',
      'Planned': '#8864b5',
      'Proposed': '#9e9e9e',
      'Require Clarification': '#ff9800',
      'Resolved': '#d83b01',
      'Verified': '#00b7c3'
    };
    
    // Check if status exists in map (case insensitive)
    const normalizedStatus = status.toLowerCase();
    for (const key in statusColorMap) {
      if (key.toLowerCase() === normalizedStatus) {
        return statusColorMap[key];
      }
    }
    
    // Return default color if status not found
    return '#9e9e9e';
  }
} 