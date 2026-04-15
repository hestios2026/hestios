from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

# Many-to-many: users assigned to sites (for field workers: polier, sef_santier, aufmass)
user_sites = Table(
    "user_sites",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("site_id", Integer, ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True),
)


class SiteStatus(str, enum.Enum):
    ACTIVE   = "active"
    PAUSED   = "paused"
    FINISHED = "finished"


class Site(Base):
    __tablename__ = "sites"

    id             = Column(Integer, primary_key=True, index=True)
    kostenstelle   = Column(String(20),  unique=True, nullable=False, index=True)  # e.g. "310"
    name           = Column(String(200), nullable=False)                           # e.g. "Geodesia Ulm"
    client         = Column(String(200), nullable=False)                           # e.g. "Geodesia"
    address        = Column(String(300))
    is_baustelle   = Column(Boolean, default=True)                            # False = overhead (KST 100-199)
    status         = Column(Enum(SiteStatus), default=SiteStatus.ACTIVE)
    budget         = Column(Float, default=0.0)
    manager_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes               = Column(Text)
    polier_instructions = Column(Text)      # PL writes daily instructions for polier/morning briefing
    planned_headcount   = Column(Integer, default=0)  # expected workers per day
    start_date     = Column(DateTime(timezone=True))
    end_date       = Column(DateTime(timezone=True))
    # Billing config per project
    billing_name                 = Column(String(200))     # full legal name of client
    billing_address              = Column(Text)
    billing_vat_id               = Column(String(50))      # USt-IdNr des Kunden
    billing_email                = Column(String(200))
    billing_iban                 = Column(String(34))      # our IBAN for payment details on invoice
    billing_bic                  = Column(String(11))
    billing_bank                 = Column(String(100))
    sicherheitseinbehalt_pct     = Column(Float, default=0.0)  # % retention per contract
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    manager        = relationship("User", foreign_keys=[manager_id])
    costs          = relationship("Cost", back_populates="site")
    materials      = relationship("MaterialLog", back_populates="site")
