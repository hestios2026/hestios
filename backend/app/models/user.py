from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class UserRole(str, enum.Enum):
    DIRECTOR = "director"
    PROJEKT_LEITER = "projekt_leiter"
    POLIER = "polier"
    SEF_SANTIER = "sef_santier"
    CALLCENTER = "callcenter"
    AUFMASS = "aufmass"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String(254), unique=True, index=True, nullable=True)
    username        = Column(String(100), unique=True, index=True, nullable=True)  # alternative login for reporting users (no email)
    full_name       = Column(String(100), nullable=False)
    hashed_password = Column(String(128), nullable=False)
    role            = Column(Enum(UserRole), nullable=False, default=UserRole.POLIER)
    is_active       = Column(Boolean, default=True)
    language        = Column(String(5), default="ro")     # ro / en / de
    # Notifications
    whatsapp_number = Column(String(30))                  # +491701234567 (with country code)
    notify_whatsapp = Column(Boolean, default=False)
    notify_email    = Column(Boolean, default=True)
    notify_in_app   = Column(Boolean, default=True)
    # Site assignment (for polier/sef_santier morning briefing)
    current_site_id = Column(Integer, ForeignKey("sites.id", use_alter=True, name="fk_users_current_site_id"), nullable=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=True)
    mobile_pin      = Column(String(10), nullable=True)           # 4-digit PIN for mobile app
    permissions     = Column(JSON, nullable=True)                 # per-user module overrides: {"sites": true, "hr": false, ...}
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    assigned_sites  = relationship("Site", secondary="user_sites", lazy="select")
