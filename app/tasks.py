import os
from app.celery_worker import celery_app
from app.services.model import get_model_service

@celery_app.task(name="process_image_task")
def process_image_task(file_path: str):
    """
    This is the background worker function. 
    It runs in a completely separate process from FastAPI!
    """
    try:
        # 1. Celery workers run in a separate process, so they need 
        # to initialize their own connection to the YOLO model on the GPU.
        model_service = get_model_service()
        model_service.initialize()
        
        # 2. Run the heavy inference using the file path
        result = model_service.predict(file_path)
        
        # 3. Clean up: Delete the image so your hard drive doesn't fill up!
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # 4. Return the JSON result to Redis so FastAPI can read it later
        return result
        
    except Exception as e:
        # If something goes wrong, make sure we still delete the temp file
        if os.path.exists(file_path):
            os.remove(file_path)
        return {"error": str(e)}