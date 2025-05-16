import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, of, switchMap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WorkItem {
  id: number;
  fields: {
    'System.State': string;
    'System.AssignedTo'?: {
      displayName: string;
      uniqueName: string;
    };
    'System.Tags'?: string;
    'System.Title'?: string;
    'System.WorkItemType'?: string;
    [key: string]: any; // Allow additional field access to avoid TypeScript errors
  };
}

// Custom interface for processed work items
export interface ProcessedWorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo: string;
  tags: string;
  type: string;
  fields: any;
}

export interface WorkItemQueryResult {
  workItems: { id: number }[];
  columns?: any[];
  workItemRelations?: any[];
}

export interface DashboardStats {
  totalTasks: number;
  devNew: number;
  inProgress: number;
  codeReview: number;
  devComplete: number;
  completed: number;
  blocked: number;
  workItems?: ProcessedWorkItem[];
  statsByAssignee?: { [key: string]: any };
}

@Injectable({
  providedIn: 'root'
})
export class AzureDevOpsService {
  // Use our backend API as a proxy
  private apiUrl = `${environment.apiUrl}/azure`;
  private azureDevOpsUrl = environment.azureDevOpsUrl;
  private organization = environment.organization;
  private project = environment.project;

  constructor(private http: HttpClient) { }

  /**
   * Fetch work items for a specific iteration path using our backend proxy
   * @param iterationPath The iteration path to filter by
   * @returns Observable with work items data
   */
  getWorkItemsByIteration(iterationPath: string): Observable<any> {
    // Use our backend proxy endpoint that will handle Azure DevOps auth
    const url = `${this.apiUrl}/work-items`;
    
    // Use URL parameters to pass the iteration path
    let params = new HttpParams().set('iterationPath', iterationPath);
    
    return this.http.get(url, { params }).pipe(
      catchError(error => {
        console.error('Error fetching work items by iteration:', error);
        return throwError(() => new Error('Failed to fetch work items. Please try again.'));
      })
    );
  }

  /**
   * Get work item counts by status from our backend
   * @param iterationPath The iteration path to filter by
   * @returns Observable with counts by status
   */
  getWorkItemStatusCounts(iterationPath: string): Observable<any> {
    const url = `${this.apiUrl}/work-item-counts`;
    
    // Use URL parameters to pass the iteration path
    let params = new HttpParams().set('iterationPath', iterationPath);
    
    return this.http.get(url, { params }).pipe(
      catchError(error => {
        console.error('Error fetching work item counts:', error);
        // Return a default object with zeroes to avoid UI breaking
        return of({
          totalTasks: 0,
          devNew: 0,
          inProgress: 0,
          codeReview: 0,
          devComplete: 0,
          completed: 0,
          blocked: 0
        });
      })
    );
  }

  /**
   * Process work items to get counts by status - use this as a fallback
   * if the backend endpoint is not yet implemented
   * @param workItems The work items data
   * @returns Object with counts by status
   */
  getWorkItemCounts(workItems: any[]): any {
    const counts = {
      totalTasks: workItems.length,
      devNew: 0,
      inProgress: 0,
      codeReview: 0,
      devComplete: 0,
      completed: 0,
      blocked: 0
    };

    workItems.forEach(item => {
      const state = item.fields ? item.fields['System.State'] : item.state;
      
      // Increment appropriate counter based on state - match the states from the screenshot
      if (state === 'Dev-New' || state === 'CS-New' || state === 'New') {
        counts.devNew++;
      } else if (state === 'Dev In progress' || state === 'Dev-WIP' || state === 'In Progress' || state === 'Active') {
        counts.inProgress++;
      } else if (state === 'Code Review' || state === 'Dev-Code Review') {
        counts.codeReview++;
      } else if (state === 'Dev Complete' || state === 'Dev-Done' || state === 'Dev-Complete') {
        counts.devComplete++;
      } else if (state === 'Completed' || state === 'Closed' || state === 'Done' || state === 'Moved to Production') {
        counts.completed++;
      } else if (state === 'Blocked' || state === 'Impediment' || state === 'Awaiting Clarification') {
        counts.blocked++;
      }
    });

    return counts;
  }

  /**
   * Fetch work items using the WIQL API for a specific iteration
   * @param iterationPath The iteration path to filter by (e.g. 'Techoil\2.3.23')
   * @returns Observable with dashboard statistics including counts by status and assignee
   */
  getWorkItemsByWiql(iterationPath: string): Observable<DashboardStats> {
    // Direct call to Azure DevOps WIQL API
    const url = `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_apis/wit/wiql?api-version=7.0`;
    
    // WIQL query to filter by iteration path and work item type
    const wiqlQuery = {
      query: `SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.AssignedTo], [System.Tags] 
              FROM WorkItems 
              WHERE [System.IterationPath] = '${iterationPath}' 
              AND [System.WorkItemType] = 'Task'`
    };

    // First get the work item IDs from the WIQL query
    return this.http.post<WorkItemQueryResult>(url, wiqlQuery).pipe(
      switchMap(result => {
        // If no work items found, return empty stats
        if (!result.workItems || result.workItems.length === 0) {
          return of({
            totalTasks: 0,
            devNew: 0,
            inProgress: 0,
            codeReview: 0,
            devComplete: 0,
            completed: 0,
            blocked: 0,
            statsByAssignee: {}
          });
        }
        
        // Extract work item IDs
        const ids = result.workItems.map(item => item.id);
        
        // Batch GET the work items to get full details including fields
        const batchUrl = `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_apis/wit/workitems?ids=${ids.join(',')}&fields=System.Id,System.WorkItemType,System.Title,System.State,System.AssignedTo,System.Tags&api-version=7.0`;
        
        // Get full work item details
        return this.http.get<{ value: WorkItem[] }>(batchUrl).pipe(
          map(workItemsResult => {
            // Map work items to a more usable format with state directly accessible
            const workItems: ProcessedWorkItem[] = workItemsResult.value.map(item => {
              return {
                id: item.id,
                title: item.fields['System.Title'] || '',
                state: item.fields['System.State'] || 'Unknown',
                assignedTo: item.fields['System.AssignedTo'] ? 
                            item.fields['System.AssignedTo'].displayName : 'Unassigned',
                tags: item.fields['System.Tags'] || '',
                type: item.fields['System.WorkItemType'] || 'Task',
                // Keep original fields for reference
                fields: item.fields
              };
            });
            
            // Process work items to get counts by status
            const counts = this.getWorkItemCounts(workItems);
            
            // Process work items to get counts by assignee
            const statsByAssignee: { [key: string]: any } = {};
            
            workItems.forEach(item => {
              const state = item.state;
              const assignee = item.assignedTo || 'Unassigned';
              
              // Initialize assignee object if it doesn't exist
              if (!statsByAssignee[assignee]) {
                statsByAssignee[assignee] = {
                  total: 0,
                  devNew: 0,
                  inProgress: 0,
                  codeReview: 0,
                  devComplete: 0,
                  completed: 0,
                  blocked: 0
                };
              }
              
              // Increment total count for this assignee
              statsByAssignee[assignee].total++;
              
              // Increment appropriate state counter for this assignee
              if (state === 'Dev-New' || state === 'CS-New' || state === 'New') {
                statsByAssignee[assignee].devNew++;
              } else if (state === 'Dev In progress' || state === 'Dev-WIP' || state === 'In Progress' || state === 'Active') {
                statsByAssignee[assignee].inProgress++;
              } else if (state === 'Code Review' || state === 'Dev-Code Review') {
                statsByAssignee[assignee].codeReview++;
              } else if (state === 'Dev Complete' || state === 'Dev-Done' || state === 'Dev-Complete') {
                statsByAssignee[assignee].devComplete++;
              } else if (state === 'Completed' || state === 'Closed' || state === 'Done' || state === 'Moved to Production') {
                statsByAssignee[assignee].completed++;
              } else if (state === 'Blocked' || state === 'Impediment' || state === 'Awaiting Clarification') {
                statsByAssignee[assignee].blocked++;
              }
            });
            
            // Return combined statistics
            return {
              ...counts,
              workItems,
              statsByAssignee
            };
          })
        );
      }),
      catchError(error => {
        console.error('Error fetching work items with WIQL:', error);
        return of({
          totalTasks: 0,
          devNew: 0,
          inProgress: 0,
          codeReview: 0,
          devComplete: 0,
          completed: 0,
          blocked: 0,
          statsByAssignee: {}
        });
      })
    );
  }

  /**
   * Get a work item by its ID
   * @param workItemId The ID of the work item to fetch
   * @returns Observable with the work item data
   */
  getWorkItemById(workItemId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/workitems/${workItemId}`)
      .pipe(
        catchError(error => {
          console.error(`Error fetching work item #${workItemId}:`, error);
          return of(null);
        })
      );
  }
} 