from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
import io, json, base64

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.cost import Cost, CostCategory
from app.core.storage import upload_file
from app.models.document import Document

import pdfplumber

router = APIRouter(prefix="/invoices", tags=["invoices"])

CLAUDE_MODEL = "claude-haiku-4-5-20251001"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_text_pdfplumber(data: bytes) -> str:
    """Extract text from PDF bytes. Returns empty string if no text found."""
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages_text = []
            for page in pdf.pages[:6]:  # limit to first 6 pages
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            return "\n\n".join(pages_text)
    except Exception:
        return ""


def _pdf_pages_as_images_b64(data: bytes) -> list[dict]:
    """Convert first 3 PDF pages to base64 PNG images for Claude vision."""
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(data, dpi=150, first_page=1, last_page=3)
        result = []
        for img in images:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.standard_b64encode(buf.getvalue()).decode()
            result.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}})
        return result
    except Exception:
        return []


def _parse_invoice_with_claude(text: str = "", images: list = None) -> dict:
    """Send invoice content to Claude and return parsed JSON."""
    import anthropic
    client = anthropic.Anthropic()

    system = (
        "Ești un asistent specializat în procesarea facturilor. "
        "Extrage datele din factură și returnează STRICT un JSON valid, fără text suplimentar. "
        "Câmpurile așteptate:\n"
        "{\n"
        '  "supplier_name": string,\n'
        '  "invoice_nr": string,\n'
        '  "invoice_date": "YYYY-MM-DD" or null,\n'
        '  "due_date": "YYYY-MM-DD" or null,\n'
        '  "line_items": [{"description": string, "quantity": number, "unit": string, "unit_price": number, "total": number}],\n'
        '  "subtotal": number,\n'
        '  "vat_rate": number,\n'
        '  "vat_amount": number,\n'
        '  "total": number,\n'
        '  "currency": "EUR" or "RON" or "USD",\n'
        '  "notes": string\n'
        "}"
    )

    content = []
    if images:
        content.extend(images)
        content.append({"type": "text", "text": "Extrage datele din această factură și returnează JSON-ul cerut."})
    else:
        content.append({"type": "text", "text": f"Extrage datele din textul acestei facturi și returnează JSON-ul cerut:\n\n{text[:8000]}"})

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2000,
        system=system,
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ─── Schemas ──────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description: str = ""
    quantity: float = 1
    unit: str = "buc"
    unit_price: float = 0
    total: float = 0


class InvoiceProposal(BaseModel):
    supplier_name: str = ""
    invoice_nr: str = ""
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    line_items: List[LineItem] = []
    subtotal: float = 0
    vat_rate: float = 0
    vat_amount: float = 0
    total: float = 0
    currency: str = "EUR"
    notes: str = ""
    # for confirmation
    file_key: Optional[str] = None
    original_filename: Optional[str] = None


class ConfirmInvoice(BaseModel):
    proposal: InvoiceProposal
    site_id: int
    category: CostCategory = CostCategory.MATERIALE
    save_document: bool = True


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/scan/")
async def scan_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Upload a PDF invoice, extract data with OCR+Claude, return proposal."""
    if file.content_type not in ("application/pdf", "image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Doar PDF sau imagini sunt acceptate")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "Fișierul depășește 20 MB")

    # Upload to storage for later confirmation
    import uuid, os
    from datetime import datetime
    ext = os.path.splitext(file.filename or "invoice.pdf")[1].lower() or ".pdf"
    file_key = f"invoices/pending/{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4().hex}{ext}"
    upload_file(file_key, data, file.content_type or "application/pdf")

    # Extract text
    use_vision = False
    extracted_text = ""
    if file.content_type == "application/pdf":
        extracted_text = _extract_text_pdfplumber(data)
        if len(extracted_text.strip()) < 80:
            use_vision = True
    else:
        use_vision = True

    try:
        if use_vision:
            images = _pdf_pages_as_images_b64(data) if file.content_type == "application/pdf" else []
            if not images:
                # image file — encode directly
                b64 = base64.standard_b64encode(data).decode()
                images = [{"type": "image", "source": {"type": "base64", "media_type": file.content_type, "data": b64}}]
            parsed = _parse_invoice_with_claude(images=images)
        else:
            parsed = _parse_invoice_with_claude(text=extracted_text)
    except json.JSONDecodeError:
        raise HTTPException(422, "Claude nu a putut parsa factura — verificați manual")
    except Exception as e:
        raise HTTPException(500, f"Eroare procesare: {str(e)}")

    # Normalize
    parsed.setdefault("line_items", [])
    parsed.setdefault("currency", "EUR")
    parsed["file_key"] = file_key
    parsed["original_filename"] = file.filename

    return parsed


@router.post("/confirm/", status_code=201)
def confirm_invoice(
    body: ConfirmInvoice,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Confirm parsed invoice proposal → create Cost record (+ optional Document)."""
    from app.models.site import Site
    from datetime import datetime

    site = db.query(Site).filter(Site.id == body.site_id).first()
    if not site:
        raise HTTPException(404, "Șantier negăsit")

    p = body.proposal
    description = f"Factură {p.invoice_nr} — {p.supplier_name}" if p.invoice_nr else p.supplier_name or "Factură scanată"

    cost = Cost(
        site_id=body.site_id,
        category=body.category,
        description=description,
        amount=p.total or p.subtotal,
        currency=p.currency,
        supplier=p.supplier_name or None,
        invoice_ref=p.invoice_nr or None,
        notes=p.notes or None,
        date=datetime.fromisoformat(p.invoice_date) if p.invoice_date else None,
        recorded_by=current.id,
    )
    db.add(cost)
    db.flush()

    doc_id = None
    if body.save_document and p.file_key:
        doc = Document(
            name=p.original_filename or f"Factură {p.invoice_nr}",
            description=description,
            category="invoice",
            site_id=body.site_id,
            file_key=p.file_key,
            file_size=0,
            content_type="application/pdf",
            uploaded_by=current.id,
            notes=p.notes or None,
        )
        db.add(doc)
        db.flush()
        doc_id = doc.id

    db.commit()
    return {"ok": True, "cost_id": cost.id, "doc_id": doc_id}
