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
  
  // Timing data for historical analysis
  actualHours?: number;         // Total actual hours spent
  developmentHours?: number;    // Development time
  testingHours?: number;        // Testing time
  startDate?: string;           // When work began
  completionDate?: string;      // When work was completed
  originalEstimate?: number;    // The original estimate
  remainingWork?: number;       // Remaining work if in progress
  estimationAccuracy?: number;  // Ratio of actual to estimated time
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
  email: string;
  currentWorkload: number;
  isActive: boolean;
  imageUrl?: string;
  team?: string;
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

// For historical work items with complete timing data
export interface WorkItemHistory extends WorkItem {
  completionState: string;      // The state when completed (Done, Closed, etc.)
  lifecycleTime: number;        // Total time from creation to completion
  cycleTime: number;            // Time from active to completion
  stateChanges: StateChange[];  // State transition history
  revisions: WorkItemRevision[]; // Revision history
}

// For tracking state changes in work item history
export interface StateChange {
  fromState: string;
  toState: string;
  changedDate: string;
  changedBy: string;
  durationInState: number;      // Hours spent in the previous state
}

// For tracking work item revisions
export interface WorkItemRevision {
  revisedDate: string;
  revisedBy: string;
  fields: {
    [key: string]: any;
  };
} 