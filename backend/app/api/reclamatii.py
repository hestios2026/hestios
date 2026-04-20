import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.reclamatie import Reclamatie, ReclamatieType, ReclamatiePriority, ReclamatieStatus
from app.models.reclamatie_attachment import ReclamatieAttachment
from app.models.user import User
from app.api.auth import get_current_user
from app.core.storage import upload_file, get_presigned_url, delete_file

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


def _attachment_dict(a: ReclamatieAttachment):
    try:
        url = get_presigned_url(a.file_key)
    except Exception:
        url = None
    return {
        "id":           a.id,
        "filename":     a.filename,
        "content_type": a.content_type,
        "file_size":    a.file_size,
        "url":          url,
        "uploaded_by":  a.uploader.full_name if a.uploader else None,
        "created_at":   a.created_at,
    }


def _dict(r: Reclamatie, db: Session = None):
    base = {
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
        "attachments":      [],
    }
    if db is not None:
        atts = db.query(ReclamatieAttachment).filter(ReclamatieAttachment.reclamatie_id == r.id).all()
        base["attachments"] = [_attachment_dict(a) for a in atts]
    return base


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
    return [_dict(r, db) for r in q.order_by(
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
    return _dict(r, db)


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
    return _dict(r, db)


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


# ─── Attachments ──────────────────────────────────────────────────────────────

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/{rid}/attachments/", status_code=201)
async def upload_attachment(
    rid: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    r = db.query(Reclamatie).filter(Reclamatie.id == rid).first()
    if not r:
        raise HTTPException(404, "Reclamatie negăsită")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Fișierul depășește 20 MB")

    ct = file.content_type or "application/octet-stream"
    if ct not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tip fișier nepermis: {ct}")

    ext = os.path.splitext(file.filename or "")[1].lower()
    file_key = f"reclamatii/{rid}/{uuid.uuid4().hex}{ext}"
    upload_file(file_key, data, ct)

    att = ReclamatieAttachment(
        reclamatie_id=rid,
        file_key=file_key,
        filename=file.filename or "attachment",
        content_type=ct,
        file_size=len(data),
        uploaded_by=current.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return _attachment_dict(att)


@router.get("/{rid}/attachments/")
def list_attachments(
    rid: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    r = db.query(Reclamatie).filter(Reclamatie.id == rid).first()
    if not r:
        raise HTTPException(404, "Reclamatie negăsită")
    atts = db.query(ReclamatieAttachment).filter(ReclamatieAttachment.reclamatie_id == rid).all()
    return [_attachment_dict(a) for a in atts]


@router.delete("/{rid}/attachments/{aid}/", status_code=204)
def delete_attachment(
    rid: int,
    aid: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    att = db.query(ReclamatieAttachment).filter(
        ReclamatieAttachment.id == aid,
        ReclamatieAttachment.reclamatie_id == rid,
    ).first()
    if not att:
        raise HTTPException(404, "Atașament negăsit")
    if current.role != "director" and att.uploaded_by != current.id:
        raise HTTPException(403, "Acces interzis")
    try:
        delete_file(att.file_key)
    except Exception:
        pass
    db.delete(att)
    db.commit()
