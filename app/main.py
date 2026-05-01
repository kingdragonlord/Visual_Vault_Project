from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import our router and our ML service
from app.api.endpoints import router as inference_router
from app.api.auth import router as auth_router
from app.api.assets import router as assets_router
from app.services.model import get_model_service
from app.api.search import router as search_router
from app.api.analysis import router as analysis_router
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.middleware.rate_limit import limiter
from app.middleware.logging import RequestLoggingMiddleware

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
# Apply the Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply the Structured Logger
app.add_middleware(RequestLoggingMiddleware)
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
app.include_router(assets_router, prefix="/api/v1/assets", tags=["Assets"])
app.include_router(search_router, prefix="/api/v1/search", tags=["Semantic Search"])
app.include_router(analysis_router, prefix="/api/v1/analysis", tags=["Analysis & ML"])
