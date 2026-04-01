from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Folder(Base):
    __tablename__ = "folders"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(200), nullable=False)
    parent_id   = Column(Integer, ForeignKey("folders.id"), nullable=True)
    site_id     = Column(Integer, ForeignKey("sites.id"), nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(Text, nullable=True)

    site        = relationship("Site")
    creator     = relationship("User")
    children    = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")
    parent      = relationship("Folder", back_populates="children", remote_side=[id])
    documents   = relationship("Document", back_populates="folder")
