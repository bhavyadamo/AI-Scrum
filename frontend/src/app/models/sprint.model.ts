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

export interface StateCount {
  state: string;
  count: number;
  color: string;
}

export interface WorkItemDistribution {
  iterationPath: string;
  states: StateCount[];
  totalCount: number;
}

export interface LongTermDevNewItem {
  id: number;
  title: string;
  daysInState: number;
  assignedTo: string | null;
  iterationPath: string;
}

export interface SupportItem {
  id: number;
  title: string;
  supportId: string;
  priority: number;
  createdDate: string;
  state: string;
}

export interface AiDashboardTip {
  tip: string;
  supportItems: SupportItem[];
  longTermDevNewItems: LongTermDevNewItem[];
}

export interface TaskStatusItem {
  status: string;
  count: number;
  color: string;
}

export interface TaskStatusBoard {
  items: TaskStatusItem[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatQuery {
  message: string;
  currentIterationPath: string;
}

export interface ChatResponse {
  message: string;
  success: boolean;
  data?: any;
} 