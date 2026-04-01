from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, Enum, Date, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class ReportStatus(str, enum.Enum):
    DRAFT     = "draft"
    SUBMITTED = "submitted"
    APPROVED  = "approved"


class WeatherCondition(str, enum.Enum):
    SONNIG    = "sonnig"
    BEWOELKT  = "bewölkt"
    REGEN     = "regen"
    SCHNEE    = "schnee"
    STURM     = "sturm"
    FROST     = "frost"


class DailyReport(Base):
    """Tagesbericht — filled by Polier/Sef Santier at end of day."""
    __tablename__ = "daily_reports"

    id              = Column(Integer, primary_key=True, index=True)
    site_id         = Column(Integer, ForeignKey("sites.id"), nullable=False)
    report_date     = Column(Date, nullable=False)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=False)
    status          = Column(Enum(ReportStatus), default=ReportStatus.DRAFT)
    # Wetter
    weather         = Column(Enum(WeatherCondition), default=WeatherCondition.SONNIG)
    temperature_c   = Column(Float)
    # Arbeitszeit
    start_time      = Column(String, default="07:00")   # e.g. "07:00"
    end_time        = Column(String, default="16:00")
    pause_min       = Column(Integer, default=30)
    # Sonstiges
    notes               = Column(Text)
    problems            = Column(Text)          # Behinderungen/Störungen
    deliveries          = Column(Text)          # Lieferungen des Tages
    subcontractor_names = Column(Text)          # Drittfirmen auf Baustelle
    visitor_count       = Column(Integer, default=0)   # Bauherr-Besuche, Bauleiter-Kontrollen
    # Sicherheit
    safety_incident     = Column(Boolean, default=False)   # Unfall / Beinaheunfall
    safety_notes        = Column(Text)          # required when safety_incident=True
    # Approval
    approved_by         = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at         = Column(DateTime(timezone=True))
    submitted_at        = Column(DateTime(timezone=True))
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (UniqueConstraint("site_id", "report_date", "created_by", name="uq_report_site_date_user"),)

    workers     = relationship("DailyReportWorker",   back_populates="report", cascade="all, delete-orphan")
    positions   = relationship("DailyReportPosition", back_populates="report", cascade="all, delete-orphan")
    equipment   = relationship("DailyReportEquipment", back_populates="report", cascade="all, delete-orphan")
    materials   = relationship("DailyReportMaterial",  back_populates="report", cascade="all, delete-orphan")
    issues      = relationship("DailyReportIssue",     back_populates="report", cascade="all, delete-orphan")


class DailyReportWorker(Base):
    """Workers present on site that day."""
    __tablename__ = "daily_report_workers"

    id               = Column(Integer, primary_key=True, index=True)
    report_id        = Column(Integer, ForeignKey("daily_reports.id"), nullable=False)
    employee_id      = Column(Integer, ForeignKey("employees.id"), nullable=True)
    name             = Column(String, nullable=False)    # cached name (employee may be deleted)
    hours_worked     = Column(Float, default=8.0)
    overtime_hours   = Column(Float, default=0.0)
    role             = Column(String)                    # e.g. "Polier", "Bauarbeiter"
    trade            = Column(String)                    # Gewerk: Bagger, Tiefbau, Elektro…
    is_subcontractor = Column(Boolean, default=False)
    absent           = Column(Boolean, default=False)
    absent_reason    = Column(String)                    # Krank, Urlaub, unentschuldigt

    report = relationship("DailyReport", back_populates="workers")


class DailyReportPosition(Base):
    """Work positions completed that day (links to Aufmaß catalog)."""
    __tablename__ = "daily_report_positions"

    id              = Column(Integer, primary_key=True, index=True)
    report_id       = Column(Integer, ForeignKey("daily_reports.id"), nullable=False)
    position_type   = Column(String, nullable=False)    # Graben, Leerrohr, Kabelzug, HDD, Muffe, HAK, Kernbohrung, Hausanschluss
    description     = Column(String)
    unit            = Column(String, default="m")       # m, Stk, m²
    quantity        = Column(Float, nullable=False)
    extra_data      = Column(JSON)                      # flexible: tiefe, breite, kabelanzahl, etc.

    report = relationship("DailyReport", back_populates="positions")


class DailyReportEquipment(Base):
    """Equipment used on site that day."""
    __tablename__ = "daily_report_equipment"

    id              = Column(Integer, primary_key=True, index=True)
    report_id       = Column(Integer, ForeignKey("daily_reports.id"), nullable=False)
    equipment_id    = Column(Integer, ForeignKey("equipment.id"), nullable=True)
    name            = Column(String, nullable=False)    # cached name
    hours_used      = Column(Float, default=8.0)
    idle_hours      = Column(Float, default=0.0)        # Standzeit
    fuel_liters     = Column(Float, default=0.0)
    operator_name   = Column(String)                    # may differ from workers list
    notes           = Column(String)

    report = relationship("DailyReport", back_populates="equipment")


class DailyReportIssue(Base):
    """Structured issue/problem tracking — blocking issues trigger notifications."""
    __tablename__ = "daily_report_issues"

    id           = Column(Integer, primary_key=True, index=True)
    report_id    = Column(Integer, ForeignKey("daily_reports.id"), nullable=False)
    issue_type   = Column(String, nullable=False)  # material_missing / equipment_breakdown / weather_stop
                                                    # design_conflict / client_instruction / other
    description  = Column(Text, nullable=False)
    blocking     = Column(Boolean, default=False)   # True = work stopped
    resolved     = Column(Boolean, default=False)
    resolved_at  = Column(DateTime(timezone=True))

    report = relationship("DailyReport", back_populates="issues")


class DailyReportMaterial(Base):
    """Materials consumed on site that day."""
    __tablename__ = "daily_report_materials"

    id              = Column(Integer, primary_key=True, index=True)
    report_id       = Column(Integer, ForeignKey("daily_reports.id"), nullable=False)
    material_name   = Column(String, nullable=False)
    unit            = Column(String, default="Stk")
    quantity        = Column(Float, nullable=False)
    notes           = Column(String)

    report = relationship("DailyReport", back_populates="materials")
