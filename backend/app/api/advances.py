from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.validators import OptStr500, OptText
from app.models.advance import EmployeeAdvance
from app.models.employee import Employee
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/advances", tags=["advances"])


class AdvanceCreate(BaseModel):
    employee_id: int
    amount: float = Field(gt=0)
    currency: str = "EUR"
    date: Optional[datetime] = None
    description: Optional[OptStr500] = None
    site_id: Optional[int] = None
    notes: Optional[OptText] = None


class AdvanceSettle(BaseModel):
    settled_note: Optional[OptText] = None


def _dict(a: EmployeeAdvance):
    return {
        "id": a.id,
        "employee_id": a.employee_id,
        "employee_name": f"{a.employee.first_name} {a.employee.last_name}" if a.employee else None,
        "amount": a.amount,
        "currency": a.currency,
        "date": a.date,
        "description": a.description,
        "site_id": a.site_id,
        "site_name": a.site.name if a.site else None,
        "settled": a.settled,
        "settled_at": a.settled_at,
        "settled_note": a.settled_note,
        "notes": a.notes,
        "recorded_by": a.recorder.full_name if a.recorder else None,
        "created_at": a.created_at,
    }


@router.get("/")
def list_advances(
    employee_id: Optional[int] = None,
    settled: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(EmployeeAdvance)
    if employee_id is not None:
        q = q.filter(EmployeeAdvance.employee_id == employee_id)
    if settled is not None:
        q = q.filter(EmployeeAdvance.settled == settled)
    items = q.order_by(EmployeeAdvance.date.desc()).all()

    # Summary per employee
    total_open = db.query(func.sum(EmployeeAdvance.amount)).filter(EmployeeAdvance.settled == False).scalar() or 0.0  # noqa: E712

    return {
        "items": [_dict(a) for a in items],
        "total_open": round(total_open, 2),
    }


@router.post("/", status_code=201)
def create_advance(body: AdvanceCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    emp = db.query(Employee).filter(Employee.id == body.employee_id).first()
    if not emp:
        raise HTTPException(404, "Angajat negăsit")
    data = body.model_dump()
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc)
    adv = EmployeeAdvance(recorded_by=current.id, **data)
    db.add(adv)
    db.commit()
    db.refresh(adv)
    return _dict(adv)


@router.post("/{adv_id}/settle/")
def settle_advance(adv_id: int, body: AdvanceSettle, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    adv = db.query(EmployeeAdvance).filter(EmployeeAdvance.id == adv_id).first()
    if not adv:
        raise HTTPException(404, "Avans negăsit")
    adv.settled = True
    adv.settled_at = datetime.now(timezone.utc)
    adv.settled_note = body.settled_note
    db.commit()
    db.refresh(adv)
    return _dict(adv)


@router.delete("/{adv_id}/", status_code=204)
def delete_advance(adv_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    adv = db.query(EmployeeAdvance).filter(EmployeeAdvance.id == adv_id).first()
    if not adv:
        raise HTTPException(404, "Avans negăsit")
    db.delete(adv)
    db.commit()
