from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from datetime import timedelta
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/")


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "language": user.language,
        "permissions": user.permissions or {},
    }


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/login/", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.email == form.username) | (User.username == form.username)
    ).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    payload = {"sub": str(user.id), "role": user.role}
    return {
        "access_token":  create_access_token(payload),
        "refresh_token": create_refresh_token(payload),
        "token_type": "bearer",
        "user": _user_dict(user),
    }


@router.post("/refresh/")
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    new_payload = {"sub": str(user.id), "role": user.role}
    return {
        "access_token":  create_access_token(new_payload),
        "refresh_token": create_refresh_token(new_payload),
        "token_type": "bearer",
        "user": _user_dict(user),
    }


@router.get("/me/")
def me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)


@router.get("/mobile-users/")
def mobile_users(db: Session = Depends(get_db)):
    """Public endpoint — returns users that have a PIN set, for the mobile user-selector screen."""
    users = (
        db.query(User)
        .filter(User.is_active == True, User.mobile_pin != None, User.mobile_pin != "")
        .order_by(User.full_name)
        .all()
    )
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in users]


class PinLoginRequest(BaseModel):
    user_id: int
    pin: str


@router.post("/pin-login/")
def pin_login(body: PinLoginRequest, db: Session = Depends(get_db)):
    """Mobile app PIN authentication — requires user_id + PIN."""
    if not body.pin or len(body.pin) < 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PIN prea scurt")
    user = db.query(User).filter(
        User.id == body.user_id,
        User.mobile_pin == body.pin,
        User.is_active == True,
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN incorect")
    payload = {"sub": str(user.id), "role": user.role}
    return {
        "token": create_access_token(payload, expires_delta=timedelta(days=30)),
        "user": _user_dict(user),
    }
