from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class CostCategory(str, enum.Enum):
    MANOPERA       = "manopera"
    MATERIALE      = "materiale"
    SUBCONTRACTORI = "subcontractori"
    UTILAJE        = "utilaje"
    COMBUSTIBIL    = "combustibil"
    TRANSPORT      = "transport"
    ALTE           = "alte"


class Cost(Base):
    __tablename__ = "costs"

    id           = Column(Integer, primary_key=True, index=True)
    site_id      = Column(Integer, ForeignKey("sites.id"), nullable=False)
    category     = Column(Enum(CostCategory), nullable=False)
    description  = Column(String, nullable=False)
    amount       = Column(Float, nullable=False)
    currency     = Column(String, default="EUR")
    invoice_ref  = Column(String)
    supplier     = Column(String)
    recorded_by  = Column(Integer, ForeignKey("users.id"))
    date         = Column(DateTime(timezone=True), server_default=func.now())
    notes        = Column(Text)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    site         = relationship("Site", back_populates="costs")
    recorder     = relationship("User", foreign_keys=[recorded_by])


class MaterialLog(Base):
    __tablename__ = "material_logs"

    id           = Column(Integer, primary_key=True, index=True)
    site_id      = Column(Integer, ForeignKey("sites.id"), nullable=False)
    material     = Column(String, nullable=False)
    quantity     = Column(Float, nullable=False)
    unit         = Column(String, default="buc")
    recorded_by  = Column(Integer, ForeignKey("users.id"))
    date         = Column(DateTime(timezone=True), server_default=func.now())
    notes        = Column(Text)

    site         = relationship("Site", back_populates="materials")
    recorder     = relationship("User", foreign_keys=[recorded_by])
