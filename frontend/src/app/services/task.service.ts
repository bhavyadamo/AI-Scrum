import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WorkItem, WorkItemDetails, TeamMember } from '../models/task.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) { }

  getTasks(iterationPath: string): Observable<WorkItem[]> {
    return this.http.get<WorkItem[]>(this.apiUrl, {
      params: { iterationPath }
    });
  }

  getTaskDetails(taskId: number): Observable<WorkItemDetails> {
    return this.http.get<WorkItemDetails>(`${this.apiUrl}/${taskId}`);
  }

  getTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>(`${this.apiUrl}/team-members`);
  }

  assignTask(taskId: number, assignedTo: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/assign`, {
      taskId,
      assignedTo
    });
  }

  getAutoAssignSuggestions(iterationPath: string): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(`${this.apiUrl}/auto-assign-suggestions`, {
      params: { iterationPath }
    });
  }

  autoAssignTasks(iterationPath: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auto-assign`, {
      iterationPath
    });
  }
} 