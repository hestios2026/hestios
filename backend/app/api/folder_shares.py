"""
Folder share links — authenticated management + public access.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone
import uuid
import os

from app.core.database import get_db
from app.api.auth import get_current_user
from app.core.storage import upload_file, get_presigned_url, delete_file
from app.models.folder import Folder
from app.models.folder_share import FolderShare
from app.models.document import Document
from app.models.user import User

router = APIRouter(tags=["folder-shares"])

ALLOWED_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "application/zip",
}
MAX_SIZE = 50 * 1024 * 1024


def _share_dict(s: FolderShare) -> dict:
    return {
        "id": s.id,
        "token": s.token,
        "folder_id": s.folder_id,
        "folder_name": s.folder.name if s.folder else None,
        "label": s.label,
        "can_read": s.can_read,
        "can_upload": s.can_upload,
        "can_delete": s.can_delete,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "created_by": s.created_by,
        "creator_name": s.creator.full_name if s.creator else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "url": f"/share/{s.token}",
    }


def _doc_public(d: Document) -> dict:
    try:
        url = get_presigned_url(d.file_key, expires_seconds=3600)
    except Exception:
        url = None
    return {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "category": d.category,
        "file_size": d.file_size,
        "content_type": d.content_type,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "tags": d.tags,
        "expires_at": d.expires_at.isoformat() if d.expires_at else None,
        "download_url": url,
    }


def _get_valid_share(token: str, db: Session) -> FolderShare:
    s = db.query(FolderShare).filter(FolderShare.token == token).first()
    if not s:
        raise HTTPException(404, "Link invalid sau expirat")
    if s.expires_at and s.expires_at < datetime.now(timezone.utc):
        raise HTTPException(403, "Link-ul a expirat")
    return s


# ── Authenticated: manage shares on a folder ─────────────────────────────────

class ShareCreate(BaseModel):
    label: Optional[str] = None
    can_read: bool = True
    can_upload: bool = False
    can_delete: bool = False
    expires_at: Optional[str] = None   # ISO datetime string or None


@router.get("/folders/{folder_id}/shares/")
def list_shares(
    folder_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    shares = db.query(FolderShare).filter(FolderShare.folder_id == folder_id).all()
    return [_share_dict(s) for s in shares]


@router.post("/folders/{folder_id}/shares/", status_code=201)
def create_share(
    folder_id: int,
    body: ShareCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    f = db.query(Folder).filter(Folder.id == folder_id).first()
    if not f:
        raise HTTPException(404, "Folder negăsit")
    expires = None
    if body.expires_at:
        try:
            expires = datetime.fromisoformat(body.expires_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "Format dată invalid")
    s = FolderShare(
        token=uuid.uuid4().hex,
        folder_id=folder_id,
        label=body.label,
        can_read=body.can_read,
        can_upload=body.can_upload,
        can_delete=body.can_delete,
        expires_at=expires,
        created_by=current.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _share_dict(s)


@router.delete("/folder-shares/{token}/", status_code=204)
def revoke_share(
    token: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    s = db.query(FolderShare).filter(FolderShare.token == token).first()
    if not s:
        raise HTTPException(404, "Share negăsit")
    db.delete(s)
    db.commit()


# ── Public: access shared folder (no auth) ───────────────────────────────────

@router.get("/public/share/{token}/")
def public_get_share(token: str, db: Session = Depends(get_db)):
    s = _get_valid_share(token, db)
    if not s.can_read:
        raise HTTPException(403, "Acces de citire dezactivat")
    docs = db.query(Document).filter(Document.folder_id == s.folder_id).order_by(Document.created_at.desc()).all()
    return {
        "token": s.token,
        "folder_id": s.folder_id,
        "folder_name": s.folder.name if s.folder else None,
        "label": s.label,
        "can_read": s.can_read,
        "can_upload": s.can_upload,
        "can_delete": s.can_delete,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "documents": [_doc_public(d) for d in docs],
    }


@router.post("/public/share/{token}/upload/", status_code=201)
async def public_upload(
    token: str,
    file: UploadFile = File(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    s = _get_valid_share(token, db)
    if not s.can_upload:
        raise HTTPException(403, "Upload dezactivat pentru acest link")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tip de fișier nepermis: {content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Fișierul depășește limita de 50 MB")

    ext = os.path.splitext(file.filename or "file")[1].lower()
    file_key = f"shared/{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4().hex}{ext}"
    upload_file(file_key, data, content_type)

    doc = Document(
        name=file.filename or file_key,
        description=description or None,
        category="other",
        folder_id=s.folder_id,
        file_key=file_key,
        file_size=len(data),
        content_type=content_type,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_public(doc)


@router.delete("/public/share/{token}/documents/{doc_id}/", status_code=204)
def public_delete_doc(token: str, doc_id: int, db: Session = Depends(get_db)):
    s = _get_valid_share(token, db)
    if not s.can_delete:
        raise HTTPException(403, "Ștergere dezactivată pentru acest link")
    d = db.query(Document).filter(Document.id == doc_id, Document.folder_id == s.folder_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    try:
        delete_file(d.file_key)
    except Exception:
        pass
    db.delete(d)
    db.commit()
