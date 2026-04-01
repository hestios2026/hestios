from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.api.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notif_dict(n: Notification):
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "target_page": n.target_page,
        "priority": n.priority,
        "channel": n.channel,
        "is_read": n.is_read,
        "read_at": n.read_at,
        "delivery_status": n.delivery_status,
        "sent_at": n.sent_at,
    }


@router.get("/")
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    notifications = q.order_by(Notification.sent_at.desc()).limit(limit).all()
    return [_notif_dict(n) for n in notifications]


@router.get("/unread-count/")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    return {"count": count}


@router.post("/{notif_id}/read/")
def mark_read(notif_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id,
    ).first()
    if n and not n.is_read:
        n.is_read = True
        n.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}


@router.post("/mark-all-read/")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()
    return {"ok": True}
