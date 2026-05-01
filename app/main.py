import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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

# Path to the Next.js static export (built by Docker Stage 1, or `npm run build` locally)
FRONTEND_OUT = Path(__file__).resolve().parent.parent / "frontend" / "out"

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach the API endpoints
app.include_router(inference_router, prefix="/api/v1", tags=["Inference"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(assets_router, prefix="/api/v1/assets", tags=["Assets"])
app.include_router(search_router, prefix="/api/v1/search", tags=["Semantic Search"])
app.include_router(analysis_router, prefix="/api/v1/analysis", tags=["Analysis & ML"])

# ── Serve the Next.js static export ──────────────────────────────────────────
# The frontend/out directory is produced by `npm run build` in the frontend/ folder.
# In Docker, Stage 1 builds it and Stage 2 copies it here automatically.
if FRONTEND_OUT.exists():
    # Mount static assets (JS, CSS, images produced by Next.js)
    app.mount("/_next", StaticFiles(directory=str(FRONTEND_OUT / "_next")), name="next-assets")

    # Catch-all: serve index.html for any non-API route so Next.js client-side
    # routing works correctly (e.g. /gallery, /auth all resolve to index.html)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        # Try to serve an exact file match first (e.g. favicon.ico, images)
        candidate = FRONTEND_OUT / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        # Next.js static export creates directories with index.html for each route
        candidate_index = FRONTEND_OUT / full_path / "index.html"
        if candidate_index.is_file():
            return FileResponse(str(candidate_index))
        # Fall back to root index.html — Next.js handles the routing client-side
        return FileResponse(str(FRONTEND_OUT / "index.html"))
