import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AiModelSettingsDto,
  AzureDevOpsSettingsDto,
  SettingsDto,
  UpdateAiModelSettingsRequest,
  UpdateAzureDevOpsPATRequest,
  UpdateUserRoleRequest,
  UserRoleDto
} from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) { }

  // Get all settings (admin only)
  getAllSettings(): Observable<SettingsDto> {
    return this.http.get<SettingsDto>(this.apiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }

  // User role management
  getUserRoles(): Observable<UserRoleDto[]> {
    return this.http.get<UserRoleDto[]>(`${this.apiUrl}/users`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateUserRole(request: UpdateUserRoleRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Azure DevOps settings
  getAzureDevOpsSettings(): Observable<AzureDevOpsSettingsDto> {
    return this.http.get<AzureDevOpsSettingsDto>(`${this.apiUrl}/azure-devops-pat`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateAzureDevOpsPAT(request: UpdateAzureDevOpsPATRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/azure-devops-pat`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  // AI model settings
  getAiModelSettings(): Observable<AiModelSettingsDto> {
    return this.http.get<AiModelSettingsDto>(`${this.apiUrl}/ai-model`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateAiModelSettings(request: UpdateAiModelSettingsRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai-model`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('Settings service error:', error);
    
    let errorMessage = 'An unknown error occurred';
    if (error.error && error.error.message) {
      errorMessage = error.error.message;
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to access this resource';
    } else if (error.status === 401) {
      errorMessage = 'Please log in to access this resource';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
} 