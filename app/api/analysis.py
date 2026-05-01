import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image

from app.database import get_db
from app.models.user import User
from app.models.asset import Asset
from app.api.deps import get_current_user
from app.services.storage import get_storage_service
from app.ml.style_transfer import get_style_service, PRESET_STYLES

router = APIRouter()

@router.get("/styles")
async def list_styles():
    """List all available Generative AI preset styles."""
    return {"presets": PRESET_STYLES}

@router.get("/style/{asset_id}", responses={200: {"content": {"image/png": {}}}})
async def apply_preset_style(
    asset_id: int,
    preset: str = Query(..., description="Name of the preset style (e.g., cyberpunk, van_gogh)"),
    alpha: float = Query(0.75, ge=0.1, le=1.0, description="Style strength (0.1 = subtle, 1.0 = intense)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Apply a generative AI style to an image using Stable Diffusion."""
    if preset not in PRESET_STYLES:
        raise HTTPException(status_code=400, detail=f"Unknown preset. Available: {list(PRESET_STYLES.keys())}")

    asset = await db.get(Asset, asset_id)
    if not asset or asset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Asset not found")

    storage = get_storage_service()
    file_path = await storage.get_file_path(asset.storage_path)
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found in storage")

    style_service = get_style_service()
    try:
        # Run the Generative AI Pipeline
        result = style_service.transfer_preset(
            content=str(file_path),
            preset_name=preset,
            alpha=alpha
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Style transfer failed: {str(e)}")

    # Return the raw image bytes directly to the browser!
    return Response(
        content=result.image_bytes,
        media_type="image/png",
        headers={
            "X-Style": result.style_name, 
            "X-Inference-Time-Ms": str(round(result.inference_time_ms, 2))
        }
    )

@router.post("/style/{asset_id}/custom", responses={200: {"content": {"image/png": {}}}})
async def apply_custom_style(
    asset_id: int,
    style_file: UploadFile = File(..., description="Upload an image to steal its style!"),
    alpha: float = Query(1.0, ge=0.1, le=1.0, description="Style strength"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Apply a custom style image using classic VGG-19 Gram Matrix optimization."""
    asset = await db.get(Asset, asset_id)
    if not asset or asset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Asset not found")

    storage = get_storage_service()
    file_path = await storage.get_file_path(asset.storage_path)
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")

    # Load the user's custom style image
    style_content = await style_file.read()
    style_image = Image.open(io.BytesIO(style_content))

    style_service = get_style_service()
    try:
        result = style_service.transfer(
            content=str(file_path),
            style=style_image,
            alpha=alpha,
            num_steps=20  # Kept low so your CPU doesn't melt
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Style transfer failed: {str(e)}")

    return Response(
        content=result.image_bytes,
        media_type="image/png"
    )