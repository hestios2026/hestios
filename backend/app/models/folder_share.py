from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class FolderShare(Base):
    __tablename__ = "folder_shares"

    id         = Column(Integer, primary_key=True, index=True)
    token      = Column(String(64), unique=True, nullable=False, index=True)
    folder_id  = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=False)
    label      = Column(String(200), nullable=True)
    can_read   = Column(Boolean, default=True, nullable=False)
    can_upload = Column(Boolean, default=False, nullable=False)
    can_delete = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    folder  = relationship("Folder", foreign_keys=[folder_id])
    creator = relationship("User",   foreign_keys=[created_by])
