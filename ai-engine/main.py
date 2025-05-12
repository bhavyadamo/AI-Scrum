from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random
from datetime import datetime

app = FastAPI(title="AI-Scrum Recommendation Engine")

# Models
class Task(BaseModel):
    id: str
    title: str
    status: str
    priority: str

class Recommendation(BaseModel):
    message: str
    severity: str  # Info, Warning, Critical


@app.get("/")
async def root():
    return {"message": "AI-Scrum Recommendation Engine API"}


@app.post("/recommend", response_model=List[Recommendation])
async def recommend(tasks: List[Task]):
    """
    Generate task recommendations based on the current sprint tasks.
    
    In a real implementation, this would use machine learning models
    to analyze tasks and generate intelligent recommendations.
    """
    if not tasks:
        return []
    
    # For demo purposes, we'll return static recommendations
    # In a production environment, this would use ML to analyze tasks
    recommendations = [
        Recommendation(
            message="🧠 Complete Task #7 to unblock 2 others",
            severity="Info"
        ),
        Recommendation(
            message="📈 Prioritize Task #12 due to upcoming deadline",
            severity="Warning"
        )
    ]
    
    # Randomly add a critical recommendation 30% of the time
    if random.random() < 0.3:
        recommendations.append(
            Recommendation(
                message="⚠️ Sprint velocity is 30% below target",
                severity="Critical"
            )
        )
    
    return recommendations


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 