from datetime import datetime, date
from decimal import Decimal
import enum

from sqlalchemy import (
    String, Date, DateTime, Numeric, Text, ForeignKey, Index, func
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from typing import Optional


class InvoiceStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    NEEDS_REVIEW = "needs_review"          # extraction low confidence / validation fail
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    SYNC_PENDING = "sync_pending"          # Tally push queue me hai
    SYNCED = "synced"                      # Tally me post ho gaya
    SYNC_FAILED = "sync_failed"


class InvoiceSource(str, enum.Enum):
    UPLOAD = "upload"      # React UI se
    EMAIL = "email"        # n8n Gmail se
    WEBHOOK = "webhook"    # koi aur system


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)

    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default=InvoiceSource.UPLOAD.value)

    # File info (file_hash se same file dobara upload hone se rokenge)
    original_filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    file_hash: Mapped[str] = mapped_column(String(64), unique=True)

    # Extracted data
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    cgst: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    sgst: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    igst: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    extraction_confidence: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)
    raw_extraction: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    validation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Workflow
    status: Mapped[str] = mapped_column(String(30), default=InvoiceStatus.UPLOADED.value, index=True)
    duplicate_of_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Tally
    tally_voucher_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    line_items: Mapped[list["LineItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )

    # Duplicate check tez karne ke liye
    __table_args__ = (
        Index("ix_invoice_vendor_number", "vendor_id", "invoice_number"),
    )


class LineItem(Base):
    __tablename__ = "line_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), index=True)

    description: Mapped[str] = mapped_column(String(500))
    hsn_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 3), nullable=True)
    rate: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    gst_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")