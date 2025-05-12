# AI-Scrum Recommendation Engine

This is the AI Engine component of the AI-Scrum application, responsible for generating intelligent task recommendations based on sprint data.

## Features

- Provides AI-powered recommendations for task prioritization
- Analyzes current sprint tasks to identify bottlenecks
- Offers insights to improve team velocity and workflow

## Development Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the FastAPI server:
   ```
   uvicorn main:app --reload
   ```

3. View the API documentation:
   - Open your browser to `http://localhost:8000/docs`

## API Endpoints

- `POST /recommend`: Accepts a list of sprint tasks and returns AI-generated recommendations
- `GET /health`: Health check endpoint for monitoring

## Docker

You can also run the application using Docker:

```
docker build -t ai-scrum-engine .
docker run -p 8000:8000 ai-scrum-engine
```

## Integration

This engine is designed to be called by the .NET backend service, which then forwards recommendations to the Angular frontend. 