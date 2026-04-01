from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class TeamAssignment(Base):
    """Maps employees to a mobile team lead (sef de echipa)."""
    __tablename__ = "team_assignments"

    id           = Column(Integer, primary_key=True, index=True)
    team_lead_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    employee_id  = Column(Integer, ForeignKey("employees.id"), nullable=False)

    team_lead = relationship("User", foreign_keys=[team_lead_id])
    employee  = relationship("Employee")

    __table_args__ = (
        UniqueConstraint("team_lead_id", "employee_id", name="uq_team_assignment"),
    )


class TimeEntry(Base):
    """One row = one employee, one day. Sources: manual entry, import, auto from daily report."""
    __tablename__ = "time_entries"

    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=False)
    site_id         = Column(Integer, ForeignKey("sites.id"), nullable=True)
    date            = Column(Date, nullable=False)
    # Hours breakdown
    hours_regular   = Column(Float, default=8.0)
    hours_overtime  = Column(Float, default=0.0)   # Überstunden (25% Zuschlag)
    hours_night     = Column(Float, default=0.0)   # Nachtzuschlag
    hours_holiday   = Column(Float, default=0.0)   # Feiertagszuschlag
    # Type
    entry_type      = Column(String, default="work")   # work / sick / vacation / holiday / absent / training
    # Mobile pontaj fields
    ora_start       = Column(String(5))                # "07:00"
    ora_stop        = Column(String(5))                # "17:00"
    team_lead_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes           = Column(String)
    source          = Column(String, default="manual")  # manual / import / daily_report / pontaj_mobile
    week_number     = Column(Integer)                   # ISO week (1-53)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_time_entry_emp_date"),
    )


class LeaveRequest(Base):
    """Vacation, sick leave, special leave per employee."""
    __tablename__ = "leave_requests"

    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type      = Column(String, nullable=False)  # urlaub / krank / unbezahlt / sonderurlaub / berufsschule
    date_from       = Column(Date, nullable=False)
    date_to         = Column(Date, nullable=False)
    days_count      = Column(Float)          # business days — auto-computed
    status          = Column(String, default="pending")  # pending / approved / rejected
    notes           = Column(String)
    approved_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    employee    = relationship("Employee")
    approver    = relationship("User", foreign_keys=[approved_by])


class PayrollRecord(Base):
    """Monthly payroll summary per employee — Lohnabrechnung."""
    __tablename__ = "payroll_records"

    id                  = Column(Integer, primary_key=True, index=True)
    employee_id         = Column(Integer, ForeignKey("employees.id"), nullable=False)
    year                = Column(Integer, nullable=False)
    month               = Column(Integer, nullable=False)   # 1-12
    # Stunden
    hours_regular       = Column(Float, default=0.0)
    hours_overtime      = Column(Float, default=0.0)
    hours_night         = Column(Float, default=0.0)
    hours_holiday       = Column(Float, default=0.0)
    hours_sick          = Column(Float, default=0.0)
    hours_vacation      = Column(Float, default=0.0)
    days_worked         = Column(Integer, default=0)
    # Bruttogehalt
    brutto_regular      = Column(Float, default=0.0)
    brutto_overtime     = Column(Float, default=0.0)
    brutto_night        = Column(Float, default=0.0)
    brutto_bauzuschlag  = Column(Float, default=0.0)
    brutto_total        = Column(Float, default=0.0)
    # Arbeitgeberkosten
    ag_sv_anteil        = Column(Float, default=0.0)
    soka_bau            = Column(Float, default=0.0)
    total_employer_cost = Column(Float, default=0.0)
    # Status
    status              = Column(String, default="draft")  # draft / locked
    notes               = Column(String)
    locked_by           = Column(Integer, ForeignKey("users.id"), nullable=True)
    locked_at           = Column(DateTime(timezone=True), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint("employee_id", "year", "month", name="uq_payroll_emp_month"),
    )
