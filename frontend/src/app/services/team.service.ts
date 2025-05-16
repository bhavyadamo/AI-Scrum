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
   * @param cacheBuster Optional timestamp to prevent caching
   * @returns Observable of TeamMember array
   */
  getTeamMembers(cacheBuster?: number): Observable<TeamMember[]> {
    let url = this.apiUrl;
    
    // Add cache busting if provided
    if (cacheBuster) {
      url = `${url}?_t=${cacheBuster}`;
    }
    
    console.log(`Calling API endpoint: ${url}`);
    return this.http.get<TeamMember[]>(url)
      .pipe(
        retry(1), // Retry once on failure
        catchError(this.handleError),
        map(response => {
          console.log('Raw API response:', response);
          return this.processTeamMembersResponse(response);
        })
      );
  }

  /**
   * Fetches team members from a specific team
   * @param teamName The name of the team to fetch members from (e.g., "RND")
   * @param iterationPath Optional iteration path to filter by
   * @returns Observable of TeamMember array
   */
  getTeamMembersByTeam(teamName: string, iterationPath?: string): Observable<TeamMember[]> {
    // Construct URL parameters
    let params = new HttpParams().set('teamName', teamName);
    
    if (iterationPath) {
      params = params.set('iterationPath', iterationPath);
    }
    
    // Add timestamp to prevent caching
    params = params.set('_t', Date.now().toString());
    
    console.log(`Fetching team members from: ${this.apiUrl} with params: ${params.toString()}`);
    
    return this.http.get<TeamMember[]>(this.apiUrl, { params })
      .pipe(
        catchError(this.handleError),
        map(response => {
          console.log('Raw API response:', response);
          return this.processTeamMembersResponse(response);
        })
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
      console.warn('Unexpected response format (not an array):', response);
      return [];
    }

    if (response.length === 0) {
      return [];
    }

    // Process the team members from the response
    return response.map((member: any) => {
      // If it's a string (just the name), convert to object format
      if (typeof member === 'string') {
        return {
          id: `member-${Math.random().toString(36).substring(2, 9)}`,
          displayName: member,
          uniqueName: member,
          currentWorkload: 0,
          isActive: true,
          email: '',
          team: 'RND Team'
        };
      }
      
      // Otherwise, handle the expected object format
      return {
        id: member.id || `member-${Math.random().toString(36).substring(2, 9)}`,
        displayName: member.displayName || 'Unknown User',
        uniqueName: member.uniqueName || member.email || '',
        currentWorkload: typeof member.currentWorkload === 'number' ? member.currentWorkload : 0,
        isActive: member.isActive !== undefined ? member.isActive : true,
        email: member.email || member.uniqueName || '',
        team: member.team || 'RND Team'
      };
    });
  }
} 