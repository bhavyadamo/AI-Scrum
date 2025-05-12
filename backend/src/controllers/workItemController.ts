import { Request, Response } from 'express';
import { AzureDevOpsService, WorkItemQuery, TeamMemberResponse } from '../services/azureDevOpsService';

export class WorkItemController {
  private azureDevOpsService: AzureDevOpsService;

  constructor() {
    this.azureDevOpsService = new AzureDevOpsService();
  }

  /**
   * Get work items by iteration path and date range
   */
  public async getWorkItems(req: Request, res: Response): Promise<void> {
    try {
      const { iterationPath, fromDate, toDate } = req.query;

      console.log('Query parameters:', req.query);
      console.log('Iteration path:', iterationPath);

      if (!iterationPath) {
        res.status(400).json({ error: 'Iteration path is required' });
        return;
      }

      // Validate iterationPath is a string
      if (typeof iterationPath !== 'string') {
        res.status(400).json({ error: 'Iteration path must be a string' });
        return;
      }

      const query: WorkItemQuery = {
        iterationPath: iterationPath,
        fromDate: fromDate as string | undefined,
        toDate: toDate as string | undefined
      };

      console.log('Work item query:', query);

      try {
        const workItems = await this.azureDevOpsService.queryWorkItems(query);
        
        // Add auto-assign suggestions for demo purposes if needed
        const workItemsWithSuggestions = workItems.map(item => ({
          ...item,
          autoAssignSuggestion: this.getRandomTeamMember()
        }));
        
        res.status(200).json(workItemsWithSuggestions);
      } catch (azureError) {
        console.error('Error querying Azure DevOps, returning mock data:', azureError);
        
        // Return mock data for development purposes
        const mockWorkItems = [
          {
            id: 101,
            title: 'Implement login page',
            state: 'Active',
            status: 'In Progress',
            priority: 1,
            assignedTo: 'Jane Smith',
            iterationPath: iterationPath,
            type: 'User Story',
            autoAssignSuggestion: 'John Doe'
          },
          {
            id: 102,
            title: 'Fix navigation bug',
            state: 'New',
            status: 'To Do',
            priority: 2,
            assignedTo: null,
            iterationPath: iterationPath,
            type: 'Bug',
            autoAssignSuggestion: 'Alex Johnson'
          },
          {
            id: 103,
            title: 'Update documentation',
            state: 'Closed',
            status: 'Done',
            priority: 3,
            assignedTo: 'John Doe',
            iterationPath: iterationPath,
            type: 'Task',
            autoAssignSuggestion: 'Sam Wilson'
          },
          {
            id: 104,
            title: 'Refactor authentication service',
            state: 'Active',
            status: 'In Progress',
            priority: 1,
            assignedTo: 'Alex Johnson',
            iterationPath: iterationPath,
            type: 'Task',
            autoAssignSuggestion: 'Jane Smith'
          },
          {
            id: 105,
            title: 'Implement forgot password feature',
            state: 'New',
            status: 'To Do',
            priority: 2,
            assignedTo: null,
            iterationPath: iterationPath,
            type: 'User Story',
            autoAssignSuggestion: 'Sam Wilson'
          }
        ];
        
        res.status(200).json(mockWorkItems);
      }
    } catch (error: any) {
      console.error('Error in getWorkItems controller:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get work item by ID
   */
  public async getWorkItemById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid work item ID' });
        return;
      }

      const workItem = await this.azureDevOpsService.getWorkItemById(id);
      res.status(200).json(workItem);
    } catch (error: any) {
      console.error(`Error in getWorkItemById controller:`, error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get team members
   * Returns a list of team members from Azure DevOps or mock data if unavailable
   */
  public async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      // Get optional team name from query parameter
      const teamName = req.query.team as string | undefined;
      
      // Fetch team members from Azure DevOps
      const teamMembers = await this.azureDevOpsService.getTeamMembers(teamName);
      
      // Return success response
      res.status(200).json(teamMembers);
    } catch (error: any) {
      console.error('Error in getTeamMembers controller:', error.message);
      
      // Provide fallback data if Azure DevOps call fails
      const fallbackTeamMembers = [
        { 
          id: '1', 
          displayName: 'Jane Smith', 
          uniqueName: 'jane.smith@example.com',
          email: 'jane.smith@example.com',
          currentWorkload: 3,
          isActive: true 
        },
        { 
          id: '2', 
          displayName: 'John Doe', 
          uniqueName: 'john.doe@example.com',
          email: 'john.doe@example.com',
          currentWorkload: 5,
          isActive: true 
        },
        { 
          id: '3', 
          displayName: 'Sam Wilson', 
          uniqueName: 'sam.wilson@example.com',
          email: 'sam.wilson@example.com',
          currentWorkload: 2,
          isActive: true 
        },
        { 
          id: '4', 
          displayName: 'Alex Johnson', 
          uniqueName: 'alex.johnson@example.com',
          email: 'alex.johnson@example.com',
          currentWorkload: 4,
          isActive: true 
        }
      ];
      
      // For development only - return mock data even when error occurs
      // In production, you might want to return an error response instead
      res.status(200).json(fallbackTeamMembers);
      
      // Uncomment for production use:
      // res.status(500).json({ error: 'Failed to fetch team members', details: error.message });
    }
  }
  
  /**
   * Assign a task to a team member
   */
  public async assignTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId, assignedTo } = req.body;
      
      if (!taskId || !assignedTo) {
        res.status(400).json({ error: 'Task ID and assignee are required' });
        return;
      }
      
      // Call Azure DevOps to assign the task
      // For development, we'll just return a success response
      console.log(`Assigning task #${taskId} to ${assignedTo}`);
      
      // Implement actual assignment logic with Azure DevOps API when ready
      // await this.azureDevOpsService.assignWorkItem(taskId, assignedTo);
      
      res.status(200).json({ 
        success: true, 
        message: `Task #${taskId} assigned to ${assignedTo}`
      });
    } catch (error: any) {
      console.error('Error in assignTask controller:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * Auto-assign tasks based on team member workload
   */
  public async autoAssignTasks(req: Request, res: Response): Promise<void> {
    try {
      const { iterationPath } = req.body;
      
      if (!iterationPath) {
        res.status(400).json({ error: 'Iteration path is required' });
        return;
      }
      
      console.log(`Auto-assigning tasks for iteration: ${iterationPath}`);
      
      // Implement actual auto-assignment logic with Azure DevOps API when ready
      // In a real implementation, we would:
      // 1. Get all unassigned tasks for the iteration
      // 2. Get team members and their current workloads
      // 3. Distribute tasks based on workload and other factors
      // 4. Update tasks in Azure DevOps
      
      // For development, just return a success response
      res.status(200).json({ 
        success: true, 
        message: `Tasks auto-assigned for iteration ${iterationPath}`
      });
    } catch (error: any) {
      console.error('Error in autoAssignTasks controller:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * Get auto-assignment suggestions for tasks
   */
  public async getAutoAssignSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { iterationPath } = req.query;
      
      if (!iterationPath) {
        res.status(400).json({ error: 'Iteration path is required' });
        return;
      }
      
      // For development, return dummy suggestions
      // In a real implementation, we would use a sophisticated algorithm
      const suggestions: Record<string, string> = {
        '101': 'Jane Smith',
        '102': 'John Doe',
        '103': 'Sam Wilson',
        '104': 'Alex Johnson',
      };
      
      res.status(200).json(suggestions);
    } catch (error: any) {
      console.error('Error in getAutoAssignSuggestions controller:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * Helper method to get a random team member name for auto-assign suggestions
   */
  private getRandomTeamMember(): string {
    const members = ['Jane Smith', 'John Doe', 'Sam Wilson', 'Alex Johnson'];
    return members[Math.floor(Math.random() * members.length)];
  }
} 