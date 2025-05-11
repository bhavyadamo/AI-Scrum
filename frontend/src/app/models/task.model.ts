export interface WorkItem {
  id: number;
  title: string;
  priority: string;
  assignedTo: string;
  status: string;
  type: string;
  iterationPath: string;
  autoAssignSuggestion?: string;
}

export interface WorkItemDetails extends WorkItem {
  description: string;
  createdDate: string;
  createdBy: string;
  relatedWorkItems: number[];
  tags: string[];
  estimatedHours?: number;
  remainingHours?: number;
  completedHours?: number;
}

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  currentWorkload: number;
  isActive: boolean;
} 