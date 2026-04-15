from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.validators import (
    Str200, OptStr200, OptStr300, OptText,
    EmailReq, OptEmail, OptPhone, Currency,
    OptStr20, OptStr100,
)
from app.api.auth import get_current_user
from app.models.supplier import Supplier, SupplierPrice, PurchaseOrder, PurchaseOrderItem
from app.models.user import User
from app.models.site import Site

router = APIRouter()

# ─── Schemas ────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: Str200
    email: EmailReq
    email2: Optional[OptEmail] = None
    phone: Optional[OptPhone] = None
    notes: Optional[OptText] = None

class SupplierUpdate(BaseModel):
    name: Optional[Str200] = None
    email: Optional[EmailReq] = None
    email2: Optional[OptEmail] = None
    phone: Optional[OptPhone] = None
    notes: Optional[OptText] = None
    is_active: Optional[bool] = None

class PriceCreate(BaseModel):
    product_name: OptStr300
    unit: OptStr20 = "buc"
    price: float = Field(gt=0, le=1_000_000)
    currency: Currency = "EUR"

class PriceUpdate(BaseModel):
    product_name: Optional[OptStr300] = None
    unit: Optional[OptStr20] = None
    price: Optional[float] = Field(default=None, gt=0, le=1_000_000)
    currency: Optional[Currency] = None

class OrderItemIn(BaseModel):
    supplier_id: int
    product_name: OptStr300
    quantity: float = Field(gt=0, le=1_000_000)
    unit: OptStr20 = "buc"
    unit_price: float = Field(gt=0, le=1_000_000)

class OrderCreate(BaseModel):
    site_id: Optional[int] = None
    notes: Optional[OptText] = None
    items: List[OrderItemIn]

class OrderUpdate(BaseModel):
    status: Optional[OptStr100] = None
    notes: Optional[OptText] = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _supplier_dict(s: Supplier):
    return {
        "id": s.id,
        "name": s.name,
        "email": s.email,
        "email2": s.email2,
        "phone": s.phone,
        "notes": s.notes,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

def _price_dict(p: SupplierPrice):
    return {
        "id": p.id,
        "supplier_id": p.supplier_id,
        "product_name": p.product_name,
        "unit": p.unit,
        "price": p.price,
        "currency": p.currency,
        "valid_from": p.valid_from.isoformat() if p.valid_from else None,
        "valid_until": p.valid_until.isoformat() if p.valid_until else None,
    }

def _item_dict(i: PurchaseOrderItem):
    return {
        "id": i.id,
        "order_id": i.order_id,
        "supplier_id": i.supplier_id,
        "supplier_name": i.supplier.name if i.supplier else None,
        "product_name": i.product_name,
        "quantity": i.quantity,
        "unit": i.unit,
        "unit_price": i.unit_price,
        "total_price": i.total_price,
        "email_sent": i.email_sent,
    }

def _order_dict(o: PurchaseOrder, db: Session):
    site_name = None
    if o.site_id:
        site = db.query(Site).filter(Site.id == o.site_id).first()
        site_name = site.name if site else None

    requester_name = None
    if o.requested_by:
        u = db.query(User).filter(User.id == o.requested_by).first()
        requester_name = u.full_name if u else None

    return {
        "id": o.id,
        "site_id": o.site_id,
        "site_name": site_name,
        "requested_by": o.requested_by,
        "requester_name": requester_name,
        "status": o.status,
        "total_amount": o.total_amount,
        "notes": o.notes,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "approved_at": o.approved_at.isoformat() if o.approved_at else None,
        "items": [_item_dict(i) for i in (o.items or [])],
    }


# ─── Suppliers ───────────────────────────────────────────────────────────────

@router.get("/suppliers/")
def list_suppliers(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    suppliers = db.query(Supplier).order_by(Supplier.name).all()
    return [_supplier_dict(s) for s in suppliers]


@router.post("/suppliers/")
def create_supplier(body: SupplierCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter", "sef_santier"):
        raise HTTPException(403, "Acces interzis")
    existing = db.query(Supplier).filter(Supplier.name == body.name).first()
    if existing:
        raise HTTPException(400, "Furnizor cu același nume există deja")
    s = Supplier(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _supplier_dict(s)


@router.get("/suppliers/{supplier_id}/")
def get_supplier(supplier_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(404, "Furnizor negăsit")
    d = _supplier_dict(s)
    d["prices"] = [_price_dict(p) for p in s.prices]
    return d


@router.put("/suppliers/{supplier_id}/")
def update_supplier(supplier_id: int, body: SupplierUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter", "sef_santier"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(404, "Furnizor negăsit")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _supplier_dict(s)


@router.delete("/suppliers/{supplier_id}/")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role != "director":
        raise HTTPException(403, "Acces interzis")
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(404, "Furnizor negăsit")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ─── Supplier Prices ──────────────────────────────────────────────────────────

@router.post("/suppliers/{supplier_id}/prices/")
def add_price(supplier_id: int, body: PriceCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter", "sef_santier"):
        raise HTTPException(403, "Acces interzis")
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(404, "Furnizor negăsit")
    p = SupplierPrice(supplier_id=supplier_id, **body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _price_dict(p)


@router.put("/suppliers/{supplier_id}/prices/{price_id}/")
def update_price(supplier_id: int, price_id: int, body: PriceUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter", "sef_santier"):
        raise HTTPException(403, "Acces interzis")
    p = db.query(SupplierPrice).filter(SupplierPrice.id == price_id, SupplierPrice.supplier_id == supplier_id).first()
    if not p:
        raise HTTPException(404, "Preț negăsit")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _price_dict(p)


@router.delete("/suppliers/{supplier_id}/prices/{price_id}/")
def delete_price(supplier_id: int, price_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter", "sef_santier"):
        raise HTTPException(403, "Acces interzis")
    p = db.query(SupplierPrice).filter(SupplierPrice.id == price_id, SupplierPrice.supplier_id == supplier_id).first()
    if not p:
        raise HTTPException(404, "Preț negăsit")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ─── Price Search ────────────────────────────────────────────────────────────

@router.get("/prices/search/")
def search_prices(
    q: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Search all supplier prices by product name (fuzzy)."""
    query = db.query(SupplierPrice).join(Supplier).filter(Supplier.is_active == True)  # noqa: E712
    if q:
        query = query.filter(SupplierPrice.product_name.ilike(f"%{q}%"))
    prices = query.order_by(SupplierPrice.product_name, SupplierPrice.price).all()
    return [
        {
            **_price_dict(p),
            "supplier_name": p.supplier.name if p.supplier else None,
        }
        for p in prices
    ]


# ─── Purchase Orders ──────────────────────────────────────────────────────────

@router.get("/orders/")
def list_orders(
    status: Optional[str] = None,
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = db.query(PurchaseOrder)
    if status:
        q = q.filter(PurchaseOrder.status == status)
    if site_id:
        q = q.filter(PurchaseOrder.site_id == site_id)
    orders = q.order_by(PurchaseOrder.created_at.desc()).all()
    return [_order_dict(o, db) for o in orders]


@router.post("/orders/")
def create_order(body: OrderCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(400, "Comanda trebuie să aibă cel puțin un articol")

    total = sum(i.quantity * i.unit_price for i in body.items)
    order = PurchaseOrder(
        site_id=body.site_id,
        requested_by=current.id,
        status="pending",
        total_amount=total,
        notes=body.notes,
    )
    db.add(order)
    db.flush()

    for item in body.items:
        oi = PurchaseOrderItem(
            order_id=order.id,
            supplier_id=item.supplier_id,
            product_name=item.product_name,
            quantity=item.quantity,
            unit=item.unit,
            unit_price=item.unit_price,
            total_price=round(item.quantity * item.unit_price, 2),
        )
        db.add(oi)

    db.commit()
    db.refresh(order)
    return _order_dict(order, db)


@router.get("/orders/{order_id}/")
def get_order(order_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    o = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not o:
        raise HTTPException(404, "Comandă negăsită")
    return _order_dict(o, db)


@router.put("/orders/{order_id}/")
def update_order(order_id: int, body: OrderUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    o = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not o:
        raise HTTPException(404, "Comandă negăsită")

    if body.status:
        allowed_transitions = {
            "pending":   ["approved", "cancelled"],
            "approved":  ["sent", "cancelled"],
            "sent":      ["cancelled"],
            "cancelled": [],
        }
        if body.status not in allowed_transitions.get(o.status, []):
            raise HTTPException(400, f"Tranziție invalidă: {o.status} → {body.status}")
        if body.status == "approved":
            o.approved_at = datetime.utcnow()
        o.status = body.status

    if body.notes is not None:
        o.notes = body.notes

    db.commit()
    db.refresh(o)
    return _order_dict(o, db)


@router.delete("/orders/{order_id}/")
def delete_order(order_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Acces interzis")
    o = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not o:
        raise HTTPException(404, "Comandă negăsită")
    if o.status not in ("pending", "cancelled"):
        raise HTTPException(400, "Doar comenzile pending sau anulate pot fi șterse")
    db.delete(o)
    db.commit()
    return {"ok": True}
