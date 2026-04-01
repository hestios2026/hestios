from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class TagesberichtEntry(Base):
    __tablename__ = "tagesbericht_entries"

    id            = Column(Integer, primary_key=True, index=True)
    local_uuid    = Column(String(36), unique=True, index=True)   # mobile-side UUID
    site_id       = Column(Integer, ForeignKey("sites.id"), nullable=False)
    work_type     = Column(String(30), nullable=False)            # poze_inainte / ha / raport_zilnic ...
    nvt_number    = Column(String(100))
    created_by    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime(timezone=True), nullable=False)  # original mobile timestamp
    synced_at     = Column(DateTime(timezone=True), server_default=func.now())
    data          = Column(JSONB, nullable=False)                  # full payload (no photos)


class TagesberichtPhoto(Base):
    __tablename__ = "tagesbericht_photos"

    id            = Column(Integer, primary_key=True, index=True)
    entry_id      = Column(Integer, ForeignKey("tagesbericht_entries.id"), nullable=False)
    category      = Column(String(50))
    filename      = Column(String(200), nullable=False)
    s3_key        = Column(String(500), nullable=False)
    url           = Column(Text)
    taken_at      = Column(DateTime(timezone=True))               # extracted from EXIF or mobile timestamp
    uploaded_at   = Column(DateTime(timezone=True), server_default=func.now())
    file_size     = Column(Integer)
