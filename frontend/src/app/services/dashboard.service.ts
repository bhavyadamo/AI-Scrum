import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SprintOverview, SprintSummary, ActivityFeed } from '../models/sprint.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) { }

  getCurrentSprint(): Observable<SprintOverview> {
    return this.http.get<SprintOverview>(`${this.apiUrl}/sprint`);
  }

  getSprintSummary(iterationPath: string): Observable<SprintSummary> {
    return this.http.get<SprintSummary>(`${this.apiUrl}/summary`, {
      params: { iterationPath }
    });
  }

  getActivityFeed(count: number = 10): Observable<ActivityFeed> {
    return this.http.get<ActivityFeed>(`${this.apiUrl}/activity`, {
      params: { count: count.toString() }
    });
  }

  getDailyTip(): Observable<{ tip: string }> {
    return this.http.get<{ tip: string }>(`${this.apiUrl}/tip`);
  }
} 