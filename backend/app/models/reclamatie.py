from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class ReclamatieType(str, enum.Enum):
    CLIENT    = "client"
    EQUIPMENT = "equipment"
    SITE      = "site"
    SUPPLIER  = "supplier"
    INTERNAL  = "internal"
    OTHER     = "other"


class ReclamatiePriority(str, enum.Enum):
    URGENT = "urgent"
    HIGH   = "high"
    NORMAL = "normal"
    LOW    = "low"


class ReclamatieStatus(str, enum.Enum):
    OPEN        = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"
    CLOSED      = "closed"


class Reclamatie(Base):
    __tablename__ = "reclamatii"

    id               = Column(Integer, primary_key=True, index=True)
    title            = Column(String(200), nullable=False)
    type             = Column(Enum(ReclamatieType), nullable=False, default=ReclamatieType.INTERNAL)
    priority         = Column(Enum(ReclamatiePriority), nullable=False, default=ReclamatiePriority.NORMAL)
    status           = Column(Enum(ReclamatieStatus), nullable=False, default=ReclamatieStatus.OPEN)
    description      = Column(Text, nullable=False)
    resolution_notes = Column(Text, nullable=True)

    site_id          = Column(Integer, ForeignKey("sites.id"), nullable=True)
    assigned_to      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at      = Column(DateTime(timezone=True), nullable=True)

    site             = relationship("Site",  foreign_keys=[site_id],     lazy="joined")
    assignee         = relationship("User",  foreign_keys=[assigned_to], lazy="joined")
    creator          = relationship("User",  foreign_keys=[created_by],  lazy="joined")
