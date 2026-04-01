from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AufmassEntry(Base):
    __tablename__ = "aufmass_entries"

    id           = Column(Integer, primary_key=True, index=True)
    site_id      = Column(Integer, ForeignKey("sites.id"), nullable=False)
    date         = Column(Date, nullable=False)
    position     = Column(String, nullable=False)          # Pos. e.g. "1.1", "2.3"
    description  = Column(Text, nullable=False)            # Leistungsbeschreibung
    unit         = Column(String, default="m")             # Einheit
    quantity     = Column(Float, nullable=False)           # Menge
    unit_price   = Column(Float, nullable=True)            # Einheitspreis (optional)
    total_price  = Column(Float, nullable=True)            # Gesamtpreis (computed)
    recorded_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    status       = Column(String, default="draft")         # draft / submitted / approved
    situatie_id  = Column(Integer, ForeignKey("situatii_lucrari.id"), nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    site         = relationship("Site")
    recorder     = relationship("User")
