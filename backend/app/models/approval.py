from datetime import datetime
import enum

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ApprovalStatus(str, enum.Enum):
    WAITING = "waiting"      # pichla step abhi pending hai, ye step ki baari nahi aayi
    PENDING = "pending"      # ab is step ki baari hai
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"      # invoice reject ho gaya, baaki steps skip


class ApprovalStep(Base):
    __tablename__ = "approval_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)

    step_order: Mapped[int] = mapped_column(Integer)            # 1, 2, 3...
    approver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    step_label: Mapped[str] = mapped_column(String(100), default="Approver")  # e.g. "Finance Head"

    status: Mapped[str] = mapped_column(String(20), default=ApprovalStatus.WAITING.value, index=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    acted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Ek invoice me ek step_order sirf ek baar aa sakta hai
    __table_args__ = (
        UniqueConstraint("invoice_id", "step_order", name="uq_invoice_step_order"),
    )