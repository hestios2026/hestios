"""Leistungsverzeichnis — LV catalog and positions."""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class LVCatalog(Base):
    __tablename__ = "lv_catalogs"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(200), nullable=False)           # e.g. "LV Geodesia Ulm 2024"
    site_id     = Column(Integer, ForeignKey("sites.id"), nullable=True)   # null = global template
    work_type   = Column(String(50))                            # FTTH / pavaj / gaz / generic
    is_template = Column(Boolean, default=False)                # True = reusable template
    notes       = Column(Text)
    created_by  = Column(Integer, ForeignKey("users.id"))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    site        = relationship("Site", foreign_keys=[site_id])
    creator     = relationship("User", foreign_keys=[created_by])
    positions   = relationship(
        "LVPosition",
        back_populates="catalog",
        cascade="all, delete-orphan",
        order_by="LVPosition.sort_order, LVPosition.position_nr",
    )


class LVPosition(Base):
    __tablename__ = "lv_positions"

    id                = Column(Integer, primary_key=True, index=True)
    lv_id             = Column(Integer, ForeignKey("lv_catalogs.id", ondelete="CASCADE"), nullable=False)
    position_nr       = Column(String(20))                      # "1.1", "2.3" — free text
    short_description = Column(String(300), nullable=False)
    long_description  = Column(Text)
    unit              = Column(String(20), default="m")
    unit_price        = Column(Float, default=0.0)
    sort_order        = Column(Integer, default=0)              # for manual ordering
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    catalog = relationship("LVCatalog", back_populates="positions")
