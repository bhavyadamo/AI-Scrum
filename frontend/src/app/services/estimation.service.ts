import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TaskEstimationRequest {
  title: string;
  type: string;
  taskType?: string; // Alternative name for type
  assignee: string;
  complexity: string;
  iterationPath?: string;
  workItemId?: number;
  additionalFields?: any;
  includeHistory?: boolean;
  historicalItems?: any[]; // Historical work items with timing data from Azure DevOps
  
  // New fields for test cases and user story
  testCasesCount?: number;
  userStoryId?: number;
  userStoryPoints?: number;
}

export interface TaskEstimationResponse {
  estimatedHours: number;
  confidenceScore: number;
  factors: string[];
  devTimeHours?: number;
  testTimeHours?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EstimationService {
  private apiUrl = `${environment.apiUrl}/estimation`;

  constructor(private http: HttpClient) { }

  /**
   * Estimate task time using ML-based estimation
   * @param request The task estimation request
   * @returns Observable of the estimation response
   */
  estimateTaskTime(request: TaskEstimationRequest): Observable<TaskEstimationResponse> {
    return this.http.post<TaskEstimationResponse>(
      `${this.apiUrl}/estimate-task-time`, 
      request
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Estimate task time using work history from a specific iteration
   * @param request The task estimation request
   * @param iterationPath The iteration path to use for work history analysis
   * @returns Observable of the estimation response
   */
  estimateTaskTimeWithWorkHistory(request: TaskEstimationRequest, iterationPath: string): Observable<TaskEstimationResponse> {
    const requestWithHistory = {
      ...request,
      iterationPath: iterationPath
    };
    
    return this.http.post<TaskEstimationResponse>(
      `${this.apiUrl}/estimate-task-time-with-history`, 
      requestWithHistory
    ).pipe(
      catchError(error => {
        if (error.status === 404) {
          console.warn('Work history estimation endpoint not available, falling back to standard estimation');
          return this.estimateTaskTime(request);
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Generic error handler for HTTP requests
   * @param error The error response
   * @returns An error observable
   */
  private handleError(error: any): Observable<never> {
    console.error('An error occurred in estimation service:', error);
    
    let errorMessage = 'An unknown error occurred';
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
} 