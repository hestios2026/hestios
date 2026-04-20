from sqlalchemy import Column, Integer, String, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ReclamatieAttachment(Base):
    __tablename__ = "reclamatie_attachments"

    id            = Column(Integer, primary_key=True, index=True)
    reclamatie_id = Column(Integer, ForeignKey("reclamatii.id", ondelete="CASCADE"), nullable=False)
    file_key      = Column(String(500), nullable=False)
    filename      = Column(String(300), nullable=False)
    content_type  = Column(String(100), nullable=False)
    file_size     = Column(BigInteger, default=0)
    uploaded_by   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    uploader      = relationship("User", foreign_keys=[uploaded_by])
