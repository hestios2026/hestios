from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(200), nullable=False, unique=True)
    email      = Column(String(254), nullable=False)
    email2     = Column(String(254))
    phone      = Column(String(30))
    notes      = Column(Text)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prices     = relationship("SupplierPrice", back_populates="supplier")


class SupplierPrice(Base):
    __tablename__ = "supplier_prices"

    id            = Column(Integer, primary_key=True, index=True)
    supplier_id   = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_name  = Column(String(300), nullable=False, index=True)
    unit          = Column(String(20), default="buc")
    price         = Column(Float, nullable=False)
    currency      = Column(String(3), default="EUR")
    valid_from    = Column(DateTime(timezone=True), server_default=func.now())
    valid_until   = Column(DateTime(timezone=True), nullable=True)
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    supplier      = relationship("Supplier", back_populates="prices")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id            = Column(Integer, primary_key=True, index=True)
    site_id       = Column(Integer, ForeignKey("sites.id"), nullable=True)
    requested_by  = Column(Integer, ForeignKey("users.id"))
    status        = Column(String(20), default="pending")  # pending/approved/sent/cancelled
    total_amount  = Column(Float, default=0.0)
    whatsapp_msg  = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    approved_at   = Column(DateTime(timezone=True), nullable=True)
    notes         = Column(Text)

    items         = relationship("PurchaseOrderItem", back_populates="order")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id            = Column(Integer, primary_key=True, index=True)
    order_id      = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    supplier_id   = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_name  = Column(String(300), nullable=False)
    quantity      = Column(Float, nullable=False)
    unit          = Column(String(20), default="buc")
    unit_price    = Column(Float, nullable=False)
    total_price   = Column(Float, nullable=False)
    email_sent    = Column(Boolean, default=False)

    order         = relationship("PurchaseOrder", back_populates="items")
    supplier      = relationship("Supplier")
