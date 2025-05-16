import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, map, tap } from 'rxjs/operators';
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
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    console.log(`Getting tasks with normalized iteration path: ${normalizedPath}`);
    
    // Use HttpParams for proper URL encoding and query string building
    // Manually encode the iterationPath to ensure backslashes are correctly encoded
    const encodedIterationPath = encodeURIComponent(normalizedPath);
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
   * @returns Observable of TeamMember array or string array depending on the iterationPath
   */
  getTeamMembers(iterationPath?: string): Observable<TeamMember[] | string[]> {
    let params = new HttpParams();
    
    if (iterationPath) {
      // Normalize the iteration path to handle any double backslashes
      const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
      
      // Manually encode the iterationPath to ensure backslashes are correctly encoded
      const encodedIterationPath = encodeURIComponent(normalizedPath);
      params = params.set('iterationPath', encodedIterationPath);
    }
    
    return this.http.get<TeamMember[] | string[]>(`${this.apiUrl}/team-members`, { params })
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
   * Get auto-assign suggestions for tasks in the given iteration
   * @param iterationPath The iteration path to get suggestions for
   * @returns Observable of task ID to suggested assignee mapping
   */
  getAutoAssignSuggestions(iterationPath: string): Observable<Record<string, string>> {
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    console.log(`Getting auto-assign suggestions with normalized path: ${normalizedPath}`);
    
    // Ensure the iterationPath is properly encoded
    const encodedIterationPath = encodeURIComponent(normalizedPath);
    const params = new HttpParams().set('iterationPath', encodedIterationPath);
    
    return this.http.get<Record<string, string>>(`${this.apiUrl}/auto-assign-suggestions`, { params }).pipe(
      tap(response => {
        console.log('Auto-assign suggestions response:', response);
        console.log('Suggestion keys:', Object.keys(response));
      }),
      catchError(error => {
        console.error('Error getting auto-assign suggestions:', error);
        return this.handleError(error, 'getting auto-assign suggestions');
      })
    );
  }

  /**
   * Get auto-assign suggestions for tasks in the given iteration, filtered for specific team members
   * @param iterationPath The iteration path to get suggestions for
   * @param teamMembers List of team member names to consider for assignment
   * @returns Observable of task ID to suggested assignee mapping
   */
  getAutoAssignSuggestionsForTeam(iterationPath: string, teamMembers: string[]): Observable<Record<string, string>> {
    // Log request details for debugging
    console.log(`Getting auto-assign suggestions for team with iteration path: ${iterationPath}`);
    console.log(`Team members (${teamMembers.length}):`, teamMembers);
    
    // Normalize the iteration path (replace double backslashes with single)
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    
    // Create the request body - ensure iterationPath is properly included
    const requestBody = {
      iterationPath: normalizedPath,
      teamMembers: teamMembers
    };

    console.log('Sending request to auto-assign-suggestions/team with payload:', JSON.stringify(requestBody));
    
    return this.http.post<Record<string, string>>(`${this.apiUrl}/auto-assign-suggestions/team`, requestBody)
      .pipe(
        tap(response => console.log('Auto-assign suggestions for team response:', response)),
        catchError(error => {
          console.error('Error getting team-specific auto-assign suggestions:', error);
          console.error('Request payload was:', JSON.stringify(requestBody));
          return this.handleError(error, 'getting team-specific auto-assign suggestions');
        })
      );
  }

  /**
   * Auto-assign tasks in the given iteration
   * @param iterationPath The iteration path containing tasks to auto-assign
   * @returns Observable of the assignment result
   */
  autoAssignTasks(iterationPath: string): Observable<any> {
    // Normalize the iteration path to handle double backslashes
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    
    console.log(`Auto-assigning tasks for iteration path: ${normalizedPath}`);
    
    // Send the normalized path in the request body
    return this.http.post<any>(`${this.apiUrl}/auto-assign`, {
      iterationPath: normalizedPath
    }).pipe(
      tap(response => console.log('Auto-assign tasks response:', response)),
      catchError(error => {
        console.error('Error auto-assigning tasks:', error);
        return this.handleError(error, 'auto-assigning tasks');
      })
    );
  }

  /**
   * Get task counts for each team member in a given iteration
   * @param iterationPath The iteration path to get task counts for
   * @returns Observable of team member names to task count mapping
   */
  getTeamMemberTaskCounts(iterationPath: string): Observable<Record<string, number>> {
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    console.log(`Getting team member task counts with normalized path: ${normalizedPath}`);
    
    // Manually encode the iterationPath to ensure backslashes are correctly encoded
    const encodedIterationPath = encodeURIComponent(normalizedPath);
    const params = new HttpParams().set('iterationPath', encodedIterationPath);

    return this.http.get<Record<string, number>>(`${this.apiUrl}/team-member-task-counts`, { params })
      .pipe(
        retry(1),
        catchError(error => this.handleError(error, 'fetching team member task counts'))
      );
  }

  /**
   * Get work item history data for a specific iteration
   * This uses the existing getTasks endpoint but looks for completed work items
   * @param iterationPath The iteration path to get history for
   * @returns Observable of work items that can be used for historical analysis
   */
  getTaskHistory(iterationPath: string): Observable<WorkItem[]> {
    // For now, we'll use the regular getTasks method since the history endpoint isn't available
    console.log('Getting historical work items from iteration: ' + iterationPath);
    
    // We use the existing endpoint but will process the data to extract historical information
    return this.getTasks(iterationPath).pipe(
      map(items => {
        console.log(`Received ${items.length} items for historical analysis`);
        
        // Filter to only include completed work items that would have historical data
        const completedItems = items.filter(item => {
          const state = item.state?.toLowerCase() || '';
          return state.includes('done') || 
                 state.includes('closed') || 
                 state.includes('complete') ||
                 state.includes('resolved');
        });
        
        console.log(`Found ${completedItems.length} completed items with potential historical data`);
        return completedItems;
      })
    );
  }

  /**
   * Get detailed history for a specific work item, including state transitions
   * This is useful for estimating time based on actual work item history
   * @param workItemId The ID of the work item to get history for
   * @returns Observable of the detailed work item history
   */
  getWorkItemWithHistory(workItemId: number): Observable<WorkItemDetails> {
    console.log(`Getting detailed history for work item #${workItemId}`);
    return this.http.get<WorkItemDetails>(`${this.apiUrl}/${workItemId}?includeHistory=true`)
      .pipe(
        tap(item => console.log(`Retrieved work item #${workItemId} with history`)),
        catchError(error => {
          console.error(`Error loading history for work item #${workItemId}:`, error);
          return this.handleError(error, `loading work item #${workItemId} history`);
        })
      );
  }

  /**
   * Get developer expertise data from the past 3 months
   * This retrieves historical data about which developers have worked on similar tasks
   * @param teamMembers Optional list of team members to filter the results
   * @returns Observable of developer expertise data
   */
  getDeveloperExpertise(teamMembers?: string[]): Observable<any> {
    // Calculate date from 3 months ago
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const fromDate = threeMonthsAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const toDate = new Date().toISOString().split('T')[0]; // Today
    
    let params = new HttpParams()
      .set('fromDate', fromDate)
      .set('toDate', toDate);
    
    // If team members are specified, include them in the request body instead of params
    if (teamMembers && teamMembers.length > 0) {
      return this.http.post<any>(`${this.apiUrl}/developer-expertise`, { 
        fromDate, 
        toDate, 
        teamMembers 
      }).pipe(
        tap(response => console.log('Developer expertise response:', response)),
        catchError(error => {
          console.error('Error getting developer expertise:', error);
          return this.handleError(error, 'getting developer expertise');
        })
      );
    }
    
    return this.http.get<any>(`${this.apiUrl}/developer-expertise`, { params }).pipe(
      tap(response => console.log('Developer expertise response:', response)),
      catchError(error => {
        console.error('Error getting developer expertise:', error);
        return this.handleError(error, 'getting developer expertise');
      })
    );
  }
  
  /**
   * Get developers who have recently completed their tasks
   * @param iterationPath The iteration path to check
   * @returns Observable of available developer names
   */
  getAvailableDevelopers(iterationPath: string): Observable<string[]> {
    // Normalize the iteration path to handle any double backslashes
    const normalizedPath = iterationPath.replace(/\\\\/g, '\\');
    
    // Ensure the iterationPath is properly encoded
    const encodedIterationPath = encodeURIComponent(normalizedPath);
    const params = new HttpParams().set('iterationPath', encodedIterationPath);
    
    return this.http.get<string[]>(`${this.apiUrl}/available-developers`, { params }).pipe(
      tap(response => console.log('Available developers response:', response)),
      catchError(error => {
        console.error('Error getting available developers:', error);
        return this.handleError(error, 'getting available developers');
      })
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