from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SituatieLucrari(Base):
    __tablename__ = "situatii_lucrari"

    id             = Column(Integer, primary_key=True, index=True)
    site_id        = Column(Integer, ForeignKey("sites.id"), nullable=False)
    title          = Column(String(200), nullable=False)
    period_from    = Column(Date, nullable=False)
    period_to      = Column(Date, nullable=False)
    # draft → sent → modifications → approved → invoiced
    status         = Column(String(20), default="draft")
    sent_at        = Column(DateTime(timezone=True), nullable=True)
    approved_at    = Column(DateTime(timezone=True), nullable=True)
    client_notes   = Column(Text, nullable=True)
    created_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    site           = relationship("Site")
    creator        = relationship("User")
    # AufmassEntry.situatie_id is the FK; no import needed (string reference)
    entries        = relationship("AufmassEntry", foreign_keys="[AufmassEntry.situatie_id]",
                                  primaryjoin="SituatieLucrari.id == AufmassEntry.situatie_id",
                                  lazy="select")
    invoices       = relationship("Invoice", foreign_keys="[Invoice.situatie_id]",
                                  primaryjoin="SituatieLucrari.id == Invoice.situatie_id",
                                  back_populates="situatie", lazy="select")


class Invoice(Base):
    __tablename__ = "invoices"

    id                                = Column(Integer, primary_key=True, index=True)
    invoice_number                    = Column(String, unique=True, nullable=False, index=True)
    invoice_type                      = Column(String(20), default="lucrari")   # lucrari / materiale
    site_id                           = Column(Integer, ForeignKey("sites.id"), nullable=True)
    situatie_id                       = Column(Integer, ForeignKey("situatii_lucrari.id"), nullable=True)
    client_name                       = Column(String, nullable=False)
    client_address                    = Column(Text, nullable=True)
    client_email                      = Column(String, nullable=True)
    issue_date                        = Column(Date, nullable=False)
    due_date                          = Column(Date, nullable=True)
    status                            = Column(String, default="draft")          # draft/sent/paid/overdue/cancelled
    subtotal                          = Column(Float, default=0.0)               # Netto
    vat_rate                          = Column(Float, default=0.0)               # 0 for lucrari, 19 for materiale
    vat_amount                        = Column(Float, default=0.0)
    total                             = Column(Float, default=0.0)               # Brutto (before retention)
    sicherheitseinbehalt_pct          = Column(Float, default=0.0)
    sicherheitseinbehalt_amount       = Column(Float, default=0.0)
    sicherheitseinbehalt_released     = Column(Boolean, default=False)
    sicherheitseinbehalt_release_date = Column(Date, nullable=True)
    payment_ref                       = Column(String, nullable=True)
    notes                             = Column(Text, nullable=True)
    created_by                        = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at                        = Column(DateTime(timezone=True), server_default=func.now())
    paid_at                           = Column(DateTime(timezone=True), nullable=True)
    paid_amount                       = Column(Float, default=0.0)
    payment_date                      = Column(Date, nullable=True)

    site      = relationship("Site")
    creator   = relationship("User")
    situatie  = relationship("SituatieLucrari", foreign_keys=[situatie_id], back_populates="invoices")
    items     = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id              = Column(Integer, primary_key=True, index=True)
    invoice_id      = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    position        = Column(String, nullable=False)
    description     = Column(Text, nullable=False)
    unit            = Column(String, default="m")
    quantity        = Column(Float, nullable=False)
    unit_price      = Column(Float, nullable=False)     # for materiale: purchase_price * (1 + admin_fee_pct/100)
    total_price     = Column(Float, nullable=False)
    aufmass_id      = Column(Integer, ForeignKey("aufmass_entries.id"), nullable=True)
    purchase_price  = Column(Float, nullable=True)      # original purchase price (materiale only)
    admin_fee_pct   = Column(Float, nullable=True)      # e.g. 3.0 (materiale only)

    invoice = relationship("Invoice", back_populates="items")
