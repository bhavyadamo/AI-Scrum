import { AzureDevOpsService } from './services/azureDevOpsService';

// Set up credentials directly in script for testing
process.env.AZURE_DEVOPS_PAT = '20J15p0KHAe3YTHe4f11RV9oeBIAmDBJFrhqQR2EzM1VzS3z3fj7JQQJ99BEACAAAAAnbaCHAAASAZDO2Czy';
process.env.AZURE_DEVOPS_ORGANIZATION = 'inatech';
process.env.AZURE_DEVOPS_PROJECT = 'YourProjectName'; // Replace with your actual project name

async function fetchWorkItems() {
  try {
    console.log('Initializing Azure DevOps service...');
    const azureDevOpsService = new AzureDevOpsService();
    
    console.log('Fetching work items...');
    const workItems = await azureDevOpsService.queryWorkItems({
      iterationPath: 'YourProjectName\\Sprint 1', // Replace with your actual iteration path
      fromDate: '2023-01-01',
      toDate: '2023-12-31'
    });
    
    console.log(`Retrieved ${workItems.length} work items`);
    workItems.forEach(item => {
      console.log(`- #${item.id}: ${item.title} (${item.state}) - Assigned to: ${item.assignedTo || 'Unassigned'}`);
    });
    
    // If we found any work items, get details for the first one
    if (workItems.length > 0) {
      const itemId = workItems[0].id;
      console.log(`\nFetching details for work item #${itemId}...`);
      
      const details = await azureDevOpsService.getWorkItemById(itemId);
      console.log('Work Item Details:');
      console.log(JSON.stringify(details, null, 2));
    }
  } catch (error) {
    console.error('Error fetching work items:', error);
  }
}

// Run the script
fetchWorkItems(); 