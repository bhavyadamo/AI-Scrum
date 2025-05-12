import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { switchMap, catchError, tap, startWith } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Recommendation {
  id: string;
  message: string;
  severity: 'Info' | 'Warning' | 'Critical';
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private apiUrl = `${environment.apiUrl}/recommendations`;
  private pollingInterval = 30000; // 30 seconds
  private recommendations$ = new BehaviorSubject<Recommendation[]>([]);
  private loading$ = new BehaviorSubject<boolean>(false);
  private error$ = new BehaviorSubject<string>('');

  constructor(private http: HttpClient) { }

  startPolling(): void {
    interval(this.pollingInterval)
      .pipe(
        startWith(0), // Start immediately
        tap(() => this.loading$.next(true)),
        switchMap(() => this.fetchRecommendations()),
        catchError(error => {
          this.error$.next(error.message || 'Failed to fetch recommendations');
          this.loading$.next(false);
          return [];
        })
      )
      .subscribe(recommendations => {
        this.recommendations$.next(recommendations);
        this.loading$.next(false);
      });
  }

  fetchRecommendations(): Observable<Recommendation[]> {
    return this.http.get<Recommendation[]>(this.apiUrl)
      .pipe(
        catchError(error => {
          this.error$.next(error.message || 'Failed to fetch recommendations');
          return [];
        })
      );
  }

  getRecommendations(): Observable<Recommendation[]> {
    return this.recommendations$.asObservable();
  }

  getLoading(): Observable<boolean> {
    return this.loading$.asObservable();
  }

  getError(): Observable<string> {
    return this.error$.asObservable();
  }
} 