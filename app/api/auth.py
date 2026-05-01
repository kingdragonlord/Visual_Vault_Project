from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Import our database connection, models, schemas, and security logic
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.auth import get_auth_service

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create a new user in the database."""
    auth_service = get_auth_service()
    
    # 1. Check if the email is already taken
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalars().first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # 2. Scramble the password
    hashed_pw = auth_service.hash_password(user_data.password)
    
    # 3. Create the user object
    new_user = User(email=user_data.email, hashed_password=hashed_pw)
    
    # 4. Save to the database
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)  # Grabs the newly generated ID from the database
    
    # Notice we return the UserResponse schema, which intentionally strips out the password!
    return new_user

@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Verify credentials and return a JWT access token."""
    auth_service = get_auth_service()
    
    # 1. Find the user by email
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalars().first()
    
    # 2. Check if user exists AND password matches
    if not user or not auth_service.verify_password(user_data.password, user.hashed_password):
        # We give a vague error message so hackers don't know if they guessed a valid email
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # 3. Generate the JWT VIP pass
    token = auth_service.create_access_token(user.id)
    
    return {"access_token": token, "token_type": "bearer"}