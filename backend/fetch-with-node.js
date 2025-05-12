/**
 * Simple Node.js script to fetch data from Azure DevOps using a PAT token
 * No TypeScript compilation required - run directly with Node.js
 */

const axios = require('axios');

// Configuration
const PAT_TOKEN = '20J15p0KHAe3YTHe4f11RV9oeBIAmDBJFrhqQR2EzM1VzS3z3fj7JQQJ99BEACAAAAAnbaCHAAASAZDO2Czy';
const ORGANIZATION = 'inatech';
const PROJECT = 'YourProjectName'; // Replace with your actual project name
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
function buildWiqlQuery() {
  return `SELECT [System.Id], [System.Title], [System.Priority], [System.State], [System.AssignedTo] 
          FROM WorkItems 
          WHERE [System.TeamProject] = '${PROJECT}'
          ORDER BY [System.Id]`;
}

// Fetch work items
async function fetchWorkItems() {
  try {
    console.log('Fetching work items from Azure DevOps...');
    
    // Step 1: Build the WIQL query URL
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const wiqlUrl = `${baseUrl}/${PROJECT}/_apis/wit/wiql?api-version=${API_VERSION}`;
    const wiqlQuery = buildWiqlQuery();
    
    console.log('Executing WIQL query...');
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
    
    workItems.forEach(item => {
      const fields = item.fields;
      console.log(`\nWork Item #${item.id}:`);
      console.log(`- Title: ${fields['System.Title']}`);
      console.log(`- State: ${fields['System.State']}`);
      console.log(`- Assigned To: ${fields['System.AssignedTo']?.displayName || 'Unassigned'}`);
    });
    
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

// Run the script
fetchWorkItems(); 