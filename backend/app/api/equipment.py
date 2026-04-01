from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from app.core.database import get_db
from app.core.validators import Str200, OptStr100, OptStr200, OptText
from app.models.equipment import Equipment, EquipmentStatus, EquipmentMovement
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/equipment", tags=["equipment"])


class EquipmentCreate(BaseModel):
    name: Str200
    category: Optional[OptStr100] = None
    brand: Optional[OptStr100] = None
    model: Optional[OptStr100] = None
    year: Optional[int] = Field(default=None, ge=1900, le=2100)
    serial_number: Optional[OptStr100] = None
    current_site_id: Optional[int] = None
    service_due: Optional[str] = None
    itp_due: Optional[str] = None
    notes: Optional[OptText] = None


class EquipmentUpdate(BaseModel):
    name: Optional[Str200] = None
    category: Optional[OptStr100] = None
    brand: Optional[OptStr100] = None
    model: Optional[OptStr100] = None
    year: Optional[int] = Field(default=None, ge=1900, le=2100)
    serial_number: Optional[OptStr100] = None
    status: Optional[EquipmentStatus] = None
    current_site_id: Optional[int] = None
    service_due: Optional[str] = None
    itp_due: Optional[str] = None
    notes: Optional[OptText] = None


class MovementCreate(BaseModel):
    to_site_id: Optional[int] = None
    notes: Optional[OptText] = None


def _eq_dict(e: Equipment):
    return {
        "id": e.id,
        "name": e.name,
        "category": e.category,
        "brand": e.brand,
        "model": e.model,
        "year": e.year,
        "serial_number": e.serial_number,
        "status": e.status,
        "current_site_id": e.current_site_id,
        "current_site_name": e.current_site.name if e.current_site else None,
        "service_due": e.service_due,
        "itp_due": e.itp_due,
        "notes": e.notes,
        "created_at": e.created_at,
    }


@router.get("/")
def list_equipment(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = db.query(Equipment).order_by(Equipment.name).all()
    return [_eq_dict(e) for e in items]


@router.post("/", status_code=201)
def create_equipment(body: EquipmentCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    eq = Equipment(**body.model_dump())
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return _eq_dict(eq)


@router.get("/{eq_id}/")
def get_equipment(eq_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    return _eq_dict(eq)


@router.put("/{eq_id}/")
def update_equipment(eq_id: int, body: EquipmentUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(eq, k, v)
    db.commit()
    db.refresh(eq)
    return _eq_dict(eq)


@router.post("/{eq_id}/move/")
def move_equipment(eq_id: int, body: MovementCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    movement = EquipmentMovement(
        equipment_id=eq_id,
        from_site_id=eq.current_site_id,
        to_site_id=body.to_site_id,
        moved_by=current.id,
        notes=body.notes,
    )
    eq.current_site_id = body.to_site_id
    db.add(movement)
    db.commit()
    return {"status": "moved"}


@router.get("/{eq_id}/movements/")
def get_movements(eq_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    movements = (
        db.query(EquipmentMovement)
        .filter(EquipmentMovement.equipment_id == eq_id)
        .order_by(EquipmentMovement.moved_at.desc())
        .all()
    )
    return [{
        "id": m.id,
        "from_site": m.from_site.name if m.from_site else "—",
        "to_site": m.to_site.name if m.to_site else "—",
        "moved_by": m.mover.full_name if m.mover else "—",
        "moved_at": m.moved_at,
        "notes": m.notes,
    } for m in movements]
