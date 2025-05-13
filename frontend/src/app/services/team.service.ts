import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TeamMember } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  private apiUrl = `${environment.apiUrl}/tasks/team-members`;

  constructor(private http: HttpClient) { }

  /**
   * Fetches all team members from the API
   * @returns Observable of TeamMember array
   */
  getTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(this.apiUrl)
      .pipe(
        retry(1), // Retry once on failure
        catchError(this.handleError),
        map(response => this.processTeamMembersResponse(response))
      );
  }

  /**
   * Fetches team members from a specific team
   * @param teamName The name of the team to fetch members from (e.g., "RND")
   * @param iterationPath Optional iteration path to filter by
   * @returns Observable of TeamMember array
   */
  getTeamMembersByTeam(teamName: string, iterationPath?: string): Observable<TeamMember[]> {
    let params = new HttpParams().set('teamName', teamName);
    
    if (iterationPath) {
      params = params.set('iterationPath', iterationPath);
    }
    
    return this.http.get<TeamMember[]>(this.apiUrl, { params })
      .pipe(
        retry(1), // Retry once on failure
        catchError(this.handleError),
        map(response => this.processTeamMembersResponse(response))
      );
  }

  /**
   * Handles HTTP errors and returns a user-friendly error message
   * @param error The HTTP error response
   * @returns An observable that errors with a user-friendly message
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred while fetching team members';
    
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
   * Processes the API response to ensure it conforms to the expected structure
   * @param response The raw API response
   * @returns An array of properly formatted TeamMember objects
   */
  private processTeamMembersResponse(response: any): TeamMember[] {
    if (!Array.isArray(response)) {
      console.warn('Unexpected response format for team members:', response);
      return [];
    }
    
    return response.map(member => ({
      id: member.id || '',
      displayName: member.displayName || 'Unknown User',
      uniqueName: member.uniqueName || '',
      imageUrl: member.imageUrl || undefined,
      // Add missing properties with default values
      currentWorkload: member.currentWorkload || 0,
      isActive: member.isActive !== undefined ? member.isActive : true,
      email: member.email || member.uniqueName || '',
      team: member.team || ''
    }));
  }
} 