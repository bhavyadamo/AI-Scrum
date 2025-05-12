import axios, { AxiosRequestConfig } from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface WorkItemQuery {
  iterationPath: string;
  fromDate?: string;
  toDate?: string;
}

export interface WorkItemResponse {
  id: number;
  title: string;
  priority: number;
  state: string;
  assignedTo?: string;
  iterationPath: string;
  createdDate: string;
  changedDate: string;
  [key: string]: any;
}

export interface TeamMemberResponse {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
  [key: string]: any;
}

export class AzureDevOpsService {
  private baseUrl: string;
  private organization: string;
  private project: string;
  private pat: string;
  private apiVersion: string;

  constructor(organization?: string, project?: string) {
    this.organization = organization || process.env.AZURE_DEVOPS_ORGANIZATION || 'inatech';
    this.project = project || process.env.AZURE_DEVOPS_PROJECT || '';
    this.pat = process.env.AZURE_DEVOPS_PAT || '';
    this.apiVersion = '7.0';
    this.baseUrl = `https://dev.azure.com/${this.organization}`;

    if (!this.pat) {
      throw new Error('Azure DevOps PAT token is required. Set AZURE_DEVOPS_PAT environment variable.');
    }

    if (!this.project) {
      throw new Error('Azure DevOps project name is required. Set AZURE_DEVOPS_PROJECT environment variable.');
    }
  }

  private getAuthHeader(): AxiosRequestConfig {
    // Create a base64 encoded string from a PAT token
    const token = Buffer.from(`:${this.pat}`).toString('base64');
    
    return {
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Create a WIQL query to fetch work items based on iteration path and date range
   */
  private buildWiqlQuery({ iterationPath, fromDate, toDate }: WorkItemQuery): string {
    let query = `SELECT [System.Id], [System.Title], [System.Priority], [System.State], [System.AssignedTo] 
                FROM WorkItems 
                WHERE [System.TeamProject] = '${this.project}' 
                AND [System.IterationPath] UNDER '${iterationPath}'`;
    
    if (fromDate) {
      query += ` AND [System.ChangedDate] >= '${fromDate}'`;
    }
    
    if (toDate) {
      query += ` AND [System.ChangedDate] <= '${toDate}'`;
    }
    
    query += ` ORDER BY [System.Id]`;
    
    return query;
  }

  /**
   * Query work items using WIQL
   */
  public async queryWorkItems(queryParams: WorkItemQuery): Promise<WorkItemResponse[]> {
    try {
      // Step 1: Build and execute WIQL query to get work item IDs
      const wiqlUrl = `${this.baseUrl}/${this.project}/_apis/wit/wiql?api-version=${this.apiVersion}`;
      const wiqlQuery = this.buildWiqlQuery(queryParams);
      
      const wiqlResponse = await axios.post(
        wiqlUrl, 
        { query: wiqlQuery },
        this.getAuthHeader()
      );
      
      const workItemRefs = wiqlResponse.data.workItems;
      
      if (!workItemRefs || workItemRefs.length === 0) {
        return [];
      }
      
      // Step 2: Get detailed work item information
      const workItemIds = workItemRefs.map((item: any) => item.id).join(',');
      const workItemsUrl = `${this.baseUrl}/${this.project}/_apis/wit/workitems?ids=${workItemIds}&$expand=all&api-version=${this.apiVersion}`;
      
      const workItemsResponse = await axios.get(workItemsUrl, this.getAuthHeader());
      
      // Step 3: Transform response to a cleaner format
      return workItemsResponse.data.value.map((item: any) => {
        const fields = item.fields;
        
        return {
          id: item.id,
          title: fields['System.Title'],
          priority: fields['Microsoft.VSTS.Common.Priority'],
          state: fields['System.State'],
          assignedTo: fields['System.AssignedTo']?.displayName,
          iterationPath: fields['System.IterationPath'],
          createdDate: fields['System.CreatedDate'],
          changedDate: fields['System.ChangedDate'],
          description: fields['System.Description'],
          effortHours: fields['Microsoft.VSTS.Scheduling.Effort'],
          tags: fields['System.Tags']
        };
      });
    } catch (error: any) {
      console.error('Error fetching work items from Azure DevOps:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      throw new Error(`Failed to fetch work items: ${error.message}`);
    }
  }

  /**
   * Get details of a specific work item by ID
   */
  public async getWorkItemById(id: number): Promise<WorkItemResponse> {
    try {
      const url = `${this.baseUrl}/${this.project}/_apis/wit/workitems/${id}?$expand=all&api-version=${this.apiVersion}`;
      
      const response = await axios.get(url, this.getAuthHeader());
      const item = response.data;
      const fields = item.fields;
      
      return {
        id: item.id,
        title: fields['System.Title'],
        priority: fields['Microsoft.VSTS.Common.Priority'],
        state: fields['System.State'],
        assignedTo: fields['System.AssignedTo']?.displayName,
        iterationPath: fields['System.IterationPath'],
        createdDate: fields['System.CreatedDate'],
        changedDate: fields['System.ChangedDate'],
        description: fields['System.Description'],
        effortHours: fields['Microsoft.VSTS.Scheduling.Effort'],
        tags: fields['System.Tags']
      };
    } catch (error: any) {
      console.error(`Error fetching work item #${id} from Azure DevOps:`, error.message);
      throw new Error(`Failed to fetch work item #${id}: ${error.message}`);
    }
  }

  /**
   * Get team members for the project
   */
  public async getTeamMembers(teamName?: string): Promise<TeamMemberResponse[]> {
    try {
      // If team name is not provided, use the default team
      const team = teamName || process.env.AZURE_DEVOPS_TEAM || '';
      const url = `${this.baseUrl}/${this.project}/_apis/teams/${team}/members?api-version=${this.apiVersion}`;
      
      const response = await axios.get(url, this.getAuthHeader());
      
      // Transform the response to a cleaner format
      return response.data.value.map((member: any) => ({
        id: member.id,
        displayName: member.displayName,
        uniqueName: member.uniqueName,
        imageUrl: member.imageUrl
      }));
    } catch (error: any) {
      console.error('Error fetching team members from Azure DevOps:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      
      // Return mock data for now
      return [
        { id: '1', displayName: 'Jane Smith', uniqueName: 'jane.smith@example.com' },
        { id: '2', displayName: 'John Doe', uniqueName: 'john.doe@example.com' },
        { id: '3', displayName: 'Sam Wilson', uniqueName: 'sam.wilson@example.com' },
        { id: '4', displayName: 'Alex Johnson', uniqueName: 'alex.johnson@example.com' }
      ];
    }
  }
} 