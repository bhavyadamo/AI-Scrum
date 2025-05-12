# AI-Scrum Backend Service

This service integrates with Azure DevOps to fetch work items for the AI-Scrum application.

## Features

- Fetch work items from Azure DevOps by iteration path and date range
- Get detailed information for specific work items
- Secure handling of Azure DevOps credentials via environment variables

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root directory with the following variables:
   ```
   AZURE_DEVOPS_PAT=your_personal_access_token_here
   AZURE_DEVOPS_PROJECT=your_project_name_here
   AZURE_DEVOPS_ORGANIZATION=inatech
   PORT=3000
   ```

3. Build the TypeScript code:
   ```
   npm run build
   ```

4. Start the server:
   ```
   npm start
   ```

   For development with auto-reload:
   ```
   npm run dev
   ```

## API Endpoints

### Get Work Items by Iteration Path

```
GET /api/work-items?iterationPath={path}&fromDate={date}&toDate={date}
```

Parameters:
- `iterationPath` (required): The Azure DevOps iteration path
- `fromDate` (optional): Start date for filtering (ISO format)
- `toDate` (optional): End date for filtering (ISO format)

### Get Work Item by ID

```
GET /api/work-items/{id}
```

Parameters:
- `id` (required): The work item ID

## Security Considerations

- The Personal Access Token (PAT) should have appropriate permissions for Azure DevOps
- Never commit the .env file to version control
- Consider using a secrets manager for production deployments 