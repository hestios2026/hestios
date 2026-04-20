from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id          = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    version     = Column(Integer, nullable=False)
    file_key    = Column(String(500), nullable=False)
    file_size   = Column(BigInteger, default=0)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    notes       = Column(Text, nullable=True)

    uploader = relationship("User", foreign_keys=[uploaded_by])
