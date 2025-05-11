export interface SprintOverview {
  sprintName: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  iterationPath: string;
}

export interface SprintSummary {
  totalTasks: number;
  inProgress: number;
  completed: number;
  blocked: number;
  completionPercentage: number;
}

export interface ActivityItem {
  id: number;
  type: string;
  title: string;
  user: string;
  timestamp: string;
  details: string;
}

export interface ActivityFeed {
  activities: ActivityItem[];
} 