import io
from fastapi import APIRouter, File, UploadFile, HTTPException
from PIL import Image

# Import the schemas and service we just built!
from app.schemas.inference import DetectionResponse
from app.services.model import get_model_service

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