from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.core.validators import Str20, Str200, OptStr100, OptStr200, OptStr300, OptStr500, OptText, Currency
from app.models.site import Site, SiteStatus, user_sites
from sqlalchemy import select
from app.models.cost import Cost, CostCategory, MaterialLog
from app.models.user import User, UserRole
from app.api.auth import get_current_user

router = APIRouter(prefix="/sites", tags=["sites"])


class SiteCreate(BaseModel):
    kostenstelle: Str20
    name: Str200
    client: Str200
    address: Optional[OptStr300] = None
    budget: Optional[float] = Field(default=0.0, ge=0)
    manager_id: Optional[int] = None
    notes: Optional[OptText] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SiteUpdate(BaseModel):
    name: Optional[Str200] = None
    client: Optional[Str200] = None
    address: Optional[OptStr300] = None
    status: Optional[SiteStatus] = None
    budget: Optional[float] = Field(default=None, ge=0)
    manager_id: Optional[int] = None
    notes: Optional[OptText] = None
    polier_instructions: Optional[OptText] = None
    planned_headcount: Optional[int] = Field(default=None, ge=0, le=500)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class CostCreate(BaseModel):
    category: CostCategory
    description: OptStr500
    amount: float = Field(gt=0)
    currency: Currency = "EUR"
    invoice_ref: Optional[OptStr100] = None
    supplier: Optional[OptStr200] = None
    notes: Optional[OptText] = None
    date: Optional[datetime] = None


class MaterialCreate(BaseModel):
    material: OptStr200
    quantity: float = Field(gt=0)
    unit: OptStr100 = "buc"
    notes: Optional[OptText] = None


@router.get("/")
def list_sites(
    baustellen_only: bool = False,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = db.query(Site)
    if current.role not in [UserRole.DIRECTOR, UserRole.CALLCENTER]:
        # Include sites where user is manager OR explicitly assigned via user_sites
        assigned_ids = db.execute(
            select(user_sites.c.site_id).where(user_sites.c.user_id == current.id)
        ).scalars().all()
        from sqlalchemy import or_
        q = q.filter(or_(Site.manager_id == current.id, Site.id.in_(assigned_ids)))
    if baustellen_only:
        q = q.filter(Site.is_baustelle == True)  # noqa: E712
    sites = q.all()

    # Aggregate costs per site in a single query
    from sqlalchemy import func
    cost_totals = dict(
        db.query(Cost.site_id, func.sum(Cost.amount))
        .filter(Cost.site_id.in_([s.id for s in sites]))
        .group_by(Cost.site_id)
        .all()
    )
    return [_site_dict(s, cost_totals.get(s.id, 0.0)) for s in sites]


@router.post("/", status_code=201)
def create_site(body: SiteCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in [UserRole.DIRECTOR, UserRole.PROJEKT_LEITER]:
        raise HTTPException(403, "Not authorized")
    site = Site(**body.model_dump())
    db.add(site)
    db.commit()
    db.refresh(site)
    return _site_dict(site)


@router.get("/{site_id}/")
def get_site(site_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from sqlalchemy import func
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(404, "Site not found")
    total_costs = db.query(func.sum(Cost.amount)).filter(Cost.site_id == site_id).scalar() or 0.0
    return _site_dict(site, total_costs)


@router.put("/{site_id}/")
def update_site(site_id: int, body: SiteUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role not in [UserRole.DIRECTOR, UserRole.PROJEKT_LEITER]:
        raise HTTPException(403, "Not authorized")
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(site, k, v)
    db.commit()
    return {"status": "updated"}


# ── Costs ──────────────────────────────────────────────────────────────────────
@router.get("/{site_id}/costs/")
def get_costs(site_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    costs = db.query(Cost).filter(Cost.site_id == site_id).all()
    total = sum(c.amount for c in costs)
    by_category = {}
    for c in costs:
        cat = c.category.value
        by_category[cat] = by_category.get(cat, 0) + c.amount
    return {"total": total, "by_category": by_category, "items": [_cost_dict(c) for c in costs]}


@router.post("/{site_id}/costs/", status_code=201)
def add_cost(site_id: int, body: CostCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    cost = Cost(site_id=site_id, recorded_by=current.id, **body.model_dump())
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return _cost_dict(cost)


# ── Materials ──────────────────────────────────────────────────────────────────
@router.get("/{site_id}/materials/")
def get_materials(site_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    logs = db.query(MaterialLog).filter(MaterialLog.site_id == site_id).order_by(MaterialLog.date.desc()).all()
    return [{"id": l.id, "material": l.material, "quantity": l.quantity, "unit": l.unit,
             "date": l.date, "notes": l.notes} for l in logs]


@router.post("/{site_id}/materials/", status_code=201)
def log_material(site_id: int, body: MaterialCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    log = MaterialLog(site_id=site_id, recorded_by=current.id, **body.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "material": log.material, "quantity": log.quantity, "unit": log.unit}


def _site_dict(s: Site, total_costs: float = 0.0):
    return {
        "id": s.id, "kostenstelle": s.kostenstelle, "name": s.name,
        "client": s.client, "address": s.address, "status": s.status,
        "is_baustelle": s.is_baustelle,
        "budget": s.budget, "total_costs": total_costs, "manager_id": s.manager_id,
        "start_date": s.start_date, "end_date": s.end_date, "notes": s.notes,
    }


def _cost_dict(c: Cost):
    return {
        "id": c.id, "category": c.category, "description": c.description,
        "amount": c.amount, "currency": c.currency, "invoice_ref": c.invoice_ref,
        "supplier": c.supplier, "date": c.date, "notes": c.notes,
    }
