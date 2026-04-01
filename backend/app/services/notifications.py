"""Notification dispatch service — in-app, WhatsApp, email."""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    body: str,
    entity_type: str = None,
    entity_id: int = None,
    target_page: str = None,
    priority: str = "normal",
    channel: str = "in_app",
) -> Notification:
    """Create a notification record and dispatch to the appropriate channel."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        target_page=target_page,
        priority=priority,
        channel=channel,
    )
    db.add(notif)
    db.flush()

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        db.commit()
        return notif

    if channel == "whatsapp" and user.notify_whatsapp and user.whatsapp_number:
        _dispatch_whatsapp(db, notif, user)
    elif channel == "email" and user.notify_email and user.email:
        _dispatch_email(db, notif, user)

    db.commit()
    return notif


def notify_all_directors(db: Session, **kwargs):
    from app.models.user import UserRole
    directors = db.query(User).filter(User.role == UserRole.DIRECTOR, User.is_active == True).all()
    for d in directors:
        create_notification(db, d.id, **kwargs)


def notify_all_pls(db: Session, **kwargs):
    from app.models.user import UserRole
    pls = db.query(User).filter(User.role == UserRole.PROJEKT_LEITER, User.is_active == True).all()
    for pl in pls:
        create_notification(db, pl.id, **kwargs)


def _dispatch_whatsapp(db: Session, notif: Notification, user: User):
    try:
        import asyncio
        from app.services.whatsapp import send_text_message
        result = asyncio.run(send_text_message(user.whatsapp_number, f"*{notif.title}*\n\n{notif.body}"))
        notif.delivery_status = "sent"
        notif.external_id = result.get("messages", [{}])[0].get("id")
    except Exception as e:
        notif.delivery_status = "failed"
        notif.error_detail = str(e)
        notif.retry_count += 1
        # Fallback: create an email notification if the user has email
        if user.notify_email and user.email:
            _dispatch_email(db, notif, user)


def _dispatch_email(db: Session, notif: Notification, user: User):
    """Send notification via SMTP."""
    import smtplib
    from email.mime.text import MIMEText
    from app.core.config import settings

    if not settings.SMTP_HOST or not settings.SMTP_USER:
        notif.delivery_status = "skipped_no_smtp"
        return

    try:
        msg = MIMEText(f"{notif.title}\n\n{notif.body}", "plain", "utf-8")
        msg["From"] = settings.SMTP_USER
        msg["To"] = user.email
        msg["Subject"] = notif.title

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [user.email], msg.as_string())

        notif.delivery_status = "sent"
    except Exception as e:
        notif.delivery_status = "failed"
        notif.error_detail = str(e)[:500]
