import torch
from PIL import Image
from typing import Union
from ultralytics import YOLO
from app.schemas.inference import Detection, BoundingBox, DetectionResponse

class YOLOModelService:
    def __init__(self):
        # Start with no model loaded
        self.model = None
        self._initialized = False

    def initialize(self):
        """Load the YOLO model into memory."""
        if self._initialized:
            return

        print("Loading YOLOv8 model...")
        self.model = YOLO("yolov8n.pt") 

        # --- TEMPORARY RTX 5090 FIX ---
        # We are forcing the CPU here to avoid CUDA Context Poisoning 
        # until the PyTorch Nightly build servers are fixed.
        print("Forcing CPU inference to bypass RTX 5090 architecture mismatch...")
        self.model.to('cpu')
        # ------------------------------

        self._initialized = True
        print("Model loaded successfully!")

    def predict(self, image_input: Union[str, Image.Image]) -> dict:
        """
        Run inference on a file path or PIL Image.
        Returns a dictionary so Celery can serialize it into Redis.
        """
        # Ensure the model is loaded before predicting
        self.initialize()

        try:
            # 1. Attempt to run it normally (uses GPU if available)
            # conf=0.25 means we ignore any detections the model is less than 25% sure about
            results = self.model(image_input, conf=0.25, verbose=False)
            
        except RuntimeError as e:
            # 2. Catch the RTX 5090 architecture error and seamlessly fallback to CPU!
            print(f"⚠️ GPU Inference failed, falling back to CPU! Error: {e}")
            results = self.model(image_input, conf=0.25, verbose=False, device="cpu")
        
        detections_list = []
        
        # YOLO returns a list of results. We only passed one image.
        for result in results:
            boxes = result.boxes  # The bounding boxes detected
            if boxes is None:
                continue
                
            for i in range(len(boxes)):
                # Extract coordinates, confidence, and the class label
                box = boxes[i]
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                label_name = self.model.names[class_id]

                # Format it into our Pydantic schema for strict validation
                bbox = BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)
                detection = Detection(label=label_name, confidence=confidence, bbox=bbox)
                detections_list.append(detection)

        # Organize into the final response schema
        response = DetectionResponse(
            message="Detection successful",
            model_used="yolov8n",
            detections=detections_list
        )

        # Convert the Pydantic object to a standard Python dictionary.
        # This ensures Celery can successfully pass it through Redis as JSON.
        if hasattr(response, 'model_dump'):
            return response.model_dump() # Pydantic v2
        return response.dict()           # Pydantic v1 fallback

# Create a single global instance of our service.
# This ensures we don't accidentally load the model multiple times into memory.
_model_service = None

def get_model_service():
    global _model_service
    if _model_service is None:
        _model_service = YOLOModelService()
    return _model_service