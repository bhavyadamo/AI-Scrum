import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { AzureDevOpsService } from '../../services/azure-devops.service';
import { 
  SprintOverview, 
  SprintSummary, 
  ActivityFeed, 
  WorkItemDistribution, 
  LongTermDevNewItem, 
  SupportItem,
  AiDashboardTip,
  StateCount,
  TaskStatusBoard,
  TaskStatusItem,
  ChatMessage
} from '../../models/sprint.model';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
// Import Modal from bootstrap
declare var bootstrap: any;

declare global {
  interface Window {
    Chart: any;
  }
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('stateDistributionChart') stateDistributionChartRef!: ElementRef;
  @ViewChild('iterationDistributionChart') iterationDistributionChartRef!: ElementRef;
  @ViewChild('statusPieChart') statusPieChartRef!: ElementRef;
  
  sprintOverview: SprintOverview | null = null;
  sprintSummary: SprintSummary | null = null;
  activityFeed: ActivityFeed | null = null;
  dailyTip: string = '';
  workItemDistribution: WorkItemDistribution | null = null;
  stateDistributions: WorkItemDistribution[] = [];
  longTermDevNewItems: LongTermDevNewItem[] = [];
  supportItems: SupportItem[] = [];
  aiTips: AiDashboardTip | null = null;
  
  // Define state colors for consistency
  stateColors: Record<string, string> = {
    'Proposed': '#e6e6e6',
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
    'Completed': '#6aa84f',
    'Blocked': '#e06666',
    'Removed': '#999999'
  };
  
  // Default chart colors if state not found in mapping
  defaultChartColors = [
    '#4a86e8', '#6aa84f', '#ffd966', '#e06666', '#9fc5e8', 
    '#d5a6bd', '#b4d7a8', '#e6e6e6', '#93c47d', '#6fa8dc'
  ];
  
  // Properties for the new task board
  taskStatusBoard: TaskStatusItem[] = [];
  
  // Properties for task details
  loadingTaskDetails = false;
  taskDetailsError = '';
  tasksByStatus: { status: string; count: number; color: string }[] = [];
  
  // Chat properties
  chatMessages: ChatMessage[] = [];
  currentMessage: string = '';
  
  // Define status colors based on Azure DevOps board from the image
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
    'Completed': '#107c10'
  };
  
  // Track loading and error states
  loading = {
    sprint: true,
    summary: true,
    activity: true,
    tip: true,
    distribution: true,
    stateDistribution: true,
    longTermDevNew: true,
    supportItems: true,
    aiTips: true,
    taskStatusBoard: true
  };
  
  error = {
    sprint: '',
    summary: '',
    activity: '',
    tip: '',
    distribution: '',
    stateDistribution: '',
    longTermDevNew: '',
    supportItems: '',
    aiTips: '',
    taskStatusBoard: ''
  };

  // Starting with a default Iteration Path that can be changed
  selectedIterationPath: string = 'Techoil\\2.3.23';
  availableIterationPaths: string[] = ['Techoil\\2.3.23'];

  // Work item status counts from Azure DevOps
  azureDevOpsWorkItems: any[] = [];
  workItemCounts = {
    totalTasks: 0,
    devNew: 0,
    inProgress: 0,
    codeReview: 0,
    devComplete: 0,
    completed: 0,
    blocked: 0
  };
  
  // Assignee distribution data
  assigneeDistribution: any = {};
  
  // Loading and error states
  loadingAzureDevOps = false;
  azureDevOpsError = '';

  // Stats grouping for types and statuses
  tasksByType: { type: string; count: number; color: string }[] = [];

  // Status popup properties
  selectedStatus: string = '';
  statusTasks: any[] = [];
  loadingStatusTasks: boolean = false;
  taskDetailsModal: any;

  // Method to decode iteration path for display
  decodeIterationPath(path: string): string {
    if (!path) return '';
    // Replace the encoded backslash with an actual backslash
    // Handle both double-encoded (%255C) and single-encoded (%5C) backslashes
    let decoded = path.replace(/%255C/g, '\\');
    decoded = decoded.replace(/%5C/g, '\\');
    decoded = decoded.replace(/%5c/g, '\\');
    return decoded;
  }

  constructor(
    private dashboardService: DashboardService,
    private azureDevOpsService: AzureDevOpsService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    // Initialize the task status modal
    const modalElement = document.getElementById('taskStatusModal');
    if (modalElement) {
      this.taskDetailsModal = new bootstrap.Modal(modalElement);
    }
  }

  loadDashboardData(): void {
    this.loadSprintOverview();
    this.loadAiTips();
    
    // Load Azure DevOps data for the initial iteration path
    this.loadingTaskDetails = true;
    this.taskDetailsError = '';
    this.loadTaskStatusBoard();
  }

  loadIterationData(): void {
    // Validate iteration path
    if (!this.selectedIterationPath) {
      return;
    }
    
    // Trim whitespace and ensure consistent formatting
    this.selectedIterationPath = this.selectedIterationPath.trim();
    
    // Reset loading and error states
    this.loading.sprint = true;
    this.error.sprint = '';
    this.loadingTaskDetails = true;
    this.taskDetailsError = '';
    
    console.log(`Loading data for iteration path: ${this.selectedIterationPath}`);
    
    // Load sprint details for the selected iteration path
    this.dashboardService.getSprintDetailsByIterationPath(this.selectedIterationPath)
      .subscribe({
        next: (data) => {
          console.log('Sprint details loaded:', data);
          // Ensure proper display by decoding the iteration path
          if (data.iterationPath) {
            data.sprintName = this.decodeIterationPath(data.sprintName);
          }
          this.sprintOverview = data;
          this.loading.sprint = false;
        },
        error: (err) => {
          this.error.sprint = 'Failed to load sprint details';
          this.loading.sprint = false;
          console.error('Error loading sprint details:', err);
        }
      });
    
    // Load Azure DevOps work items directly first to get live data
    this.loadAzureDevOpsWorkItemsWithWiql();
    
    // Load other dashboard data
    this.loadSprintSummary(this.selectedIterationPath);
    this.loadTaskStatusBoard();
    
    // Update available paths if this is a new one
    if (!this.availableIterationPaths.includes(this.selectedIterationPath)) {
      this.availableIterationPaths.push(this.selectedIterationPath);
    }
  }

  loadSprintOverview(): void {
    this.loading.sprint = true;
    this.dashboardService.getCurrentSprint().subscribe({
      next: (data) => {
        this.sprintOverview = data;
        // Use hard-coded iteration path instead of data.iterationPath
        // this.selectedIterationPath = data.iterationPath;
        this.loading.sprint = false;
        this.loadSprintSummary(this.selectedIterationPath);
        this.loadActivityFeed();
        this.loadWorkItemDistribution(this.selectedIterationPath);
        this.loadStateDistributions();
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
  
  loadWorkItemDistribution(iterationPath?: string): void {
    this.loading.distribution = true;
    this.dashboardService.getWorkItemDistribution(iterationPath).subscribe({
      next: (data) => {
        this.workItemDistribution = data;
        this.loading.distribution = false;
        
        // Initialize distribution chart after data is loaded
        setTimeout(() => {
          this.initializeWorkItemDistributionChart();
        }, 100);
      },
      error: (err) => {
        this.error.distribution = 'Failed to load work item distribution';
        this.loading.distribution = false;
        console.error('Error loading work item distribution:', err);
      }
    });
  }
  
  loadStateDistributions(): void {
    this.loading.stateDistribution = true;
    this.dashboardService.getStateDistribution(this.selectedIterationPath).subscribe({
      next: (data) => {
        this.stateDistributions = data;
        // Keep hard-coded iteration paths instead of dynamically loading them
        // this.availableIterationPaths = data.map(d => d.iterationPath);
        this.loading.stateDistribution = false;
        
        // Initialize state distribution chart after data is loaded
        setTimeout(() => {
          this.initializeStateDistributionsChart();
        }, 100);
      },
      error: (err) => {
        this.error.stateDistribution = 'Failed to load state distributions';
        this.loading.stateDistribution = false;
        console.error('Error loading state distributions:', err);
      }
    });
  }
  
  loadLongTermDevNewItems(): void {
    this.loading.longTermDevNew = true;
    this.dashboardService.getLongTermDevNewItems(5).subscribe({
      next: (data) => {
        this.longTermDevNewItems = data;
        this.loading.longTermDevNew = false;
      },
      error: (err) => {
        this.error.longTermDevNew = 'Failed to load long-term Dev-New items';
        this.loading.longTermDevNew = false;
        console.error('Error loading long-term Dev-New items:', err);
      }
    });
  }
  
  loadSupportItems(): void {
    this.loading.supportItems = true;
    this.dashboardService.getSupportItems(6).subscribe({
      next: (data) => {
        this.supportItems = data;
        this.loading.supportItems = false;
      },
      error: (err) => {
        this.error.supportItems = 'Failed to load support items';
        this.loading.supportItems = false;
        console.error('Error loading support items:', err);
      }
    });
  }
  
  loadAiTips(): void {
    this.loading.aiTips = true;
    this.dashboardService.getAiTips().subscribe({
      next: (data) => {
        this.aiTips = data;
        this.longTermDevNewItems = data.longTermDevNewItems;
        this.supportItems = data.supportItems;
        this.dailyTip = data.tip;
        this.loading.aiTips = false;
      },
      error: (err) => {
        this.error.aiTips = 'Failed to load AI tips';
        this.loading.aiTips = false;
        console.error('Error loading AI tips:', err);
        // Fall back to individual methods
        this.loadDailyTip();
        this.loadLongTermDevNewItems();
        this.loadSupportItems();
      }
    });
  }
  
  initializeWorkItemDistributionChart(): void {
    if (!this.workItemDistribution || !this.stateDistributionChartRef?.nativeElement) {
      return;
    }
    
    // Get canvas element
    const ctx = this.stateDistributionChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    const labels = this.workItemDistribution.states.map(s => s.state);
    const data = this.workItemDistribution.states.map(s => s.count);
    const colors = this.workItemDistribution.states.map(s => 
      this.stateColors[s.state] || this.getRandomColor()
    );
    
    // Clear any existing chart
    if (window.Chart && ctx.chart) {
      ctx.chart.destroy();
    }
    
    // Create new chart
    if (window.Chart) {
      ctx.chart = new window.Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: `Work Item States - ${this.workItemDistribution.iterationPath}`
            }
          }
        }
      });
    }
  }
  
  initializeStateDistributionsChart(): void {
    if (this.stateDistributions.length === 0 || !this.iterationDistributionChartRef?.nativeElement) {
      return;
    }
    
    // Get canvas element
    const ctx = this.iterationDistributionChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Clear any existing chart
    if (window.Chart && ctx.chart) {
      ctx.chart.destroy();
    }
    
    // Prepare data for stacked bar chart
    const iterationLabels = this.stateDistributions.map(d => d.iterationPath);
    
    // Find all unique states across all iterations
    const allStates = new Set<string>();
    this.stateDistributions.forEach(dist => {
      dist.states.forEach(state => {
        allStates.add(state.state);
      });
    });
    
    // Create datasets, one for each state
    const datasets = Array.from(allStates).map(stateName => {
      // Find color for this state
      const stateColor = this.stateColors[stateName] || this.getRandomColor();
      
      // Create dataset for this state across all iterations
      return {
        label: stateName,
        data: this.stateDistributions.map(dist => {
          const stateData = dist.states.find(s => s.state === stateName);
          return stateData ? stateData.count : 0;
        }),
        backgroundColor: stateColor
      };
    });
    
    // Create new chart
    if (window.Chart) {
      ctx.chart = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: iterationLabels,
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
              text: 'Work Item Distribution by Iteration'
            }
          }
        }
      });
    }
  }
  
  changeIterationPath(iterationPath: string): void {
    // Even with hardcoded path, keep the method in case it's called from elsewhere
    if (iterationPath !== this.selectedIterationPath) {
      this.selectedIterationPath = iterationPath;
      this.loadWorkItemDistribution(iterationPath);
      this.loadSprintSummary(iterationPath);
    }
  }
  
  getStateColor(state: string): string {
    return this.stateColors[state] || this.getRandomColor();
  }
  
  getRandomColor(): string {
    const randomIndex = Math.floor(Math.random() * this.defaultChartColors.length);
    return this.defaultChartColors[randomIndex];
  }

  reload(): void {
    this.loadDashboardData();
  }

  loadTaskStatusBoard(): void {
    this.loading.taskStatusBoard = true;
    this.error.taskStatusBoard = '';
    this.loadingTaskDetails = true;
    this.taskDetailsError = '';
    
    // Define the expected status order to match the image
    const expectedStatuses = [
      'PMG - Proposed',
      'DEV - Yet to Start', 
      'DEV - WIP', 
      'DEV - Code Review', 
      'DEV - Done',
      'DEV/QC - Reopened'
    ];
    
    // Type colors for visualization
    const typeColors: {[key: string]: string} = {
      'Bug': '#e74c3c',
      'Requirement': '#3498db',
      'Change Request': '#2ecc71',
      'Task': '#f39c12',
      'Epic': '#9b59b6',
      'User Story': '#1abc9c'
    };
    
    // Use the direct API endpoint as specified
    const encodedPath = encodeURIComponent(this.selectedIterationPath).replace(/%5C/g, '%255C');
    const url = `http://localhost:5000/api/tasks?iterationPath=${encodedPath}`;
    
    this.http.get<any[]>(url)
      .pipe(
        finalize(() => {
          this.loading.taskStatusBoard = false;
          this.loadingTaskDetails = false;
        })
      )
      .subscribe({
        next: (workItems) => {
          if (workItems && workItems.length > 0) {
            // Group by status
            const statusGroups: {[key: string]: any[]} = workItems.reduce((acc: {[key: string]: any[]}, item) => {
              const status = item.status || 'Unknown';
              if (!acc[status]) {
                acc[status] = [];
              }
              acc[status].push(item);
              return acc;
            }, {});
            
            // Group by type
            const typeGroups: {[key: string]: any[]} = workItems.reduce((acc: {[key: string]: any[]}, item) => {
              const type = item.type || 'Unknown';
              if (!acc[type]) {
                acc[type] = [];
              }
              acc[type].push(item);
              return acc;
            }, {});
            
            // Create status items
            let statusItems = Object.keys(statusGroups).map(status => ({
              status: status,
              count: statusGroups[status].length,
              color: this.statusColors[status] || this.getStateColor(status)
            }));
            
            // Create type items
            this.tasksByType = Object.keys(typeGroups).map(type => ({
              type: type,
              count: typeGroups[type].length,
              color: typeColors[type] || this.getRandomColor()
            })).sort((a, b) => b.count - a.count);
            
            // Sort statuses based on expected status order
            statusItems = statusItems.sort((a, b) => {
              const indexA = expectedStatuses.indexOf(a.status);
              const indexB = expectedStatuses.indexOf(b.status);
              
              // If both are in expectedStatuses, sort by that order
              if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
              }
              
              // If only one is in expectedStatuses, prioritize it
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              
              // For any other statuses, sort alphabetically
              return a.status.localeCompare(b.status);
            });
            
            // Update the task status board
            this.taskStatusBoard = statusItems;
            
            // Also update tasksByStatus for compatibility with older code
            this.tasksByStatus = [...this.taskStatusBoard];
            
            console.log('Task counts by type:', this.tasksByType);
            console.log('Task counts by status:', this.taskStatusBoard);
          } else {
            this.error.taskStatusBoard = 'No tasks found for this iteration';
            this.taskDetailsError = 'No tasks found for this iteration';
            
            // Create dummy data as a last resort
            this.createDummyTaskBoard();
          }
        },
        error: (err) => {
          console.error('Error loading task board data:', err);
          this.error.taskStatusBoard = 'Failed to load task board data';
          this.taskDetailsError = 'Failed to load task data';
          
          // Fallback to dummy data
          this.createDummyTaskBoard();
        }
      });
  }
  
  createDummyTaskBoard(): void {
    // Create dummy data to match the image
    this.taskStatusBoard = [
      { status: 'PMG - Proposed', count: 0, color: '#e0e0e0' },
      { status: 'DEV - Yet to Start', count: 2, color: '#9a9a9a' },
      { status: 'DEV - WIP', count: 4, color: '#0078d4' },
      { status: 'DEV - Code Review', count: 2, color: '#324e93' },
      { status: 'DEV - Done', count: 5, color: '#00b7c3' },
      { status: 'DEV/QC - Reopened', count: 1, color: '#e81123' }
    ];
    
    // Create dummy data for types
    this.tasksByType = [
      { type: 'Bug', count: 8, color: '#e74c3c' },
      { type: 'Requirement', count: 6, color: '#3498db' },
      { type: 'Change Request', count: 3, color: '#2ecc71' },
      { type: 'Task', count: 5, color: '#f39c12' }
    ];
    
    // Also update tasksByStatus for compatibility
    this.tasksByStatus = [...this.taskStatusBoard];
    
    // Clear any loading and error states
    this.loadingTaskDetails = false;
    this.taskDetailsError = '';
  }
  
  initializeStatusPieChart(): void {
    if (!this.statusPieChartRef?.nativeElement) {
      return;
    }
    
    // Get canvas element
    const ctx = this.statusPieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;
    
    // Setup data for pie chart from work item counts
    const statusData = [
      { status: 'Dev-New', count: this.workItemCounts.devNew, color: '#00a8e8' },
      { status: 'In Progress', count: this.workItemCounts.inProgress, color: '#0078d4' },
      { status: 'Code Review', count: this.workItemCounts.codeReview, color: '#8764b8' },
      { status: 'Dev Complete', count: this.workItemCounts.devComplete, color: '#107c10' },
      { status: 'Completed', count: this.workItemCounts.completed, color: '#00b7c3' },
      { status: 'Blocked', count: this.workItemCounts.blocked, color: '#e81123' }
    ];
    
    // Filter out states with 0 count for better visualization
    const filteredStatuses = statusData.filter(item => item.count > 0);
    
    const labels = filteredStatuses.map(s => s.status);
    const data = filteredStatuses.map(s => s.count);
    const colors = filteredStatuses.map(s => s.color);
    
    // Clear any existing chart
    if (window.Chart && ctx.chart) {
      ctx.chart.destroy();
    }
    
    // Create new chart
    if (window.Chart) {
      ctx.chart = new window.Chart(ctx, {
        type: 'pie',
        data: {
          labels: labels,
          datasets: [{
            data: data,
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
              text: 'Work Item States Distribution'
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
  
  getStatusColor(status: string): string {
    return this.statusColors[status] || '#9a9a9a'; // Default gray color
  }
  
  // Chat methods
  sendChatMessage(): void {
    if (!this.currentMessage.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: this.currentMessage.trim(),
      timestamp: new Date()
    };
    this.chatMessages.push(userMessage);
    
    // Store message and clear input
    const message = this.currentMessage;
    this.currentMessage = '';
    
    // Special case for "number of status" queries - handle these first
    if (message.toLowerCase().startsWith('number of ') || message.toLowerCase().startsWith('no of ')) {
      // Handle the special case directly
      this.handleStatusCountQueryDirect(message);
      return;
    }
    
    // Check if this is a task assignment request
    // Match patterns like: "assign task #123 to john", "set task 123 for john doe", etc.
    const assignTaskRegex = /(?:assign|set|give)\s+(?:task|item|work item)?(?:\s+#)?(\d+)\s+(?:to|for)\s+([a-zA-Z][a-zA-Z\s\.]+)/i;
    const assignTaskMatch = message.match(assignTaskRegex);
    
    // Check for shorthand task assignment: "#48044 assign to Bhavya"
    const shorthandAssignRegex = /#?(\d+)\s+(?:assign(?:ed)?|set|give)\s+(?:to|for)\s+([a-zA-Z][a-zA-Z\s\.]+)/i;
    const shorthandAssignMatch = assignTaskMatch ? null : message.match(shorthandAssignRegex);
    
    // Check if this is a task lookup request
    // Match patterns like: "show task #123", "find task 123", "what is task 123", etc.
    const lookupTaskRegex = /(?:show|find|what is|get|lookup|look up|display|view)\s+(?:task|item|work item)(?:\s+#)?(\d+)/i;
    const lookupTaskMatch = message.match(lookupTaskRegex);
    
    // Pattern for "who has the most tasks"
    const mostTasksRegex = /who has (?:the )?most (?:tasks|work items|items|work)/i;
    const mostTasksMatch = message.match(mostTasksRegex);
    
    // Pattern for task distribution
    const taskDistributionRegex = /(?:task|work|workload|work item) distribution/i;
    const taskDistributionMatch = message.match(taskDistributionRegex);
    
    // Pattern for sprint status/summary
    const sprintStatusRegex = /(?:sprint|iteration) (?:status|summary|overview|details|progress)/i;
    const sprintStatusMatch = message.match(sprintStatusRegex);
    
    // Pattern for dashboard queries
    const dashboardRegex = /(?:show|get|display|view|what(?:'|i)s|how(?:'|i)s)\s+(?:the\s+)?dashboard|dashboard\s+(?:overview|status|summary|info|details)/i;
    const dashboardMatch = message.match(dashboardRegex);
    
    // Pattern for task status distribution queries
    const taskStatusRegex = /(?:task|work item)s?\s+(?:by|in|with)\s+status|status\s+(?:breakdown|distribution)|(?:distribution|breakdown)\s+(?:of|by)\s+status/i;
    const taskStatusMatch = message.match(taskStatusRegex);
    
    // Pattern for work item type queries
    const workItemTypeRegex = /(?:work item|task)s?\s+(?:by|per|across)\s+type|type\s+(?:breakdown|distribution)|(?:distribution|breakdown)\s+(?:of|by)\s+type/i;
    const workItemTypeMatch = message.match(workItemTypeRegex);
    
    // Pattern for tasks with specific status in specific iteration
    const specificTasksRegex = /(?:show|get|find|display|list|what(?:'|i)s)?\s*(?:the\s+)?(\w+(?:[-\s]\w+)*)\s+(?:tasks|work items|items)\s+(?:under|in|for|within)\s+(.+?)(?:\s*\?|$)/i;
    const specificTasksMatch = message.match(specificTasksRegex);
    
    // Direct pattern for "Active tasks under Techoil\2.3.23" and similar
    const directTaskPathPattern = /^(\w+)\s+tasks\s+under\s+(.+)$/i;
    const directMatch = !specificTasksMatch ? message.match(directTaskPathPattern) : null;
    
    // Pattern for questions about specific task status count
    const statusCountRegex = /(?:how many|what is the count of|count of|number of)\s+(\w+(?:[-\s]\w+)*)\s+(?:tasks|work items|items)/i;
    const statusCountMatch = message.match(statusCountRegex);
    
    // Pattern for "no of [status]" queries
    const noOfStatusRegex = /^(?:no|number) of\s+(.+?)(?:\s+tasks|\s+work items|\s+items)?(?:\s+in|\s+under|\s+within|\s+for)?\s*(.*?)?\s*$/i;
    const noOfStatusMatch = message.match(noOfStatusRegex);
    
    // Simple pattern for just a status name question
    const simpleStatusRegex = /^(active|code review|cs-new|dev in progress|dev-new|planned|proposed|require clarification|resolved|verified)$/i;
    const simpleStatusMatch = message.match(simpleStatusRegex);
    
    // Pattern for status card questions
    const statusCardRegex = /(?:status cards|task cards|dashboard cards|status distribution cards|task status distribution)/i;
    const statusCardMatch = message.match(statusCardRegex);
    
    // Handle queries like "number of CS-New tasks under Techoil\2.3.23"
    const handleStatusCountQuery = (query: string): boolean => {
      // Check if query matches the pattern
      const match = query.match(noOfStatusRegex);
      if (!match) return false;
      
      // Extract the status and iteration path
      let statusText = match[1].trim();
      const iteration = match[2]?.trim() || this.selectedIterationPath;
      
      // Special handling for known statuses
      let actualStatus = statusText;
      if (statusText.toLowerCase() === 'cs-new' || statusText.toLowerCase() === 'cs new') {
        actualStatus = 'CS-New';
      } else if (statusText.toLowerCase() === 'dev-new' || statusText.toLowerCase() === 'dev new') {
        actualStatus = 'Dev-New';
      } else if (statusText.toLowerCase() === 'dev in progress') {
        actualStatus = 'Dev In progress';
      } else if (statusText.toLowerCase() === 'code review') {
        actualStatus = 'Code Review';
      }
      
      // Show loading message
      this.chatMessages.push({
        role: 'assistant',
        content: `Retrieving the count of ${actualStatus} tasks in ${iteration}...`,
        timestamp: new Date()
      });
      
      // Get task count for this status
      this.dashboardService.getTasksByStatusInIteration(actualStatus, iteration)
        .subscribe({
          next: (tasks: any[]) => {
            this.chatMessages.pop();
            
            if (tasks && tasks.length > 0) {
              const count = tasks.length;
              let formattedResponse = `<p>Found ${count} ${actualStatus} tasks in iteration "${iteration}".</p>`;
              
              this.chatMessages.push({
                role: 'assistant',
                content: formattedResponse,
                timestamp: new Date()
              });
            } else {
              this.chatMessages.push({
                role: 'assistant', 
                content: `No tasks found with status "${actualStatus}" in iteration "${iteration}".`,
                timestamp: new Date()
              });
            }
          },
          error: (err: any) => {
            this.chatMessages.pop();
            console.error('Error retrieving task count:', err);
            this.chatMessages.push({
              role: 'assistant',
              content: 'Sorry, I encountered an error retrieving the task count. Please try again later.',
              timestamp: new Date()
            });
          }
        });
      
      return true;
    };
    
    if (assignTaskMatch) {
      // This is a task assignment command
      const taskId = parseInt(assignTaskMatch[1]);
      const assignee = assignTaskMatch[2].trim();
      
      // Show thinking message
      this.chatMessages.push({
        role: 'assistant',
        content: `Assigning task #${taskId} to ${assignee}...`,
        timestamp: new Date()
      });
      
      // Process the assignment
      this.dashboardService.processAiTaskAssignment(taskId, assignee).subscribe({
        next: (response) => {
          // Remove the thinking message
          this.chatMessages.pop();
          
          // Add success message
          this.chatMessages.push({
            role: 'assistant',
            content: `✅ Task #${taskId} has been successfully assigned to ${assignee}. The changes will be reflected in Azure DevOps.`,
            timestamp: new Date()
          });
          
          // Refresh task data to reflect the changes
          this.loadTaskStatusBoard();
        },
        error: (err) => {
          // Remove the thinking message
          this.chatMessages.pop();
          
          console.error('Error assigning task:', err);
          // Add error message
          this.chatMessages.push({
            role: 'assistant',
            content: `❌ Sorry, I couldn't assign task #${taskId} to ${assignee}. ${err.error?.message || 'Please check if the task ID and assignee name are correct.'}`,
            timestamp: new Date()
          });
        }
      });
    } else if (shorthandAssignMatch) {
      // This is a shorthand task assignment command
      const taskId = parseInt(shorthandAssignMatch[1]);
      const assignee = shorthandAssignMatch[2].trim();
      
      // Show thinking message
      this.chatMessages.push({
        role: 'assistant',
        content: `Assigning task #${taskId} to ${assignee}...`,
        timestamp: new Date()
      });
      
      // Process the assignment
      this.dashboardService.processAiTaskAssignment(taskId, assignee).subscribe({
        next: (response) => {
          // Remove the thinking message
          this.chatMessages.pop();
          
          // Add success message
          this.chatMessages.push({
            role: 'assistant',
            content: `✅ Task #${taskId} has been successfully assigned to ${assignee}. The changes will be reflected in Azure DevOps.`,
            timestamp: new Date()
          });
          
          // Refresh task data to reflect the changes
          this.loadTaskStatusBoard();
        },
        error: (err) => {
          // Remove the thinking message
          this.chatMessages.pop();
          
          console.error('Error assigning task:', err);
          // Add error message
          this.chatMessages.push({
            role: 'assistant',
            content: `❌ Sorry, I couldn't assign task #${taskId} to ${assignee}. ${err.error?.message || 'Please check if the task ID and assignee name are correct.'}`,
            timestamp: new Date()
          });
        }
      });
    } else if (lookupTaskMatch) {
      // This is a task lookup command
      const taskId = parseInt(lookupTaskMatch[1]);
      
      // Show thinking message
      this.chatMessages.push({
        role: 'assistant',
        content: `Looking up task #${taskId}...`,
        timestamp: new Date()
      });
      
      // Get task details
      this.azureDevOpsService.getWorkItemById(taskId).subscribe({
        next: (task: any) => {
          // Remove the thinking message
          this.chatMessages.pop();
          
          if (task) {
            // Format task details as a response
            const statusClass = task.state ? 
              (task.state.toLowerCase().includes('active') ? 'text-primary' : 
               task.state.toLowerCase().includes('new') ? 'text-success' : 
               task.state.toLowerCase().includes('closed') ? 'text-secondary' : 'text-info') : 'text-info';
              
            const formattedMessage = `
              <div class="task-details p-2 border rounded">
                <h5>Task #${task.id}: ${task.title}</h5>
                <ul class="list-unstyled mb-0">
                  <li><strong>Status:</strong> <span class="${statusClass}">${task.state || 'Unknown'}</span></li>
                  <li><strong>Assigned to:</strong> ${task.assignedTo || 'Unassigned'}</li>
                  <li><strong>Iteration:</strong> ${this.decodeIterationPath(task.iterationPath)}</li>
                  ${task.type ? `<li><strong>Type:</strong> ${task.type}</li>` : ''}
                </ul>
                <div class="mt-2">
                  <small>You can assign this task by typing: "Assign task #${task.id} to [name]"</small>
                </div>
              </div>
            `;
            
            // Add task details response
            this.chatMessages.push({
              role: 'assistant',
              content: formattedMessage,
              timestamp: new Date()
            });
          } else {
            // Task not found
            this.chatMessages.push({
              role: 'assistant',
              content: `❌ I couldn't find task #${taskId}. Please check if the ID is correct.`,
              timestamp: new Date()
            });
          }
        },
        error: (err: any) => {
          // Remove the thinking message
          this.chatMessages.pop();
          
          console.error('Error looking up task:', err);
          // Add error message
          this.chatMessages.push({
            role: 'assistant',
            content: `❌ Sorry, I couldn't find information for task #${taskId}. ${err.error?.message || 'Please check if the task ID is correct.'}`,
            timestamp: new Date()
          });
        }
      });
    } else if (mostTasksMatch) {
      // Handle "who has the most tasks" query locally
      this.chatMessages.push({
        role: 'assistant',
        content: 'Analyzing task distribution...',
        timestamp: new Date()
      });
      
      const assigneeDistribution = this.getAssigneeDistribution();
      if (assigneeDistribution && assigneeDistribution.length > 0) {
        // Find member with the most tasks
        const mostTasksMember = assigneeDistribution[0]; // Already sorted by task count in getAssigneeDistribution()
        
        // Remove the thinking message
        this.chatMessages.pop();
        
        // Create formatted response with task distribution
        let formattedResponse = `<p><strong>${mostTasksMember.name}</strong> has the most assigned tasks (${mostTasksMember.count}).</p>`;
        
        // Add a small table showing distribution
        formattedResponse += `
          <div class="mt-2 small">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Task Count</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        // Add rows for top 5 members
        assigneeDistribution.slice(0, 5).forEach(member => {
          formattedResponse += `
            <tr>
              <td>${member.name}</td>
              <td>${member.count}</td>
            </tr>
          `;
        });
        
        formattedResponse += `
              </tbody>
            </table>
          </div>
        `;
        
        this.chatMessages.push({
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date()
        });
      } else {
        // No assignee data available
        this.chatMessages.pop();
        this.chatMessages.push({
          role: 'assistant',
          content: 'I couldn\'t determine who has the most tasks. There may be no tasks assigned yet.',
          timestamp: new Date()
        });
      }
    } else if (taskDistributionMatch) {
      // Handle task distribution query locally
      this.chatMessages.push({
        role: 'assistant',
        content: 'Analyzing task distribution...',
        timestamp: new Date()
      });
      
      if (this.tasksByStatus && this.tasksByStatus.length > 0) {
        // Remove the thinking message
        this.chatMessages.pop();
        
        // Create formatted response with task distribution
        let formattedResponse = `<p>Current task distribution in ${this.decodeIterationPath(this.selectedIterationPath)}:</p>`;
        
        // Add a small table showing distribution
        formattedResponse += `
          <div class="mt-2">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        // Add rows for all statuses
        this.tasksByStatus.forEach(status => {
          const statusClass = this.getStatusColor(status.status);
          formattedResponse += `
            <tr>
              <td><span class="badge" style="background-color: ${statusClass};">${status.status}</span></td>
              <td>${status.count}</td>
            </tr>
          `;
        });
        
        formattedResponse += `
              </tbody>
            </table>
          </div>
        `;
        
        this.chatMessages.push({
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date()
        });
      } else {
        // No status data available
        this.chatMessages.pop();
        this.chatMessages.push({
          role: 'assistant',
          content: 'I couldn\'t retrieve the task distribution information. Please try again later.',
          timestamp: new Date()
        });
      }
    } else if (sprintStatusMatch) {
      // Handle sprint status query locally
      this.chatMessages.push({
        role: 'assistant',
        content: 'Retrieving sprint information...',
        timestamp: new Date()
      });
      
      if (this.sprintSummary) {
        // Remove the thinking message
        this.chatMessages.pop();
        
        const completionPercentage = this.calculateCompletionPercentage();
        
        // Create formatted response with sprint information
        let formattedResponse = `
          <div class="sprint-summary p-2 border rounded">
            <h5>${this.decodeIterationPath(this.selectedIterationPath)}</h5>
            <div class="row">
              <div class="col-md-6">
                <ul class="list-unstyled mb-0">
                  <li><strong>Total Tasks:</strong> ${this.sprintSummary.totalTasks}</li>
                  <li><strong>Completed Tasks:</strong> ${this.sprintSummary.completed}</li>
                  <li><strong>In Progress:</strong> ${this.sprintSummary.inProgress}</li>
                  <li><strong>Completion:</strong> ${this.sprintSummary.completionPercentage.toFixed(1)}%</li>
                </ul>
              </div>
              <div class="col-md-6">
                <div class="progress mb-2" style="height: 20px;">
                  <div class="progress-bar" role="progressbar" 
                       style="width: ${completionPercentage}%;" 
                       aria-valuenow="${completionPercentage}" 
                       aria-valuemin="0" 
                       aria-valuemax="100">
                    ${completionPercentage}%
                  </div>
                </div>
                <p class="small text-muted text-center">Sprint Progress</p>
              </div>
            </div>
          </div>
        `;
        
        this.chatMessages.push({
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date()
        });
      } else {
        // No sprint data available
        this.chatMessages.pop();
        this.chatMessages.push({
          role: 'assistant',
          content: 'I couldn\'t retrieve the sprint information. Please try again later.',
          timestamp: new Date()
        });
      }
    } else if (dashboardMatch) {
      // Handle dashboard queries
      this.chatMessages.push({
        role: 'assistant',
        content: 'Retrieving dashboard information...',
        timestamp: new Date()
      });
      
      if (this.sprintSummary) {
        // Remove the thinking message
        this.chatMessages.pop();
        
        const completionPercentage = this.calculateCompletionPercentage();
        
        // Create formatted response with sprint information
        let formattedResponse = `
          <div class="sprint-summary p-2 border rounded">
            <h5>${this.decodeIterationPath(this.selectedIterationPath)}</h5>
            <div class="row">
              <div class="col-md-6">
                <ul class="list-unstyled mb-0">
                  <li><strong>Total Tasks:</strong> ${this.sprintSummary.totalTasks}</li>
                  <li><strong>Completed Tasks:</strong> ${this.sprintSummary.completed}</li>
                  <li><strong>In Progress:</strong> ${this.sprintSummary.inProgress}</li>
                  <li><strong>Completion:</strong> ${this.sprintSummary.completionPercentage.toFixed(1)}%</li>
                </ul>
              </div>
              <div class="col-md-6">
                <div class="progress mb-2" style="height: 20px;">
                  <div class="progress-bar" role="progressbar" 
                       style="width: ${completionPercentage}%;" 
                       aria-valuenow="${completionPercentage}" 
                       aria-valuemin="0" 
                       aria-valuemax="100">
                    ${completionPercentage}%
                  </div>
                </div>
                <p class="small text-muted text-center">Sprint Progress</p>
              </div>
            </div>
          </div>
        `;
        
        this.chatMessages.push({
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date()
        });
      } else {
        // No sprint data available
        this.chatMessages.pop();
        this.chatMessages.push({
          role: 'assistant',
          content: 'I couldn\'t retrieve the dashboard information. Please try again later.',
          timestamp: new Date()
        });
      }
    } else if (taskStatusMatch) {
      // Handle task status distribution queries
      this.chatMessages.push({
        role: 'assistant',
        content: 'Analyzing task status distribution...',
        timestamp: new Date()
      });
      
      if (this.tasksByStatus && this.tasksByStatus.length > 0) {
        // Remove the thinking message
        this.chatMessages.pop();
        
        // Create formatted response with task status distribution
        let formattedResponse = `<p>Current task status distribution in ${this.decodeIterationPath(this.selectedIterationPath)}:</p>`;
        
        // Add a small table showing distribution
        formattedResponse += `
          <div class="mt-2">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        // Add rows for all statuses
        this.tasksByStatus.forEach(status => {
          const statusClass = this.getStatusColor(status.status);
          formattedResponse += `
            <tr>
              <td><span class="badge" style="background-color: ${statusClass};">${status.status}</span></td>
              <td>${status.count}</td>
            </tr>
          `;
        });
        
        formattedResponse += `
              </tbody>
            </table>
          </div>
        `;
        
        this.chatMessages.push({
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date()
        });
      } else {
        // No status data available
        this.chatMessages.pop();
        this.chatMessages.push({
          role: 'assistant',
          content: 'I couldn\'t retrieve the task status distribution information. Please try again later.',
          timestamp: new Date()
        });
      }
    } else if (workItemTypeMatch) {
      // Handle work item type queries
      this.chatMessages.push({
        role: 'assistant',
        content: 'Analyzing work item type distribution...',
        timestamp: new Date()
      });
      
      if (this.tasksByType && this.tasksByType.length > 0) {
        // Remove the thinking message
        this.chatMessages.pop();
        
        // Create formatted response with work item type distribution
        let formattedResponse = `<p>Current work item type distribution in ${this.decodeIterationPath(this.selectedIterationPath)}:</p>`;
        
        // Add a small table showing distribution
        formattedResponse += `
          <div class="mt-2">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        // Add rows for all types
        this.tasksByType.forEach(type => {
          formattedResponse += `
            <tr>
              <td><span class="badge" style="background-color: ${type.color};">${type.type}</span></td>
              <td>${type.count}</td>
            </tr>
          `;
        });
        
        formattedResponse += `
              </tbody>
            </table>
          </div>
        `;
        
        this.chatMessages.push({
          role: 'assistant',
          content: formattedResponse,
          timestamp: new Date()
        });
      } else {
        // No type data available
        this.chatMessages.pop();
        this.chatMessages.push({
          role: 'assistant',
          content: 'I couldn\'t retrieve the work item type distribution information. Please try again later.',
          timestamp: new Date()
        });
      }
    } else if (specificTasksMatch) {
      // Handle tasks with specific status in specific iteration
      const status = specificTasksMatch[1];
      const iteration = specificTasksMatch[2];
      
      this.chatMessages.push({
        role: 'assistant',
        content: `Retrieving ${status} tasks in ${iteration}...`,
        timestamp: new Date()
      });
      
      this.dashboardService.getTasksByStatusInIteration(status, iteration)
        .subscribe({
          next: (tasks: any[]) => {
            this.chatMessages.pop();
            
            if (tasks && tasks.length > 0) {
              let formattedResponse = `<p>Found ${tasks.length} tasks with status "${status}" in iteration "${iteration}":</p>`;
              formattedResponse += `<ul class="list-group">`;
              tasks.forEach((task: any) => {
                formattedResponse += `
                  <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <strong>#${task.id}</strong>: ${task.title}
                      ${task.assignedTo ? `<div class="small text-muted">Assigned to: ${task.assignedTo}</div>` : ''}
                    </div>
                    <span class="badge" style="background-color: ${this.getStatusColor(task.status || '')};">${task.status || 'Unknown'}</span>
                  </li>
                `;
              });
              formattedResponse += `</ul>`;
              
              this.chatMessages.push({
                role: 'assistant',
                content: formattedResponse,
                timestamp: new Date()
              });
            } else {
              this.chatMessages.push({
                role: 'assistant',
                content: `No tasks found with status "${status}" in iteration "${iteration}".`,
                timestamp: new Date()
              });
            }
          },
          error: (err: any) => {
            this.chatMessages.pop();
            console.error('Error retrieving tasks:', err);
            this.chatMessages.push({
              role: 'assistant',
              content: 'Sorry, I encountered an error retrieving the tasks. Please try again later.',
              timestamp: new Date()
            });
          }
        });
    } else if (directMatch && handleStatusCountQuery(message)) {
      // Successfully handled by the specialized function
    } else if (noOfStatusMatch && handleStatusCountQuery(message)) {
      // Successfully handled by the specialized function
    } else if (simpleStatusMatch) {
      // Handle simple status name questions
      const statusName = simpleStatusMatch[1];
      
      this.chatMessages.push({
        role: 'assistant',
        content: `Retrieving information about the status "${statusName}" in ${this.decodeIterationPath(this.selectedIterationPath)}...`,
        timestamp: new Date()
      });
      
      this.dashboardService.getTasksByStatusInIteration(statusName, this.selectedIterationPath)
        .subscribe({
          next: (tasks: any[]) => {
            this.chatMessages.pop();
            
            if (tasks && tasks.length > 0) {
              const count = tasks.length;
              let formattedResponse = `<p>Found ${count} tasks with status "${statusName}" in iteration "${this.selectedIterationPath}":</p>`;
              
              this.chatMessages.push({
                role: 'assistant',
                content: formattedResponse,
                timestamp: new Date()
              });
            } else {
              this.chatMessages.push({
                role: 'assistant',
                content: `No tasks found with status "${statusName}" in iteration "${this.selectedIterationPath}".`,
                timestamp: new Date()
              });
            }
          },
          error: (err: any) => {
            this.chatMessages.pop();
            console.error('Error retrieving status information:', err);
            this.chatMessages.push({
              role: 'assistant',
              content: 'Sorry, I encountered an error retrieving the status information. Please try again later.',
              timestamp: new Date()
            });
          }
        });
    } else if (statusCardMatch) {
      // Handle status card questions
      this.chatMessages.push({
        role: 'assistant',
        content: 'Retrieving status card information...',
        timestamp: new Date()
      });
      
      // Call API to get response for status card questions
      this.dashboardService.getDashboardCardInformation(this.selectedIterationPath)
        .subscribe({
          next: (response: {message: string}) => {
            this.chatMessages.pop();
            
            // Add the actual response
            const assistantMessage: ChatMessage = {
              role: 'assistant',
              content: response.message,
              timestamp: new Date()
            };
            this.chatMessages.push(assistantMessage);
          },
          error: (err: any) => {
            this.chatMessages.pop();
            
            console.error('Error getting status card response:', err);
            // Add fallback response
            const fallbackMessage: ChatMessage = {
              role: 'assistant',
              content: 'Sorry, I encountered an error retrieving the status card information. Please try again later.',
              timestamp: new Date()
            };
            this.chatMessages.push(fallbackMessage);
          }
        });
    } else {
      // Show loading indicator for regular chat messages
      this.chatMessages.push({
        role: 'assistant',
        content: 'Thinking...',
        timestamp: new Date()
      });
      
      // Call API to get response for regular chat messages
      this.dashboardService.sendChatMessage({
        message: message,
        currentIterationPath: this.selectedIterationPath
      }).subscribe({
        next: (response) => {
          // Remove the loading indicator
          this.chatMessages.pop();
          
          // Add the actual response
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response.message,
            timestamp: new Date()
          };
          this.chatMessages.push(assistantMessage);
        },
        error: (err) => {
          // Remove the loading indicator
          this.chatMessages.pop();
          
          console.error('Error getting chat response:', err);
          // Add fallback response
          const fallbackMessage: ChatMessage = {
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request. Please try again later.',
            timestamp: new Date()
          };
          this.chatMessages.push(fallbackMessage);
        }
      });
    }
  }

  /**
   * Load work items from Azure DevOps for the selected iteration using WIQL API
   */
  loadAzureDevOpsWorkItemsWithWiql(): void {
    this.loadingAzureDevOps = true;
    this.azureDevOpsError = '';
    
    this.azureDevOpsService.getWorkItemsByWiql(this.selectedIterationPath)
      .pipe(
        finalize(() => {
          this.loadingAzureDevOps = false;
        })
      )
      .subscribe({
        next: (dashboardStats) => {
          // Store the work item counts
          this.workItemCounts = {
            totalTasks: dashboardStats.totalTasks,
            devNew: dashboardStats.devNew,
            inProgress: dashboardStats.inProgress,
            codeReview: dashboardStats.codeReview,
            devComplete: dashboardStats.devComplete,
            completed: dashboardStats.completed,
            blocked: dashboardStats.blocked
          };
          
          // Store the work items if available
          if (dashboardStats.workItems) {
            this.azureDevOpsWorkItems = dashboardStats.workItems;
          }
          
          // Store assignee distribution data
          if (dashboardStats.statsByAssignee) {
            this.assigneeDistribution = dashboardStats.statsByAssignee;
          }
          
          // Update the summary data with the Azure DevOps counts
          this.updateSummaryWithAzureDevOpsCounts();
          
          // Update pie chart
          setTimeout(() => {
            this.initializeStatusPieChart();
          }, 100);
        },
        error: (error) => {
          console.error('Error loading Azure DevOps work items with WIQL:', error);
          this.azureDevOpsError = 'Failed to load Azure DevOps work items. Please try again.';
          
          // Fall back to the legacy method if WIQL fails
          this.loadAzureDevOpsWorkItems();
        }
      });
  }
  
  /**
   * Load work items from Azure DevOps for the selected iteration
   */
  loadAzureDevOpsWorkItems(): void {
    this.loadingAzureDevOps = true;
    this.azureDevOpsError = '';
    
    // First try to get the status counts directly from the backend proxy
    this.azureDevOpsService.getWorkItemStatusCounts(this.selectedIterationPath)
      .pipe(
        catchError(error => {
          console.error('Error loading status counts, falling back to work items:', error);
          // Fall back to getting work items and counting them
          return this.azureDevOpsService.getWorkItemsByIteration(this.selectedIterationPath)
            .pipe(
              map(workItems => {
                // Process the work items to get counts
                return this.azureDevOpsService.getWorkItemCounts(workItems);
              }),
              catchError(err => {
                this.azureDevOpsError = 'Failed to load Azure DevOps work items. Please try again.';
                console.error('Error loading Azure DevOps work items:', err);
                return of({
                  totalTasks: 0,
                  devNew: 0,
                  inProgress: 0,
                  codeReview: 0,
                  devComplete: 0,
                  completed: 0,
                  blocked: 0
                });
              })
            );
        }),
        finalize(() => {
          this.loadingAzureDevOps = false;
        })
      )
      .subscribe(counts => {
        // Store the counts
        this.workItemCounts = counts;
        
        // Also store the work items if available
        if (Array.isArray(counts.workItems)) {
          this.azureDevOpsWorkItems = counts.workItems;
        }
        
        // Update the summary data with the Azure DevOps counts
        this.updateSummaryWithAzureDevOpsCounts();
      });
  }
  
  /**
   * Update summary data with the counts from Azure DevOps
   */
  updateSummaryWithAzureDevOpsCounts(): void {
    console.log('Updating summary with Azure DevOps counts:', this.workItemCounts);
    
    // Always create a new summary object with the latest counts to ensure reactivity
    this.sprintSummary = {
      totalTasks: this.workItemCounts.totalTasks || 0,
      inProgress: this.workItemCounts.inProgress || 0,
      completed: this.workItemCounts.completed || 0,
      blocked: this.workItemCounts.blocked || 0,
      completionPercentage: this.calculateCompletionPercentage()
    };
    
    // Also update task status board with Azure DevOps data
    this.updateTaskStatusBoardWithAzureDevOpsCounts();
    
    // Create tasksByStatus data for the pie chart
    if (this.azureDevOpsWorkItems && this.azureDevOpsWorkItems.length > 0) {
      // Group work items by state
      const stateGroups = this.azureDevOpsWorkItems.reduce((acc, item) => {
        const state = item.state || 'Unknown';
        if (!acc[state]) {
          acc[state] = [];
        }
        acc[state].push(item);
        return acc;
      }, {});
      
      // Convert to tasksByStatus format
      this.tasksByStatus = Object.keys(stateGroups).map(state => ({
        status: state,
        count: stateGroups[state].length,
        color: this.getStatusColor(state)
      })).sort((a, b) => b.count - a.count);
      
      // Also update taskStatusBoard for compatibility
      this.taskStatusBoard = [...this.tasksByStatus];
    }
  }
  
  /**
   * Calculate completion percentage based on work item counts
   */
  calculateCompletionPercentage(): number {
    const total = this.workItemCounts.totalTasks;
    if (total === 0) return 0;
    
    const completed = this.workItemCounts.completed;
    return Math.round((completed / total) * 100);
  }
  
  /**
   * Update task status board with counts from Azure DevOps
   * This method is now only used for compatibility with other parts of the code
   */
  updateTaskStatusBoardWithAzureDevOpsCounts(): void {
    // Update task status board with the latest data
    this.loadTaskStatusBoard();
  }
  
  /**
   * Get assignee data as an array for display in the UI
   * @returns Array of assignee data with counts
   */
  getAssigneeDistribution(): any[] {
    if (!this.assigneeDistribution) {
      return [];
    }
    
    return Object.keys(this.assigneeDistribution).map(assignee => {
      return {
        name: assignee,
        ...this.assigneeDistribution[assignee]
      };
    });
  }

  // Get total work items for percentage calculation
  getTotalWorkItems(): number {
    return this.tasksByType.reduce((total, item) => total + item.count, 0);
  }

  /**
   * Show tasks for a specific status in a modal
   * @param status The status to show tasks for
   */
  showTasksForStatus(status: string): void {
    this.selectedStatus = status;
    this.loadingStatusTasks = true;
    this.statusTasks = [];
    
    // Show the modal first, then load the data
    if (this.taskDetailsModal) {
      this.taskDetailsModal.show();
    }
    
    // Define the API URL
    const encodedPath = encodeURIComponent(this.selectedIterationPath).replace(/%5C/g, '%255C');
    const url = `http://localhost:5000/api/tasks?iterationPath=${encodedPath}`;
    
    this.http.get<any[]>(url)
      .pipe(
        finalize(() => {
          this.loadingStatusTasks = false;
        })
      )
      .subscribe({
        next: (workItems) => {
          if (workItems && workItems.length > 0) {
            // Filter the work items by the selected status
            this.statusTasks = workItems.filter(item => 
              item.status === status || 
              (status === 'Dev In progress' && 
               (item.status === 'Dev In Progress' || 
                (item.status.toLowerCase().includes('dev') && 
                 item.status.toLowerCase().includes('progress'))))
            );
          } else {
            this.statusTasks = [];
          }
        },
        error: (err) => {
          console.error('Error loading tasks for status:', err);
          this.statusTasks = [];
        }
      });
  }
  
  /**
   * Get URL for a task to link to Azure DevOps
   * @param taskId The task ID
   * @returns URL string for the task
   */
  getTaskUrl(taskId: number): string {
    return `${environment.azureDevOpsUrl}/${environment.organization}/${environment.project}/_workitems/edit/${taskId}`;
  }

  /**
   * Directly handle "number of X tasks" queries with a string parsing approach
   * @param message The user message
   */
  handleStatusCountQueryDirect(message: string): void {
    let queryTerm = '';
    let iterationPath = this.selectedIterationPath;
    
    // Remove "number of" or "no of" prefix
    let remainder = '';
    if (message.toLowerCase().startsWith('number of ')) {
      remainder = message.substring('number of '.length);
    } else if (message.toLowerCase().startsWith('no of ')) {
      remainder = message.substring('no of '.length);
    }
    
    // Check if there's an iteration path specified
    const inIndex = remainder.toLowerCase().lastIndexOf(' in ');
    const underIndex = remainder.toLowerCase().lastIndexOf(' under ');
    const withinIndex = remainder.toLowerCase().lastIndexOf(' within ');
    const forIndex = remainder.toLowerCase().lastIndexOf(' for ');
    
    let splitIndex = -1;
    if (inIndex > 0) splitIndex = inIndex;
    if (underIndex > 0 && (splitIndex < 0 || underIndex < splitIndex)) splitIndex = underIndex;
    if (withinIndex > 0 && (splitIndex < 0 || withinIndex < splitIndex)) splitIndex = withinIndex;
    if (forIndex > 0 && (splitIndex < 0 || forIndex < splitIndex)) splitIndex = forIndex;
    
    if (splitIndex > 0) {
      // Extract iteration path
      iterationPath = remainder.substring(splitIndex + 4).trim(); // +4 to skip " in ", " for ", etc.
      
      // Extract query term
      queryTerm = remainder.substring(0, splitIndex).trim();
    } else {
      // No iteration path, just extract query term
      queryTerm = remainder.trim();
    }
    
    // Remove " tasks" or " items" suffix from query term if present
    queryTerm = queryTerm.replace(/\s+(?:tasks|work items|items)$/i, '').trim();
    
    console.log(`Extracted term: "${queryTerm}", iteration: "${iterationPath}"`);
    
    // Determine if this is a type query or a status query
    const knownTypes = ['bug', 'task', 'user story', 'requirement', 'change request', 'code merge'];
    const isTypeQuery = knownTypes.includes(queryTerm.toLowerCase());
    
    // Special handling for known statuses to ensure correct casing
    let normalizedValue = queryTerm;
    if (!isTypeQuery) {
      if (queryTerm.toLowerCase() === 'cs-new' || queryTerm.toLowerCase() === 'cs new') {
        normalizedValue = 'CS-New';
      } else if (queryTerm.toLowerCase() === 'dev-new' || queryTerm.toLowerCase() === 'dev new') {
        normalizedValue = 'Dev-New';
      } else if (queryTerm.toLowerCase() === 'dev in progress') {
        normalizedValue = 'Dev In progress';
      } else if (queryTerm.toLowerCase() === 'code review') {
        normalizedValue = 'Code Review';
      } else if (queryTerm.toLowerCase() === 'planned') {
        normalizedValue = 'Planned';
      } else if (queryTerm.toLowerCase() === 'active') {
        normalizedValue = 'Active';
      }
    } else {
      // Capitalize the first letter of each word in the type
      normalizedValue = queryTerm.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // Show loading message
    this.chatMessages.push({
      role: 'assistant',
      content: `Retrieving the count of ${normalizedValue} ${isTypeQuery ? 'work items' : 'tasks'} in ${iterationPath}...`,
      timestamp: new Date()
    });
    
    // Define direct API URL instead of using the service that might be filtering incorrectly
    const encodedPath = encodeURIComponent(iterationPath).replace(/%5C/g, '%255C');
    const url = `http://localhost:5000/api/tasks?iterationPath=${encodedPath}`;
    
    // Get all tasks for the iteration and filter by status directly
    this.http.get<any[]>(url)
      .subscribe({
        next: (tasks: any[]) => {
          this.chatMessages.pop(); // Remove loading message
          
          if (tasks && tasks.length > 0) {
            // Filter tasks based on whether it's a type or status query
            const matchingTasks = tasks.filter((task: any) => {
              if (isTypeQuery) {
                const taskType = task.type || '';
                return taskType.toLowerCase() === normalizedValue.toLowerCase();
              } else {
                const taskStatus = task.status || '';
                return taskStatus.toLowerCase() === normalizedValue.toLowerCase();
              }
            });
            
            const count = matchingTasks.length;
            
            if (count > 0) {
              let formattedResponse = `<p>Found ${count} ${isTypeQuery ? normalizedValue : ''} ${isTypeQuery ? 'work items' : `tasks with status "${normalizedValue}"`} in iteration "${iterationPath}".</p>`;
              
              this.chatMessages.push({
                role: 'assistant',
                content: formattedResponse,
                timestamp: new Date()
              });
            } else {
              this.chatMessages.push({
                role: 'assistant', 
                content: isTypeQuery 
                  ? `No work items found with type "${normalizedValue}" in iteration "${iterationPath}".`
                  : `No tasks found with status "${normalizedValue}" in iteration "${iterationPath}".`,
                timestamp: new Date()
              });
            }
          } else {
            this.chatMessages.push({
              role: 'assistant', 
              content: `No tasks found in iteration "${iterationPath}".`,
              timestamp: new Date()
            });
          }
        },
        error: (err: any) => {
          this.chatMessages.pop();
          console.error('Error retrieving task count:', err);
          this.chatMessages.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error retrieving the task count. Please try again later.',
            timestamp: new Date()
          });
        }
      });
  }
} 