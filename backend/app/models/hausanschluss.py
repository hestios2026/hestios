from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class HausanschlussStatus(str, enum.Enum):
    NEW        = "new"
    SCHEDULED  = "scheduled"
    IN_PROGRESS = "in_progress"
    DONE       = "done"
    CANCELLED  = "cancelled"


class Hausanschluss(Base):
    __tablename__ = "hausanschluss"

    id              = Column(Integer, primary_key=True, index=True)
    # Client
    client_name     = Column(String(100), nullable=False)
    client_phone    = Column(String(30))
    client_email    = Column(String(254))
    address         = Column(String(300), nullable=False)
    city            = Column(String(100))
    zip_code        = Column(String(10))
    # Details
    connection_type = Column(String(50))   # Fiber / Gas / Power
    notes           = Column(Text)
    status          = Column(Enum(HausanschlussStatus), default=HausanschlussStatus.NEW)
    # Scheduling
    scheduled_date  = Column(DateTime(timezone=True), nullable=True)
    assigned_site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)
    assigned_team_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Meta
    created_by      = Column(Integer, ForeignKey("users.id"))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at    = Column(DateTime(timezone=True), nullable=True)

    site            = relationship("Site", foreign_keys=[assigned_site_id])
    team_leader     = relationship("User", foreign_keys=[assigned_team_id])
    creator         = relationship("User", foreign_keys=[created_by])
