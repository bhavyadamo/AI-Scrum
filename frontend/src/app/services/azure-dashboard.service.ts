import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
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
    'Custom.RootCause'?: string;
  };
}

export interface WorkItemQueryResult {
  workItems: { id: number }[];
  columns?: any[];
  workItemRelations?: any[];
}

export interface GroupByRootCause {
  rootCause: string;
  count: number;
  states: {
    [state: string]: number;
  };
}

export interface DashboardStats {
  totalItems: number;
  statusCounts: {
    [status: string]: number;
  };
  assigneeCounts: {
    [assignee: string]: {
      total: number;
      states: {
        [state: string]: number;
      };
    };
  };
  rootCauseCounts: GroupByRootCause[];
  workItems?: WorkItem[];
}

@Injectable({
  providedIn: 'root'
})
export class AzureDashboardService {
  private azureDevOpsUrl = environment.azureDevOpsUrl;
  private organization = environment.organization;
  private project = environment.project;

  constructor(private http: HttpClient) { }

  /**
   * Get dashboard statistics using WIQL API for a specific iteration
   * @param iterationPath The iteration path to filter by (e.g. 'Techoil\2.3.23')
   * @returns Observable with dashboard statistics including counts by status, assignee, and root cause
   */
  getDashboardStats(iterationPath: string): Observable<DashboardStats> {
    // URL for WIQL API
    const wiqlUrl = `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_apis/wit/wiql?api-version=7.0`;
    
    // Construct WIQL query to filter by iteration path
    const wiqlQuery = {
      query: `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo], [Custom.RootCause]
              FROM WorkItems
              WHERE [System.IterationPath] = '${iterationPath}'
              AND [System.TeamProject] = '${this.project}'`
    };

    // Execute WIQL query to get work item IDs
    return this.http.post<WorkItemQueryResult>(wiqlUrl, wiqlQuery).pipe(
      switchMap(result => {
        // If no work items found, return empty stats
        if (!result.workItems || result.workItems.length === 0) {
          return of({
            totalItems: 0,
            statusCounts: {},
            assigneeCounts: {},
            rootCauseCounts: [],
            workItems: []
          });
        }
        
        // Extract work item IDs
        const ids = result.workItems.map(item => item.id);
        
        // URL for batch API to get full work item details
        const batchUrl = `${this.azureDevOpsUrl}/${this.organization}/${this.project}/_apis/wit/workitems?ids=${ids.join(',')}&fields=System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,Custom.RootCause&api-version=7.0`;
        
        // Get work item details
        return this.http.get<{ value: WorkItem[] }>(batchUrl).pipe(
          map(workItemsResult => {
            const workItems = workItemsResult.value;
            
            // Process work items to calculate statistics
            return this.processWorkItems(workItems);
          })
        );
      }),
      catchError(error => {
        console.error('Error fetching dashboard statistics:', error);
        return throwError(() => new Error('Failed to fetch dashboard statistics. Please try again.'));
      })
    );
  }

  /**
   * Process work items to calculate dashboard statistics
   * @param workItems Array of work items to process
   * @returns Dashboard statistics
   */
  private processWorkItems(workItems: WorkItem[]): DashboardStats {
    const statusCounts: { [status: string]: number } = {};
    const assigneeCounts: { 
      [assignee: string]: { 
        total: number; 
        states: { [state: string]: number }; 
      }; 
    } = {};
    const rootCausesMap: { 
      [rootCause: string]: { 
        count: number; 
        states: { [state: string]: number }; 
      }; 
    } = {};

    // Process each work item
    workItems.forEach(item => {
      const state = item.fields['System.State'] || 'Unknown';
      const assignee = item.fields['System.AssignedTo'] ? 
                       item.fields['System.AssignedTo'].displayName : 
                       'Unassigned';
      const rootCause = item.fields['Custom.RootCause'] || 'Unspecified';
      
      // Count by status
      statusCounts[state] = (statusCounts[state] || 0) + 1;
      
      // Count by assignee and status
      if (!assigneeCounts[assignee]) {
        assigneeCounts[assignee] = { total: 0, states: {} };
      }
      assigneeCounts[assignee].total++;
      assigneeCounts[assignee].states[state] = (assigneeCounts[assignee].states[state] || 0) + 1;
      
      // Count by root cause and status
      if (!rootCausesMap[rootCause]) {
        rootCausesMap[rootCause] = { count: 0, states: {} };
      }
      rootCausesMap[rootCause].count++;
      rootCausesMap[rootCause].states[state] = (rootCausesMap[rootCause].states[state] || 0) + 1;
    });

    // Convert root causes to array format
    const rootCauseCounts: GroupByRootCause[] = Object.keys(rootCausesMap).map(rootCause => ({
      rootCause,
      count: rootCausesMap[rootCause].count,
      states: rootCausesMap[rootCause].states
    })).sort((a, b) => b.count - a.count); // Sort by count descending

    return {
      totalItems: workItems.length,
      statusCounts,
      assigneeCounts,
      rootCauseCounts,
      workItems
    };
  }
} 