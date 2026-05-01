from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import os

# We will grab the database URL from our environment variables.
# If it's not set, we'll fall back to a default local URL.
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://yolo_user:yolo_password@localhost:5432/yolo_db"
)

# The 'engine' is the core connection to the database
engine = create_async_engine(DATABASE_URL, echo=False)

# The 'sessionmaker' creates individual conversations (sessions) with the database
async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    This is a FastAPI 'Dependency'. Every time a user hits an endpoint that needs 
    the database, FastAPI will run this function to open a session, yield it to the 
    endpoint, and then safely close it when the request is done.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise