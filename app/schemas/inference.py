from pydantic import BaseModel, Field
from typing import List

class BoundingBox(BaseModel):
    """Coordinates for the bounding box of a detected object."""
    x1: float = Field(..., description="Top-left X coordinate")
    y1: float = Field(..., description="Top-left Y coordinate")
    x2: float = Field(..., description="Bottom-right X coordinate")
    y2: float = Field(..., description="Bottom-right Y coordinate")

class Detection(BaseModel):
    """A single detected object."""
    label: str = Field(..., description="The name of the detected object (e.g., 'person', 'car')")
    confidence: float = Field(..., description="Confidence score from the model (0.0 to 1.0)")
    bbox: BoundingBox = Field(..., description="The bounding box coordinates")

class DetectionResponse(BaseModel):
    """The final response sent back to the user."""
    message: str = Field(default="Detection successful", description="Status message")
    model_used: str = Field(default="yolov8n", description="The YOLO model version used")
    detections: List[Detection] = Field(default_factory=list, description="List of all detected objects")