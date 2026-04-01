from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import csv, io

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.facturare import Invoice, InvoiceItem
from app.models.aufmass import AufmassEntry
from app.models.site import Site
from app.models.user import User

router = APIRouter(prefix="/invoices", tags=["invoices"])

TRANSITIONS = {
    "draft":     ["sent", "cancelled"],
    "sent":      ["paid", "overdue", "cancelled"],
    "overdue":   ["paid", "cancelled"],
    "paid":      [],
    "cancelled": [],
}

# ─── Schemas ──────────────────────────────────────────────────────────────────

class ItemIn(BaseModel):
    position: str
    description: str
    unit: str = "m"
    quantity: float
    unit_price: float
    aufmass_id: Optional[int] = None
    purchase_price: Optional[float] = None
    admin_fee_pct: Optional[float] = None

class InvoiceCreate(BaseModel):
    invoice_type: str = "lucrari"          # lucrari / materiale
    site_id: Optional[int] = None
    situatie_id: Optional[int] = None
    client_name: str
    client_address: Optional[str] = None
    client_email: Optional[str] = None
    issue_date: date
    due_date: Optional[date] = None
    vat_rate: float = 0.0
    sicherheitseinbehalt_pct: float = 0.0
    payment_ref: Optional[str] = None
    notes: Optional[str] = None
    items: List[ItemIn]

class InvoiceUpdate(BaseModel):
    client_name: Optional[str] = None
    client_address: Optional[str] = None
    client_email: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    vat_rate: Optional[float] = None
    payment_ref: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class PaymentIn(BaseModel):
    paid_amount: float
    payment_date: date
    payment_ref: Optional[str] = None

class BillingConfig(BaseModel):
    billing_name: Optional[str] = None
    billing_address: Optional[str] = None
    billing_vat_id: Optional[str] = None
    billing_email: Optional[str] = None
    billing_iban: Optional[str] = None
    billing_bic: Optional[str] = None
    billing_bank: Optional[str] = None
    sicherheitseinbehalt_pct: Optional[float] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _next_invoice_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(Invoice.id)).filter(
        extract("year", Invoice.created_at) == year
    ).scalar() or 0
    return f"RE-{year}-{(count + 1):04d}"


def _item_dict(i: InvoiceItem):
    return {
        "id": i.id,
        "invoice_id": i.invoice_id,
        "position": i.position,
        "description": i.description,
        "unit": i.unit,
        "quantity": i.quantity,
        "unit_price": i.unit_price,
        "total_price": i.total_price,
        "aufmass_id": i.aufmass_id,
        "purchase_price": i.purchase_price,
        "admin_fee_pct": i.admin_fee_pct,
    }


def _invoice_dict(inv: Invoice, include_items=True):
    payable = round(inv.total - inv.sicherheitseinbehalt_amount, 2)
    d = {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type,
        "site_id": inv.site_id,
        "site_name": inv.site.name if inv.site else None,
        "site_kostenstelle": inv.site.kostenstelle if inv.site else None,
        "situatie_id": inv.situatie_id,
        "client_name": inv.client_name,
        "client_address": inv.client_address,
        "client_email": inv.client_email,
        "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "status": inv.status,
        "subtotal": inv.subtotal,
        "vat_rate": inv.vat_rate,
        "vat_amount": inv.vat_amount,
        "total": inv.total,
        "sicherheitseinbehalt_pct": inv.sicherheitseinbehalt_pct,
        "sicherheitseinbehalt_amount": inv.sicherheitseinbehalt_amount,
        "sicherheitseinbehalt_released": inv.sicherheitseinbehalt_released,
        "sicherheitseinbehalt_release_date": inv.sicherheitseinbehalt_release_date.isoformat() if inv.sicherheitseinbehalt_release_date else None,
        "amount_payable": payable,     # total - retention
        "payment_ref": inv.payment_ref,
        "notes": inv.notes,
        "created_by": inv.created_by,
        "creator_name": inv.creator.full_name if inv.creator else None,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "paid_amount": inv.paid_amount,
        "payment_date": inv.payment_date.isoformat() if inv.payment_date else None,
    }
    if include_items:
        d["items"] = [_item_dict(i) for i in sorted(inv.items or [], key=lambda x: x.position)]
    return d


def _compute_totals(items, vat_rate: float):
    subtotal = round(sum(i.quantity * i.unit_price for i in items), 2)
    vat = round(subtotal * vat_rate / 100, 2)
    total = round(subtotal + vat, 2)
    return subtotal, vat, total


# ─── Billing config per site ──────────────────────────────────────────────────

@router.get("/sites/{site_id}/billing/")
def get_billing_config(site_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(404, "Șantier negăsit")
    return {
        "site_id": site.id,
        "site_name": site.name,
        "billing_name": site.billing_name,
        "billing_address": site.billing_address,
        "billing_vat_id": site.billing_vat_id,
        "billing_email": site.billing_email,
        "billing_iban": site.billing_iban,
        "billing_bic": site.billing_bic,
        "billing_bank": site.billing_bank,
        "sicherheitseinbehalt_pct": site.sicherheitseinbehalt_pct or 0.0,
    }


@router.put("/sites/{site_id}/billing/")
def save_billing_config(
    site_id: int,
    body: BillingConfig,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(404, "Șantier negăsit")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(site, k, v)
    db.commit()
    db.refresh(site)
    return {
        "site_id": site.id,
        "billing_name": site.billing_name,
        "billing_address": site.billing_address,
        "billing_vat_id": site.billing_vat_id,
        "billing_email": site.billing_email,
        "billing_iban": site.billing_iban,
        "billing_bic": site.billing_bic,
        "billing_bank": site.billing_bank,
        "sicherheitseinbehalt_pct": site.sicherheitseinbehalt_pct or 0.0,
    }


# ─── Invoice CRUD ─────────────────────────────────────────────────────────────

@router.get("/stats/")
def invoice_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Invoice.status, func.count(Invoice.id), func.sum(Invoice.total)).group_by(Invoice.status).all()
    result = {r.status: {"count": r[1], "total": round(r[2] or 0, 2)} for r in rows}
    return result


@router.get("/")
def list_invoices(
    status: Optional[str] = None,
    site_id: Optional[int] = None,
    invoice_type: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Invoice)
    if status:
        q = q.filter(Invoice.status == status)
    if site_id:
        q = q.filter(Invoice.site_id == site_id)
    if invoice_type:
        q = q.filter(Invoice.invoice_type == invoice_type)
    invoices = q.order_by(Invoice.created_at.desc()).all()
    return [_invoice_dict(inv, include_items=False) for inv in invoices]


@router.post("/", status_code=201)
def create_invoice(
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Factura trebuie să aibă cel puțin o poziție")
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")

    inv = Invoice(
        invoice_number=_next_invoice_number(db),
        invoice_type=body.invoice_type,
        site_id=body.site_id,
        situatie_id=body.situatie_id,
        client_name=body.client_name,
        client_address=body.client_address,
        client_email=body.client_email,
        issue_date=body.issue_date,
        due_date=body.due_date,
        vat_rate=body.vat_rate,
        sicherheitseinbehalt_pct=body.sicherheitseinbehalt_pct,
        payment_ref=body.payment_ref,
        notes=body.notes,
        status="draft",
        created_by=current.id,
    )
    db.add(inv)
    db.flush()

    orm_items = []
    for it in body.items:
        # For materiale: unit_price = purchase_price * (1 + admin_fee_pct/100)
        unit_price = it.unit_price
        if body.invoice_type == "materiale" and it.purchase_price is not None:
            admin = it.admin_fee_pct or 3.0
            unit_price = round(it.purchase_price * (1 + admin / 100), 4)
        item = InvoiceItem(
            invoice_id=inv.id,
            position=it.position,
            description=it.description,
            unit=it.unit,
            quantity=it.quantity,
            unit_price=unit_price,
            total_price=round(it.quantity * unit_price, 2),
            aufmass_id=it.aufmass_id,
            purchase_price=it.purchase_price,
            admin_fee_pct=it.admin_fee_pct or (3.0 if body.invoice_type == "materiale" else None),
        )
        db.add(item)
        orm_items.append(item)

    subtotal, vat, total = _compute_totals(orm_items, body.vat_rate)
    einbehalt = round(subtotal * body.sicherheitseinbehalt_pct / 100, 2)
    inv.subtotal = subtotal
    inv.vat_amount = vat
    inv.total = total
    inv.sicherheitseinbehalt_amount = einbehalt

    db.commit()
    db.refresh(inv)
    return _invoice_dict(inv)


@router.get("/{invoice_id}/")
def get_invoice(invoice_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Factură negăsită")
    return _invoice_dict(inv)


@router.put("/{invoice_id}/")
def update_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Factură negăsită")

    if inv.status not in ("draft",) and body.status is None:
        raise HTTPException(400, "Doar facturile în ciornă pot fi editate")

    if body.status and body.status != inv.status:
        allowed = TRANSITIONS.get(inv.status, [])
        if body.status not in allowed:
            raise HTTPException(400, f"Tranziție invalidă: {inv.status} → {body.status}")
        if body.status == "paid":
            inv.paid_at = datetime.utcnow()
        inv.status = body.status

    for k, v in body.model_dump(exclude_none=True, exclude={"status"}).items():
        setattr(inv, k, v)

    if body.vat_rate is not None:
        subtotal, vat, total = _compute_totals(inv.items, inv.vat_rate)
        inv.subtotal = subtotal
        inv.vat_amount = vat
        inv.total = total
        inv.sicherheitseinbehalt_amount = round(subtotal * inv.sicherheitseinbehalt_pct / 100, 2)

    db.commit()
    db.refresh(inv)
    return _invoice_dict(inv)


@router.delete("/{invoice_id}/")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Factură negăsită")
    if inv.status not in ("draft", "cancelled"):
        raise HTTPException(400, "Doar facturile ciornă sau anulate pot fi șterse")
    db.delete(inv)
    db.commit()
    return {"ok": True}


# ─── Payment registration ─────────────────────────────────────────────────────

@router.post("/{invoice_id}/payment/")
def register_payment(
    invoice_id: int,
    body: PaymentIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Factură negăsită")
    if inv.status not in ("sent", "overdue", "paid"):
        raise HTTPException(400, "Nu se poate înregistra plată în această stare")

    inv.paid_amount = body.paid_amount
    inv.payment_date = body.payment_date
    if body.payment_ref:
        inv.payment_ref = body.payment_ref
    # Mark as paid if amount covers amount_payable
    amount_payable = round(inv.total - inv.sicherheitseinbehalt_amount, 2)
    if body.paid_amount >= amount_payable:
        inv.status = "paid"
        inv.paid_at = datetime.utcnow()

    db.commit()
    db.refresh(inv)
    return _invoice_dict(inv)


# ─── Release Sicherheitseinbehalt ─────────────────────────────────────────────

@router.post("/{invoice_id}/release-retention/")
def release_retention(
    invoice_id: int,
    release_date: date,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Factură negăsită")
    if inv.sicherheitseinbehalt_amount <= 0:
        raise HTTPException(400, "Această factură nu are retenție")
    inv.sicherheitseinbehalt_released = True
    inv.sicherheitseinbehalt_release_date = release_date
    db.commit()
    db.refresh(inv)
    return _invoice_dict(inv)


# ─── Aufmass import helper ────────────────────────────────────────────────────

@router.get("/{invoice_id}/aufmass-import/")
def get_aufmass_for_import(invoice_id: int, site_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    used_ids = {i.aufmass_id for i in db.query(InvoiceItem).filter(InvoiceItem.aufmass_id != None).all()}
    entries = (
        db.query(AufmassEntry)
        .filter(
            AufmassEntry.site_id == site_id,
            AufmassEntry.status == "approved",
            ~AufmassEntry.id.in_(used_ids) if used_ids else True,
        )
        .order_by(AufmassEntry.date, AufmassEntry.position)
        .all()
    )
    return [
        {
            "id": e.id, "date": e.date.isoformat(),
            "position": e.position, "description": e.description,
            "unit": e.unit, "quantity": e.quantity,
            "unit_price": e.unit_price, "total_price": e.total_price,
        }
        for e in entries
    ]


# ─── DATEV CSV Export ─────────────────────────────────────────────────────────

@router.get("/export/datev/")
def export_datev(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")

    q = db.query(Invoice).filter(Invoice.status.notin_(["draft", "cancelled"]))
    if year:
        q = q.filter(extract("year", Invoice.issue_date) == year)
    if month:
        q = q.filter(extract("month", Invoice.issue_date) == month)
    invoices = q.order_by(Invoice.issue_date).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "Belegnummer", "Belegdatum", "Buchungstext", "Konto", "Gegenkonto",
        "Umsatz Netto", "MwSt %", "MwSt Betrag", "Brutto",
        "Sicherheitseinbehalt %", "Sicherheitseinbehalt Betrag", "Zahlbar netto",
        "Status", "Zahlungsdatum", "Zahlungsbetrag",
        "Typ", "Kostenstelle",
    ])
    for inv in invoices:
        konto = "8200" if inv.invoice_type == "lucrari" else "8400"
        payable = round(inv.total - inv.sicherheitseinbehalt_amount, 2)
        writer.writerow([
            inv.invoice_number,
            inv.issue_date.strftime("%d.%m.%Y") if inv.issue_date else "",
            inv.client_name,
            "10000",   # Debitoren
            konto,
            str(inv.subtotal).replace(".", ","),
            str(inv.vat_rate).replace(".", ","),
            str(inv.vat_amount).replace(".", ","),
            str(inv.total).replace(".", ","),
            str(inv.sicherheitseinbehalt_pct).replace(".", ","),
            str(inv.sicherheitseinbehalt_amount).replace(".", ","),
            str(payable).replace(".", ","),
            inv.status,
            inv.payment_date.strftime("%d.%m.%Y") if inv.payment_date else "",
            str(inv.paid_amount or 0).replace(".", ","),
            inv.invoice_type,
            inv.site.kostenstelle if inv.site else "",
        ])

    content = "\ufeff" + output.getvalue()  # BOM for Excel
    filename = f"DATEV_export_{year or 'all'}_{month or 'all'}.csv"
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
