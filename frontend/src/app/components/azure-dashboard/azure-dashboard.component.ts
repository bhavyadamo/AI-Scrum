import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AzureDashboardService, DashboardStats, GroupByRootCause } from '../../services/azure-dashboard.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-azure-dashboard',
  templateUrl: './azure-dashboard.component.html',
  styleUrls: ['./azure-dashboard.component.scss']
})
export class AzureDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('statusChart') statusChartRef!: ElementRef;
  @ViewChild('rootCauseChart') rootCauseChartRef!: ElementRef;
  
  // Selected iteration path (default to the one in the requirements)
  selectedIterationPath: string = 'Techoil\\2.3.23';
  
  // Available iteration paths (can be extended)
  availableIterationPaths: string[] = ['Techoil\\2.3.23', 'Team-Shiptech\\12.9.0'];
  
  // Dashboard statistics
  dashboardStats: DashboardStats | null = null;
  
  // Chart objects
  statusChart: any;
  rootCauseChart: any;
  
  // Status colors for the charts
  statusColors: Record<string, string> = {
    'PMG - Proposed': '#e0e0e0',
    'DEV - Yet to Start': '#9a9a9a',
    'DEV - WIP': '#0078d4',
    'DEV - Code Review': '#324e93',
    'DEV - Done': '#00b7c3',
    'DEV/QC - Reopened': '#e81123',
    'Clarifications': '#fff100',
    'On Hold': '#e3008c',
    'QC - In Test Bed': '#8764b8',
    'Completed': '#107c10',
    'New': '#b4d7a8',
    'Dev-New': '#b4d7a8',
    'Active': '#4a86e8',
    'Dev-WIP': '#4a86e8',
    'In Progress': '#4a86e8',
    'Resolved': '#ffd966',
    'Code Review': '#9fc5e8',
    'QA': '#d5a6bd',
    'Testing': '#d5a6bd',
    'Done': '#93c47d',
    'Closed': '#6aa84f',
    'Blocked': '#e06666',
    'Removed': '#999999'
  };
  
  // Default colors for charts if status not found in mapping
  defaultChartColors = [
    '#4a86e8', '#6aa84f', '#ffd966', '#e06666', '#9fc5e8', 
    '#d5a6bd', '#b4d7a8', '#e6e6e6', '#93c47d', '#6fa8dc'
  ];
  
  // Loading and error states
  loading = false;
  error = '';

  constructor(private azureDashboardService: AzureDashboardService) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  /**
   * Load dashboard data for the selected iteration
   */
  loadDashboardData(): void {
    // Validate iteration path
    if (!this.selectedIterationPath) {
      this.error = 'Please enter an iteration path';
      return;
    }
    
    // Trim whitespace and ensure consistent formatting
    this.selectedIterationPath = this.selectedIterationPath.trim();
    
    // Show loading indicator
    this.loading = true;
    this.error = '';
    
    // Call service to get dashboard statistics
    this.azureDashboardService.getDashboardStats(this.selectedIterationPath)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (stats) => {
          this.dashboardStats = stats;
          
          // Update available paths if this is a new one
          if (!this.availableIterationPaths.includes(this.selectedIterationPath)) {
            this.availableIterationPaths.push(this.selectedIterationPath);
          }
          
          // Initialize charts
          setTimeout(() => {
            this.initializeStatusChart();
            this.initializeRootCauseChart();
          }, 100);
        },
        error: (err) => {
          console.error('Error loading dashboard data:', err);
          this.error = 'Failed to load dashboard data. Please try again.';
        }
      });
  }

  /**
   * Initialize status chart
   */
  initializeStatusChart(): void {
    if (!this.dashboardStats || !this.statusChartRef?.nativeElement) {
      return;
    }
    
    // Get canvas element
    const ctx = this.statusChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Get status data
    const statuses = Object.keys(this.dashboardStats.statusCounts);
    const counts = statuses.map(status => this.dashboardStats!.statusCounts[status]);
    const colors = statuses.map(status => this.getStatusColor(status));
    
    // Clear any existing chart
    if (window.Chart && this.statusChart) {
      this.statusChart.destroy();
    }
    
    // Create new chart
    if (window.Chart) {
      this.statusChart = new window.Chart(ctx, {
        type: 'pie',
        data: {
          labels: statuses,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
              display: true
            },
            title: {
              display: true,
              text: 'Work Items by Status'
            },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.dataset.data.reduce((a: number, b: number) => Number(a) + Number(b), 0);
                  const percentage = Math.round((value / total) * 100);
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  /**
   * Initialize root cause chart
   */
  initializeRootCauseChart(): void {
    if (!this.dashboardStats || !this.rootCauseChartRef?.nativeElement || this.dashboardStats.rootCauseCounts.length === 0) {
      return;
    }
    
    // Get canvas element
    const ctx = this.rootCauseChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Get root cause data
    const rootCauses = this.dashboardStats.rootCauseCounts.map(rc => rc.rootCause);
    const counts = this.dashboardStats.rootCauseCounts.map(rc => rc.count);
    
    // Get all unique states across all root causes
    const allStates = new Set<string>();
    this.dashboardStats.rootCauseCounts.forEach(rc => {
      Object.keys(rc.states).forEach(state => {
        allStates.add(state);
      });
    });
    
    // Create datasets, one for each state
    const datasets = Array.from(allStates).map(state => {
      const color = this.getStatusColor(state);
      return {
        label: state,
        data: this.dashboardStats!.rootCauseCounts.map(rc => rc.states[state] || 0),
        backgroundColor: color
      };
    });
    
    // Clear any existing chart
    if (window.Chart && this.rootCauseChart) {
      this.rootCauseChart.destroy();
    }
    
    // Create new chart
    if (window.Chart) {
      this.rootCauseChart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: rootCauses,
          datasets: datasets
        },
        options: {
          responsive: true,
          scales: {
            x: {
              stacked: true,
            },
            y: {
              stacked: true,
              beginAtZero: true
            }
          },
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Work Items by Root Cause'
            }
          }
        }
      });
    }
  }

  /**
   * Get color for a status
   * @param status Status to get color for
   * @returns Color for the status
   */
  getStatusColor(status: string): string {
    return this.statusColors[status] || this.getRandomColor();
  }

  /**
   * Get a random color from the default colors
   * @returns Random color
   */
  getRandomColor(): string {
    const randomIndex = Math.floor(Math.random() * this.defaultChartColors.length);
    return this.defaultChartColors[randomIndex];
  }

  /**
   * Get sorted status data for display
   * @returns Array of status data
   */
  getStatusData(): { status: string; count: number; color: string }[] {
    if (!this.dashboardStats) {
      return [];
    }
    
    return Object.keys(this.dashboardStats.statusCounts)
      .map(status => ({
        status,
        count: this.dashboardStats!.statusCounts[status],
        color: this.getStatusColor(status)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get sorted assignee data for display
   * @returns Array of assignee data
   */
  getAssigneeData(): { name: string; total: number; states: { [state: string]: number } }[] {
    if (!this.dashboardStats) {
      return [];
    }
    
    return Object.keys(this.dashboardStats.assigneeCounts)
      .map(assignee => ({
        name: assignee,
        total: this.dashboardStats!.assigneeCounts[assignee].total,
        states: this.dashboardStats!.assigneeCounts[assignee].states
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Get states for an assignee
   * @param assignee Assignee to get states for
   * @returns Array of states and counts
   */
  getStatesForAssignee(assignee: { name: string; total: number; states: { [state: string]: number } }): { state: string; count: number }[] {
    return Object.keys(assignee.states)
      .map(state => ({
        state,
        count: assignee.states[state]
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get states for a root cause
   * @param rootCause Root cause to get states for
   * @returns Array of states and counts
   */
  getStatesForRootCause(rootCause: GroupByRootCause): { state: string; count: number }[] {
    return Object.keys(rootCause.states)
      .map(state => ({
        state,
        count: rootCause.states[state]
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Change the selected iteration path
   * @param iterationPath New iteration path
   */
  changeIterationPath(iterationPath: string): void {
    this.selectedIterationPath = iterationPath;
    this.loadDashboardData();
  }

  /**
   * Refresh dashboard data
   */
  refresh(): void {
    this.loadDashboardData();
  }
} 