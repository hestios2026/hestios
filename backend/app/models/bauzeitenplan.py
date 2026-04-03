from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.core.database import Base


class BauzeitenplanProject(Base):
    """One Bauzeitenplan per construction site."""
    __tablename__ = "bzp_projects"

    id          = Column(Integer, primary_key=True, index=True)
    site_id     = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name        = Column(String(300), nullable=False)
    firma       = Column(String(200))
    baubeginn   = Column(Date)
    bauende     = Column(Date)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    site    = relationship("Site", back_populates=None)
    rows    = relationship("BauzeitenplanRow", back_populates="project",
                           cascade="all, delete-orphan", order_by="BauzeitenplanRow.sort_order")


class BauzeitenplanRow(Base):
    """One row = one Vorhaben / Gewerk line."""
    __tablename__ = "bzp_rows"

    id              = Column(Integer, primary_key=True, index=True)
    project_id      = Column(Integer, ForeignKey("bzp_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    vorhaben_nr     = Column(String(50))      # e.g. "209366992"
    hk_nvt          = Column(String(100))     # e.g. "1R/27", "V1405"
    gewerk          = Column(String(50))      # "Tiefbau" | "Montage" | "Spülbohrung" | etc.
    hh              = Column(Boolean, default=False)
    hc              = Column(Boolean, default=False)
    tb_soll_m       = Column(Float)           # planned meters
    date_start      = Column(Date)
    date_end        = Column(Date)
    tb_ist_m        = Column(Float, default=0)  # actual meters
    ha_gebaut       = Column(Integer, default=0)
    verzug_kw       = Column(Integer, default=0)
    bemerkung       = Column(Text)
    sort_order      = Column(Integer, default=0)
    is_group_header = Column(Boolean, default=False)  # section header row (Bauabschnitt)
    color           = Column(String(20))      # optional override hex color

    project  = relationship("BauzeitenplanProject", back_populates="rows")
    weekly   = relationship("BauzeitenplanWeekly", back_populates="row",
                            cascade="all, delete-orphan", order_by="BauzeitenplanWeekly.week_date")

    @property
    def progress_pct(self):
        if self.tb_soll_m and self.tb_soll_m > 0:
            return min(round((self.tb_ist_m or 0) / self.tb_soll_m * 100, 1), 100)
        return 0


class BauzeitenplanWeekly(Base):
    """Weekly progress per row (meters per KW)."""
    __tablename__ = "bzp_weekly"

    id          = Column(Integer, primary_key=True, index=True)
    row_id      = Column(Integer, ForeignKey("bzp_rows.id", ondelete="CASCADE"), nullable=False, index=True)
    week_date   = Column(Date, nullable=False)   # Monday of the KW
    meters      = Column(Float, default=0)
    note        = Column(String(200))            # e.g. "Urlaub", "Regen", "Karneval"

    row = relationship("BauzeitenplanRow", back_populates="weekly")
