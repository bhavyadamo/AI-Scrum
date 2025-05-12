/**
 * Script to test Azure DevOps integration
 * 
 * Usage:
 * npm run build
 * node dist/scripts/fetchWorkItems.js --iteration="YourProject\\Sprint 1" --from="2023-01-01" --to="2023-12-31"
 */

import { AzureDevOpsService } from '../services/azureDevOpsService';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const params: Record<string, string> = {};

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    if (key && value) {
      params[key] = value;
    }
  }
});

// Default values
const iterationPath = params.iteration || process.env.AZURE_DEVOPS_ITERATION_PATH || 'YourProject\\Sprint 1';
const fromDate = params.from || '';
const toDate = params.to || '';
const outputFile = params.output || 'work-items.json';

async function main() {
  try {
    console.log('Fetching work items from Azure DevOps...');
    console.log(`Iteration Path: ${iterationPath}`);
    if (fromDate) console.log(`From Date: ${fromDate}`);
    if (toDate) console.log(`To Date: ${toDate}`);
    
    const azureDevOpsService = new AzureDevOpsService();
    
    const workItems = await azureDevOpsService.queryWorkItems({
      iterationPath,
      fromDate,
      toDate
    });
    
    console.log(`Retrieved ${workItems.length} work items.`);
    
    // Print work items summary
    workItems.forEach(item => {
      console.log(`- #${item.id}: ${item.title} (${item.state}) - Assigned to: ${item.assignedTo || 'Unassigned'}`);
    });
    
    // Write to output file if specified
    if (outputFile) {
      const outputData = JSON.stringify(workItems, null, 2);
      fs.writeFileSync(outputFile, outputData);
      console.log(`\nWork items saved to ${outputFile}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main(); 