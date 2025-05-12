/**
 * Script to fetch team information from Azure DevOps Techoil project
 */

const axios = require('axios');

// Configuration
const PAT_TOKEN = '20J15p0KHAe3YTHe4f11RV9oeBIAmDBJFrhqQR2EzM1VzS3z3fj7JQQJ99BEACAAAAAnbaCHAAASAZDO2Czy';
const ORGANIZATION = 'inatech';
const PROJECT = 'Techoil';
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

// Fetch project teams
async function getTeams() {
  try {
    console.log('Fetching teams for project...');
    
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const teamsUrl = `${baseUrl}/_apis/projects/${PROJECT}/teams?api-version=${API_VERSION}`;
    
    const response = await axios.get(teamsUrl, getAuthHeader());
    const teams = response.data.value || [];
    
    console.log(`\n==== Teams (${teams.length}) ====`);
    teams.forEach(team => {
      console.log(`- ${team.name} (${team.id})`);
    });
    
    return teams;
  } catch (error) {
    console.error('Error fetching teams:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      console.error(error.message);
    }
    return [];
  }
}

// Fetch work item types
async function getWorkItemTypes() {
  try {
    console.log('\nFetching work item types...');
    
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const typesUrl = `${baseUrl}/${PROJECT}/_apis/wit/workitemtypes?api-version=${API_VERSION}`;
    
    const response = await axios.get(typesUrl, getAuthHeader());
    const types = response.data.value || [];
    
    console.log(`\n==== Work Item Types (${types.length}) ====`);
    types.forEach(type => {
      console.log(`- ${type.name} (${type.referenceName})`);
    });
    
    return types;
  } catch (error) {
    console.error('Error fetching work item types:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      console.error(error.message);
    }
    return [];
  }
}

// Get project information
async function getProjectInfo() {
  try {
    console.log('\nFetching project information...');
    
    const baseUrl = `https://dev.azure.com/${ORGANIZATION}`;
    const projectUrl = `${baseUrl}/_apis/projects/${PROJECT}?api-version=${API_VERSION}`;
    
    const response = await axios.get(projectUrl, getAuthHeader());
    const project = response.data;
    
    console.log(`\n==== Project Information ====`);
    console.log(`Name: ${project.name}`);
    console.log(`ID: ${project.id}`);
    console.log(`Description: ${project.description || 'None'}`);
    console.log(`URL: ${project.url}`);
    console.log(`State: ${project.state}`);
    console.log(`Last Update: ${project.lastUpdateTime}`);
    
    return project;
  } catch (error) {
    console.error('Error fetching project information:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Main function
async function main() {
  console.log('==== Azure DevOps Team Information ====\n');
  console.log(`Organization: ${ORGANIZATION}`);
  console.log(`Project: ${PROJECT}`);
  
  // Get project information
  await getProjectInfo();
  
  // Get teams
  await getTeams();
  
  // Get work item types
  await getWorkItemTypes();
}

// Run the script
main(); 