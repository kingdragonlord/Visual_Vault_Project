import json
import numpy as np
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.user import User
from app.models.asset import Asset, AssetStatus
from app.api.deps import get_current_user
from app.ml.clip_service import get_clip_service
from app.schemas.asset import AssetResponse

router = APIRouter()

# --- Search Schemas ---
class TextSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="What are you looking for?")
    limit: int = Field(20, ge=1, le=100)
    min_similarity: float = Field(0.2, ge=0.0, le=1.0)

class SearchResult(BaseModel):
    asset: AssetResponse
    similarity: float

# --- Helper Function ---
async def get_user_embeddings(db: AsyncSession, user_id: int):
    """Loads all completed image embeddings for the user from the database."""
    result = await db.execute(
        select(Asset)
        .where(Asset.user_id == user_id)
        .where(Asset.status == AssetStatus.COMPLETED.value)
        .where(Asset.embedding_vector.isnot(None))
    )
    assets = result.scalars().all()
    
    embeddings = []
    for asset in assets:
        try:
            vector = np.array(json.loads(asset.embedding_vector))
            embeddings.append((asset, vector))
        except (json.JSONDecodeError, TypeError):
            continue
    return embeddings

# --- Search Endpoint ---
@router.post("/text", response_model=list[SearchResult])
async def search_by_text(
    request: TextSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Semantic AI Search using Natural Language!"""
    clip_service = get_clip_service()
    
    # 1. Turn the user's text into a math vector
    query_embedding = clip_service.get_text_embedding(request.query)

    # 2. Get all of the user's image vectors from the database
    asset_embeddings = await get_user_embeddings(db, current_user.id)
    if not asset_embeddings:
        return []

    # 3. Compute cosine similarity (Dot Product)
    results = []
    for asset, embedding in asset_embeddings:
        similarity = float(np.dot(query_embedding, embedding))
        
        if similarity >= request.min_similarity:
            results.append(SearchResult(asset=asset, similarity=round(similarity, 4)))

    # 4. Sort the results with the highest match at the top
    results.sort(key=lambda x: x.similarity, reverse=True)
    return results[:request.limit]