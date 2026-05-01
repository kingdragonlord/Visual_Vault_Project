from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User

class AssetStatus(str, Enum):
    """Processing status of an asset."""
    PENDING = "pending"       # Uploaded, awaiting Celery
    PROCESSING = "processing" # Celery is running ML models
    COMPLETED = "completed"   # Success!
    FAILED = "failed"         # Something crashed

class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    # Identity & Ownership
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # File Information
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # Image Dimensions
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)

    # Processing State
    status: Mapped[str] = mapped_column(String(20), default=AssetStatus.PENDING.value, index=True)
    error_message: Mapped[str | None] = mapped_column(Text)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # ML Features (Saved as JSON strings)
    ml_labels: Mapped[str | None] = mapped_column(Text)       # For CLIP zero-shot labels
    ml_colors: Mapped[str | None] = mapped_column(Text)       # For dominant colors
    ml_text: Mapped[str | None] = mapped_column(Text)         # For future OCR text
    embedding_vector: Mapped[str | None] = mapped_column(Text) # For CLIP similarity search
    custom_tags: Mapped[str | None] = mapped_column(Text)     # User-defined tags

    # Relationships
    user: Mapped["User"] = relationship(back_populates="assets")