# Azure DevOps Data Fetcher

This document provides instructions for fetching work items from Azure DevOps using the provided PAT token.

## Quick Start

### Method 1: Run the PowerShell script (Recommended)

1. Open PowerShell
2. Navigate to the backend directory
3. Run the PowerShell script:
   ```
   .\fetch-azure-devops.ps1
   ```

### Method 2: Manual Steps

1. Open a command prompt or PowerShell
2. Navigate to the backend directory
3. Install dependencies:
   ```
   npm install
   ```
4. Build the TypeScript:
   ```
   npm run build
   ```
5. Run the test script:
   ```
   node dist/test-fetch.js
   ```

## Customizing the Query

To customize what data is fetched, you can modify the `backend/src/test-fetch.ts` file.

### Important Parameters

In the `test-fetch.ts` file, you'll need to update these values:

1. Project Name: Replace `YourProjectName` with your actual Azure DevOps project name
2. Iteration Path: Replace `YourProjectName\\Sprint 1` with your actual iteration path
3. Date Range: Modify the `fromDate` and `toDate` values as needed

### Example Modifications

```typescript
const workItems = await azureDevOpsService.queryWorkItems({
  iterationPath: 'ActualProjectName\\Current Sprint',
  fromDate: '2023-10-01',
  toDate: '2023-11-30'
});
```

## Security Note

The PAT token has been directly embedded in the test script for simplicity. For production use, it's recommended to:

1. Store the token in a secure .env file
2. Never commit tokens to version control
3. Use a secrets manager for production deployments

## Troubleshooting

If you encounter errors:

1. Verify the project name and iteration path are correct
2. Check that the PAT token has sufficient permissions
3. Ensure you have network connectivity to Azure DevOps
4. Check the console output for detailed error messages 