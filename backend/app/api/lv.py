"""LV Catalog — Leistungsverzeichnis CRUD, CSV import/export, clone."""
import csv
import io
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.validators import Str200, OptStr50, OptStr200, OptStr300, OptText
from app.models.lv import LVCatalog, LVPosition
from app.models.user import User
from app.models.site import Site
from app.api.auth import get_current_user

router = APIRouter(prefix="/lv", tags=["lv"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class LVCreate(BaseModel):
    name: Str200
    site_id: Optional[int] = None
    work_type: Optional[OptStr50] = None
    is_template: bool = False
    notes: Optional[OptText] = None


class LVUpdate(BaseModel):
    name: Optional[Str200] = None
    site_id: Optional[int] = None
    work_type: Optional[OptStr50] = None
    is_template: Optional[bool] = None
    notes: Optional[OptText] = None


class PositionCreate(BaseModel):
    position_nr: Optional[OptStr200] = None
    short_description: OptStr300
    long_description: Optional[OptText] = None
    unit: OptStr50 = "m"
    unit_price: float = Field(default=0.0, ge=0)
    sort_order: int = Field(default=0, ge=0)


class PositionUpdate(BaseModel):
    position_nr: Optional[OptStr200] = None
    short_description: Optional[OptStr300] = None
    long_description: Optional[OptText] = None
    unit: Optional[OptStr50] = None
    unit_price: Optional[float] = Field(default=None, ge=0)
    sort_order: Optional[int] = Field(default=None, ge=0)


class ReorderRequest(BaseModel):
    order: List[int]   # position IDs in desired order


# ── Helpers ────────────────────────────────────────────────────────────────────

def _pos_dict(p: LVPosition) -> dict:
    return {
        "id": p.id,
        "lv_id": p.lv_id,
        "position_nr": p.position_nr,
        "short_description": p.short_description,
        "long_description": p.long_description,
        "unit": p.unit,
        "unit_price": p.unit_price,
        "sort_order": p.sort_order,
    }


def _lv_dict(lv: LVCatalog, include_positions: bool = False) -> dict:
    d = {
        "id": lv.id,
        "name": lv.name,
        "site_id": lv.site_id,
        "site_name": lv.site.name if lv.site else None,
        "work_type": lv.work_type,
        "is_template": lv.is_template,
        "notes": lv.notes,
        "created_by": lv.created_by,
        "creator_name": lv.creator.full_name if lv.creator else None,
        "created_at": lv.created_at,
        "position_count": len(lv.positions),
    }
    if include_positions:
        d["positions"] = [_pos_dict(p) for p in lv.positions]
    return d


# ── LV Catalog CRUD ────────────────────────────────────────────────────────────

@router.get("/")
def list_catalogs(
    site_id: Optional[int] = None,
    work_type: Optional[str] = None,
    templates_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(LVCatalog)
    if site_id is not None:
        q = q.filter(LVCatalog.site_id == site_id)
    if work_type:
        q = q.filter(LVCatalog.work_type == work_type)
    if templates_only:
        q = q.filter(LVCatalog.is_template == True)  # noqa: E712
    return [_lv_dict(lv) for lv in q.order_by(LVCatalog.name).all()]


@router.post("/", status_code=201)
def create_catalog(
    body: LVCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if body.site_id:
        if not db.query(Site).filter(Site.id == body.site_id).first():
            raise HTTPException(404, "Site not found")
    lv = LVCatalog(**body.model_dump(), created_by=current.id)
    db.add(lv)
    db.commit()
    db.refresh(lv)
    return _lv_dict(lv)


@router.get("/{lv_id}/")
def get_catalog(
    lv_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lv = db.query(LVCatalog).filter(LVCatalog.id == lv_id).first()
    if not lv:
        raise HTTPException(404, "LV not found")
    return _lv_dict(lv, include_positions=True)


@router.put("/{lv_id}/")
def update_catalog(
    lv_id: int,
    body: LVUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lv = db.query(LVCatalog).filter(LVCatalog.id == lv_id).first()
    if not lv:
        raise HTTPException(404, "LV not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(lv, k, v)
    db.commit()
    db.refresh(lv)
    return _lv_dict(lv)


@router.delete("/{lv_id}/")
def delete_catalog(
    lv_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in ("director", "projekt_leiter"):
        raise HTTPException(403, "Insufficient rights")
    lv = db.query(LVCatalog).filter(LVCatalog.id == lv_id).first()
    if not lv:
        raise HTTPException(404, "LV not found")
    db.delete(lv)
    db.commit()
    return {"ok": True}


# ── Clone LV ──────────────────────────────────────────────────────────────────

@router.post("/{lv_id}/clone/", status_code=201)
def clone_catalog(
    lv_id: int,
    body: LVCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Clone an LV (e.g. template → specific site) with all positions."""
    source = db.query(LVCatalog).filter(LVCatalog.id == lv_id).first()
    if not source:
        raise HTTPException(404, "Source LV not found")

    new_lv = LVCatalog(
        name=body.name,
        site_id=body.site_id,
        work_type=body.work_type or source.work_type,
        is_template=body.is_template,
        notes=body.notes or source.notes,
        created_by=current.id,
    )
    db.add(new_lv)
    db.flush()

    for p in source.positions:
        db.add(LVPosition(
            lv_id=new_lv.id,
            position_nr=p.position_nr,
            short_description=p.short_description,
            long_description=p.long_description,
            unit=p.unit,
            unit_price=p.unit_price,
            sort_order=p.sort_order,
        ))

    db.commit()
    db.refresh(new_lv)
    return _lv_dict(new_lv, include_positions=True)


# ── Positions CRUD ─────────────────────────────────────────────────────────────

@router.post("/{lv_id}/positions/", status_code=201)
def add_position(
    lv_id: int,
    body: PositionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.query(LVCatalog).filter(LVCatalog.id == lv_id).first():
        raise HTTPException(404, "LV not found")
    pos = LVPosition(lv_id=lv_id, **body.model_dump())
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return _pos_dict(pos)


@router.put("/{lv_id}/positions/{pos_id}/")
def update_position(
    lv_id: int,
    pos_id: int,
    body: PositionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pos = db.query(LVPosition).filter(
        LVPosition.id == pos_id, LVPosition.lv_id == lv_id
    ).first()
    if not pos:
        raise HTTPException(404, "Position not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(pos, k, v)
    db.commit()
    db.refresh(pos)
    return _pos_dict(pos)


@router.delete("/{lv_id}/positions/{pos_id}/")
def delete_position(
    lv_id: int,
    pos_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    pos = db.query(LVPosition).filter(
        LVPosition.id == pos_id, LVPosition.lv_id == lv_id
    ).first()
    if not pos:
        raise HTTPException(404, "Position not found")
    db.delete(pos)
    db.commit()
    return {"ok": True}


# ── Bulk reorder ───────────────────────────────────────────────────────────────

@router.put("/{lv_id}/positions/reorder/")
def reorder_positions(
    lv_id: int,
    body: ReorderRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Update sort_order for all positions in one call."""
    for idx, pos_id in enumerate(body.order):
        db.query(LVPosition).filter(
            LVPosition.id == pos_id, LVPosition.lv_id == lv_id
        ).update({"sort_order": idx})
    db.commit()
    return {"ok": True}


# ── Search positions (for use in Aufmaß / Tagesbericht dropdowns) ─────────────

@router.get("/positions/search/")
def search_positions(
    q: str = "",
    site_id: Optional[int] = None,
    work_type: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Full-text search across all positions — used in Aufmaß/Tagesbericht autocomplete."""
    query = db.query(LVPosition).join(LVCatalog)
    if site_id:
        query = query.filter(
            (LVCatalog.site_id == site_id) | (LVCatalog.is_template == True)  # noqa
        )
    if work_type:
        query = query.filter(LVCatalog.work_type == work_type)
    if q:
        like = f"%{q}%"
        query = query.filter(
            LVPosition.short_description.ilike(like)
            | LVPosition.position_nr.ilike(like)
        )
    rows = query.order_by(LVPosition.sort_order, LVPosition.position_nr).limit(limit).all()
    return [
        {**_pos_dict(p), "lv_name": p.catalog.name, "work_type": p.catalog.work_type}
        for p in rows
    ]


# ── CSV Import ─────────────────────────────────────────────────────────────────

_CSV_COLUMNS = ["position_nr", "short_description", "long_description", "unit", "unit_price"]

@router.post("/{lv_id}/import/")
async def import_csv(
    lv_id: int,
    file: UploadFile = File(...),
    replace: bool = False,    # if True, delete existing positions first
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Import positions from CSV.
    Required columns: position_nr, short_description, unit, unit_price
    Optional: long_description
    Encoding: UTF-8 with BOM support.
    """
    if not db.query(LVCatalog).filter(LVCatalog.id == lv_id).first():
        raise HTTPException(404, "LV not found")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only .csv files accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handles BOM from Excel
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(400, "Empty or invalid CSV")

    # Normalise headers: strip whitespace, lowercase
    fieldnames_lower = [f.strip().lower() for f in reader.fieldnames]
    if "short_description" not in fieldnames_lower:
        raise HTTPException(400, "CSV must have a 'short_description' column")

    if replace:
        db.query(LVPosition).filter(LVPosition.lv_id == lv_id).delete()

    # Determine existing max sort_order
    existing_max = db.query(LVPosition).filter(LVPosition.lv_id == lv_id).count()
    imported = 0
    errors = []

    for i, raw_row in enumerate(reader, start=2):  # start=2 (header is row 1)
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        desc = row.get("short_description", "").strip()
        if not desc:
            errors.append(f"Row {i}: empty short_description — skipped")
            continue
        if len(desc) > 300:
            errors.append(f"Row {i}: short_description too long (>300) — truncated")
            desc = desc[:300]

        try:
            price = float(row.get("unit_price", "0") or 0)
        except ValueError:
            errors.append(f"Row {i}: invalid unit_price '{row.get('unit_price')}' — set to 0")
            price = 0.0

        db.add(LVPosition(
            lv_id=lv_id,
            position_nr=(row.get("position_nr") or "")[:20],
            short_description=desc,
            long_description=row.get("long_description") or None,
            unit=(row.get("unit") or "m")[:20],
            unit_price=price,
            sort_order=existing_max + imported,
        ))
        imported += 1

    db.commit()
    return {"imported": imported, "errors": errors}


# ── CSV Export ─────────────────────────────────────────────────────────────────

@router.get("/{lv_id}/export/")
def export_csv(
    lv_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lv = db.query(LVCatalog).filter(LVCatalog.id == lv_id).first()
    if not lv:
        raise HTTPException(404, "LV not found")

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=_CSV_COLUMNS, lineterminator="\r\n")
    writer.writeheader()
    for p in lv.positions:
        writer.writerow({
            "position_nr":       p.position_nr or "",
            "short_description": p.short_description,
            "long_description":  p.long_description or "",
            "unit":              p.unit or "m",
            "unit_price":        p.unit_price,
        })

    safe_name = "".join(c if c.isalnum() or c in "._- " else "_" for c in lv.name)
    return StreamingResponse(
        io.BytesIO(("\ufeff" + buf.getvalue()).encode("utf-8")),  # BOM for Excel
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.csv"'},
    )
