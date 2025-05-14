import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TaskDetails {
  id: number;
  title: string;
  state: string;
  assignedTo?: string;
  iterationPath: string;
  workItemType: string;
  tags?: string[];
}

export interface TaskSummary {
  totalTasks: number;
  statusCounts: { [status: string]: number };
  assigneeCounts: { [assignee: string]: number };
  tasks: TaskDetails[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskDetailsService {
  private apiUrl = `${environment.apiUrl}`;
  private azureDevOpsUrl = environment.azureDevOpsUrl;
  private organization = environment.organization;
  private project = environment.project;

  constructor(private http: HttpClient) { }

  /**
   * Get detailed task information for a specific iteration path
   * First attempts to use the backend API, falls back to direct Azure DevOps API if necessary
   * @param iterationPath The iteration path (e.g. 'Techoil\\2.3.23')
   * @returns Observable with task details and summary
   */
  getTaskDetails(iterationPath: string): Observable<TaskSummary> {
    // First try to get task data from our backend API
    return this.getTasksFromBackend(iterationPath).pipe(
      catchError(error => {
        console.warn('Backend API request failed, attempting direct Azure DevOps query:', error);
        // If backend API fails, try direct Azure DevOps query
        return this.getTasksFromAzureDevOps(iterationPath);
      })
    );
  }

  /**
   * Get tasks from our backend API
   * @param iterationPath The iteration path
   * @returns Observable with task details and summary
   */
  private getTasksFromBackend(iterationPath: string): Observable<TaskSummary> {
    const url = `${this.apiUrl}/tasks`;
    const params = new HttpParams().set('iterationPath', iterationPath);

    return this.http.get<any[]>(url, { params }).pipe(
      map(tasks => this.processTaskData(tasks)),
      catchError(error => {
        console.error('Error fetching tasks from backend:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get tasks directly from Azure DevOps using WIQL API
   * @param iterationPath The iteration path
   * @returns Observable with task details and summary
   */
  private getTasksFromAzureDevOps(iterationPath: string): Observable<TaskSummary> {
    // URL for WIQL API
    const wiqlUrl = `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_apis/wit/wiql?api-version=7.0`;

    // WIQL query to filter by iteration path and work item type
    const wiqlQuery = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [System.Tags], [System.IterationPath]
              FROM WorkItems
              WHERE [System.IterationPath] = '${iterationPath}'
              AND [System.WorkItemType] = 'Task'`
    };

    // Execute WIQL query to get work item IDs
    return this.http.post<{ workItems: { id: number }[] }>(wiqlUrl, wiqlQuery).pipe(
      switchMap(result => {
        if (!result.workItems || result.workItems.length === 0) {
          // No work items found
          return of({
            totalTasks: 0,
            statusCounts: {},
            assigneeCounts: {},
            tasks: []
          });
        }

        // Extract work item IDs
        const ids = result.workItems.map(item => item.id);

        // URL for batch API to get full work item details
        const batchUrl = `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_apis/wit/workitems?ids=${ids.join(',')}&fields=System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,System.Tags,System.IterationPath&api-version=7.0`;

        // Get work item details
        return this.http.get<{ value: any[] }>(batchUrl).pipe(
          map(response => {
            const tasks = response.value.map(item => ({
              id: item.id,
              title: item.fields['System.Title'],
              state: item.fields['System.State'],
              assignedTo: item.fields['System.AssignedTo'] ? item.fields['System.AssignedTo'].displayName : 'Unassigned',
              iterationPath: item.fields['System.IterationPath'],
              workItemType: item.fields['System.WorkItemType'],
              tags: item.fields['System.Tags'] ? item.fields['System.Tags'].split(';').map((tag: string) => tag.trim()) : []
            }));

            return this.processTaskData(tasks);
          })
        );
      }),
      catchError(error => {
        console.error('Error fetching task details from Azure DevOps:', error);
        return of({
          totalTasks: 0,
          statusCounts: {},
          assigneeCounts: {},
          tasks: []
        });
      })
    );
  }

  /**
   * Process task data to generate summary information
   * @param tasks Array of tasks
   * @returns Task summary with counts by status and assignee
   */
  private processTaskData(tasks: any[]): TaskSummary {
    const statusCounts: { [status: string]: number } = {};
    const assigneeCounts: { [assignee: string]: number } = {};

    // Process each task
    tasks.forEach(task => {
      const status = task.state || 'Unknown';
      const assignee = task.assignedTo || 'Unassigned';

      // Count by status
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Count by assignee
      assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    });

    return {
      totalTasks: tasks.length,
      statusCounts,
      assigneeCounts,
      tasks: tasks
    };
  }
} 