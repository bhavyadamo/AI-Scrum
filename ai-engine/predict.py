from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import random
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Task Estimation AI Engine")

class TaskEstimationRequest(BaseModel):
    title: str
    type: str
    assignee: Optional[str] = None
    complexity: str

class TimeEstimate(BaseModel):
    devTime: str
    qaTime: str
    totalEstimate: str
    confidence: float
    factorsConsidered: List[str]

@app.get("/")
def read_root():
    return {"message": "Task Estimation AI Engine is running"}

@app.post("/predict-time", response_model=TimeEstimate)
async def predict_time(request: TaskEstimationRequest):
    """
    Predict the time required to complete a task based on its attributes.
    """
    try:
        logger.info(f"Received task estimation request: {request}")
        
        # In a real implementation, this would use a trained ML model
        # For now, we'll use a rule-based approach

        # Calculate development time based on complexity
        dev_time = 0
        qa_time = 0
        factors = []
        
        # Add task title as a factor
        factors.append(f"Task title: {request.title}")
        
        # Add task type as a factor
        factors.append(f"Task type: {request.type}")
        
        # Complexity-based estimation
        if request.complexity.lower() == "high":
            dev_time = random.uniform(4.0, 6.0)
            qa_time = random.uniform(1.5, 2.5)
            factors.append("High complexity increases development time")
            confidence = random.uniform(0.65, 0.75)
        elif request.complexity.lower() == "low":
            dev_time = random.uniform(0.5, 1.5)
            qa_time = random.uniform(0.25, 0.75)
            factors.append("Low complexity results in shorter timeline")
            confidence = random.uniform(0.85, 0.95)
        else:  # Medium
            dev_time = random.uniform(2.0, 4.0)
            qa_time = random.uniform(0.75, 1.25)
            factors.append("Medium complexity is standard estimation")
            confidence = random.uniform(0.75, 0.85)
        
        # Task type adjustments
        if request.type.lower() == "bug":
            dev_time *= 0.8
            factors.append("Bug fixes typically take less time than new features")
        elif request.type.lower() == "documentation":
            qa_time *= 0.5
            factors.append("Documentation requires less QA time")
        elif request.type.lower() == "feature":
            dev_time *= 1.1
            factors.append("New features require additional design work")
        
        # Assignee experience factor (if provided)
        if request.assignee:
            factors.append(f"Assigned to: {request.assignee}")
            
            # Simulate some team members being faster or slower
            if "senior" in request.assignee.lower():
                dev_time *= 0.9
                factors.append("Senior developers typically work faster")
            elif "junior" in request.assignee.lower():
                dev_time *= 1.2
                factors.append("Junior developers may need more time")
        
        # Format the time estimates
        dev_time_str = f"{dev_time:.1f} days" if dev_time >= 1 else f"{dev_time * 8:.1f} hours"
        qa_time_str = f"{qa_time:.1f} days" if qa_time >= 1 else f"{qa_time * 8:.1f} hours"
        total_time = dev_time + qa_time
        total_time_str = f"{total_time:.1f} days" if total_time >= 1 else f"{total_time * 8:.1f} hours"
        
        # Create the response
        response = TimeEstimate(
            devTime=dev_time_str,
            qaTime=qa_time_str,
            totalEstimate=total_time_str,
            confidence=confidence,
            factorsConsidered=factors
        )
        
        logger.info(f"Generated time estimate: {response}")
        return response
        
    except Exception as e:
        logger.error(f"Error predicting time: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error predicting time: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 