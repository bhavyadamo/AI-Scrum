/**
 * Simplified script to fetch work items from Azure DevOps Techoil project
 * using a basic WIQL query
 */

const axios = require('axios');

// Configuration
const PAT_TOKEN = '20J15p0KHAe3YTHe4f11RV9oeBIAmDBJFrhqQR2EzM1VzS3z3fj7JQQJ99BEACAAAAAnbaCHAAASAZDO2Czy';
const ORGANIZATION = 'inatech';
const PROJECT = 'Techoil';
const API_VERSION = '7.0';
const TEAM = 'FHR Team'; // One of the teams we found

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

// Fetch work items using a simple WIQL query
async function fetchWorkItemsSimple() {
  try {
    console.log('Fetching work items with simple WIQL query...');
    
    // Build very basic WIQL query that should work regardless of project structure
    const query = `SELECT [System.Id], [System.Title], [System.State] 
                   FROM WorkItems 
                   WHERE [System.TeamProject] = '${PROJECT}' 
                   ORDER BY [System.Id]`;
    
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const wiqlUrl = `${baseUrl}/${PROJECT}/_apis/wit/wiql?api-version=${API_VERSION}`;
    
    console.log('Executing WIQL query...');
    
    const wiqlResponse = await axios.post(
      wiqlUrl,
      { query },
      getAuthHeader()
    );
    
    const workItemRefs = wiqlResponse.data.workItems || [];
    console.log(`Found ${workItemRefs.length} work items`);
    
    if (workItemRefs.length === 0) {
      console.log('No work items found.');
      return;
    }
    
    // Get IDs for the first 10 work items (to avoid large requests)
    const limitedRefs = workItemRefs.slice(0, 10);
    const workItemIds = limitedRefs.map(item => item.id).join(',');
    
    // Get detailed information for the work items
    const workItemsUrl = `${baseUrl}/${PROJECT}/_apis/wit/workitems?ids=${workItemIds}&api-version=${API_VERSION}`;
    
    console.log('Fetching details for first 10 work items...');
    const workItemsResponse = await axios.get(workItemsUrl, getAuthHeader());
    
    const workItems = workItemsResponse.data.value || [];
    
    console.log(`\n==== Work Items (${workItems.length}) ====`);
    workItems.forEach(item => {
      const fields = item.fields;
      console.log(`\nWork Item #${item.id}:`);
      console.log(`- Title: ${fields['System.Title'] || 'No Title'}`);
      console.log(`- Type: ${fields['System.WorkItemType'] || 'Unknown'}`);
      console.log(`- State: ${fields['System.State'] || 'Unknown'}`);
      
      // Print other fields if they exist
      Object.keys(fields).forEach(field => {
        if (!['System.Title', 'System.WorkItemType', 'System.State'].includes(field)) {
          const value = fields[field];
          if (typeof value === 'object' && value !== null) {
            if (value.displayName) {
              console.log(`- ${field}: ${value.displayName}`);
            } else {
              console.log(`- ${field}: [Complex object]`);
            }
          } else if (value !== null && value !== undefined) {
            console.log(`- ${field}: ${value}`);
          }
        }
      });
    });
    
  } catch (error) {
    console.error('Error fetching work items:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Try fetching with team context
async function fetchWorkItemsWithTeamContext() {
  try {
    console.log('\n\nFetching work items with team context...');
    
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const teamContext = `${PROJECT}/${TEAM}`;
    const wiqlUrl = `${baseUrl}/${teamContext}/_apis/wit/wiql?api-version=${API_VERSION}`;
    
    // Build very basic WIQL query
    const query = `SELECT [System.Id], [System.Title], [System.State] 
                   FROM WorkItems 
                   WHERE [System.TeamProject] = '${PROJECT}' 
                   ORDER BY [System.Id]`;
    
    console.log(`Team Context: ${teamContext}`);
    console.log('Executing WIQL query...');
    
    const wiqlResponse = await axios.post(
      wiqlUrl,
      { query },
      getAuthHeader()
    );
    
    const workItemRefs = wiqlResponse.data.workItems || [];
    console.log(`Found ${workItemRefs.length} work items for team ${TEAM}`);
    
  } catch (error) {
    console.error('Error fetching work items with team context:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Main function
async function main() {
  console.log('==== Azure DevOps Simple Work Item Fetcher ====\n');
  console.log(`Organization: ${ORGANIZATION}`);
  console.log(`Project: ${PROJECT}`);
  
  // Try both approaches
  await fetchWorkItemsSimple();
  await fetchWorkItemsWithTeamContext();
}

// Run the script
main(); 