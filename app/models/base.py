from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    """
    Every database model we create will inherit from this Base class.
    It tells SQLAlchemy to keep track of our tables.
    """
    pass

class TimestampMixin:
    """
    A handy mixin class. If we add this to our models, they will automatically 
    keep track of exactly when they were created and last updated!
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )