"""
AI Chat Models for persistent, user-isolated chat history.
Sessions and messages are strictly scoped to the user who created them.
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, DateTime, Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.user import GUID


class AIChatSession(Base):
    """
    Represents a conversation session for a specific user.
    Strictly isolated: only the owning user (user_id) can view or modify it.
    """
    __tablename__ = "ai_chat_sessions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="New Conversation")
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True, nullable=False)

    # Relationships
    messages = relationship(
        "AIChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AIChatMessage.created_at",
    )
    user = relationship("User")


class AIChatMessage(Base):
    """
    Represents an individual message in a chat session.
    Tagged with both session_id and user_id for strict isolation.
    """
    __tablename__ = "ai_chat_messages"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id = Column(GUID(), ForeignKey("ai_chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    links = Column(JSON, nullable=True)  # List of {label, href, type}
    document_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    session = relationship("AIChatSession", back_populates="messages")
    user = relationship("User")
