import os
import shutil
from uuid import uuid4
from celery.result import AsyncResult
from app.tasks import process_image_task
import io
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image

# Import the schemas and service we just built!
from app.schemas.inference import DetectionResponse
from app.services.model import get_model_service

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.models.detection import DetectionJob
from app.api.deps import get_current_user

# Create a router to group our endpoints together
router = APIRouter()

@router.get("/health")
async def health_check():
    """Check if the API is running."""
    return {"status": "healthy", "model": "yolov8n"}

@router.post("/predict", response_model=DetectionResponse)
async def predict(file: UploadFile = File(...)):
    """
    Upload an image and run YOLO object detection.
    """
    # 1. Basic validation: Make sure they actually uploaded an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image type (JPEG, PNG, etc.).")

    try:
        # 2. Read the image bytes into memory
        content = await file.read()
        
        # 3. Convert the bytes into a PIL Image that YOLO can understand
        image = Image.open(io.BytesIO(content))
        
        # Ensure the image is in standard RGB format (some PNGs have an alpha/transparency channel)
        if image.mode != "RGB":
            image = image.convert("RGB")
            
        # 4. Get our ML service and ask it to predict!
        model_service = get_model_service()
        prediction_result = model_service.predict(image)
        
        return prediction_result
        
    except Exception as e:
        # If anything goes wrong (e.g., corrupted image file), return a 500 error
        raise HTTPException(status_code=500, detail=f"An error occurred during processing: {str(e)}")

@router.post("/predict/async")
async def predict_async(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user), # THE SECURITY LOCK!
    db: AsyncSession = Depends(get_db)              # THE DATABASE CONNECTION!
):
    """Instantly saves the image, queues Celery, and saves the job to the database."""
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid4()}.{file_extension}"
    file_path = os.path.join("temp_uploads", unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Send to Celery
    task = process_image_task.delay(file_path)
    
    # Save the pending job to PostgreSQL, linking it to the logged-in user
    job = DetectionJob(user_id=current_user.id, task_id=task.id, status="PENDING")
    db.add(job)
    await db.commit()
    
    return {"message": "Image accepted", "task_id": task.id}


@router.get("/predict/result/{task_id}")
async def get_prediction_result(
    task_id: str,
    current_user: User = Depends(get_current_user), # THE SECURITY LOCK!
    db: AsyncSession = Depends(get_db)              # THE DATABASE CONNECTION!
):
    """Check Redis for the result. If finished, permanently save it to PostgreSQL."""
    
    # 1. Look up the job in the database (ensuring this user owns it)
    result = await db.execute(select(DetectionJob).where(
        DetectionJob.task_id == task_id, 
        DetectionJob.user_id == current_user.id
    ))
    job = result.scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Task not found or unauthorized")

    # 2. Check Celery/Redis for real-time updates
    task = AsyncResult(task_id)
    
    # 3. "Lazy Save": If Celery is done but the DB still says PENDING, update the DB!
    if task.state == "SUCCESS" and job.status != "COMPLETED":
        job.status = "COMPLETED"
        job.result_data = task.result
        await db.commit()
        
    elif task.state == "FAILURE" and job.status != "FAILED":
        job.status = "FAILED"
        job.result_data = {"error": str(task.info)}
        await db.commit()

    return {"task_id": task_id, "status": job.status, "result": job.result_data}