"""
Tagesbericht API — mobile field reporting endpoints.
POST /tagesbericht/          — create entry (sync from mobile)
POST /tagesbericht/photos/   — upload photo for an entry
GET  /tagesbericht/          — list entries (filter by site_id, date)
GET  /tagesbericht/{id}/     — get single entry with photos
"""
from __future__ import annotations

import io
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.tagesbericht import TagesberichtEntry, TagesberichtPhoto
from app.models.user import User

try:
    from app.core.storage import upload_file, get_presigned_url
    STORAGE_AVAILABLE = True
except ImportError:
    STORAGE_AVAILABLE = False

router = APIRouter(prefix="/tagesbericht", tags=["tagesbericht"])


def _fresh_url(s3_key: str) -> str:
    """Generate a fresh 7-day presigned URL for a given S3 key."""
    if STORAGE_AVAILABLE and s3_key and not s3_key.startswith("http"):
        try:
            return get_presigned_url(s3_key, expires_seconds=86400 * 7)
        except Exception:
            pass
    return s3_key


# ─── Schemas ──────────────────────────────────────────────────────────────────

class EntryIn(BaseModel):
    id: str                   # local UUID from mobile
    site_id: int
    nvt_number: str = ""
    work_type: str
    created_by: int
    created_by_name: str = ""
    created_at: str           # ISO string
    data: dict


class EntryOut(BaseModel):
    id: int
    local_uuid: str
    site_id: int
    work_type: str
    nvt_number: str
    created_by: int
    created_at: str
    synced_at: str
    data: dict
    photos: list[dict] = []

    class Config:
        from_attributes = True


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
def create_entry(
    body: EntryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Idempotent — skip if already synced
    existing = db.query(TagesberichtEntry).filter_by(local_uuid=body.id).first()
    if existing:
        return {"id": existing.id, "status": "already_synced"}

    # Strip photos from data before storing (photos uploaded separately)
    data_clean = {k: v for k, v in body.data.items() if k != "photos"}

    try:
        created_at = datetime.fromisoformat(body.created_at.replace("Z", "+00:00"))
    except Exception:
        created_at = datetime.utcnow()

    entry = TagesberichtEntry(
        local_uuid=body.id,
        site_id=body.site_id,
        work_type=body.work_type,
        nvt_number=body.nvt_number,
        created_by=body.created_by,
        created_at=created_at,
        data=data_clean,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "status": "created"}


@router.post("/photos/")
async def upload_photo(
    entry_id: int = Form(...),
    category: str = Form(default="Altele"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(TagesberichtEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")

    content = await file.read()
    filename = f"tagesbericht/{entry.site_id}/{entry.work_type}/{entry_id}_{uuid.uuid4().hex[:8]}.jpg"
    url = filename  # fallback if storage unavailable

    if STORAGE_AVAILABLE:
        try:
            upload_file(filename, content, content_type="image/jpeg")
            url = get_presigned_url(filename, expires_seconds=86400 * 7)  # 7 days
        except Exception:
            pass

    photo = TagesberichtPhoto(
        entry_id=entry_id,
        category=category,
        filename=file.filename or filename,
        s3_key=filename,
        url=url,
        file_size=len(content),
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return {"id": photo.id, "url": url}


@router.get("/")
def list_entries(
    site_id: Optional[int] = Query(None),
    work_type: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(TagesberichtEntry)
    if site_id:
        q = q.filter(TagesberichtEntry.site_id == site_id)
    if work_type:
        q = q.filter(TagesberichtEntry.work_type == work_type)
    if date_from:
        q = q.filter(TagesberichtEntry.created_at >= date_from)
    if date_to:
        q = q.filter(TagesberichtEntry.created_at <= date_to)
    entries = q.order_by(TagesberichtEntry.created_at.desc()).limit(limit).all()

    result = []
    for e in entries:
        photos = db.query(TagesberichtPhoto).filter_by(entry_id=e.id).all()
        result.append({
            "id": e.id,
            "local_uuid": e.local_uuid,
            "site_id": e.site_id,
            "work_type": e.work_type,
            "nvt_number": e.nvt_number,
            "created_by": e.created_by,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "synced_at": e.synced_at.isoformat() if e.synced_at else None,
            "data": e.data,
            "photos": [{"id": p.id, "category": p.category, "url": _fresh_url(p.s3_key), "filename": p.filename} for p in photos],
        })
    return result


@router.get("/{entry_id}/")
def get_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(TagesberichtEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(404, "Not found")
    photos = db.query(TagesberichtPhoto).filter_by(entry_id=entry_id).all()
    return {
        "id": entry.id,
        "local_uuid": entry.local_uuid,
        "site_id": entry.site_id,
        "work_type": entry.work_type,
        "nvt_number": entry.nvt_number,
        "created_by": entry.created_by,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "synced_at": entry.synced_at.isoformat() if entry.synced_at else None,
        "data": entry.data,
        "photos": [{"id": p.id, "category": p.category, "url": _fresh_url(p.s3_key), "filename": p.filename} for p in photos],
    }
