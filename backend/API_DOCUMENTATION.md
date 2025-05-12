# AI-Scrum API Documentation

This document provides detailed information about the API endpoints available in the AI-Scrum application.

## Getting Started

### Prerequisites
- Node.js v16+ and npm
- TypeScript
- Azure DevOps PAT token with appropriate permissions

### Running the Server

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables (create a `.env` file):
   ```
   AZURE_DEVOPS_PAT=your_pat_token
   AZURE_DEVOPS_ORGANIZATION=inatech
   AZURE_DEVOPS_PROJECT=Techoil
   PORT=5000
   ```

3. Start the development server:
   ```
   node start-server.js
   ```
   
   For compiled TypeScript:
   ```
   npm run build
   node start-server.js --compiled
   ```

## API Endpoints

### Get Work Items

**Endpoint:** `GET /api/work-items`

**Description:** Retrieves work items based on iteration path and optional date range.

**Query Parameters:**
- `iterationPath` (required): The Azure DevOps iteration path (e.g., "YourProject\\Sprint 1")
- `fromDate` (optional): Start date for filtering (ISO format, e.g., "2023-01-01")
- `toDate` (optional): End date for filtering (ISO format, e.g., "2023-12-31")

**Response Example:**
```json
[
  {
    "id": 1001,
    "title": "Create login screen",
    "priority": 2,
    "state": "Completed",
    "assignedTo": "Jane Smith",
    "iterationPath": "Techoil\\Sprint 1",
    "createdDate": "2023-01-15T08:30:45.123Z",
    "changedDate": "2023-01-20T14:25:10.456Z"
  },
  {
    "id": 1002,
    "title": "Implement user authentication",
    "priority": 1,
    "state": "In Progress",
    "assignedTo": "John Doe",
    "iterationPath": "Techoil\\Sprint 1",
    "createdDate": "2023-01-16T10:15:30.789Z",
    "changedDate": "2023-01-21T09:45:22.123Z"
  }
]
```

### Get Work Item by ID

**Endpoint:** `GET /api/work-items/:id`

**Description:** Retrieves detailed information for a specific work item.

**Path Parameters:**
- `id` (required): The work item ID (numeric)

**Response Example:**
```json
{
  "id": 1001,
  "title": "Create login screen",
  "priority": 2,
  "state": "Completed",
  "assignedTo": "Jane Smith",
  "iterationPath": "Techoil\\Sprint 1",
  "createdDate": "2023-01-15T08:30:45.123Z",
  "changedDate": "2023-01-20T14:25:10.456Z",
  "description": "Implement a login screen with username and password fields",
  "effortHours": 8,
  "tags": ["UI", "Authentication"]
}
```

### Get Team Members

**Endpoint:** `GET /api/work-items/team-members`

**Description:** Retrieves team members from Azure DevOps or returns mock data if unavailable.

**Query Parameters:**
- `team` (optional): The name of the team to get members for. If not provided, uses the default team.

**Response Example:**
```json
[
  {
    "id": "1",
    "displayName": "Jane Smith",
    "uniqueName": "jane.smith@example.com",
    "imageUrl": "https://example.com/avatar/jane.jpg"
  },
  {
    "id": "2",
    "displayName": "John Doe",
    "uniqueName": "john.doe@example.com",
    "imageUrl": "https://example.com/avatar/john.jpg"
  }
]
```

### Assign Task

**Endpoint:** `POST /api/work-items/assign`

**Description:** Assigns a work item to a team member.

**Request Body:**
```json
{
  "taskId": 1001,
  "assignedTo": "jane.smith@example.com"
}
```

**Response Example:**
```json
{
  "success": true,
  "message": "Task #1001 assigned to Jane Smith"
}
```

### Get Auto-Assign Suggestions

**Endpoint:** `GET /api/work-items/auto-assign-suggestions`

**Description:** Gets suggestions for auto-assigning tasks based on team members' workload and skills.

**Query Parameters:**
- `iterationPath` (required): The iteration path containing tasks to be auto-assigned.

**Response Example:**
```json
{
  "1001": "1",  // Task ID 1001 => Team Member ID 1 (Jane Smith)
  "1002": "2",  // Task ID 1002 => Team Member ID 2 (John Doe)
  "1003": "3"   // Task ID 1003 => Team Member ID 3 (Sam Wilson)
}
```

### Auto-Assign Tasks

**Endpoint:** `POST /api/work-items/auto-assign`

**Description:** Automatically assigns tasks to team members based on AI recommendations.

**Request Body:**
```json
{
  "iterationPath": "Techoil\\Sprint 1"
}
```

**Response Example:**
```json
{
  "success": true,
  "assignedCount": 5,
  "message": "Successfully assigned 5 tasks"
}
```

## Health Check

**Endpoint:** `GET /health`

**Description:** Checks if the API server is running properly.

**Response Example:**
```json
{
  "status": "ok",
  "timestamp": "2023-05-11T14:30:22.123Z"
}
```

## Error Responses

All API endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: When input parameters are invalid
- `401 Unauthorized`: When authentication fails
- `404 Not Found`: When the requested resource doesn't exist
- `500 Internal Server Error`: When an unexpected error occurs

Error response format:
```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

## CORS Configuration

The API allows cross-origin requests from:
- `http://localhost:4200` (Angular development server)
- `http://127.0.0.1:4200` (Alternative local address)
- `https://ai-scrum.example.com` (Production URL - update as needed)

## Troubleshooting

If you encounter issues:

1. Check if the server is running (`http://localhost:5000/health`)
2. Verify the PAT token has sufficient permissions
3. Check the console for error logs
4. Make sure the Azure DevOps organization and project names are correct
5. Ensure the correct iteration path is being used 