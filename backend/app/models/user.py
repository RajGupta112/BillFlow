from datetime import datetime
from decimal import Decimal
import enum

from sqlalchemy import String, Boolean, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    UPLOADER = "uploader"
    APPROVER = "approver"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=UserRole.UPLOADER.value)

    # Approver kitne amount tak approve kar sakta hai (None = limit nahi)
    approval_limit: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())