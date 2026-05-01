import io

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.models.asset import Asset, AssetStatus
from app.api.deps import get_current_user
from app.schemas.asset import AssetUploadResponse, AssetResponse
from app.services.storage import get_storage_service
from app.utils.image import get_image_dimensions, validate_image_integrity
from app.tasks import process_image_task
from app.schemas.asset import AssetDetail

router = APIRouter()

@router.post("/upload", response_model=AssetUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    storage = get_storage_service()

    # 1. First-pass validation
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Could not determine file type")

    content = await file.read()
    file_size = len(content)

    is_valid, error = storage.validate_image(file.content_type, file_size)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    # 2. Deep image integrity check
    file_obj = io.BytesIO(content)
    is_valid_img, img_error = validate_image_integrity(file_obj)
    if not is_valid_img:
        raise HTTPException(status_code=400, detail=img_error)

    # 3. Extract dimensions
    dimensions = get_image_dimensions(file_obj)
    width, height = dimensions if dimensions else (None, None)

    # 4. Save to permanent storage (resets byte position first)
    file_obj.seek(0)
    storage_path = await storage.save_file(
        file=file_obj,
        filename=file.filename or "unnamed",
        content_type=file.content_type,
        user_id=current_user.id,
    )

    # 5. Create the database record
    asset = Asset(
        user_id=current_user.id,
        filename=storage_path.split("/")[-1],
        original_filename=file.filename or "unnamed",
        content_type=file.content_type,
        file_size=file_size,
        storage_path=storage_path,
        width=width,
        height=height,
        status=AssetStatus.PENDING.value,
    )

    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    # 6. Drop the ticket for Celery!
    process_image_task.delay(asset.id)

    return AssetUploadResponse(
        id=asset.id,
        filename=asset.filename,
        original_filename=asset.original_filename,
        content_type=asset.content_type,
        file_size=asset.file_size,
        status=asset.status,
    )

@router.get("/", response_model=list[AssetResponse])
async def list_assets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all assets for the logged-in user to build their gallery."""
    result = await db.execute(
        select(Asset).where(Asset.user_id == current_user.id).order_by(Asset.created_at.desc())
    )
    return result.scalars().all()

@router.get("/{asset_id}/file")
async def download_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the physical image file from storage."""
    asset = await db.get(Asset, asset_id)
    if not asset or asset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Asset not found")

    storage = get_storage_service()
    file_path = await storage.get_file_path(asset.storage_path)

    if not file_path:
        raise HTTPException(status_code=404, detail="File not found in storage")

    return FileResponse(
        path=file_path,
        media_type=asset.content_type,
        filename=asset.original_filename,
    )

@router.get("/{asset_id}", response_model=AssetDetail)
async def get_asset_details(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch the full ML details (colors, labels) for a specific image."""
    asset = await db.get(Asset, asset_id)
    
    if not asset or asset.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    return asset