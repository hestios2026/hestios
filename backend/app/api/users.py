from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import hash_password
from app.core.validators import EmailReq, OptEmail, OptPhone, Password, LangCode, Str100, OptStr100
from app.models.user import User, UserRole
from app.api.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    email: EmailReq
    full_name: Str100
    password: Password
    role: UserRole
    language: LangCode = "ro"


class UserUpdate(BaseModel):
    full_name: Optional[Str100] = None
    role: Optional[UserRole] = None
    language: Optional[LangCode] = None
    is_active: Optional[bool] = None
    password: Optional[Password] = None
    whatsapp_number: Optional[OptPhone] = None
    notify_whatsapp: Optional[bool] = None
    current_site_id: Optional[int] = None
    mobile_pin: Optional[str] = None   # 4-6 digit PIN for mobile app; None = remove PIN


def require_director(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Director access required")
    return current_user


@router.get("/", response_model=List[dict])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_director)):
    users = db.query(User).all()
    return [{
        "id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role,
        "is_active": u.is_active, "language": u.language,
        "whatsapp_number": u.whatsapp_number, "notify_whatsapp": u.notify_whatsapp,
        "current_site_id": u.current_site_id, "mobile_pin": u.mobile_pin,
    } for u in users]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        language=body.language,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}


@router.put("/{user_id}/")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None: user.full_name = body.full_name
    if body.role is not None: user.role = body.role
    if body.language is not None: user.language = body.language
    if body.is_active is not None: user.is_active = body.is_active
    if body.password: user.hashed_password = hash_password(body.password)
    if body.whatsapp_number is not None: user.whatsapp_number = body.whatsapp_number
    if body.notify_whatsapp is not None: user.notify_whatsapp = body.notify_whatsapp
    if body.current_site_id is not None: user.current_site_id = body.current_site_id
    if 'mobile_pin' in body.model_fields_set:
        pin = body.mobile_pin
        if pin and (len(pin) < 4 or not pin.isdigit()):
            raise HTTPException(status_code=400, detail="PIN trebuie să aibă minim 4 cifre")
        user.mobile_pin = pin or None
    db.commit()
    return {"status": "updated"}


@router.delete("/{user_id}/")
def delete_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(require_director)):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}
