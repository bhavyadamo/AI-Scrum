import { Component, OnInit, OnDestroy } from '@angular/core';
import { RecommendationService, Recommendation } from '../../services/recommendation.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-recommendations',
  templateUrl: './recommendations.component.html',
  styleUrls: ['./recommendations.component.scss']
})
export class RecommendationsComponent implements OnInit, OnDestroy {
  recommendations: Recommendation[] = [];
  loading = false;
  error = '';
  private subscriptions = new Subscription();

  constructor(private recommendationService: RecommendationService) { }

  ngOnInit(): void {
    // Start polling for recommendations
    this.recommendationService.startPolling();
    
    // Subscribe to recommendations
    this.subscriptions.add(
      this.recommendationService.getRecommendations().subscribe(data => {
        this.recommendations = data;
      })
    );
    
    // Subscribe to loading state
    this.subscriptions.add(
      this.recommendationService.getLoading().subscribe(loading => {
        this.loading = loading;
      })
    );
    
    // Subscribe to error messages
    this.subscriptions.add(
      this.recommendationService.getError().subscribe(error => {
        this.error = error;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions when component is destroyed
    this.subscriptions.unsubscribe();
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'Critical':
        return 'bg-danger';
      case 'Warning':
        return 'bg-warning';
      case 'Info':
      default:
        return 'bg-info';
    }
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'Critical':
        return 'bi-exclamation-triangle-fill';
      case 'Warning':
        return 'bi-exclamation-circle-fill';
      case 'Info':
      default:
        return 'bi-info-circle-fill';
    }
  }
} 