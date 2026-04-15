from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import hash_password
from app.core.validators import EmailReq, OptEmail, OptPhone, Password, LangCode, Str100, OptStr100
from typing import Optional as Opt
from app.models.user import User, UserRole
from app.models.site import Site
from app.api.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    email: Optional[EmailReq] = None
    username: Optional[Str100] = None
    full_name: Str100
    password: Password
    role: UserRole
    language: LangCode = "ro"
    mobile_pin: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[Str100] = None
    email: Optional[EmailReq] = None
    username: Optional[Str100] = None
    role: Optional[UserRole] = None
    language: Optional[LangCode] = None
    is_active: Optional[bool] = None
    password: Optional[Password] = None
    whatsapp_number: Optional[OptPhone] = None
    notify_whatsapp: Optional[bool] = None
    current_site_id: Optional[int] = None
    mobile_pin: Optional[str] = None   # 4-6 digit PIN for mobile app; None = remove PIN
    permissions: Optional[dict] = None  # per-module overrides: {"sites": true, "hr": false}


def require_director(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.DIRECTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Director access required")
    return current_user


@router.get("/", response_model=List[dict])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_director)):
    users = db.query(User).all()
    return [{
        "id": u.id, "email": u.email, "username": u.username, "full_name": u.full_name, "role": u.role,
        "is_active": u.is_active, "language": u.language,
        "whatsapp_number": u.whatsapp_number, "notify_whatsapp": u.notify_whatsapp,
        "current_site_id": u.current_site_id, "mobile_pin": u.mobile_pin,
        "permissions": u.permissions or {},
        "assigned_site_ids": [s.id for s in (u.assigned_sites or [])],
    } for u in users]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    if not body.email and not body.username:
        raise HTTPException(status_code=400, detail="Email sau username este obligatoriu")
    if body.email and db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email deja înregistrat")
    if body.username and db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username deja folosit")
    if body.mobile_pin and (len(body.mobile_pin) < 4 or not body.mobile_pin.isdigit()):
        raise HTTPException(status_code=400, detail="PIN trebuie să aibă minim 4 cifre")
    user = User(
        email=body.email or None,
        username=body.username or None,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        language=body.language,
        mobile_pin=body.mobile_pin or None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "username": user.username, "full_name": user.full_name, "role": user.role}


@router.put("/{user_id}/")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None: user.full_name = body.full_name
    if 'email' in body.model_fields_set: user.email = body.email or None
    if 'username' in body.model_fields_set: user.username = body.username or None
    if body.role is not None: user.role = body.role
    if body.language is not None: user.language = body.language
    if body.is_active is not None: user.is_active = body.is_active
    if body.password: user.hashed_password = hash_password(body.password)
    if body.whatsapp_number is not None: user.whatsapp_number = body.whatsapp_number
    if body.notify_whatsapp is not None: user.notify_whatsapp = body.notify_whatsapp
    if body.current_site_id is not None: user.current_site_id = body.current_site_id
    if 'permissions' in body.model_fields_set:
        user.permissions = body.permissions or {}
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


class AssignSitesBody(BaseModel):
    site_ids: List[int]


@router.get("/{user_id}/sites/")
def get_user_sites(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_director)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return [{"id": s.id, "name": s.name, "kostenstelle": s.kostenstelle} for s in (user.assigned_sites or [])]


@router.put("/{user_id}/sites/")
def assign_sites(user_id: int, body: AssignSitesBody, db: Session = Depends(get_db), _: User = Depends(require_director)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    sites = db.query(Site).filter(Site.id.in_(body.site_ids)).all()
    user.assigned_sites = sites
    db.commit()
    return {"assigned": [s.id for s in sites]}
