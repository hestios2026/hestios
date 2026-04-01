from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class EquipmentStatus(str, enum.Enum):
    ACTIVE      = "active"
    MAINTENANCE = "maintenance"
    RETIRED     = "retired"


class Equipment(Base):
    __tablename__ = "equipment"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(200), nullable=False)
    serial_number   = Column(String(100), unique=True, nullable=True)
    category        = Column(String(100))  # utilaj / vehicul / unealta
    brand           = Column(String(100))
    model           = Column(String(100))
    year            = Column(Integer)
    status          = Column(Enum(EquipmentStatus), default=EquipmentStatus.ACTIVE)
    current_site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)
    service_due     = Column(DateTime(timezone=True), nullable=True)
    itp_due         = Column(DateTime(timezone=True), nullable=True)
    notes           = Column(Text)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    current_site    = relationship("Site", foreign_keys=[current_site_id])
    movements       = relationship("EquipmentMovement", back_populates="equipment")


class EquipmentMovement(Base):
    __tablename__ = "equipment_movements"

    id              = Column(Integer, primary_key=True, index=True)
    equipment_id    = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    from_site_id    = Column(Integer, ForeignKey("sites.id"), nullable=True)
    to_site_id      = Column(Integer, ForeignKey("sites.id"), nullable=True)
    moved_by        = Column(Integer, ForeignKey("users.id"))
    moved_at        = Column(DateTime(timezone=True), server_default=func.now())
    notes           = Column(Text)

    equipment       = relationship("Equipment", back_populates="movements")
    from_site       = relationship("Site", foreign_keys=[from_site_id])
    to_site         = relationship("Site", foreign_keys=[to_site_id])
    mover           = relationship("User", foreign_keys=[moved_by])
