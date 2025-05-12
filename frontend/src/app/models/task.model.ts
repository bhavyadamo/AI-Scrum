/**
 * Base work item interface containing common properties
 */
export interface WorkItem {
  id: number;
  title: string;
  state: string;
  priority: number;
  assignedTo?: string;
  iterationPath: string;
  type?: string;
  status?: string;
  autoAssignSuggestion?: string;
}

/**
 * Extended interface for detailed work item information
 */
export interface WorkItemDetails extends WorkItem {
  description?: string;
  acceptanceCriteria?: string;
  createdDate?: string;
  changedDate?: string;
  effortHours?: number;
  remainingHours?: number;
  tags?: string[];
  attachments?: Attachment[];
  comments?: Comment[];
  activity?: ActivityLog[];
  relations?: WorkItemRelation[];
  fields?: Record<string, any>;
}

/**
 * Model for work item attachments
 */
export interface Attachment {
  id: string;
  name: string;
  url: string;
  createdBy?: string;
  createdDate?: string;
  fileSize?: number;
}

/**
 * Model for work item comments
 */
export interface Comment {
  id: string;
  text: string;
  author: string;
  createdDate: string;
}

/**
 * Model for activity/history log entries
 */
export interface ActivityLog {
  id: string;
  action: string;
  changedBy: string;
  changedDate: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Model for work item relationships (parent/child, related, etc.)
 */
export interface WorkItemRelation {
  id: number;
  url?: string;
  type: 'parent' | 'child' | 'related' | 'duplicate' | string;
  title?: string;
}

/**
 * Model for team members
 */
export interface TeamMember {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
  currentWorkload: number;
  isActive?: boolean;
  email?: string;
}

/**
 * Model for auto-assign suggestion results
 */
export interface AutoAssignResult {
  assignedItems: WorkItem[];
  unassignedItems: WorkItem[];
  errorItems?: WorkItem[];
}

/**
 * Enum of possible work item types
 * Update these to match the actual work item types in your Azure DevOps project
 */
export enum WorkItemType {
  UserStory = 'User Story',
  Task = 'Task',
  Bug = 'Bug',
  Epic = 'Epic',
  Feature = 'Feature',
  Issue = 'Issue'
}

/**
 * Enum of possible work item states
 * Update these to match the actual states in your Azure DevOps project
 */
export enum WorkItemState {
  New = 'New',
  Active = 'Active',
  InProgress = 'In Progress',
  Resolved = 'Resolved',
  Closed = 'Closed',
  Removed = 'Removed'
} 