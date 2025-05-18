# AI Scrum Master Dashboard

A comprehensive AI-powered Scrum management tool that integrates with Azure DevOps to enhance team productivity through intelligent task management, estimation, and recommendations.

![AI Scrum Master Dashboard](https://example.com/dashboard-screenshot.png)

## 🌟 Features

### 📊 Dashboard
- Real-time sprint overview with progress metrics
- Status distribution cards for quick visualization
- Work item type breakdown
- AI-assisted chat interface for natural language queries
- Sprint completion progress bar

### 📋 Task Distribution
- Visual workload distribution across team members
- AI-powered auto-assignment of tasks based on skills and capacity
- Drag-and-drop manual task assignment
- Task filtering by status, type, and assigned team member

### ⏱️ Task Estimation
- Machine learning based time estimations for work items
- Historical data analysis for accurate predictions
- Comparison of estimated vs. actual completion times
- Velocity tracking across sprints

### 💡 AI Recommendations
- Intelligent suggestions for improving sprint performance
- Identification of bottlenecks and at-risk tasks
- Team workload optimization
- Sprint planning assistance

### ⚙️ Settings
- Integration with Azure DevOps
- User role management
- AI model configuration
- Team filters and preferences

## 🏗️ Architecture

### Frontend
- **Framework**: Angular 15
- **UI Components**: Bootstrap 5, custom SCSS
- **State Management**: Angular services, RxJS
- **Visualization**: Chart.js, ng2-charts
- **Responsive Design**: Mobile-friendly interface

### Backend
- **Framework**: ASP.NET Core 7
- **API**: RESTful endpoints
- **Authentication**: Azure AD integration
- **Data Processing**: Real-time Azure DevOps data integration

### AI Engine
- **Framework**: FastAPI (Python)
- **ML Models**: Task estimation, workload optimization
- **Natural Language Processing**: Query understanding, chat assistant
- **Recommendation Engine**: Sprint optimization algorithms

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ and npm
- .NET 7 SDK
- Python 3.9+
- Azure DevOps account with PAT (Personal Access Token)
- Docker (optional, for containerized deployment)

### Installation

#### Clone the Repository
```bash
git clone https://github.com/your-org/ai-scrum-master.git
cd ai-scrum-master
```

#### Frontend Setup
```bash
cd frontend
npm install
ng serve
```
The Angular application will be available at http://localhost:4200

#### Backend Setup
```bash
cd backend
dotnet restore
dotnet run
```
The ASP.NET Core API will be available at http://localhost:5000

#### AI Engine Setup
```bash
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --reload
```
The FastAPI server will be available at http://localhost:8000

### Configuration

1. Create an `.env` file in the backend directory with your Azure DevOps credentials:
```
AZURE_DEVOPS_PAT=your_pat_token
AZURE_DEVOPS_ORGANIZATION=your_organization
AZURE_DEVOPS_PROJECT=your_project
```

2. Configure the frontend to connect to your backend by updating `environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api'
};
```

## 📱 Usage

### Dashboard Navigation
- Use the top navigation menu to access different features
- The dashboard provides an overview of the current sprint
- Use the AI Assistant to ask questions about your sprint

### Sprint Selection
- Enter your iteration path (e.g., "YourProject\\Sprint 1") in the input field
- Click "Search" to load data for the selected sprint

### Task Management
- View work items by status or type
- Click on status cards to see detailed task lists
- Use the Task Distribution page for workload management

### AI Queries
Try asking the AI Assistant:
- "How many tasks are in progress?"
- "Show me blocked tasks"
- "Who has the most assigned tasks?"
- "What's our sprint progress?"

## 🔧 Development

### Project Structure
- `/frontend` - Angular application
- `/backend` - ASP.NET Core API
- `/ai-engine` - FastAPI ML services
- `/scripts` - Utility scripts for deployment and management

### Running in Development Mode
Use the included PowerShell scripts for easy startup:
```
./start-all.ps1
```

This will start the frontend, backend, and AI engine concurrently.

### Running with Docker
```bash
docker-compose up
```

## 📃 API Documentation

The backend exposes RESTful APIs for:
- Work item retrieval and management
- Team member information
- Sprint metrics and statistics
- Task assignment and auto-assignment
- AI recommendations

For detailed API documentation, start the backend and visit:
http://localhost:5000/swagger

## 📋 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 👥 Team

This project is maintained by the AI Scrum Team.

## 📞 Support

For support, please open an issue on GitHub or contact the team at [support@example.com](mailto:support@example.com). 