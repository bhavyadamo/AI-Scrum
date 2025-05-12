import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, map } from 'rxjs/operators';
import { WorkItem, WorkItemDetails, TeamMember } from '../models/task.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) { }

  /**
   * Get available iteration paths from the API
   * @returns Observable of string array with iteration paths
   */
  getIterationPaths(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/iteration-paths`)
      .pipe(
        retry(1),
        catchError(error => this.handleError(error, 'fetching iteration paths'))
      );
  }

  /**
   * Get work items by iteration path and optional date range
   * @param iterationPath The iteration path to filter work items by
   * @param fromDate Optional start date for filtering
   * @param toDate Optional end date for filtering
   * @returns Observable of WorkItem array
   */
  getTasks(iterationPath: string, fromDate?: string, toDate?: string): Observable<WorkItem[]> {
    // Use HttpParams for proper URL encoding and query string building
    // Manually encode the iterationPath to ensure backslashes are correctly encoded
    const encodedIterationPath = encodeURIComponent(iterationPath);
    let params = new HttpParams().set('iterationPath', encodedIterationPath);
    
    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }
    
    if (toDate) {
      params = params.set('toDate', toDate);
    }
    
    return this.http.get<WorkItem[]>(this.apiUrl, { params })
      .pipe(
        retry(1),
        catchError(error => this.handleError(error, 'fetching work items')),
        map(response => this.processWorkItemsResponse(response))
      );
  }

  /**
   * Get detailed information for a specific work item
   * @param taskId The ID of the work item to fetch
   * @returns Observable of WorkItemDetails
   */
  getTaskDetails(taskId: number): Observable<WorkItemDetails> {
    return this.http.get<WorkItemDetails>(`${this.apiUrl}/${taskId}`)
      .pipe(
        retry(1),
        catchError(error => this.handleError(error, `fetching work item #${taskId}`))
      );
  }

  /**
   * Get team members from the API
   * @param iterationPath Optional iteration path to filter team members
   * @returns Observable of TeamMember array
   */
  getTeamMembers(iterationPath?: string): Observable<TeamMember[]> {
    let params = new HttpParams();
    
    if (iterationPath) {
      // Manually encode the iterationPath to ensure backslashes are correctly encoded
      const encodedIterationPath = encodeURIComponent(iterationPath);
      params = params.set('iterationPath', encodedIterationPath);
    }
    
    return this.http.get<TeamMember[]>(`${this.apiUrl}/team-members`, { params })
      .pipe(
        retry(1),
        catchError(error => this.handleError(error, 'fetching team members'))
      );
  }

  /**
   * Assign a work item to a team member
   * @param taskId The ID of the work item to assign
   * @param assignedTo The ID or name of the team member to assign the task to
   * @returns Observable of the assignment result
   */
  assignTask(taskId: number, assignedTo: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/assign`, {
      taskId,
      assignedTo
    }).pipe(
      catchError(error => this.handleError(error, `assigning work item #${taskId}`))
    );
  }

  /**
   * Get auto-assignment suggestions for tasks in the given iteration
   * @param iterationPath The iteration path to get suggestions for
   * @returns Observable of task ID to team member ID mapping
   */
  getAutoAssignSuggestions(iterationPath: string): Observable<Record<string, string>> {
    // Manually encode the iterationPath to ensure backslashes are correctly encoded
    const encodedIterationPath = encodeURIComponent(iterationPath);
    const params = new HttpParams().set('iterationPath', encodedIterationPath);

    return this.http.get<Record<string, string>>(`${this.apiUrl}/auto-assign-suggestions`, { params })
      .pipe(
        catchError(error => this.handleError(error, 'fetching auto-assign suggestions'))
      );
  }

  /**
   * Auto-assign tasks in the given iteration
   * @param iterationPath The iteration path containing tasks to auto-assign
   * @returns Observable of the assignment result
   */
  autoAssignTasks(iterationPath: string): Observable<any> {
    // Ensure the iterationPath is properly encoded in the JSON body
    const encodedIterationPath = encodeURIComponent(iterationPath);
    return this.http.post<any>(`${this.apiUrl}/auto-assign`, {
      iterationPath: encodedIterationPath
    }).pipe(
      catchError(error => this.handleError(error, 'auto-assigning tasks'))
    );
  }

  /**
   * Generic error handler for HTTP requests
   * @param error The HTTP error response
   * @param operation The operation that was being performed
   * @returns An observable that errors with a user-friendly message
   */
  private handleError(error: HttpErrorResponse, operation: string): Observable<never> {
    let errorMessage = `An error occurred while ${operation}`;
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server returned code ${error.status}: ${error.statusText}`;
      if (error.error?.message) {
        errorMessage += ` - ${error.error.message}`;
      }
    }
    
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Process the work items response to ensure consistent structure
   * @param response The raw API response
   * @returns An array of properly formatted WorkItem objects
   */
  private processWorkItemsResponse(response: any): WorkItem[] {
    if (!Array.isArray(response)) {
      console.warn('Unexpected response format for work items:', response);
      return [];
    }
    
    return response.map(item => ({
      id: item.id,
      title: item.title || 'Untitled Work Item',
      state: item.state || 'Unknown',
      status: item.status,
      type: item.type,
      priority: item.priority || 0,
      assignedTo: item.assignedTo || null,
      iterationPath: item.iterationPath || '',
    }));
  }
} 