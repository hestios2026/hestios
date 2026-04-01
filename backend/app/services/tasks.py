"""Scheduled task implementations — called by APScheduler."""
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from app.models.daily_report import DailyReport, ReportStatus
from app.models.site import Site, SiteStatus
from app.models.equipment import Equipment
from app.models.notification import PolierAssignment
from app.models.user import User, UserRole
from app.services.notifications import create_notification, notify_all_directors, notify_all_pls
import logging

logger = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _active_baustellen(db: Session):
    return db.query(Site).filter(
        Site.is_baustelle == True,
        Site.status == SiteStatus.ACTIVE,
    ).all()


def _polier_for_site(db: Session, site_id: int) -> list[User]:
    """Return polier/sef_santier assigned to site today."""
    today = date.today().isoformat()
    assignments = db.query(PolierAssignment).filter(
        PolierAssignment.site_id == site_id,
        PolierAssignment.date_from <= today,
    ).filter(
        (PolierAssignment.date_to == None) | (PolierAssignment.date_to >= today)
    ).all()
    if not assignments:
        # Fallback: any polier whose current_site_id matches
        return db.query(User).filter(
            User.current_site_id == site_id,
            User.is_active == True,
            User.role.in_([UserRole.POLIER, UserRole.SEF_SANTIER]),
        ).all()
    return [db.query(User).get(a.polier_id) for a in assignments if db.query(User).get(a.polier_id)]


def _has_submitted_report(db: Session, site_id: int) -> bool:
    today = date.today()
    return db.query(DailyReport).filter(
        DailyReport.site_id == site_id,
        DailyReport.report_date == today,
        DailyReport.status != ReportStatus.DRAFT,
    ).first() is not None


# ─── Task functions ───────────────────────────────────────────────────────────

async def check_missing_reports_18(db: Session):
    """18:00 Mon-Fri: WhatsApp reminder to poliers with missing daily report."""
    sites = _active_baustellen(db)
    for site in sites:
        if _has_submitted_report(db, site.id):
            continue
        poliers = _polier_for_site(db, site.id)
        for polier in poliers:
            lang = polier.language or "ro"
            if lang == "de":
                title = f"Tagesbericht fehlt: {site.name}"
                body = f"Guten Abend {polier.full_name}! Der Tagesbericht für {site.name} wurde noch nicht eingereicht. Bitte bis 19:00 Uhr einreichen."
            else:
                title = f"Raport zilnic lipsă: {site.name}"
                body = f"Bună ziua {polier.full_name}! Raportul zilnic pentru șantierul {site.name} nu a fost depus. Te rugăm să îl completezi până la 19:00."
            channel = "whatsapp" if polier.notify_whatsapp and polier.whatsapp_number else "in_app"
            create_notification(db, polier.id, type="report_missing", title=title, body=body,
                                entity_type="site", entity_id=site.id,
                                target_page="tagesbericht", priority="high", channel=channel)


async def check_missing_reports_19(db: Session):
    """19:00 Mon-Fri: in-app escalation to PL + director for still-missing reports."""
    sites = _active_baustellen(db)
    for site in sites:
        if _has_submitted_report(db, site.id):
            continue
        poliers = _polier_for_site(db, site.id)
        polier_names = ", ".join(p.full_name for p in poliers) if poliers else "—"
        title = f"ALERTĂ: Raport lipsă — {site.name}"
        body = f"Raportul zilnic pentru {site.name} (Polier: {polier_names}) nu a fost depus până la 19:00."
        notify_all_directors(db, type="report_missing_escalation", title=title, body=body,
                             entity_type="site", entity_id=site.id, target_page="tagesbericht",
                             priority="critical", channel="in_app")
        notify_all_pls(db, type="report_missing_escalation", title=title, body=body,
                       entity_type="site", entity_id=site.id, target_page="tagesbericht",
                       priority="high", channel="in_app")


async def check_equipment_due(db: Session):
    """08:00 daily: notify director about equipment with service/ITP due within 14 days."""
    threshold = date.today() + timedelta(days=14)
    today = date.today()
    equipment_list = db.query(Equipment).filter(
        Equipment.status == "active",
    ).all()
    for eq in equipment_list:
        # Service due within 7 days
        if eq.service_due and isinstance(eq.service_due, (date, datetime)):
            due = eq.service_due if isinstance(eq.service_due, date) else eq.service_due.date()
            days_left = (due - today).days
            if 0 <= days_left <= 7:
                notify_all_directors(
                    db, type="equipment_service_due",
                    title=f"Service: {eq.name}",
                    body=f"Utilaj {eq.name} necesită revizie până pe {due}. {days_left} zile rămase.",
                    entity_type="equipment", entity_id=eq.id, target_page="equipment",
                    priority="high" if days_left <= 3 else "normal", channel="in_app",
                )
        # ITP due within 14 days
        if eq.itp_due and isinstance(eq.itp_due, (date, datetime)):
            due = eq.itp_due if isinstance(eq.itp_due, date) else eq.itp_due.date()
            days_left = (due - today).days
            if 0 <= days_left <= 14:
                notify_all_directors(
                    db, type="equipment_itp_due",
                    title=f"ITP/TÜV: {eq.name}",
                    body=f"Utilaj {eq.name} — ITP expiră pe {due}. {days_left} zile rămase.",
                    entity_type="equipment", entity_id=eq.id, target_page="equipment",
                    priority="high" if days_left <= 7 else "normal", channel="in_app",
                )


async def check_overdue_invoices(db: Session):
    """09:00 daily: notify director about overdue invoices."""
    try:
        from app.models.facturare import Invoice
        today = date.today()
        overdue = db.query(Invoice).filter(
            Invoice.status.notin_(["paid", "cancelled"]),
            Invoice.due_date < today,
        ).all()
        for inv in overdue:
            notify_all_directors(
                db, type="invoice_overdue",
                title=f"Factură restantă: {inv.invoice_number}",
                body=f"Factură {inv.invoice_number} — {getattr(inv, 'client_name', '?')} — {inv.total:.2f} EUR — restantă din {inv.due_date}.",
                entity_type="invoice", entity_id=inv.id, target_page="billing",
                priority="high", channel="in_app",
            )
    except Exception:
        pass


async def check_budgets(db: Session):
    """Monday 09:00: check budget consumption on all active Baustellen."""
    from sqlalchemy import func as sqlfunc
    from app.models.cost import Cost
    sites = _active_baustellen(db)
    for site in sites:
        if not site.budget or site.budget <= 0:
            continue
        total_costs = db.query(sqlfunc.sum(Cost.amount)).filter(Cost.site_id == site.id).scalar() or 0
        pct = total_costs / site.budget * 100
        if pct >= 90:
            priority, prefix = ("critical", "ALERTĂ BUGET") if pct >= 100 else ("high", "ATENȚIE BUGET")
            notify_all_directors(
                db, type="budget_alert",
                title=f"{prefix}: {site.name}",
                body=f"Șantier {site.name} a consumat {pct:.1f}% din buget ({total_costs:.2f} / {site.budget:.2f} EUR).",
                entity_type="site", entity_id=site.id, target_page="sites",
                priority=priority, channel="in_app",
            )


async def check_pending_orders(db: Session):
    """Every 30 min 08-18h: notify director about purchase orders pending > 2h."""
    try:
        from app.models.supplier import PurchaseOrder
        threshold = datetime.utcnow() - timedelta(hours=2)
        pending = db.query(PurchaseOrder).filter(
            PurchaseOrder.status == "pending",
            PurchaseOrder.created_at < threshold,
        ).all()
        if pending:
            count = len(pending)
            notify_all_directors(
                db, type="order_pending",
                title=f"{count} comenzi așteaptă aprobare",
                body=f"{count} comenzi de achiziție sunt în așteptare de >2h. Verificați secțiunea Achiziții.",
                target_page="procurement", priority="normal", channel="in_app",
            )
    except Exception:
        pass


async def send_programari_zilnice(db: Session):
    """20:00 daily: send tomorrow's HA schedule to each team leader via WhatsApp template."""
    from app.models.hausanschluss import Hausanschluss, HausanschlussStatus
    from app.services.whatsapp import send_template_message

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    tomorrow_display = (date.today() + timedelta(days=1)).strftime("%d.%m.%Y")

    # Fetch all non-cancelled HA for tomorrow
    programari = db.query(Hausanschluss).filter(
        Hausanschluss.scheduled_date >= f"{tomorrow}T00:00:00",
        Hausanschluss.scheduled_date < f"{tomorrow}T23:59:59",
        Hausanschluss.status != HausanschlussStatus.CANCELLED,
    ).order_by(Hausanschluss.scheduled_date).all()

    if not programari:
        logger.info("send_programari_zilnice: no HA scheduled for tomorrow")
        return

    # Group by team leader
    by_team: dict[int, list] = {}
    no_team: list = []
    for p in programari:
        if p.assigned_team_id:
            by_team.setdefault(p.assigned_team_id, []).append(p)
        else:
            no_team.append(p)

    def _format_list(items: list) -> str:
        lines = []
        for p in items:
            time_str = p.scheduled_date.strftime("%H:%M") if p.scheduled_date else "—"
            lines.append(f"  {time_str} — {p.client_name}, {p.address}{', ' + p.city if p.city else ''}")
        return "\n".join(lines)

    # Send to each team leader
    for team_id, items in by_team.items():
        leader = db.query(User).filter(User.id == team_id).first()
        if not leader or not leader.whatsapp_number or not leader.notify_whatsapp:
            continue
        lista = _format_list(items)
        try:
            await send_template_message(
                to=leader.whatsapp_number,
                template_name="programari_zilnice",
                language="ro",
                components=[{
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": tomorrow_display},
                        {"type": "text", "text": lista},
                    ]
                }],
            )
            logger.info(f"Programări trimise la {leader.full_name} ({leader.whatsapp_number}): {len(items)} HA")
            create_notification(
                db, leader.id,
                type="programari_zilnice",
                title=f"Programări mâine ({tomorrow_display})",
                body=f"{len(items)} programări — {lista[:200]}",
                target_page="hausanschluss",
                priority="normal",
                channel="in_app",
            )
        except Exception as e:
            logger.error(f"Eroare trimitere WhatsApp la {leader.whatsapp_number}: {e}")

    # Notify director about unassigned HA
    if no_team:
        notify_all_directors(
            db, type="programari_unassigned",
            title=f"{len(no_team)} programări fără echipă ({tomorrow_display})",
            body="\n".join(f"  {p.client_name}, {p.address}" for p in no_team),
            target_page="hausanschluss",
            priority="high",
            channel="in_app",
        )
