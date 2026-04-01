import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Request, Query, HTTPException, Header
from sqlalchemy.orm import Session
from fastapi import Depends
from app.core.database import get_db
from app.core.config import settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

VERIFY_TOKEN = "hestios_whatsapp_verify_2024"


# ─── Verification ─────────────────────────────────────────────────────────────

@router.get("/whatsapp/")
def verify_webhook(
    hub_mode: str = Query(default=None, alias="hub.mode"),
    hub_challenge: str = Query(default=None, alias="hub.challenge"),
    hub_verify_token: str = Query(default=None, alias="hub.verify_token"),
):
    """Meta webhook verification (GET request from Meta during setup)."""
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(403, "Invalid verify token")


# ─── Inbound messages ─────────────────────────────────────────────────────────

@router.post("/whatsapp/")
async def receive_whatsapp(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: str = Header(default=None),
):
    """Receive inbound WhatsApp messages from Meta."""
    raw_body = await request.body()

    # Verify Meta signature if token is configured
    if settings.WHATSAPP_TOKEN and x_hub_signature_256:
        expected = "sha256=" + hmac.new(
            settings.WHATSAPP_TOKEN.encode(),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_hub_signature_256):
            raise HTTPException(403, "Invalid signature")

    try:
        payload = json.loads(raw_body)
    except Exception:
        return {"status": "ok"}

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            messages = change.get("value", {}).get("messages", [])
            for msg in messages:
                try:
                    await _handle_inbound(db, msg)
                except Exception as e:
                    logger.error(f"Error handling WhatsApp message: {e}", exc_info=True)
    return {"status": "ok"}


async def _handle_inbound(db, msg: dict):
    from_number = msg.get("from", "")
    text = msg.get("text", {}).get("body", "").strip()
    text_upper = text.upper()

    if text_upper == "OK":
        await _handle_briefing_confirmation(db, from_number)
    elif text_upper in ("DA", "JA", "YES"):
        await _handle_po_approval(db, from_number, approved=True)
    elif text_upper in ("NU", "NEIN", "NO"):
        await _handle_po_approval(db, from_number, approved=False)
    else:
        # Treat as a procurement request — parse with Claude
        await _handle_procurement_request(db, from_number, text)


# ─── Briefing confirmation ─────────────────────────────────────────────────────

async def _handle_briefing_confirmation(db, phone: str):
    from app.models.user import User
    user = db.query(User).filter(User.whatsapp_number == phone).first()
    if not user:
        return
    logger.info(f"Briefing confirmed by {user.full_name} ({phone})")


# ─── PO approval / rejection ──────────────────────────────────────────────────

async def _handle_po_approval(db, phone: str, approved: bool):
    """Approve or reject the latest pending purchase order for this user."""
    from app.models.user import User
    from app.models.supplier import PurchaseOrder
    from app.services.whatsapp import send_text_message

    user = db.query(User).filter(User.whatsapp_number == phone).first()
    if not user:
        return

    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.requested_by == user.id,
        PurchaseOrder.status == "pending",
    ).order_by(PurchaseOrder.created_at.desc()).first()

    if not po:
        await send_text_message(phone, "Nu există comenzi în așteptare.")
        return

    from datetime import datetime
    if approved:
        po.status = "approved"
        po.approved_at = datetime.utcnow()
        db.commit()
        await _send_supplier_emails(db, po)
        suppliers_summary = _get_suppliers_summary(db, po)
        await send_text_message(
            phone,
            f"✅ Comanda #{po.id} confirmată.\nEmailuri trimise la:\n{suppliers_summary}\n\nTotal: {po.total_amount:.2f} EUR"
        )
        logger.info(f"PO #{po.id} approved by {user.full_name}")
    else:
        po.status = "cancelled"
        db.commit()
        await send_text_message(phone, f"❌ Comanda #{po.id} a fost anulată.")
        logger.info(f"PO #{po.id} cancelled by {user.full_name}")


def _get_suppliers_summary(db, po) -> str:
    from app.models.supplier import Supplier
    from collections import defaultdict
    by_sup: dict = defaultdict(float)
    for item in po.items:
        sup = db.query(Supplier).filter(Supplier.id == item.supplier_id).first()
        name = sup.name if sup else f"Supplier #{item.supplier_id}"
        by_sup[name] += item.total_price
    return "\n".join(f"  • {name}: {total:.2f} EUR" for name, total in by_sup.items())


async def _send_supplier_emails(db, po):
    """Send order emails to each supplier that has items in this PO."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from collections import defaultdict
    from app.models.supplier import PurchaseOrderItem, Supplier

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured — skipping supplier emails for PO #%s", po.id)
        return

    by_sup: dict[int, list] = defaultdict(list)
    for item in po.items:
        by_sup[item.supplier_id].append(item)

    for supplier_id, items in by_sup.items():
        sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if not sup:
            continue

        lines = ["Sehr geehrte Damen und Herren,", "", "wir bestellen folgende Artikel:", ""]
        total = 0.0
        for item in items:
            lines.append(f"  - {item.product_name}: {item.quantity} {item.unit} × {item.unit_price:.2f} EUR = {item.total_price:.2f} EUR")
            total += item.total_price
        lines += ["", f"Gesamtbetrag: {total:.2f} EUR", "", "Mit freundlichen Grüßen,", "Hesti Rossmann GmbH"]

        recipients = [sup.email] + ([sup.email2] if sup.email2 else [])
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_USER
            msg["To"] = ", ".join(recipients)
            msg["Subject"] = f"Bestellung #{po.id} — Hesti Rossmann GmbH"
            msg.attach(MIMEText("\n".join(lines), "plain", "utf-8"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_USER, recipients, msg.as_string())

            for item in items:
                item.email_sent = True
            db.commit()
            logger.info(f"Email trimis la {sup.name} ({sup.email}) pentru PO #{po.id}")
        except Exception as e:
            logger.error(f"Eroare email la {sup.name}: {e}")


# ─── Procurement request parsing with Claude ──────────────────────────────────

async def _handle_procurement_request(db, phone: str, text: str):
    """Parse free-form procurement request using Claude, find best prices, send approval message."""
    from app.models.user import User
    from app.models.supplier import Supplier, SupplierPrice, PurchaseOrder, PurchaseOrderItem
    from app.services.whatsapp import send_text_message
    from collections import defaultdict

    user = db.query(User).filter(User.whatsapp_number == phone).first()
    if not user:
        logger.warning(f"Unknown WhatsApp number: {phone}")
        return

    if not settings.ANTHROPIC_API_KEY:
        await send_text_message(phone, "❌ Agent Achiziții nu este configurat (lipsă API key).")
        return

    prices = db.query(SupplierPrice).all()
    if not prices:
        await send_text_message(phone, "❌ Nu există prețuri în baza de date.")
        return

    # Build price catalog for Claude
    price_catalog = []
    for p in prices:
        sup = db.query(Supplier).filter(Supplier.id == p.supplier_id, Supplier.is_active == True).first()
        if sup:
            price_catalog.append({
                "product": p.product_name,
                "unit": p.unit,
                "price": p.price,
                "currency": p.currency,
                "supplier": sup.name,
                "supplier_id": sup.id,
            })

    catalog_json = json.dumps(price_catalog, ensure_ascii=False)

    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    system_prompt = (
        "Ești un agent de achiziții pentru o firmă de construcții. "
        "Primești o cerere de materiale în text liber și un catalog de prețuri JSON. "
        "Identifică produsele cerute și cantitățile, alege cel mai ieftin furnizor pentru fiecare produs. "
        "Returnează DOAR un JSON valid (fără alt text) cu structura:\n"
        '{"items":[{"product_name":"...","quantity":10,"unit":"buc","unit_price":5.50,'
        '"total_price":55.00,"supplier":"Würth","supplier_id":2}],'
        '"not_found":["produs negăsit"],"total":55.00}\n'
        "Dacă un produs nu există în catalog, adaugă-l în not_found. "
        "Alege prețul cel mai mic per produs."
    )

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": f"Cerere: {text}\n\nCatalog:\n{catalog_json}"}],
        )
        result_text = response.content[0].text.strip()
        if "```" in result_text:
            result_text = result_text.split("```")[1].replace("json", "").strip()
        parsed = json.loads(result_text)
    except Exception as e:
        logger.error(f"Claude parsing error: {e}")
        await send_text_message(phone, "❌ Eroare la procesarea cererii. Încearcă din nou.")
        return

    items = parsed.get("items", [])
    not_found = parsed.get("not_found", [])
    total = parsed.get("total", sum(i.get("total_price", 0) for i in items))

    if not items:
        msg = "Nu am găsit niciun produs din cerere în catalog."
        if not_found:
            msg += f"\nProduse negăsite: {', '.join(not_found)}"
        await send_text_message(phone, msg)
        return

    # Create pending PurchaseOrder
    po = PurchaseOrder(
        requested_by=user.id,
        status="pending",
        total_amount=total,
        whatsapp_msg=text,
    )
    db.add(po)
    db.flush()

    for item in items:
        sup = db.query(Supplier).filter(Supplier.name == item["supplier"]).first()
        if not sup:
            continue
        db.add(PurchaseOrderItem(
            order_id=po.id,
            supplier_id=sup.id,
            product_name=item["product_name"],
            quantity=item["quantity"],
            unit=item.get("unit", "buc"),
            unit_price=item["unit_price"],
            total_price=item["total_price"],
        ))
    db.commit()

    # Build approval message grouped by supplier
    by_sup: dict[str, list] = defaultdict(list)
    for item in items:
        by_sup[item["supplier"]].append(item)

    lines = [f"📦 *Comandă #{po.id} — spre aprobare*", ""]
    for sup_name, sup_items in by_sup.items():
        sup_total = sum(i["total_price"] for i in sup_items)
        lines.append(f"*{sup_name}* ({sup_total:.2f} EUR):")
        for i in sup_items:
            lines.append(f"  • {i['product_name']}: {i['quantity']} {i.get('unit','buc')} × {i['unit_price']:.2f} = {i['total_price']:.2f} EUR")
        lines.append("")

    lines.append(f"*TOTAL: {total:.2f} EUR*")
    if not_found:
        lines.append(f"\n⚠ Negăsite în catalog: {', '.join(not_found)}")
    lines.append("\nRăspunde *DA* pentru a trimite comenzile sau *NU* pentru a anula.")

    await send_text_message(phone, "\n".join(lines))
    logger.info(f"Procurement request from {user.full_name}: PO #{po.id}, {len(items)} items, {total:.2f} EUR")
