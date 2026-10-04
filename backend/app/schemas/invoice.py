from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Gemini ka structured output isi schema me aayega ----------

class ExtractedLineItem(BaseModel):
    description: str | None = None
    hsn_code: str | None = None
    quantity: float | None = None
    rate: float | None = None
    gst_rate: float | None = None
    amount: float | None = None


class ExtractedInvoice(BaseModel):
    vendor_name: str | None = None
    vendor_gstin: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = Field(default=None, description="YYYY-MM-DD")
    due_date: str | None = Field(default=None, description="YYYY-MM-DD")
    subtotal: float | None = None
    cgst: float | None = None
    sgst: float | None = None
    igst: float | None = None
    total_amount: float | None = None
    line_items: list[ExtractedLineItem] = Field(default_factory=list)
    confidence: float | None = Field(default=None, description="0 se 1 ke beech")


# ---------- API responses ----------

class LineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    hsn_code: str | None = None
    quantity: Decimal | None = None
    rate: Decimal | None = None
    gst_rate: Decimal | None = None
    amount: Decimal | None = None


class VendorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    gstin: str | None = None
    tally_ledger_name: str | None = None


class ApprovalStepOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    step_order: int
    step_label: str
    approver_id: int | None = None
    status: str
    comment: str | None = None
    acted_at: datetime | None = None


class InvoiceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_number: str | None = None
    invoice_date: date | None = None
    total_amount: Decimal | None = None
    status: str
    source: str
    original_filename: str
    vendor: VendorOut | None = None
    created_at: datetime


class InvoiceDetail(InvoiceListItem):
    due_date: date | None = None
    subtotal: Decimal | None = None
    cgst: Decimal | None = None
    sgst: Decimal | None = None
    igst: Decimal | None = None
    extraction_confidence: Decimal | None = None
    validation_notes: str | None = None
    duplicate_of_id: int | None = None
    rejection_reason: str | None = None
    tally_voucher_id: str | None = None
    synced_at: datetime | None = None
    line_items: list[LineItemOut] = []
    approval_steps: list[ApprovalStepOut] = []


class InvoiceUpdate(BaseModel):
    """Reviewer extracted data me galti theek karta hai."""
    vendor_id: int | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal | None = None
    cgst: Decimal | None = None
    sgst: Decimal | None = None
    igst: Decimal | None = None
    total_amount: Decimal | None = None