from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import our router and our ML service
from app.api.endpoints import router as inference_router
from app.api.auth import router as auth_router
from app.services.model import get_model_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    This function runs before the server starts taking requests.
    It's the perfect place to load our heavy ML model into memory.
    """
    print("--- SERVER STARTING UP ---")
    model_service = get_model_service()
    model_service.initialize()
    print("--- SERVER READY ---")
    
    yield  # The server handles requests while paused here
    
    # Anything down here would run when the server shuts down
    print("--- SERVER SHUTTING DOWN ---")

# Create the actual FastAPI application
app = FastAPI(
    title="YOLOv8 Object Detection API",
    description="A fast computer vision API utilizing YOLOv8 and PyTorch.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS (Cross-Origin Resource Sharing)
# This is important for later when we build the frontend!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the endpoints we created in Step 4
app.include_router(inference_router, prefix="/api/v1", tags=["Inference"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])