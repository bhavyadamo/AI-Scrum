import { AzureDevOpsService } from '../services/azureDevOpsService';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  try {
    // Create an instance of the Azure DevOps service
    const azureDevOpsService = new AzureDevOpsService();

    // Example 1: Query work items by iteration path
    console.log('\n--- Example 1: Query work items by iteration path ---');
    const workItems = await azureDevOpsService.queryWorkItems({
      iterationPath: process.env.AZURE_DEVOPS_ITERATION_PATH || 'YourProject\\Sprint 1',
      fromDate: '2023-01-01',
      toDate: '2023-12-31'
    });

    console.log(`Found ${workItems.length} work items:`);
    workItems.forEach(item => {
      console.log(`- ${item.id}: ${item.title} (${item.state}) - Assigned to: ${item.assignedTo || 'Unassigned'}`);
    });

    // Example 2: Get a specific work item by ID
    if (workItems.length > 0) {
      console.log('\n--- Example 2: Get work item details ---');
      const firstItemId = workItems[0].id;
      const workItemDetails = await azureDevOpsService.getWorkItemById(firstItemId);
      
      console.log('Work Item Details:');
      console.log(`ID: ${workItemDetails.id}`);
      console.log(`Title: ${workItemDetails.title}`);
      console.log(`State: ${workItemDetails.state}`);
      console.log(`Priority: ${workItemDetails.priority}`);
      console.log(`Assigned To: ${workItemDetails.assignedTo || 'Unassigned'}`);
      console.log(`Iteration Path: ${workItemDetails.iterationPath}`);
      console.log(`Created Date: ${workItemDetails.createdDate}`);
      console.log(`Changed Date: ${workItemDetails.changedDate}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main();

/**
 * Expected output (with real data):
 * 
 * --- Example 1: Query work items by iteration path ---
 * Found 5 work items:
 * - 1001: Create login screen (Completed) - Assigned to: Jane Smith
 * - 1002: Implement user authentication (In Progress) - Assigned to: John Doe
 * - 1003: Design database schema (Completed) - Assigned to: Sam Wilson
 * - 1004: Create API endpoints (In Progress) - Assigned to: Jane Smith
 * - 1005: Implement dashboard UI (In Progress) - Assigned to: Alex Johnson
 * 
 * --- Example 2: Get work item details ---
 * Work Item Details:
 * ID: 1001
 * Title: Create login screen
 * State: Completed
 * Priority: 2
 * Assigned To: Jane Smith
 * Iteration Path: YourProject\Sprint 1
 * Created Date: 2023-01-15T08:30:45.123Z
 * Changed Date: 2023-01-20T14:25:10.456Z
 */ 