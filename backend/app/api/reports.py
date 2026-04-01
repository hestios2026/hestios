from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.site import Site
from app.models.cost import Cost
from app.models.aufmass import AufmassEntry
from app.models.hausanschluss import Hausanschluss
from app.models.equipment import Equipment, EquipmentStatus

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary/")
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Top-level KPIs for the reports dashboard."""
    sites_active = db.query(func.count(Site.id)).filter(Site.status == "active").scalar()
    sites_total  = db.query(func.count(Site.id)).scalar()
    total_costs  = db.query(func.sum(Cost.amount)).scalar() or 0.0
    aufmass_approved = (
        db.query(func.sum(AufmassEntry.total_price))
        .filter(AufmassEntry.status == "approved")
        .scalar() or 0.0
    )
    programari_total = db.query(func.count(Hausanschluss.id)).scalar()
    programari_done  = db.query(func.count(Hausanschluss.id)).filter(Hausanschluss.status == "done").scalar()
    equipment_active = db.query(func.count(Equipment.id)).filter(Equipment.status == EquipmentStatus.ACTIVE).scalar()

    return {
        "sites_active": sites_active,
        "sites_total": sites_total,
        "total_costs": round(total_costs, 2),
        "aufmass_approved": round(aufmass_approved, 2),
        "programari_total": programari_total,
        "programari_done": programari_done,
        "equipment_active": equipment_active,
    }


@router.get("/costs/")
def costs_report(
    site_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Costs grouped by site and category with optional filters."""
    q = db.query(
        Cost.site_id,
        Cost.category,
        func.sum(Cost.amount).label("total"),
        func.count(Cost.id).label("count"),
    )
    if site_id:
        q = q.filter(Cost.site_id == site_id)
    if date_from:
        q = q.filter(Cost.date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(Cost.date <= datetime.combine(date_to, datetime.max.time()))

    rows = q.group_by(Cost.site_id, Cost.category).all()

    # Build site-keyed structure
    sites_map: dict = {}
    for row in rows:
        sid = row.site_id
        if sid not in sites_map:
            site = db.query(Site).filter(Site.id == sid).first()
            sites_map[sid] = {
                "site_id": sid,
                "site_name": site.name if site else None,
                "kostenstelle": site.kostenstelle if site else None,
                "categories": {},
                "total": 0.0,
            }
        sites_map[sid]["categories"][row.category] = round(row.total, 2)
        sites_map[sid]["total"] = round(sites_map[sid]["total"] + row.total, 2)

    return sorted(sites_map.values(), key=lambda x: x["total"], reverse=True)


@router.get("/aufmass/")
def aufmass_report(
    site_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Aufmaß entries grouped by site with totals."""
    q = db.query(AufmassEntry)
    if site_id:
        q = q.filter(AufmassEntry.site_id == site_id)
    if date_from:
        q = q.filter(AufmassEntry.date >= date_from)
    if date_to:
        q = q.filter(AufmassEntry.date <= date_to)
    if status:
        q = q.filter(AufmassEntry.status == status)

    entries = q.order_by(AufmassEntry.site_id, AufmassEntry.date, AufmassEntry.position).all()

    sites_map: dict = {}
    for e in entries:
        sid = e.site_id
        if sid not in sites_map:
            sites_map[sid] = {
                "site_id": sid,
                "site_name": e.site.name if e.site else None,
                "kostenstelle": e.site.kostenstelle if e.site else None,
                "entries": [],
                "total_approved": 0.0,
                "total_all": 0.0,
            }
        sites_map[sid]["entries"].append({
            "id": e.id,
            "date": e.date.isoformat(),
            "position": e.position,
            "description": e.description,
            "quantity": e.quantity,
            "unit": e.unit,
            "unit_price": e.unit_price,
            "total_price": e.total_price,
            "status": e.status,
            "recorder_name": e.recorder.full_name if e.recorder else None,
        })
        if e.total_price:
            sites_map[sid]["total_all"] = round(sites_map[sid]["total_all"] + e.total_price, 2)
            if e.status == "approved":
                sites_map[sid]["total_approved"] = round(sites_map[sid]["total_approved"] + e.total_price, 2)

    return list(sites_map.values())
