import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AiModelSettingsDto,
  AzureDevOpsSettingsDto,
  SettingsDto,
  UpdateAiModelSettingsRequest,
  UpdateAzureDevOpsPATRequest,
  UpdateUserRoleRequest,
  UserRoleDto,
  UserRole
} from '../models/settings.model';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = `${environment.apiUrl}/settings`;
  private useLocalMock = true; // Always use mock data for demo purposes

  // Mock data for demo
  private mockUserRoles: UserRoleDto[] = [
    { userId: '1', userName: 'John Doe', email: 'john.doe@example.com', role: UserRole.Admin },
    { userId: '2', userName: 'Jane Smith', email: 'jane.smith@example.com', role: UserRole.ScrumMaster },
    { userId: '3', userName: 'Bob Johnson', email: 'bob.johnson@example.com', role: UserRole.Member },
    { userId: '4', userName: 'Alice Williams', email: 'alice.williams@example.com', role: UserRole.Viewer }
  ];

  private mockAzureDevOpsSettings: AzureDevOpsSettingsDto = {
    organization: 'demo-organization',
    organizationUrl: 'https://dev.azure.com/demo-organization',
    project: 'Demo Project',
    personalAccessToken: '•••••••••••••••••••••••••••••'
  };

  private mockAiModelSettings: AiModelSettingsDto = {
    modelType: 'openai',
    modelEndpoint: '',
    apiKey: '•••••••••••••••••••••••••••••',
    enableRecommendations: true,
    enableAutoUpdate: true
  };

  constructor(private http: HttpClient) { }

  // Get all settings (admin only)
  getAllSettings(): Observable<SettingsDto> {
    if (this.useLocalMock) {
      const mockData: SettingsDto = {
        userRoles: this.mockUserRoles,
        azureDevOpsSettings: this.mockAzureDevOpsSettings,
        aiModelSettings: this.mockAiModelSettings
      };
      return of(mockData).pipe(delay(300));
    }

    return this.http.get<SettingsDto>(this.apiUrl)
      .pipe(
        catchError(this.handleError)
      );
  }

  // User role management
  getUserRoles(): Observable<UserRoleDto[]> {
    if (this.useLocalMock) {
      return of(this.mockUserRoles).pipe(delay(300));
    }

    return this.http.get<UserRoleDto[]>(`${this.apiUrl}/users`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateUserRole(request: UpdateUserRoleRequest): Observable<any> {
    if (this.useLocalMock) {
      // Update the local mock data
      const userIndex = this.mockUserRoles.findIndex(u => u.userId === request.userId);
      if (userIndex >= 0) {
        this.mockUserRoles[userIndex].role = request.role;
      }
      return of({ success: true }).pipe(delay(300));
    }

    return this.http.post(`${this.apiUrl}/users`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Azure DevOps settings
  getAzureDevOpsSettings(): Observable<AzureDevOpsSettingsDto> {
    if (this.useLocalMock) {
      return of(this.mockAzureDevOpsSettings).pipe(delay(300));
    }

    return this.http.get<AzureDevOpsSettingsDto>(`${this.apiUrl}/azure-devops-pat`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateAzureDevOpsPAT(request: UpdateAzureDevOpsPATRequest): Observable<any> {
    if (this.useLocalMock) {
      // Update the mock data (but don't actually store the real PAT)
      this.mockAzureDevOpsSettings.personalAccessToken = '•••••••••••••••••••••••••••••';
      return of({ success: true }).pipe(delay(300));
    }

    return this.http.post(`${this.apiUrl}/azure-devops-pat`, request)
      .pipe(
        catchError(this.handleError)
      );
  }

  // AI model settings
  getAiModelSettings(): Observable<AiModelSettingsDto> {
    if (this.useLocalMock) {
      return of(this.mockAiModelSettings).pipe(delay(300));
    }

    return this.http.get<AiModelSettingsDto>(`${this.apiUrl}/ai-model`)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateAiModelSettings(request: UpdateAiModelSettingsRequest): Observable<any> {
    if (this.useLocalMock) {
      // Update mock data
      this.mockAiModelSettings = {
        ...this.mockAiModelSettings,
        modelType: request.modelType || this.mockAiModelSettings.modelType,
        modelEndpoint: request.modelEndpoint || this.mockAiModelSettings.modelEndpoint,
        enableRecommendations: request.enableRecommendations !== undefined ? 
            request.enableRecommendations : this.mockAiModelSettings.enableRecommendations,
        enableAutoUpdate: request.enableAutoUpdate
      };
      // Don't store the real API key
      if (request.apiKey) {
        this.mockAiModelSettings.apiKey = '•••••••••••••••••••••••••••••';
      }
      return of({ success: true }).pipe(delay(300));
    }

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
    } else if (error.status === 404) {
      errorMessage = 'Resource not found';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => new Error(errorMessage));
  }
} 