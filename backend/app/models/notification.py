from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    type            = Column(String, nullable=False)    # equipment_service_due / invoice_overdue / ...
    title           = Column(String, nullable=False)
    body            = Column(Text, nullable=False)
    entity_type     = Column(String)                    # "daily_report" / "equipment" / "invoice"
    entity_id       = Column(Integer)
    target_page     = Column(String)                    # nav key to navigate to on click
    priority        = Column(String, default="normal")  # low / normal / high / critical
    channel         = Column(String, default="in_app")  # in_app / whatsapp / email
    is_read         = Column(Boolean, default=False)
    read_at         = Column(DateTime(timezone=True))
    # Delivery tracking (for WhatsApp / email)
    delivery_status = Column(String, default="pending")  # pending / sent / delivered / failed / skipped
    external_id     = Column(String)                     # WhatsApp message ID from Meta API
    retry_count     = Column(Integer, default=0)
    error_detail    = Column(Text)
    sent_at         = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class PolierAssignment(Base):
    """Links a polier/sef_santier to a site for a date range (for morning briefing)."""
    __tablename__ = "polier_assignments"

    id          = Column(Integer, primary_key=True, index=True)
    polier_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    site_id     = Column(Integer, ForeignKey("sites.id"), nullable=False)
    date_from   = Column(String, nullable=False)   # ISO date string "YYYY-MM-DD"
    date_to     = Column(String)                   # NULL = open-ended
    notes       = Column(Text)
    assigned_by = Column(Integer, ForeignKey("users.id"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
