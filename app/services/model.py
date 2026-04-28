import torch
from PIL import Image
from ultralytics import YOLO
from app.schemas.inference import Detection, BoundingBox, DetectionResponse

class YOLOModelService:
    def __init__(self):
        # Start with no model loaded
        self.model = None
        self._initialized = False

    def initialize(self):
        """Load the YOLO model into memory."""
        # If it's already loaded, don't do it again!
        if self._initialized:
            return

        print("Loading YOLOv8 model...")
        # This will automatically download the 'nano' version of YOLOv8 
        # (a great, fast starting point) and save it locally.
        self.model = YOLO("yolov8n.pt") 

        # Route the model to the GPU if CUDA is available
        if torch.cuda.is_available():
            print("CUDA detected! Using GPU for inference.")
            self.model.to('cuda')
        else:
            print("CUDA not detected. Using CPU.")

        self._initialized = True
        print("Model loaded successfully!")

    def predict(self, image: Image.Image) -> DetectionResponse:
        """Run inference on a PIL Image and return our formatted schema."""
        # Ensure the model is loaded before predicting
        self.initialize()

        # Run the image through the YOLO model
        # conf=0.25 means we ignore any detections the model is less than 25% sure about
        results = self.model(image, conf=0.25, verbose=False)
        
        detections_list = []
        
        # YOLO returns a list of results (one for each image). We only passed one image.
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

                # Format it into our Pydantic schema
                bbox = BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2)
                detection = Detection(label=label_name, confidence=confidence, bbox=bbox)
                detections_list.append(detection)

        # Return the final organized response
        return DetectionResponse(
            message="Detection successful",
            model_used="yolov8n",
            detections=detections_list
        )

# Create a single global instance of our service.
# This ensures we don't accidentally load the model multiple times into memory.
_model_service = None

def get_model_service():
    global _model_service
    if _model_service is None:
        _model_service = YOLOModelService()
    return _model_service