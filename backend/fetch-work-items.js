/**
 * Script to fetch work items from Azure DevOps Techoil project
 */

const axios = require('axios');

// Configuration
const PAT_TOKEN = '20J15p0KHAe3YTHe4f11RV9oeBIAmDBJFrhqQR2EzM1VzS3z3fj7JQQJ99BEACAAAAAnbaCHAAASAZDO2Czy';
const ORGANIZATION = 'inatech';
const PROJECT = 'Techoil'; // Using the project we found
const API_VERSION = '7.0';

// Authentication headers
function getAuthHeader() {
  const token = Buffer.from(`:${PAT_TOKEN}`).toString('base64');
  return {
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json'
    }
  };
}

// Build WIQL query
function buildWiqlQuery(iterationPath) {
  let query = `SELECT [System.Id], [System.Title], [System.Priority], [System.State], [System.AssignedTo] 
               FROM WorkItems 
               WHERE [System.TeamProject] = '${PROJECT}'`;
               
  if (iterationPath) {
    query += ` AND [System.IterationPath] UNDER '${iterationPath}'`;
  }
  
  query += ` ORDER BY [System.Id]`;
  
  return query;
}

// Fetch work items
async function fetchWorkItems(iterationPath) {
  try {
    console.log('Fetching work items from Azure DevOps...');
    console.log(`Organization: ${ORGANIZATION}`);
    console.log(`Project: ${PROJECT}`);
    if (iterationPath) {
      console.log(`Iteration Path: ${iterationPath}`);
    }
    
    // Step 1: Build the WIQL query URL
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const wiqlUrl = `${baseUrl}/${PROJECT}/_apis/wit/wiql?api-version=${API_VERSION}`;
    const wiqlQuery = buildWiqlQuery(iterationPath);
    
    console.log('\nExecuting WIQL query...');
    const wiqlResponse = await axios.post(
      wiqlUrl,
      { query: wiqlQuery },
      getAuthHeader()
    );
    
    const workItemRefs = wiqlResponse.data.workItems || [];
    console.log(`Found ${workItemRefs.length} work items`);
    
    if (workItemRefs.length === 0) {
      console.log('No work items found.');
      return;
    }
    
    // Step 2: Get detailed work item information
    const workItemIds = workItemRefs.map(item => item.id).join(',');
    const workItemsUrl = `${baseUrl}/${PROJECT}/_apis/wit/workitems?ids=${workItemIds}&$expand=all&api-version=${API_VERSION}`;
    
    console.log('Fetching work item details...');
    const workItemsResponse = await axios.get(workItemsUrl, getAuthHeader());
    
    // Step 3: Display results
    const workItems = workItemsResponse.data.value || [];
    
    console.log(`\n==== Work Items (${workItems.length}) ====`);
    workItems.forEach(item => {
      const fields = item.fields;
      console.log(`\nWork Item #${item.id}:`);
      console.log(`- Title: ${fields['System.Title'] || 'No Title'}`);
      console.log(`- Type: ${fields['System.WorkItemType'] || 'Unknown'}`);
      console.log(`- State: ${fields['System.State'] || 'Unknown'}`);
      console.log(`- Assigned To: ${fields['System.AssignedTo']?.displayName || 'Unassigned'}`);
      console.log(`- Iteration Path: ${fields['System.IterationPath'] || 'None'}`);
      if (fields['System.Description']) {
        console.log(`- Description: ${fields['System.Description'].substring(0, 100)}...`);
      }
    });
    
    console.log('\n==== Fetch Complete ====');
    
  } catch (error) {
    console.error('Error fetching work items:');
    if (error.response) {
      // Azure DevOps API returned an error
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      // Network error or other issue
      console.error(error.message);
    }
  }
}

// Fetch iteration paths
async function getIterationPaths() {
  try {
    console.log('Fetching iteration paths...');
    
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const iterationsUrl = `${baseUrl}/${PROJECT}/_apis/work/teamsettings/iterations?api-version=${API_VERSION}`;
    
    const response = await axios.get(iterationsUrl, getAuthHeader());
    const iterations = response.data.value || [];
    
    console.log(`\n==== Iteration Paths (${iterations.length}) ====`);
    iterations.forEach(iteration => {
      console.log(`- ${iteration.name} (${iteration.path})`);
    });
    
    return iterations;
  } catch (error) {
    console.error('Error fetching iteration paths:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      console.error(error.message);
    }
    return [];
  }
}

// Main function
async function main() {
  console.log('==== Azure DevOps Work Item Fetcher ====\n');
  
  // First get iteration paths
  const iterations = await getIterationPaths();
  
  // Then fetch work items (without specifying iteration path to get all)
  await fetchWorkItems();
  
  // If iterations were found, also fetch for the first iteration
  if (iterations.length > 0) {
    console.log('\n\nFetching work items for a specific iteration...');
    await fetchWorkItems(iterations[0].path);
  }
}

// Run the script
main(); 