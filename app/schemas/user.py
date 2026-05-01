from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    """What the user sends us to register."""
    email: str = Field(..., description="User's email address")
    password: str = Field(..., min_length=8, description="Password (at least 8 characters)")

class UserLogin(BaseModel):
    """What the user sends us to log in."""
    email: str
    password: str

class UserResponse(BaseModel):
    """What we send back when asking for user info (NO PASSWORDS)."""
    id: int
    email: str
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    """The VIP pass we give the user when they successfully log in."""
    access_token: str
    token_type: str = "bearer"