from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt
import os

# Grab our secret key from the environment (defined in docker-compose.yml)
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-default-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Set up the password scrambler (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Scramble the password so it's unreadable."""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Check if the typed password matches the scrambled one in the database."""
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def create_access_token(user_id: int) -> str:
        """Create a temporary JWT VIP pass for the user."""
        # Calculate when the token should expire
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Package the user's ID and the expiration time into the token
        payload = {
            "sub": str(user_id),
            "exp": expire,
            "type": "access"
        }
        
        # Sign the token with our secret key so hackers can't forge fake ones
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Singleton pattern just like our YOLO model
_auth_service = None

def get_auth_service():
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service