from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class EmployeeAdvance(Base):
    __tablename__ = "employee_advances"

    id           = Column(Integer, primary_key=True, index=True)
    employee_id  = Column(Integer, ForeignKey("employees.id"), nullable=False)
    amount       = Column(Float, nullable=False)
    currency     = Column(String(3), default="EUR")
    date         = Column(DateTime(timezone=True), server_default=func.now())
    description  = Column(String(500))
    site_id      = Column(Integer, ForeignKey("sites.id"), nullable=True)
    recorded_by  = Column(Integer, ForeignKey("users.id"))
    # settled = True means amount was deducted from salary / closed
    settled      = Column(Boolean, default=False)
    settled_at   = Column(DateTime(timezone=True), nullable=True)
    settled_note = Column(Text, nullable=True)
    notes        = Column(Text)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    employee     = relationship("Employee", foreign_keys=[employee_id])
    site         = relationship("Site", foreign_keys=[site_id])
    recorder     = relationship("User", foreign_keys=[recorded_by])
