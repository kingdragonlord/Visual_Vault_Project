import os
import json
import asyncio
import sys
from datetime import datetime, timezone
from celery import shared_task
from PIL import Image

# 1. WINDOWS FIX: Prevent the ProactorEventLoop crash in background threads
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.celery_worker import celery_app
from app.models.asset import Asset, AssetStatus
from app.services.storage import get_storage_service
from app.services.model import get_model_service
from app.utils.image import extract_dominant_colors
from app.ml.clip_service import get_clip_service

# Grab the database URL directly from the environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://yolo_user:yolo_password@localhost:5432/yolo_db")

async def _process_asset_async(asset_id: int):
    """The async runner that creates an isolated database connection."""
    
    # 2. ISOLATION FIX: Create a brand new engine specifically for this Celery thread!
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as db:
        # Fetch the asset FIRST, before the try/except block to avoid UnboundLocalError
        asset = await db.get(Asset, asset_id)
        
        if not asset:
            await engine.dispose()
            return {"error": "Asset not found"}
            
        try:
            # Lock the row by setting status
            asset.status = AssetStatus.PROCESSING.value
            await db.commit()

            storage = get_storage_service()
            file_path = storage.base_path / asset.storage_path

            # --- 1. NEW: Generate CLIP Embedding ---
            image = Image.open(file_path)
            if image.mode != "RGB":
                image = image.convert("RGB")
                
            clip = get_clip_service()
            embedding = clip.get_image_embedding(image)
            asset.embedding_vector = json.dumps(embedding.tolist())
            # ---------------------------------------

            # 2. Run YOLO Inference
            model_service = get_model_service()
            yolo_result = model_service.predict(str(file_path))
            
            detected_labels = list(set([d["label"] for d in yolo_result.get("detections", [])]))
            if detected_labels:
                asset.ml_labels = json.dumps(detected_labels)

            # 3. Extract Dominant Colors
            with open(file_path, "rb") as f:
                colors = extract_dominant_colors(f, num_colors=5)
            asset.ml_colors = json.dumps(colors)

            # Mark as success
            asset.status = AssetStatus.COMPLETED.value
            asset.processed_at = datetime.now(timezone.utc)
            await db.commit()

            return {"status": "completed", "asset_id": asset_id}

        except Exception as e:
            # Now, if an error happens, 'asset' is guaranteed to exist!
            asset.status = AssetStatus.FAILED.value
            asset.error_message = str(e)
            await db.commit()
            raise
        finally:
            # Safely close the engine so we don't leak memory
            await engine.dispose()

@celery_app.task(name="process_image_task", bind=True, max_retries=3)
def process_image_task(self, asset_id: int):
    """Celery wrapper that bridges synchronous queues with our async database/ML flow."""
    return asyncio.run(_process_asset_async(asset_id))