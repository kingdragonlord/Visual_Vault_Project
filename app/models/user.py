from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    # The primary key (ID) for the user
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # We want emails to be unique so two people can't register the same one
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # We will NEVER store raw passwords. This will hold the scrambled (hashed) version.
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Is the user allowed to log in?
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)