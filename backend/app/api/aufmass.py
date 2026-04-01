from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.aufmass import AufmassEntry
from app.models.user import User
from app.models.site import Site

router = APIRouter()

# ─── Schemas ─────────────────────────────────────────────────────────────────

class EntryCreate(BaseModel):
    site_id: int
    date: date
    position: str
    description: str
    unit: str = "m"
    quantity: float
    unit_price: Optional[float] = None
    notes: Optional[str] = None

class EntryUpdate(BaseModel):
    date: Optional[date] = None
    position: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# ─── Helper ───────────────────────────────────────────────────────────────────

def _entry_dict(e: AufmassEntry):
    return {
        "id": e.id,
        "site_id": e.site_id,
        "site_name": e.site.name if e.site else None,
        "site_kostenstelle": e.site.kostenstelle if e.site else None,
        "date": e.date.isoformat() if e.date else None,
        "position": e.position,
        "description": e.description,
        "unit": e.unit,
        "quantity": e.quantity,
        "unit_price": e.unit_price,
        "total_price": e.total_price,
        "recorded_by": e.recorded_by,
        "recorder_name": e.recorder.full_name if e.recorder else None,
        "status": e.status,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/aufmass/")
def list_entries(
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = db.query(AufmassEntry)

    # Non-directors see only their own entries
    if current.role == "aufmass":
        q = q.filter(AufmassEntry.recorded_by == current.id)
    elif current.role not in ("director", "projekt_leiter", "polier", "sef_santier"):
        raise HTTPException(403, "Acces interzis")

    if site_id:
        q = q.filter(AufmassEntry.site_id == site_id)
    if status:
        q = q.filter(AufmassEntry.status == status)
    if date_from:
        q = q.filter(AufmassEntry.date >= date_from)
    if date_to:
        q = q.filter(AufmassEntry.date <= date_to)

    entries = q.order_by(AufmassEntry.date.desc(), AufmassEntry.position).all()
    return [_entry_dict(e) for e in entries]


@router.post("/aufmass/")
def create_entry(body: EntryCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    total = round(body.quantity * body.unit_price, 2) if body.unit_price is not None else None

    entry = AufmassEntry(
        site_id=body.site_id,
        date=body.date,
        position=body.position,
        description=body.description,
        unit=body.unit,
        quantity=body.quantity,
        unit_price=body.unit_price,
        total_price=total,
        recorded_by=current.id,
        status="draft",
        notes=body.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_dict(entry)


@router.get("/aufmass/{entry_id}/")
def get_entry(entry_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    e = db.query(AufmassEntry).filter(AufmassEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Înregistrare negăsită")
    if current.role == "aufmass" and e.recorded_by != current.id:
        raise HTTPException(403, "Acces interzis")
    return _entry_dict(e)


@router.put("/aufmass/{entry_id}/")
def update_entry(entry_id: int, body: EntryUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    e = db.query(AufmassEntry).filter(AufmassEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Înregistrare negăsită")

    # Only director/projekt_leiter can approve; aufmass can only edit own drafts
    if body.status == "approved" and current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Doar directorul sau Projekt Leiter pot aproba")
    if current.role == "aufmass" and e.recorded_by != current.id:
        raise HTTPException(403, "Acces interzis")
    if current.role == "aufmass" and e.status != "draft":
        raise HTTPException(400, "Înregistrările trimise/aprobate nu pot fi editate")

    data = body.model_dump(exclude_none=True)

    # Recalculate total if quantity or price changes
    new_qty = data.get("quantity", e.quantity)
    new_price = data.get("unit_price", e.unit_price)
    if new_price is not None:
        data["total_price"] = round(new_qty * new_price, 2)

    for k, v in data.items():
        setattr(e, k, v)

    db.commit()
    db.refresh(e)
    return _entry_dict(e)


@router.delete("/aufmass/{entry_id}/")
def delete_entry(entry_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    e = db.query(AufmassEntry).filter(AufmassEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Înregistrare negăsită")
    if current.role == "aufmass" and e.recorded_by != current.id:
        raise HTTPException(403, "Acces interzis")
    if e.status == "approved":
        raise HTTPException(400, "Înregistrările aprobate nu pot fi șterse")
    db.delete(e)
    db.commit()
    return {"ok": True}


@router.get("/aufmass-summary/")
def summary(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Totals grouped by site for dashboard/reports."""
    q = db.query(
        AufmassEntry.site_id,
        func.count(AufmassEntry.id).label("count"),
        func.sum(AufmassEntry.total_price).label("total"),
    )
    if site_id:
        q = q.filter(AufmassEntry.site_id == site_id)
    q = q.group_by(AufmassEntry.site_id)
    rows = q.all()

    result = []
    for row in rows:
        site = db.query(Site).filter(Site.id == row.site_id).first()
        result.append({
            "site_id": row.site_id,
            "site_name": site.name if site else None,
            "count": row.count,
            "total": row.total or 0,
        })
    return result
