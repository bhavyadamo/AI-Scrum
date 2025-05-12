/**
 * Debug script for Azure DevOps API authentication
 */

const axios = require('axios');

// Configuration
const PAT_TOKEN = '20J15p0KHAe3YTHe4f11RV9oeBIAmDBJFrhqQR2EzM1VzS3z3fj7JQQJ99BEACAAAAAnbaCHAAASAZDO2Czy';
const ORGANIZATION = 'inatech';

// Authentication headers
function getAuthHeader() {
  // Create authorization token (PAT tokens use empty username with token as password)
  const token = Buffer.from(`:${PAT_TOKEN}`).toString('base64');
  return {
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type': 'application/json'
    }
  };
}

// Test API connection
async function testConnection() {
  try {
    console.log('Testing Azure DevOps API connection...');
    console.log(`Organization: ${ORGANIZATION}`);
    console.log(`PAT Token (first 10 chars): ${PAT_TOKEN.substring(0, 10)}...`);
    
    // Step 1: Get organization info (simplest API call)
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const orgUrl = `${baseUrl}/_apis/projects?api-version=7.0`;
    
    console.log(`\nMaking request to: ${orgUrl}`);
    console.log('Authorization header:', `Basic ${Buffer.from(`:${PAT_TOKEN}`).toString('base64').substring(0, 20)}...`);
    
    try {
      const response = await axios.get(orgUrl, getAuthHeader());
      console.log('\nConnection successful!');
      console.log(`Status: ${response.status} ${response.statusText}`);
      
      if (response.data.value && response.data.value.length > 0) {
        console.log('\nProjects found:');
        response.data.value.forEach(project => {
          console.log(`- ${project.name} (${project.id})`);
        });
      } else {
        console.log('No projects found or empty response.');
      }
      
      return true;
    } catch (error) {
      console.error('\nAPI request failed:');
      if (error.response) {
        console.error(`Status: ${error.response.status} ${error.response.statusText}`);
        console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Error details:', error.response.data);
      } else if (error.request) {
        console.error('No response received from the server.');
        console.error('Request details:', error.request);
      } else {
        console.error('Error setting up the request:', error.message);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

// Run diagnostics
async function runDiagnostics() {
  console.log('==== Azure DevOps API Diagnostics ====\n');
  
  // Test basic connection
  const connectionSuccess = await testConnection();
  
  if (!connectionSuccess) {
    console.log('\n==== Troubleshooting Tips ====');
    console.log('1. Verify the PAT token is correct and not expired');
    console.log('2. Confirm the organization name "inatech" is correct');
    console.log('3. Check that the PAT token has sufficient permissions:');
    console.log('   - Read permission for Work Items');
    console.log('   - Read permission for Project and Team');
    console.log('4. Make sure your network allows connections to dev.azure.com');
    console.log('5. The token might require URL-safe Base64 encoding');
  }
  
  console.log('\n==== Diagnostics Complete ====');
}

// Run the script
runDiagnostics(); 