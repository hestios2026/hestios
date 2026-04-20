from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)               # original filename
    description  = Column(Text, nullable=True)
    category     = Column(String, nullable=False, default="other")
    # category: contract / invoice / permit / plan / photo / report / other
    site_id      = Column(Integer, ForeignKey("sites.id"), nullable=True)
    employee_id  = Column(Integer, ForeignKey("employees.id"), nullable=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True)
    folder_id    = Column(Integer, ForeignKey("folders.id"), nullable=True)
    file_key     = Column(String, nullable=False, unique=True)  # MinIO object key
    file_size    = Column(BigInteger, default=0)                # bytes
    content_type = Column(String, nullable=False, default="application/octet-stream")
    uploaded_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    notes        = Column(Text, nullable=True)
    tags         = Column(String(500), nullable=True)           # comma-separated tags
    expires_at   = Column(DateTime(timezone=True), nullable=True)
    version      = Column(Integer, default=1, nullable=False)

    site         = relationship("Site")
    employee     = relationship("Employee")
    equipment    = relationship("Equipment")
    folder       = relationship("Folder", back_populates="documents")
    uploader     = relationship("User")
