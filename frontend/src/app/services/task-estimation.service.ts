import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AzureWorkItem {
  id: string;
  title: string;
  type: string;
  assignee: string;
  complexity: string;
  iterationPath: string;
}

export interface TimeEstimate {
  devTime: string;
  qaTime: string;
  totalEstimate: string;
  confidence: number;
  factorsConsidered: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskEstimationService {
  private apiUrl = `${environment.apiUrl}/tasks`;
  private estimateUrl = `${environment.apiUrl}/task-estimation`;
  
  // BehaviorSubject to share the currently selected task
  private selectedTaskSubject = new BehaviorSubject<AzureWorkItem | null>(null);
  
  // Cache for tasks by iteration path
  private taskCache: { [iterationPath: string]: Observable<AzureWorkItem[]> } = {};

  constructor(private http: HttpClient) { }

  // Get tasks by iteration path (with caching)
  getTasksByIteration(iterationPath: string): Observable<AzureWorkItem[]> {
    // Check if we have cached data for this iteration
    if (!this.taskCache[iterationPath]) {
      const params = new HttpParams().set('iterationPath', iterationPath);
      
      // Store the observable in cache to avoid multiple requests
      this.taskCache[iterationPath] = this.http.get<AzureWorkItem[]>(this.apiUrl, { params })
        .pipe(
          shareReplay(1), // Cache the result
          catchError(error => {
            console.error('Error fetching tasks:', error);
            return of([]);
          })
        );
    }
    
    return this.taskCache[iterationPath];
  }

  // Get available iteration paths
  getIterationPaths(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/iteration-paths`)
      .pipe(
        catchError(error => {
          console.error('Error fetching iteration paths:', error);
          return of([]);
        })
      );
  }

  // Set the selected task and broadcast it to subscribers
  setSelectedTask(task: AzureWorkItem): void {
    this.selectedTaskSubject.next(task);
  }

  // Get the selected task as an observable
  getSelectedTask(): Observable<AzureWorkItem | null> {
    return this.selectedTaskSubject.asObservable();
  }

  // Clear the selected task
  clearSelectedTask(): void {
    this.selectedTaskSubject.next(null);
  }

  // Estimate time for the given task
  estimateTime(task: AzureWorkItem): Observable<TimeEstimate> {
    const payload = {
      title: task.title,
      type: task.type,
      assignee: task.assignee,
      complexity: task.complexity
    };

    return this.http.post<TimeEstimate>(`${this.estimateUrl}`, payload)
      .pipe(
        catchError(error => {
          console.error('Error estimating time:', error);
          throw error;
        })
      );
  }

  // Clear cache for specific iteration
  clearCache(iterationPath: string): void {
    if (this.taskCache[iterationPath]) {
      delete this.taskCache[iterationPath];
    }
  }

  // Clear all cache
  clearAllCache(): void {
    this.taskCache = {};
  }
} 