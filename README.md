# AI-Based Scrum Master

An intelligent Scrum Master assistant that integrates with Azure DevOps to provide AI-powered task management, estimation, and recommendations.

## Modules

1. **Home Dashboard** - Sprint overview, summary metrics, and activity feed
2. **Task Distribution** - Manual and AI-powered task assignment
3. **AI-Based Recommendations** - Intelligent suggestions for improving team productivity
4. **Task Estimation** - ML-based time estimation for tasks
5. **Settings** - Application and integration configuration

## Architecture

- **Frontend**: Angular 15+
- **Backend**: ASP.NET Core 7
- **ML Services**: FastAPI (Python) or ML.NET
- **Integration**: Azure DevOps

## Getting Started

### Prerequisites

- .NET 7 SDK
- Node.js 16+ and npm
- Angular CLI
- Azure DevOps account with PAT

### Setup

1. Clone this repository
2. Navigate to `/frontend` and run `npm install`
3. Run `ng serve` to start the Angular development server
4. Navigate to `/backend` and run `dotnet restore`
5. Run `dotnet run` to start the ASP.NET Core backend

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines. 