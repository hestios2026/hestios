from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid
import os

from app.core.database import get_db
from app.api.auth import get_current_user
from app.core.storage import upload_file, get_presigned_url, delete_file, get_file_content
from app.models.document import Document
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "application/zip",
}
MAX_SIZE = 50 * 1024 * 1024  # 50 MB

CATEGORIES_FALLBACK = ("contract", "invoice", "offer", "permit", "plan", "photo", "report", "technical", "safety", "certificate", "correspondence", "other")


def _valid_categories(db) -> tuple:
    """Return allowed category keys from DB settings (or fallback)."""
    try:
        from app.api.settings import _get_raw_categories
        cats = _get_raw_categories(db)
        return tuple(c["key"] for c in cats)
    except Exception:
        return CATEGORIES_FALLBACK


def _doc_dict(d: Document, include_url=False):
    result = {
        "id": d.id,
        "name": d.name,
        "description": d.description,
        "category": d.category,
        "site_id": d.site_id,
        "site_name": d.site.name if d.site else None,
        "employee_id": d.employee_id,
        "employee_name": f"{d.employee.vorname} {d.employee.nachname}" if d.employee else None,
        "equipment_id": d.equipment_id,
        "equipment_name": d.equipment.name if d.equipment else None,
        "folder_id": d.folder_id,
        "folder_name": d.folder.name if d.folder else None,
        "file_key": d.file_key,
        "file_size": d.file_size,
        "content_type": d.content_type,
        "uploaded_by": d.uploaded_by,
        "uploader_name": d.uploader.full_name if d.uploader else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "notes": d.notes,
    }
    if include_url:
        try:
            result["download_url"] = get_presigned_url(d.file_key)
        except Exception:
            result["download_url"] = None
    return result


@router.get("/")
def list_documents(
    category: Optional[str] = None,
    site_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    equipment_id: Optional[int] = None,
    folder_id: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Document)
    if category:
        q = q.filter(Document.category == category)
    if site_id:
        q = q.filter(Document.site_id == site_id)
    if employee_id:
        q = q.filter(Document.employee_id == employee_id)
    if equipment_id:
        q = q.filter(Document.equipment_id == equipment_id)
    if folder_id is not None:
        q = q.filter(Document.folder_id == folder_id)
    if search:
        q = q.filter(Document.name.ilike(f"%{search}%"))
    docs = q.order_by(Document.created_at.desc()).all()
    return [_doc_dict(d) for d in docs]


@router.post("/upload/", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("other"),
    description: str = Form(""),
    site_id: Optional[str] = Form(None),
    employee_id: Optional[str] = Form(None),
    equipment_id: Optional[str] = Form(None),
    folder_id: Optional[str] = Form(None),
    notes: str = Form(""),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Tip de fișier nepermis: {content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Fișierul depășește limita de 50 MB")
    if category not in _valid_categories(db):
        category = "other"

    ext = os.path.splitext(file.filename or "file")[1].lower()
    file_key = f"{category}/{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4().hex}{ext}"

    upload_file(file_key, data, content_type)

    doc = Document(
        name=file.filename or file_key,
        description=description or None,
        category=category,
        site_id=int(site_id) if site_id else None,
        employee_id=int(employee_id) if employee_id else None,
        equipment_id=int(equipment_id) if equipment_id else None,
        folder_id=int(folder_id) if folder_id else None,
        file_key=file_key,
        file_size=len(data),
        content_type=content_type,
        uploaded_by=current.id,
        notes=notes or None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _doc_dict(doc, include_url=True)


@router.get("/{doc_id}/")
def get_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    return _doc_dict(d, include_url=True)


@router.get("/{doc_id}/download/")
def download_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    url = get_presigned_url(d.file_key, expires_seconds=300)
    return RedirectResponse(url=url)


@router.get("/{doc_id}/view/")
def view_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Stream file bytes directly from MinIO — no redirect, no CORS/X-Frame-Options issues."""
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    try:
        data = get_file_content(d.file_key)
    except Exception:
        raise HTTPException(500, "Eroare la citirea fișierului")
    return Response(
        content=data,
        media_type=d.content_type,
        headers={"Content-Disposition": f'inline; filename="{d.name}"'},
    )


@router.get("/{doc_id}/content/")
def get_document_content(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    if not d.content_type.startswith("text/"):
        raise HTTPException(400, "Documentul nu este text")
    try:
        data = get_file_content(d.file_key)
        return Response(content=data.decode("utf-8", errors="replace"), media_type="text/plain; charset=utf-8")
    except Exception:
        raise HTTPException(500, "Eroare la citirea fișierului")


class ContentBody(BaseModel):
    content: str


@router.put("/{doc_id}/content/")
def update_document_content(
    doc_id: int,
    body: ContentBody,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    if not d.content_type.startswith("text/"):
        raise HTTPException(400, "Documentul nu este text")
    if current.role not in ("director", "projekt_leiter") and d.uploaded_by != current.id:
        raise HTTPException(403, "Acces interzis")
    try:
        data = body.content.encode("utf-8")
        upload_file(d.file_key, data, d.content_type)
        d.file_size = len(data)
        db.commit()
        return {"ok": True, "file_size": len(data)}
    except Exception:
        raise HTTPException(500, "Eroare la salvarea fișierului")


OFFICE_EDITABLE = {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

def _office_doc_type(content_type: str) -> str:
    if "word" in content_type or content_type == "application/msword":
        return "word"
    if "excel" in content_type or "spreadsheet" in content_type:
        return "cell"
    if "powerpoint" in content_type or "presentation" in content_type:
        return "slide"
    return "word"

def _office_file_type(content_type: str) -> str:
    mapping = {
        "application/msword": "doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-powerpoint": "ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    }
    return mapping.get(content_type, "docx")


def _office_file_token(doc_id: int) -> str:
    """Generate a short-lived HMAC token for unauthenticated file download by OnlyOffice."""
    import hmac as _hmac, hashlib, time
    secret = os.environ.get("SECRET_KEY", "dev_secret")
    # Token valid for 2 hours, anchored to the current hour
    ts = str(int(time.time()) // 7200)
    return _hmac.new(secret.encode(), f"{doc_id}:{ts}".encode(), hashlib.sha256).hexdigest()


@router.get("/{doc_id}/office-file/")
def office_file_serve(doc_id: int, sig: str, db: Session = Depends(get_db)):
    """Serve document bytes to OnlyOffice — authenticated via HMAC token, no user auth needed."""
    import hmac as _hmac, hashlib, time, urllib.parse
    expected = _office_file_token(doc_id)
    secret = os.environ.get("SECRET_KEY", "dev_secret")
    ts_prev = str(int(time.time()) // 7200 - 1)
    expected_prev = _hmac.new(secret.encode(), f"{doc_id}:{ts_prev}".encode(), hashlib.sha256).hexdigest()
    if sig not in (expected, expected_prev):
        raise HTTPException(403, "Token invalid")
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    try:
        data = get_file_content(d.file_key)
    except Exception:
        raise HTTPException(500, "Eroare la citirea fișierului")
    safe_name = urllib.parse.quote(d.name, safe='')
    return Response(
        content=data,
        media_type=d.content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{safe_name}"},
    )


@router.get("/{doc_id}/office-config/")
def get_office_config(
    doc_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Return OnlyOffice editor config JSON for a document."""
    import jwt as pyjwt
    import time
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    if d.content_type not in OFFICE_EDITABLE:
        raise HTTPException(400, "Tipul fișierului nu poate fi editat cu OnlyOffice")

    jwt_secret = os.environ.get("ONLYOFFICE_JWT_SECRET", "")
    domain = os.environ.get("DOMAIN", "erp.hesti-rossmann.de")
    base_url = f"https://{domain}"

    # Use backend-served URL instead of MinIO presigned URL
    # OnlyOffice downloads via the backend, avoiding S3 auth header conflicts
    sig = _office_file_token(doc_id)
    download_url = f"{base_url}/api/documents/{doc_id}/office-file/?sig={sig}"

    # Fresh key each session to avoid stale OnlyOffice state
    doc_key = f"{d.id}_{int(d.created_at.timestamp() if d.created_at else 0)}_{int(time.time())}"

    config = {
        "document": {
            "fileType": _office_file_type(d.content_type),
            "key": doc_key,
            "title": d.name,
            "url": download_url,
            "permissions": {
                "edit": True,
                "download": True,
                "print": True,
            },
        },
        "documentType": _office_doc_type(d.content_type),
        "editorConfig": {
            "callbackUrl": f"{base_url}/api/documents/{doc_id}/office-callback/",
            "lang": "de",
            "user": {
                "id": str(current.id),
                "name": current.full_name,
            },
            "customization": {
                "autosave": True,
                "forcesave": False,
                "logo": {"visible": False},
                "chat": {"visible": False},
                "help": {"visible": False},
                "toolbarNoTabs": True,
            },
        },
        "token": "",
    }

    if jwt_secret:
        token = pyjwt.encode(config, jwt_secret, algorithm="HS256")
        config["token"] = token

    return config


@router.post("/{doc_id}/office-callback/")
async def office_callback(
    doc_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """OnlyOffice calls this when user saves. Download updated file and store in MinIO."""
    from fastapi import Request
    import httpx

    body = await request.json()
    status = body.get("status")

    # Status 2 = document ready to save, 6 = force save
    if status not in (2, 6):
        return {"error": 0}

    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        return {"error": 1}

    download_url = body.get("url")
    if not download_url:
        return {"error": 1}

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(download_url, timeout=60)
            r.raise_for_status()
            data = r.content

        upload_file(d.file_key, data, d.content_type)
        d.file_size = len(data)
        d.created_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"OnlyOffice callback save failed: {e}")
        return {"error": 1}

    return {"error": 0}


@router.delete("/{doc_id}/")
def delete_document(doc_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    d = db.query(Document).filter(Document.id == doc_id).first()
    if not d:
        raise HTTPException(404, "Document negăsit")
    if current.role not in ("director", "projekt_leiter") and d.uploaded_by != current.id:
        raise HTTPException(403, "Acces interzis")
    delete_file(d.file_key)
    db.delete(d)
    db.commit()
    return {"ok": True}
