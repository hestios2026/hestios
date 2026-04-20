from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.reclamatie import Reclamatie, ReclamatieType, ReclamatiePriority, ReclamatieStatus
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/reclamatii", tags=["reclamatii"])


class ReclamatieCreate(BaseModel):
    title: str
    type: ReclamatieType = ReclamatieType.INTERNAL
    priority: ReclamatiePriority = ReclamatiePriority.NORMAL
    description: str
    site_id: Optional[int] = None
    assigned_to: Optional[int] = None


class ReclamatieUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[ReclamatieType] = None
    priority: Optional[ReclamatiePriority] = None
    status: Optional[ReclamatieStatus] = None
    description: Optional[str] = None
    resolution_notes: Optional[str] = None
    site_id: Optional[int] = None
    assigned_to: Optional[int] = None


def _dict(r: Reclamatie):
    return {
        "id":               r.id,
        "title":            r.title,
        "type":             r.type,
        "priority":         r.priority,
        "status":           r.status,
        "description":      r.description,
        "resolution_notes": r.resolution_notes,
        "site_id":          r.site_id,
        "site_name":        r.site.name if r.site else None,
        "assigned_to":      r.assigned_to,
        "assigned_name":    r.assignee.full_name if r.assignee else None,
        "created_by":       r.created_by,
        "created_by_name":  r.creator.full_name if r.creator else None,
        "created_at":       r.created_at,
        "updated_at":       r.updated_at,
        "resolved_at":      r.resolved_at,
    }


@router.get("/")
def list_reclamatii(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    type: Optional[str] = None,
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = db.query(Reclamatie)
    if status:   q = q.filter(Reclamatie.status == status)
    if priority: q = q.filter(Reclamatie.priority == priority)
    if type:     q = q.filter(Reclamatie.type == type)
    if site_id:  q = q.filter(Reclamatie.site_id == site_id)
    return [_dict(r) for r in q.order_by(
        Reclamatie.status.in_(["open", "in_progress"]).desc(),
        Reclamatie.priority.in_(["urgent", "high"]).desc(),
        Reclamatie.created_at.desc()
    ).all()]


@router.post("/", status_code=201)
def create_reclamatie(
    body: ReclamatieCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    r = Reclamatie(
        title=body.title,
        type=body.type,
        priority=body.priority,
        description=body.description,
        site_id=body.site_id,
        assigned_to=body.assigned_to,
        created_by=current.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _dict(r)


@router.patch("/{rid}/")
def update_reclamatie(
    rid: int,
    body: ReclamatieUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    r = db.query(Reclamatie).filter(Reclamatie.id == rid).first()
    if not r:
        raise HTTPException(404, "Reclamatie negăsită")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(r, field, value)

    # Set resolved_at when status changes to resolved/closed
    if body.status in (ReclamatieStatus.RESOLVED, ReclamatieStatus.CLOSED) and not r.resolved_at:
        r.resolved_at = datetime.now(timezone.utc)
    elif body.status in (ReclamatieStatus.OPEN, ReclamatieStatus.IN_PROGRESS):
        r.resolved_at = None

    db.commit()
    db.refresh(r)
    return _dict(r)


@router.delete("/{rid}/", status_code=204)
def delete_reclamatie(
    rid: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    r = db.query(Reclamatie).filter(Reclamatie.id == rid).first()
    if not r:
        raise HTTPException(404, "Reclamatie negăsită")
    if current.role != "director" and r.created_by != current.id:
        raise HTTPException(403, "Acces interzis")
    db.delete(r)
    db.commit()
