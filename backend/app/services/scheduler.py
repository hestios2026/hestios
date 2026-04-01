"""APScheduler — all cron jobs for HestiOS."""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="Europe/Berlin")


def _make_task(task_fn):
    """Wrap async task function with its own DB session."""
    async def wrapper():
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            await task_fn(db)
        except Exception as e:
            logger.error(f"Scheduler task {task_fn.__name__} failed: {e}", exc_info=True)
        finally:
            db.close()
    wrapper.__name__ = task_fn.__name__
    return wrapper


def _get_notify_hour_minute() -> tuple[int, int]:
    """Read notify_time (HH:MM) from the AppSettings DB row. Falls back to 20:00."""
    try:
        from app.core.database import SessionLocal
        from app.models.settings import AppSettings
        db = SessionLocal()
        try:
            s = db.query(AppSettings).first()
            if s and s.notify_time:
                parts = s.notify_time.split(":")
                return int(parts[0]), int(parts[1])
        finally:
            db.close()
    except Exception:
        pass
    return 20, 0


def start_scheduler():
    from app.services.tasks import (
        check_missing_reports_18,
        check_missing_reports_19,
        check_equipment_due,
        check_overdue_invoices,
        check_budgets,
        check_pending_orders,
        send_programari_zilnice,
    )

    notify_hour, notify_minute = _get_notify_hour_minute()

    scheduler.add_job(_make_task(check_missing_reports_18),  CronTrigger(hour=18, minute=0,  day_of_week="mon-fri"), id="report_reminder_18",   replace_existing=True)
    scheduler.add_job(_make_task(check_missing_reports_19),  CronTrigger(hour=19, minute=0,  day_of_week="mon-fri"), id="report_escalation_19", replace_existing=True)
    scheduler.add_job(_make_task(check_equipment_due),       CronTrigger(hour=8,  minute=0),                         id="equipment_check",       replace_existing=True)
    scheduler.add_job(_make_task(check_overdue_invoices),    CronTrigger(hour=9,  minute=0),                         id="invoice_overdue",       replace_existing=True)
    scheduler.add_job(_make_task(check_budgets),             CronTrigger(hour=9,  minute=0, day_of_week="mon"),      id="budget_check",          replace_existing=True)
    scheduler.add_job(_make_task(check_pending_orders),      CronTrigger(minute="*/30", hour="8-18", day_of_week="mon-fri"), id="pending_orders", replace_existing=True)
    scheduler.add_job(_make_task(send_programari_zilnice),   CronTrigger(hour=notify_hour, minute=notify_minute),   id="programari_zilnice",    replace_existing=True)

    scheduler.start()
    logger.info(f"APScheduler started — 7 jobs registered (programări la {notify_hour:02d}:{notify_minute:02d})")


def stop_scheduler():
    scheduler.shutdown(wait=False)
