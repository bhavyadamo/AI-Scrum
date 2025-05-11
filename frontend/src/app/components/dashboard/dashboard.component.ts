import { Component, OnInit } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { SprintOverview, SprintSummary, ActivityFeed } from '../../models/sprint.model';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  sprintOverview: SprintOverview | null = null;
  sprintSummary: SprintSummary | null = null;
  activityFeed: ActivityFeed | null = null;
  dailyTip: string = '';
  loading = {
    sprint: true,
    summary: true,
    activity: true,
    tip: true
  };
  error = {
    sprint: '',
    summary: '',
    activity: '',
    tip: ''
  };

  constructor(private dashboardService: DashboardService) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadSprintOverview();
    this.loadDailyTip();
  }

  loadSprintOverview(): void {
    this.loading.sprint = true;
    this.dashboardService.getCurrentSprint().subscribe({
      next: (data) => {
        this.sprintOverview = data;
        this.loading.sprint = false;
        this.loadSprintSummary(data.iterationPath);
        this.loadActivityFeed();
      },
      error: (err) => {
        this.error.sprint = 'Failed to load sprint data';
        this.loading.sprint = false;
        console.error('Error loading sprint data:', err);
      }
    });
  }

  loadSprintSummary(iterationPath: string): void {
    this.loading.summary = true;
    this.dashboardService.getSprintSummary(iterationPath).subscribe({
      next: (data) => {
        this.sprintSummary = data;
        this.loading.summary = false;
      },
      error: (err) => {
        this.error.summary = 'Failed to load summary data';
        this.loading.summary = false;
        console.error('Error loading summary data:', err);
      }
    });
  }

  loadActivityFeed(): void {
    this.loading.activity = true;
    this.dashboardService.getActivityFeed().subscribe({
      next: (data) => {
        this.activityFeed = data;
        this.loading.activity = false;
      },
      error: (err) => {
        this.error.activity = 'Failed to load activity feed';
        this.loading.activity = false;
        console.error('Error loading activity feed:', err);
      }
    });
  }

  loadDailyTip(): void {
    this.loading.tip = true;
    this.dashboardService.getDailyTip().subscribe({
      next: (data) => {
        this.dailyTip = data.tip;
        this.loading.tip = false;
      },
      error: (err) => {
        this.error.tip = 'Failed to load daily tip';
        this.loading.tip = false;
        console.error('Error loading daily tip:', err);
      }
    });
  }

  reload(): void {
    this.loadDashboardData();
  }
} 