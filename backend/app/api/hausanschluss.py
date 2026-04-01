from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from app.core.database import get_db
from app.core.validators import Str100, OptStr100, OptStr300, OptStr50, OptEmail, OptPhone, OptText
from app.models.hausanschluss import Hausanschluss, HausanschlussStatus
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/programari", tags=["programari"])


class ProgramareCreate(BaseModel):
    client_name: Str100
    client_phone: Optional[OptPhone] = None
    address: OptStr300
    city: Optional[OptStr100] = None
    zip_code: Optional[OptStr50] = None
    connection_type: Optional[OptStr50] = None
    scheduled_date: datetime
    assigned_site_id: Optional[int] = None
    assigned_team_id: Optional[int] = None
    notes: Optional[OptText] = None


class ProgramareUpdate(BaseModel):
    client_name: Optional[Str100] = None
    client_phone: Optional[OptPhone] = None
    address: Optional[OptStr300] = None
    city: Optional[OptStr100] = None
    scheduled_date: Optional[datetime] = None
    assigned_site_id: Optional[int] = None
    assigned_team_id: Optional[int] = None
    status: Optional[HausanschlussStatus] = None
    notes: Optional[OptText] = None


def _dict(h: Hausanschluss):
    return {
        "id": h.id,
        "client_name": h.client_name,
        "client_phone": h.client_phone,
        "address": h.address,
        "city": h.city,
        "zip_code": h.zip_code,
        "connection_type": h.connection_type,
        "status": h.status,
        "scheduled_date": h.scheduled_date,
        "assigned_site_id": h.assigned_site_id,
        "assigned_site_name": h.site.name if h.site else None,
        "assigned_team_id": h.assigned_team_id,
        "assigned_team_name": h.team_leader.full_name if h.team_leader else None,
        "notes": h.notes,
        "created_at": h.created_at,
        "completed_at": h.completed_at,
    }


@router.get("/")
def list_programari(
    day: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Hausanschluss).order_by(Hausanschluss.scheduled_date)
    if day:
        q = q.filter(
            Hausanschluss.scheduled_date >= datetime.combine(day, datetime.min.time()),
            Hausanschluss.scheduled_date < datetime.combine(day, datetime.max.time()),
        )
    if date_from:
        q = q.filter(Hausanschluss.scheduled_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(Hausanschluss.scheduled_date < datetime.combine(date_to, datetime.max.time()))
    if site_id:
        q = q.filter(Hausanschluss.assigned_site_id == site_id)
    if status:
        q = q.filter(Hausanschluss.status == status)
    return [_dict(h) for h in q.all()]


@router.post("/", status_code=201)
def create_programare(body: ProgramareCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    h = Hausanschluss(**body.model_dump(), created_by=current.id, status=HausanschlussStatus.SCHEDULED)
    db.add(h)
    db.commit()
    db.refresh(h)
    return _dict(h)


@router.put("/{item_id}/")
def update_programare(item_id: int, body: ProgramareUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    h = db.query(Hausanschluss).filter(Hausanschluss.id == item_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    data = body.model_dump(exclude_none=True)
    if data.get("status") == HausanschlussStatus.DONE and not h.completed_at:
        data["completed_at"] = datetime.utcnow()
    for k, v in data.items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return _dict(h)


@router.delete("/{item_id}/", status_code=204)
def delete_programare(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    h = db.query(Hausanschluss).filter(Hausanschluss.id == item_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    db.delete(h)
    db.commit()
