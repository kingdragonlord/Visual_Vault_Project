import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

class StorageService:
    """
    A unified service for validating and storing files.
    In the future, this abstraction makes it very easy to swap 
    out local storage for AWS S3 or Google Cloud Storage!
    """

    ALLOWED_IMAGE_TYPES = {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"
    }
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB limit

    def __init__(self, base_path: str = "storage/uploads"):
        self.base_path = Path(base_path)
        # Ensure the base directory exists
        self.base_path.mkdir(parents=True, exist_ok=True)

    def validate_image(self, content_type: str, file_size: int) -> tuple[bool, str]:
        """Check if the file is an allowed image format and under the size limit."""
        if content_type not in self.ALLOWED_IMAGE_TYPES:
            return False, f"File type '{content_type}' is not allowed. Please upload a standard image."
        
        if file_size > self.MAX_FILE_SIZE:
            return False, "File exceeds the 50MB maximum size limit."
            
        return True, ""

    def _generate_unique_filename(self, original_filename: str) -> str:
        """
        Generate a cryptographically unique filename to prevent overwriting
        files if two users upload an image named 'photo.jpg' at the same time.
        """
        ext = Path(original_filename).suffix.lower()
        unique_id = uuid.uuid4().hex[:16]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        return f"{timestamp}_{unique_id}{ext}"

    async def save_file(self, file: BinaryIO, filename: str, content_type: str, user_id: int) -> str:
        """Saves the file to the hard drive organized by User ID and Date."""
        unique_name = self._generate_unique_filename(filename)

        # Create a clean directory structure: storage/uploads/{user_id}/{year}/{month}/
        now = datetime.utcnow()
        user_path = self.base_path / str(user_id) / str(now.year) / f"{now.month:02d}"
        user_path.mkdir(parents=True, exist_ok=True)

        file_path = user_path / unique_name

        # Write the file in chunks to prevent RAM overflow on huge images
        with open(file_path, "wb") as dest:
            shutil.copyfileobj(file, dest)

        # Return the relative path so we can save it to the PostgreSQL database
        return str(file_path.relative_to(self.base_path))

    async def get_file_path(self, storage_path: str) -> Path | None:
        """Look up the physical path of a saved file."""
        full_path = self.base_path / storage_path
        if full_path.exists():
            return full_path
        return None

    async def delete_file(self, storage_path: str) -> bool:
        """Delete a file from the hard drive."""
        full_path = self.base_path / storage_path
        if full_path.exists():
            full_path.unlink()
            return True
        return False

# Create a Singleton instance of the service
_storage_service = None

def get_storage_service():
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service