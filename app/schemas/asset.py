import json
from pydantic import field_validator
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AssetResponse(BaseModel):
    """Schema for asset responses, returning metadata but hiding backend paths."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    width: int | None = None
    height: int | None = None
    status: str
    created_at: datetime
    processed_at: datetime | None = None

class AssetUploadResponse(BaseModel):
    """Schema for the immediate response after a successful upload."""
    id: int
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    status: str
    message: str = "File uploaded successfully. Processing will begin shortly."

class AssetDetail(AssetResponse):
    """Detailed response that includes all the background ML extraction data."""
    ml_labels: list[str] | None = None
    ml_colors: list[dict] | None = None
    error_message: str | None = None

    @field_validator('ml_labels', 'ml_colors', mode='before')
    @classmethod
    def parse_json_strings(cls, v):
        """Automatically convert the database JSON strings back into Python lists/dicts!"""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return v