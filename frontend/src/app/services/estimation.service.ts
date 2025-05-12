import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TaskEstimationRequest {
  title: string;
  type: string;
  assignee: string;
  complexity: string;
}

export interface TaskEstimationResponse {
  estimatedHours: number;
  confidenceScore: number;
  factors: string[];
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