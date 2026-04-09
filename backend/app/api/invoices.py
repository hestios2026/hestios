from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
import io, json, base64, re, logging

logger = logging.getLogger(__name__)

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


def _ocr_image_bytes(data: bytes, content_type: str) -> str:
    """Run Tesseract OCR on image bytes. Returns extracted text."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        return pytesseract.image_to_string(img, lang="deu+ron+eng")
    except Exception as e:
        logger.warning(f"Tesseract OCR failed: {e}")
        return ""


def _parse_amount(s: str) -> float:
    """Parse German/Romanian formatted number: 1.234,56 or 1234.56"""
    s = s.strip().replace(" ", "")
    if re.match(r"^\d{1,3}(\.\d{3})*(,\d+)?$", s):
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_invoice_local(text: str) -> dict:
    """Regex-based invoice parser — no external API needed."""
    result = {
        "supplier_name": "", "invoice_nr": "", "invoice_date": None,
        "due_date": None, "line_items": [], "subtotal": 0.0,
        "vat_rate": 19.0, "vat_amount": 0.0, "total": 0.0,
        "currency": "EUR", "notes": "",
    }
    if not text:
        return result

    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Supplier name: first meaningful line
    for line in lines[:8]:
        if len(line) > 3 and not re.match(r"^(Rechnung|Factura|Invoice|Datum|Date|Nr\.)", line, re.I):
            result["supplier_name"] = line
            break

    # Invoice number
    for pat in [
        r"(?:Rechnungs(?:nummer|nr\.?)|Invoice\s*(?:No\.?|Nr\.?)|Factura\s*nr\.?)[:\s#]*([A-Z0-9][\w\-/]{2,30})",
        r"(?:Nr\.|No\.)[:\s]*([A-Z0-9][\w\-/]{2,20})",
        r"(?:RE|INV|RN|FA)[:\s\-]*(\d{4,}[\w\-/]*)",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            result["invoice_nr"] = m.group(1).strip()
            break

    # Dates
    def normalize_date(d: str) -> str:
        if re.match(r"\d{4}-\d{2}-\d{2}", d):
            return d
        parts = re.split(r"[./]", d)
        return f"{parts[2]}-{parts[1]}-{parts[0]}"

    dates = re.findall(r"(\d{2}[./]\d{2}[./]\d{4}|\d{4}-\d{2}-\d{2})", text)
    if dates:
        result["invoice_date"] = normalize_date(dates[0])
    if len(dates) >= 2:
        result["due_date"] = normalize_date(dates[1])

    # Currency
    if "RON" in text or "Lei" in text:
        result["currency"] = "RON"
    elif "USD" in text or "$" in text:
        result["currency"] = "USD"

    # VAT rate
    m = re.search(r"(\d{1,2})\s*%\s*(?:MwSt|USt|TVA|VAT)", text, re.I)
    if m:
        result["vat_rate"] = float(m.group(1))

    # Amounts
    amt = r"([\d.,]+)"
    for key, patterns in [
        ("total",      [r"(?:Gesamt(?:betrag)?|Total|TOTAL|Rechnungsbetrag)[^0-9]+" + amt,
                        r"(?:Summe|Betrag)[^0-9]+" + amt]),
        ("subtotal",   [r"(?:Netto(?:betrag)?|Subtotal|Zwischensumme|Warenwert)[^0-9]+" + amt]),
        ("vat_amount", [r"(?:MwSt|USt|TVA|VAT)[^0-9]+" + amt]),
    ]:
        for pat in patterns:
            m = re.search(pat, text, re.I)
            if m:
                result[key] = _parse_amount(m.group(1))
                break

    # Derive missing amounts
    if result["total"] and not result["subtotal"] and result["vat_amount"]:
        result["subtotal"] = round(result["total"] - result["vat_amount"], 2)
    if result["total"] and not result["vat_amount"] and result["subtotal"]:
        result["vat_amount"] = round(result["total"] - result["subtotal"], 2)
    if result["subtotal"] and not result["total"] and result["vat_amount"]:
        result["total"] = round(result["subtotal"] + result["vat_amount"], 2)

    # Fallback single line item
    if not result["line_items"] and result["total"]:
        result["line_items"].append({
            "description": result["supplier_name"] or "Servicii",
            "quantity": 1, "unit": "buc",
            "unit_price": result["subtotal"] or result["total"],
            "total": result["subtotal"] or result["total"],
        })

    return result


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

    # ── Step 1: Extract text ──────────────────────────────────────────────────
    extracted_text = ""
    is_image = file.content_type != "application/pdf"

    if not is_image:
        extracted_text = _extract_text_pdfplumber(data)

    # For image files or scanned PDFs (no text layer), run Tesseract OCR
    if is_image:
        extracted_text = _ocr_image_bytes(data, file.content_type)
    elif len(extracted_text.strip()) < 80:
        # Scanned PDF — convert to images then OCR
        try:
            from pdf2image import convert_from_bytes
            from PIL import Image as PILImage
            import pytesseract
            pages = convert_from_bytes(data, dpi=200, first_page=1, last_page=3)
            extracted_text = "\n\n".join(
                pytesseract.image_to_string(p, lang="deu+ron+eng") for p in pages
            )
        except Exception as e:
            logger.warning(f"PDF→image OCR failed: {e}")

    # ── Step 2: Parse — Claude if key available, else local regex ─────────────
    import os
    has_claude = bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())
    parsed = None

    if has_claude:
        try:
            if is_image or len(extracted_text.strip()) < 80:
                # Send image to Claude vision
                b64 = base64.standard_b64encode(data).decode()
                images = [{"type": "image", "source": {"type": "base64", "media_type": file.content_type, "data": b64}}]
                if not is_image:
                    images = _pdf_pages_as_images_b64(data)
                parsed = _parse_invoice_with_claude(images=images)
            else:
                parsed = _parse_invoice_with_claude(text=extracted_text)
            logger.info("Invoice parsed with Claude")
        except Exception as e:
            logger.warning(f"Claude parsing failed, falling back to local OCR: {e}")
            parsed = None

    if parsed is None:
        parsed = _parse_invoice_local(extracted_text)
        parsed["notes"] = (parsed.get("notes") or "") + (" [OCR local]" if not has_claude else " [fallback local]")
        logger.info("Invoice parsed with local regex OCR")

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
