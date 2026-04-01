from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
import json
from app.core.database import get_db
from app.core.validators import OptStr200, OptStr50, OptIBAN, OptEmail, OptPhone
from app.models.user import User, UserRole
from app.api.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = {
    # Firmendaten
    "company_name":        "Hesti Rossmann GmbH",
    "company_address":     "",
    "company_city":        "Kirchheim unter Teck",
    "company_zip":         "",
    "company_phone":       "",
    "company_email":       "",
    "company_steuernr":    "",
    "company_iban":        "",
    "company_bank":        "",
    # Notificări
    "notify_time":         "20:00",
    "notify_channel":      "email",
    "whatsapp_phone_id":   "",
    "whatsapp_token":      "",
    "smtp_host":           "",
    "smtp_port":           "587",
    "smtp_user":           "",
    "smtp_password":       "",
    "telegram_bot_token":  "",
    "telegram_chat_id":    "",
    # Tarifvertrag BRTV
    "tariflohn_lg1":       "",
    "tariflohn_lg2":       "",
    "tariflohn_lg3":       "",
    "tariflohn_lg4":       "",
    "tariflohn_lg5":       "",
    "tariflohn_lg6":       "",
    "bauzuschlag_standard": "0.72",
    "urlaubsanspruch_default": "30",
}


class SettingsUpdate(BaseModel):
    # Firmendaten
    company_name:     Optional[OptStr200] = None
    company_address:  Optional[OptStr200] = None
    company_city:     Optional[OptStr200] = None
    company_zip:      Optional[OptStr50]  = None
    company_phone:    Optional[OptPhone]  = None
    company_email:    Optional[OptEmail]  = None
    company_steuernr: Optional[OptStr50]  = None
    company_iban:     Optional[OptIBAN]   = None
    company_bank:     Optional[OptStr200] = None
    # Notificări
    notify_time:         Optional[OptStr50]  = None   # HH:MM
    notify_channel:      Optional[OptStr50]  = None   # email / whatsapp / telegram
    whatsapp_phone_id:   Optional[OptStr200] = None
    whatsapp_token:      Optional[OptStr200] = None
    smtp_host:           Optional[OptStr200] = None
    smtp_port:           Optional[OptStr50]  = None
    smtp_user:           Optional[OptStr200] = None
    smtp_password:       Optional[OptStr200] = None
    telegram_bot_token:  Optional[OptStr200] = None
    telegram_chat_id:    Optional[OptStr200] = None
    # Tarifvertrag BRTV
    tariflohn_lg1:          Optional[OptStr50] = None
    tariflohn_lg2:          Optional[OptStr50] = None
    tariflohn_lg3:          Optional[OptStr50] = None
    tariflohn_lg4:          Optional[OptStr50] = None
    tariflohn_lg5:          Optional[OptStr50] = None
    tariflohn_lg6:          Optional[OptStr50] = None
    bauzuschlag_standard:   Optional[OptStr50] = None
    urlaubsanspruch_default: Optional[OptStr50] = None


def require_director(current: User = Depends(get_current_user)):
    if current.role != UserRole.DIRECTOR:
        from fastapi import HTTPException
        raise HTTPException(403, "Director access required")
    return current


@router.get("/")
def get_settings(db: Session = Depends(get_db), _: User = Depends(require_director)):
    rows = db.execute(text("SELECT key, value FROM settings")).fetchall()
    result = dict(DEFAULTS)
    for row in rows:
        result[row[0]] = row[1]
    return result


@router.put("/")
def save_settings(body: SettingsUpdate, db: Session = Depends(get_db), _: User = Depends(require_director)):
    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        if key not in DEFAULTS:
            continue
        str_value = str(value) if value is not None else ""
        existing = db.execute(text("SELECT key FROM settings WHERE key = :k"), {"k": key}).fetchone()
        if existing:
            db.execute(text("UPDATE settings SET value = :v, updated_at = NOW() WHERE key = :k"), {"k": key, "v": str_value})
        else:
            db.execute(text("INSERT INTO settings (key, value) VALUES (:k, :v)"), {"k": key, "v": str_value})
    db.commit()
    return {"status": "saved"}


# ─── Document Categories ───────────────────────────────────────────────────────

DEFAULT_DOC_CATEGORIES = [
    {"key": "contract",       "label": "Contract",        "color": "#1d4ed8", "icon": "📄"},
    {"key": "invoice",        "label": "Factură",          "color": "#7c3aed", "icon": "🧾"},
    {"key": "offer",          "label": "Ofertă",           "color": "#f97316", "icon": "📝"},
    {"key": "permit",         "label": "Genehmigung",      "color": "#d97706", "icon": "✅"},
    {"key": "plan",           "label": "Plan",             "color": "#0891b2", "icon": "📐"},
    {"key": "photo",          "label": "Foto",             "color": "#16a34a", "icon": "🖼"},
    {"key": "report",         "label": "Raport",           "color": "#dc2626", "icon": "📊"},
    {"key": "technical",      "label": "Tehnic",           "color": "#6366f1", "icon": "⚙️"},
    {"key": "safety",         "label": "Securitate",       "color": "#ef4444", "icon": "🦺"},
    {"key": "certificate",    "label": "Certificat",       "color": "#0d9488", "icon": "🏆"},
    {"key": "correspondence", "label": "Corespondență",    "color": "#64748b", "icon": "✉️"},
    {"key": "other",          "label": "Altele",           "color": "#94a3b8", "icon": "📁"},
]

SETTINGS_KEY_CATEGORIES = "document_categories"


def _get_raw_categories(db: Session) -> list:
    row = db.execute(text("SELECT value FROM settings WHERE key = :k"), {"k": SETTINGS_KEY_CATEGORIES}).fetchone()
    if row and row[0]:
        try:
            return json.loads(row[0])
        except Exception:
            pass
    return DEFAULT_DOC_CATEGORIES


def _save_raw_categories(db: Session, categories: list):
    val = json.dumps(categories, ensure_ascii=False)
    existing = db.execute(text("SELECT key FROM settings WHERE key = :k"), {"k": SETTINGS_KEY_CATEGORIES}).fetchone()
    if existing:
        db.execute(text("UPDATE settings SET value = :v, updated_at = NOW() WHERE key = :k"), {"k": SETTINGS_KEY_CATEGORIES, "v": val})
    else:
        db.execute(text("INSERT INTO settings (key, value) VALUES (:k, :v)"), {"k": SETTINGS_KEY_CATEGORIES, "v": val})
    db.commit()


class DocCategory(BaseModel):
    key: str
    label: str
    color: str
    icon: str


@router.get("/document-categories/")
def get_document_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_raw_categories(db)


@router.put("/document-categories/")
def save_document_categories(
    categories: List[DocCategory],
    db: Session = Depends(get_db),
    _: User = Depends(require_director),
):
    if not categories:
        raise HTTPException(400, "Lista categoriilor nu poate fi goală")
    # Validate keys are URL-safe
    for c in categories:
        if not c.key.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(400, f"Cheia '{c.key}' conține caractere invalide")
    _save_raw_categories(db, [c.model_dump() for c in categories])
    return {"status": "saved", "count": len(categories)}


# ─── Connection Types ──────────────────────────────────────────────────────────

DEFAULT_CONNECTION_TYPES = ["Fiber", "Gas", "Curent", "Apă", "Altele"]
SETTINGS_KEY_CONN_TYPES = "connection_types"


def _get_raw_conn_types(db: Session) -> list:
    row = db.execute(text("SELECT value FROM settings WHERE key = :k"), {"k": SETTINGS_KEY_CONN_TYPES}).fetchone()
    if row and row[0]:
        try:
            return json.loads(row[0])
        except Exception:
            pass
    return DEFAULT_CONNECTION_TYPES


def _save_raw_conn_types(db: Session, types: list):
    val = json.dumps(types, ensure_ascii=False)
    existing = db.execute(text("SELECT key FROM settings WHERE key = :k"), {"k": SETTINGS_KEY_CONN_TYPES}).fetchone()
    if existing:
        db.execute(text("UPDATE settings SET value = :v, updated_at = NOW() WHERE key = :k"), {"k": SETTINGS_KEY_CONN_TYPES, "v": val})
    else:
        db.execute(text("INSERT INTO settings (key, value) VALUES (:k, :v)"), {"k": SETTINGS_KEY_CONN_TYPES, "v": val})
    db.commit()


@router.get("/connection-types/")
def get_connection_types(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_raw_conn_types(db)


@router.put("/connection-types/")
def save_connection_types(
    types: List[str],
    db: Session = Depends(get_db),
    _: User = Depends(require_director),
):
    types = [t.strip() for t in types if t.strip()]
    if not types:
        raise HTTPException(400, "Lista nu poate fi goală")
    _save_raw_conn_types(db, types)
    return {"status": "saved", "count": len(types)}
