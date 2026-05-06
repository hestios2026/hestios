from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from app.core.database import get_db
from app.core.validators import Str200, OptStr100, OptStr200, OptText
from app.models.equipment import Equipment, EquipmentStatus, EquipmentMovement
from app.models.cost import Cost, CostCategory
from app.models.site import Site
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/equipment", tags=["equipment"])


class EquipmentCreate(BaseModel):
    name: Str200
    category: Optional[OptStr100] = None
    brand: Optional[OptStr100] = None
    model: Optional[OptStr100] = None
    year: Optional[int] = Field(default=None, ge=1900, le=2100)
    serial_number: Optional[OptStr100] = None
    daily_rate: Optional[float] = Field(default=None, gt=0)
    current_site_id: Optional[int] = None
    service_due: Optional[str] = None
    itp_due: Optional[str] = None
    notes: Optional[OptText] = None


class EquipmentUpdate(BaseModel):
    name: Optional[Str200] = None
    category: Optional[OptStr100] = None
    brand: Optional[OptStr100] = None
    model: Optional[OptStr100] = None
    year: Optional[int] = Field(default=None, ge=1900, le=2100)
    serial_number: Optional[OptStr100] = None
    status: Optional[EquipmentStatus] = None
    daily_rate: Optional[float] = Field(default=None, gt=0)
    current_site_id: Optional[int] = None
    service_due: Optional[str] = None
    itp_due: Optional[str] = None
    notes: Optional[OptText] = None


class MovementCreate(BaseModel):
    to_site_id: Optional[int] = None
    notes: Optional[OptText] = None


class EquipmentCostCreate(BaseModel):
    site_id: int
    daily_rate: float = Field(gt=0)
    days: int = Field(gt=0)
    period: Optional[str] = None
    description: Optional[OptText] = None
    notes: Optional[OptText] = None


class EquipmentCostUpdate(BaseModel):
    site_id: Optional[int] = None
    daily_rate: Optional[float] = Field(default=None, gt=0)
    days: Optional[int] = Field(default=None, gt=0)
    period: Optional[str] = None
    description: Optional[OptText] = None
    notes: Optional[OptText] = None


def _cost_dict(c: Cost, site_name: Optional[str] = None):
    import re
    rate, days = None, None
    m = re.search(r'\((\d+) zile × ([\d.]+)', c.description or '')
    if m:
        days = int(m.group(1))
        rate = float(m.group(2))
    return {
        "id": c.id,
        "site_id": c.site_id,
        "site_name": site_name,
        "description": c.description,
        "amount": c.amount,
        "daily_rate": rate,
        "days": days,
        "notes": c.notes,
        "date": c.date,
    }


def _eq_dict(e: Equipment):
    return {
        "id": e.id,
        "name": e.name,
        "category": e.category,
        "brand": e.brand,
        "model": e.model,
        "year": e.year,
        "serial_number": e.serial_number,
        "status": e.status,
        "current_site_id": e.current_site_id,
        "current_site_name": e.current_site.name if e.current_site else None,
        "daily_rate": e.daily_rate,
        "service_due": e.service_due,
        "itp_due": e.itp_due,
        "notes": e.notes,
        "created_at": e.created_at,
    }


@router.get("/")
def list_equipment(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = db.query(Equipment).order_by(Equipment.name).all()
    return [_eq_dict(e) for e in items]


@router.post("/", status_code=201)
def create_equipment(body: EquipmentCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    eq = Equipment(**body.model_dump())
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return _eq_dict(eq)


@router.get("/{eq_id}/")
def get_equipment(eq_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    return _eq_dict(eq)


@router.put("/{eq_id}/")
def update_equipment(eq_id: int, body: EquipmentUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(eq, k, v)
    db.commit()
    db.refresh(eq)
    return _eq_dict(eq)


@router.post("/{eq_id}/move/")
def move_equipment(eq_id: int, body: MovementCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    movement = EquipmentMovement(
        equipment_id=eq_id,
        from_site_id=eq.current_site_id,
        to_site_id=body.to_site_id,
        moved_by=current.id,
        notes=body.notes,
    )
    eq.current_site_id = body.to_site_id
    db.add(movement)
    db.commit()
    return {"status": "moved"}


@router.post("/{eq_id}/cost/", status_code=201)
def log_equipment_cost(eq_id: int, body: EquipmentCostCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not eq:
        raise HTTPException(404, "Not found")
    site = db.query(Site).filter(Site.id == body.site_id).first()
    if not site:
        raise HTTPException(404, "Site not found")
    total = round(body.daily_rate * body.days, 2)
    period_label = f" – {body.period}" if body.period else ""
    description = body.description or f"{eq.name}{period_label} ({body.days} zile × {body.daily_rate} €/zi)"
    cost = Cost(
        site_id=body.site_id,
        equipment_id=eq_id,
        recorded_by=current.id,
        category=CostCategory.UTILAJE,
        description=description,
        amount=total,
        currency="EUR",
        notes=body.notes,
    )
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return _cost_dict(cost, site.name)


@router.get("/{eq_id}/costs/")
def list_equipment_costs(eq_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    costs = (
        db.query(Cost)
        .filter(Cost.equipment_id == eq_id)
        .order_by(Cost.date.desc())
        .all()
    )
    return [_cost_dict(c) for c in costs]


@router.put("/{eq_id}/costs/{cost_id}/")
def update_equipment_cost(eq_id: int, cost_id: int, body: EquipmentCostUpdate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    cost = db.query(Cost).filter(Cost.id == cost_id, Cost.equipment_id == eq_id).first()
    if not cost:
        raise HTTPException(404, "Cost not found")
    eq = db.query(Equipment).filter(Equipment.id == eq_id).first()

    daily_rate = body.daily_rate if body.daily_rate is not None else None
    days = body.days if body.days is not None else None

    # Recalculate amount if rate or days changed
    if daily_rate is not None or days is not None:
        # Try to extract existing values from description as fallback
        import re
        existing_rate = daily_rate
        existing_days = days
        if existing_rate is None or existing_days is None:
            m = re.search(r'\((\d+) zile × ([\d.]+)', cost.description or '')
            if m:
                if existing_days is None:
                    existing_days = int(m.group(1))
                if existing_rate is None:
                    existing_rate = float(m.group(2))
        if existing_rate and existing_days:
            cost.amount = round(existing_rate * existing_days, 2)
            period = body.period or (re.search(r'– (.+?) \(', cost.description or '') or [None, None])[1]
            period_label = f" – {period}" if period else ""
            if not body.description:
                cost.description = f"{eq.name}{period_label} ({existing_days} zile × {existing_rate} €/zi)"

    if body.site_id is not None:
        cost.site_id = body.site_id
    if body.description is not None:
        cost.description = body.description
    if body.notes is not None:
        cost.notes = body.notes
    if body.period is not None and not (daily_rate or days):
        # update period in description
        import re
        cost.description = re.sub(r' – [^(]+', f' – {body.period} ', cost.description or '') if '–' in (cost.description or '') else cost.description

    db.commit()
    db.refresh(cost)
    site = db.query(Site).filter(Site.id == cost.site_id).first()
    return _cost_dict(cost, site.name if site else None)


@router.delete("/{eq_id}/costs/{cost_id}/", status_code=204)
def delete_equipment_cost(eq_id: int, cost_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cost = db.query(Cost).filter(Cost.id == cost_id, Cost.equipment_id == eq_id).first()
    if not cost:
        raise HTTPException(404, "Cost not found")
    db.delete(cost)
    db.commit()


@router.get("/{eq_id}/movements/")
def get_movements(eq_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    movements = (
        db.query(EquipmentMovement)
        .filter(EquipmentMovement.equipment_id == eq_id)
        .order_by(EquipmentMovement.moved_at.desc())
        .all()
    )
    return [{
        "id": m.id,
        "from_site": m.from_site.name if m.from_site else "—",
        "to_site": m.to_site.name if m.to_site else "—",
        "moved_by": m.mover.full_name if m.mover else "—",
        "moved_at": m.moved_at,
        "notes": m.notes,
    } for m in movements]
