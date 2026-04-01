from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.facturare import SituatieLucrari, Invoice, InvoiceItem
from app.models.aufmass import AufmassEntry
from app.models.site import Site
from app.models.user import User

router = APIRouter(prefix="/situatii", tags=["situatii"])

# Status machine
TRANSITIONS = {
    "draft":         ["sent"],
    "sent":          ["modifications", "approved"],
    "modifications": ["sent"],
    "approved":      ["invoiced"],
    "invoiced":      [],
}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SituatieCreate(BaseModel):
    site_id: int
    title: str
    period_from: date
    period_to: date
    notes: Optional[str] = None

class SituatieUpdate(BaseModel):
    title: Optional[str] = None
    period_from: Optional[date] = None
    period_to: Optional[date] = None
    status: Optional[str] = None
    client_notes: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _entry_dict(e: AufmassEntry):
    return {
        "id": e.id,
        "date": e.date.isoformat() if e.date else None,
        "position": e.position,
        "description": e.description,
        "unit": e.unit,
        "quantity": e.quantity,
        "unit_price": e.unit_price,
        "total_price": e.total_price,
        "status": e.status,
    }

def _situatie_dict(s: SituatieLucrari, include_entries=True):
    d = {
        "id": s.id,
        "site_id": s.site_id,
        "site_name": s.site.name if s.site else None,
        "site_kostenstelle": s.site.kostenstelle if s.site else None,
        "title": s.title,
        "period_from": s.period_from.isoformat() if s.period_from else None,
        "period_to": s.period_to.isoformat() if s.period_to else None,
        "status": s.status,
        "sent_at": s.sent_at.isoformat() if s.sent_at else None,
        "approved_at": s.approved_at.isoformat() if s.approved_at else None,
        "client_notes": s.client_notes,
        "created_by": s.created_by,
        "creator_name": s.creator.full_name if s.creator else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "invoice_ids": [inv.id for inv in (s.invoices or [])],
    }
    if include_entries:
        entries = s.entries or []
        d["entries"] = [_entry_dict(e) for e in sorted(entries, key=lambda x: (x.date, x.position))]
        d["total_netto"] = round(sum((e.total_price or 0) for e in entries), 2)
        d["entries_count"] = len(entries)
    return d


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_situatii(
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SituatieLucrari)
    if site_id:
        q = q.filter(SituatieLucrari.site_id == site_id)
    if status:
        q = q.filter(SituatieLucrari.status == status)
    rows = q.order_by(SituatieLucrari.created_at.desc()).all()
    return [_situatie_dict(s, include_entries=False) for s in rows]


@router.post("/", status_code=201)
def create_situatie(
    body: SituatieCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    site = db.query(Site).filter(Site.id == body.site_id).first()
    if not site:
        raise HTTPException(404, "Șantier negăsit")
    s = SituatieLucrari(
        site_id=body.site_id,
        title=body.title,
        period_from=body.period_from,
        period_to=body.period_to,
        client_notes=body.notes,
        created_by=current.id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _situatie_dict(s)


@router.get("/{sit_id}/")
def get_situatie(sit_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")
    return _situatie_dict(s)


@router.put("/{sit_id}/")
def update_situatie(
    sit_id: int,
    body: SituatieUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")

    if body.status and body.status != s.status:
        allowed = TRANSITIONS.get(s.status, [])
        if body.status not in allowed:
            raise HTTPException(400, f"Tranziție invalidă: {s.status} → {body.status}")
        s.status = body.status
        if body.status == "sent":
            s.sent_at = datetime.utcnow()
        elif body.status == "approved":
            s.approved_at = datetime.utcnow()

    if body.title is not None:
        s.title = body.title
    if body.period_from is not None:
        s.period_from = body.period_from
    if body.period_to is not None:
        s.period_to = body.period_to
    if body.client_notes is not None:
        s.client_notes = body.client_notes

    db.commit()
    db.refresh(s)
    return _situatie_dict(s)


@router.delete("/{sit_id}/")
def delete_situatie(sit_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")
    if s.status not in ("draft",):
        raise HTTPException(400, "Doar situațiile în ciornă pot fi șterse")
    # Detach aufmass entries
    db.query(AufmassEntry).filter(AufmassEntry.situatie_id == sit_id).update({"situatie_id": None})
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.get("/{sit_id}/available-entries/")
def available_entries(sit_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Approved aufmass entries for this site not yet assigned to any situatie."""
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")
    entries = (
        db.query(AufmassEntry)
        .filter(
            AufmassEntry.site_id == s.site_id,
            AufmassEntry.status == "approved",
            AufmassEntry.situatie_id == None,
        )
        .order_by(AufmassEntry.date, AufmassEntry.position)
        .all()
    )
    return [_entry_dict(e) for e in entries]


@router.post("/{sit_id}/add-entries/")
def add_entries(
    sit_id: int,
    entry_ids: List[int],
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")
    if s.status not in ("draft", "modifications"):
        raise HTTPException(400, "Nu poți adăuga intrări în această stare")
    db.query(AufmassEntry).filter(
        AufmassEntry.id.in_(entry_ids),
        AufmassEntry.site_id == s.site_id,
    ).update({"situatie_id": sit_id}, synchronize_session="fetch")
    db.commit()
    db.refresh(s)
    return _situatie_dict(s)


@router.delete("/{sit_id}/entries/{entry_id}/")
def remove_entry(
    sit_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")
    if s.status not in ("draft", "modifications"):
        raise HTTPException(400, "Nu poți elimina intrări în această stare")
    db.query(AufmassEntry).filter(
        AufmassEntry.id == entry_id,
        AufmassEntry.situatie_id == sit_id,
    ).update({"situatie_id": None})
    db.commit()
    return {"ok": True}


@router.post("/{sit_id}/invoice/", status_code=201)
def generate_invoice(
    sit_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Generate a lucrari invoice from an approved situatie."""
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(SituatieLucrari).filter(SituatieLucrari.id == sit_id).first()
    if not s:
        raise HTTPException(404, "Situație negăsită")
    if s.status != "approved":
        raise HTTPException(400, "Situația trebuie să fie aprobată înainte de facturare")
    if not s.entries:
        raise HTTPException(400, "Situația nu are intrări Aufmaß")

    site = s.site
    # Auto-fill client data from billing config
    client_name = site.billing_name or site.client
    client_address = site.billing_address
    client_email = site.billing_email
    sicherheitseinbehalt_pct = site.sicherheitseinbehalt_pct or 0.0

    # Generate invoice number
    from sqlalchemy import func, extract
    year = datetime.utcnow().year
    count = db.query(func.count(Invoice.id)).filter(
        extract("year", Invoice.created_at) == year
    ).scalar() or 0
    invoice_number = f"RE-{year}-{(count + 1):04d}"

    inv = Invoice(
        invoice_number=invoice_number,
        invoice_type="lucrari",
        site_id=s.site_id,
        situatie_id=sit_id,
        client_name=client_name,
        client_address=client_address,
        client_email=client_email,
        issue_date=date.today(),
        vat_rate=0.0,  # lucrari = netto
        sicherheitseinbehalt_pct=sicherheitseinbehalt_pct,
        created_by=current.id,
        status="draft",
    )
    db.add(inv)
    db.flush()

    orm_items = []
    for e in sorted(s.entries, key=lambda x: (x.date, x.position)):
        item = InvoiceItem(
            invoice_id=inv.id,
            position=e.position,
            description=e.description,
            unit=e.unit,
            quantity=e.quantity,
            unit_price=e.unit_price or 0.0,
            total_price=e.total_price or 0.0,
            aufmass_id=e.id,
        )
        db.add(item)
        orm_items.append(item)

    subtotal = round(sum(i.total_price for i in orm_items), 2)
    einbehalt = round(subtotal * sicherheitseinbehalt_pct / 100, 2)
    inv.subtotal = subtotal
    inv.vat_amount = 0.0
    inv.total = subtotal
    inv.sicherheitseinbehalt_amount = einbehalt

    # Mark situatie as invoiced
    s.status = "invoiced"

    db.commit()
    db.refresh(inv)
    return {"invoice_id": inv.id, "invoice_number": inv.invoice_number}
