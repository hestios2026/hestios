from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from app.core.database import get_db
from app.core.validators import Str100, OptStr100, OptStr200, OptText
from app.models.daily_report import (
    DailyReport, DailyReportWorker, DailyReportPosition,
    DailyReportEquipment, DailyReportMaterial,
    ReportStatus, WeatherCondition,
)
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/daily-reports", tags=["daily-reports"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkerIn(BaseModel):
    employee_id:     Optional[int]      = None
    name:            Str100
    hours_worked:    float               = Field(default=8.0,  ge=0, le=24)
    overtime_hours:  float               = Field(default=0.0,  ge=0, le=12)
    role:            Optional[OptStr100] = None
    trade:           Optional[OptStr100] = None   # Gewerk: Bagger, Tiefbau…
    is_subcontractor: bool               = False
    absent:          bool                = False
    absent_reason:   Optional[OptStr100] = None


class PositionIn(BaseModel):
    position_type:  Str100
    description:    Optional[OptStr200] = None
    unit:           OptStr100           = "m"
    quantity:       float                = Field(ge=0, le=999_999)
    extra_data:     Optional[dict]       = None


class EquipmentIn(BaseModel):
    equipment_id:   Optional[int]       = None
    name:           Str100
    hours_used:     float                = Field(default=8.0, ge=0, le=24)
    idle_hours:     float                = Field(default=0.0, ge=0, le=24)
    fuel_liters:    float                = Field(default=0.0, ge=0, le=9999)
    operator_name:  Optional[OptStr100] = None
    notes:          Optional[OptStr200] = None


class MaterialIn(BaseModel):
    material_name:  Str100
    unit:           OptStr100 = "Stk"
    quantity:       float      = Field(ge=0, le=999_999)
    notes:          Optional[OptStr200] = None


_TIME_RE = r"^\d{2}:\d{2}$"   # HH:MM

class ReportCreate(BaseModel):
    site_id:             int
    report_date:         date
    weather:             WeatherCondition = WeatherCondition.SONNIG
    temperature_c:       Optional[float]  = Field(default=None, ge=-50, le=60)
    start_time:          str               = Field(default="07:00", pattern=_TIME_RE)
    end_time:            str               = Field(default="16:00", pattern=_TIME_RE)
    pause_min:           int               = Field(default=30, ge=0, le=480)
    notes:               Optional[OptText] = None
    problems:            Optional[OptText] = None
    deliveries:          Optional[OptText] = None
    subcontractor_names: Optional[OptText] = None
    visitor_count:       int               = Field(default=0, ge=0, le=999)
    safety_incident:     bool              = False
    safety_notes:        Optional[OptText] = None
    workers:             List[WorkerIn]    = []
    positions:           List[PositionIn]  = []
    equipment:           List[EquipmentIn] = []
    materials:           List[MaterialIn]  = []


class ReportUpdate(BaseModel):
    weather:             Optional[WeatherCondition] = None
    temperature_c:       Optional[float]  = Field(default=None, ge=-50, le=60)
    start_time:          Optional[str]    = Field(default=None, pattern=_TIME_RE)
    end_time:            Optional[str]    = Field(default=None, pattern=_TIME_RE)
    pause_min:           Optional[int]    = Field(default=None, ge=0, le=480)
    notes:               Optional[OptText] = None
    problems:            Optional[OptText] = None
    deliveries:          Optional[OptText] = None
    subcontractor_names: Optional[OptText] = None
    visitor_count:       Optional[int]    = Field(default=None, ge=0, le=999)
    safety_incident:     Optional[bool]   = None
    safety_notes:        Optional[OptText] = None
    # Director can revert status (e.g. submitted → draft for corrections)
    status:              Optional[ReportStatus] = None
    workers:             Optional[List[WorkerIn]]    = None
    positions:           Optional[List[PositionIn]]  = None
    equipment:           Optional[List[EquipmentIn]] = None
    materials:           Optional[List[MaterialIn]]  = None


# ── Serializer ────────────────────────────────────────────────────────────────

def _report_dict(r: DailyReport):
    return {
        "id": r.id,
        "site_id": r.site_id,
        "report_date": r.report_date,
        "created_by": r.created_by,
        "status": r.status,
        "weather": r.weather,
        "temperature_c": r.temperature_c,
        "start_time": r.start_time,
        "end_time": r.end_time,
        "pause_min": r.pause_min,
        "notes": r.notes,
        "problems": r.problems,
        "deliveries": r.deliveries,
        "subcontractor_names": r.subcontractor_names,
        "visitor_count": r.visitor_count,
        "safety_incident": r.safety_incident,
        "safety_notes": r.safety_notes,
        "submitted_at": r.submitted_at,
        "approved_by": r.approved_by,
        "approved_at": r.approved_at,
        "created_at": r.created_at,
        "workers": [
            {
                "id": w.id, "employee_id": w.employee_id, "name": w.name,
                "hours_worked": w.hours_worked, "overtime_hours": w.overtime_hours,
                "role": w.role, "trade": w.trade,
                "is_subcontractor": w.is_subcontractor,
                "absent": w.absent, "absent_reason": w.absent_reason,
            } for w in r.workers
        ],
        "positions": [
            {
                "id": p.id, "position_type": p.position_type, "description": p.description,
                "unit": p.unit, "quantity": p.quantity, "extra_data": p.extra_data,
            } for p in r.positions
        ],
        "equipment": [
            {
                "id": e.id, "equipment_id": e.equipment_id, "name": e.name,
                "hours_used": e.hours_used, "idle_hours": e.idle_hours,
                "fuel_liters": e.fuel_liters, "operator_name": e.operator_name,
                "notes": e.notes,
            } for e in r.equipment
        ],
        "materials": [
            {
                "id": m.id, "material_name": m.material_name,
                "unit": m.unit, "quantity": m.quantity, "notes": m.notes,
            } for m in r.materials
        ],
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_reports(
    site_id: Optional[int] = Query(None),
    report_date: Optional[date] = Query(None),
    status: Optional[ReportStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(DailyReport)
    if site_id:
        q = q.filter(DailyReport.site_id == site_id)
    if report_date:
        q = q.filter(DailyReport.report_date == report_date)
    if status:
        q = q.filter(DailyReport.status == status)
    # Non-directors see only their own reports
    if current_user.role not in ("director", "projekt_leiter"):
        q = q.filter(DailyReport.created_by == current_user.id)
    reports = q.order_by(DailyReport.report_date.desc()).all()
    return [_report_dict(r) for r in reports]


@router.post("/", status_code=201)
def create_report(body: ReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Prevent duplicate report for same site + date
    existing = db.query(DailyReport).filter(
        DailyReport.site_id == body.site_id,
        DailyReport.report_date == body.report_date,
        DailyReport.created_by == current_user.id,
    ).first()
    if existing:
        raise HTTPException(400, "Report already exists for this site and date")

    report = DailyReport(
        site_id=body.site_id,
        report_date=body.report_date,
        created_by=current_user.id,
        weather=body.weather,
        temperature_c=body.temperature_c,
        start_time=body.start_time,
        end_time=body.end_time,
        pause_min=body.pause_min,
        notes=body.notes,
        problems=body.problems,
        deliveries=body.deliveries,
        subcontractor_names=body.subcontractor_names,
        visitor_count=body.visitor_count,
        safety_incident=body.safety_incident,
        safety_notes=body.safety_notes,
    )
    db.add(report)
    db.flush()

    for w in body.workers:
        db.add(DailyReportWorker(report_id=report.id, **w.model_dump(exclude_none=True)))
    for p in body.positions:
        db.add(DailyReportPosition(report_id=report.id, **p.model_dump(exclude_none=True)))
    for e in body.equipment:
        db.add(DailyReportEquipment(report_id=report.id, **e.model_dump(exclude_none=True)))
    for m in body.materials:
        db.add(DailyReportMaterial(report_id=report.id, **m.model_dump(exclude_none=True)))

    db.commit()
    db.refresh(report)
    return _report_dict(report)


@router.get("/{report_id}/")
def get_report(report_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    return _report_dict(r)


@router.put("/{report_id}/")
def update_report(
    report_id: int,
    body: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    if r.status == ReportStatus.APPROVED and current_user.role != "director":
        raise HTTPException(403, "Cannot edit approved report")

    # Status change: only director; only allowed transitions
    if body.status is not None:
        if current_user.role != "director":
            raise HTTPException(403, "Only directors can change status directly")
        r.status = body.status

    scalar_fields = (
        "weather", "temperature_c", "start_time", "end_time", "pause_min",
        "notes", "problems", "deliveries", "subcontractor_names",
        "visitor_count", "safety_incident", "safety_notes",
    )
    for field in scalar_fields:
        val = getattr(body, field)
        if val is not None:
            setattr(r, field, val)

    # Replace child collections if provided
    if body.workers is not None:
        for w in r.workers:
            db.delete(w)
        db.flush()
        for w in body.workers:
            db.add(DailyReportWorker(report_id=r.id, **w.model_dump(exclude_none=True)))

    if body.positions is not None:
        for p in r.positions:
            db.delete(p)
        db.flush()
        for p in body.positions:
            db.add(DailyReportPosition(report_id=r.id, **p.model_dump(exclude_none=True)))

    if body.equipment is not None:
        for e in r.equipment:
            db.delete(e)
        db.flush()
        for e in body.equipment:
            db.add(DailyReportEquipment(report_id=r.id, **e.model_dump(exclude_none=True)))

    if body.materials is not None:
        for m in r.materials:
            db.delete(m)
        db.flush()
        for m in body.materials:
            db.add(DailyReportMaterial(report_id=r.id, **m.model_dump(exclude_none=True)))

    db.commit()
    db.refresh(r)
    return _report_dict(r)


@router.post("/{report_id}/submit/")
def submit_report(report_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    if r.status != ReportStatus.DRAFT:
        raise HTTPException(400, f"Report is already {r.status}")
    r.status = ReportStatus.SUBMITTED
    r.submitted_at = datetime.utcnow()
    db.commit()
    return {"status": r.status}


@router.post("/{report_id}/approve/")
def approve_report(report_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Only directors or Projektleiter can approve")
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    r.status = ReportStatus.APPROVED
    db.commit()
    return {"status": r.status}


@router.delete("/{report_id}/", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "director":
        raise HTTPException(403, "Only directors can delete reports")
    r = db.query(DailyReport).filter(DailyReport.id == report_id).first()
    if not r:
        raise HTTPException(404, "Not found")
    db.delete(r)
    db.commit()
