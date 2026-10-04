import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Invoice, InvoiceStatus, Vendor


def normalize_invoice_number(value: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def match_or_create_vendor(
    db: Session, *, name: str | None, gstin: str | None
) -> tuple[Vendor | None, bool]:
    """GSTIN se match, nahi to naam se, nahi to naya vendor. (vendor, created) return karta hai.

    gstin sirf wo do jo validator pass kar chuka ho.
    """
    if gstin:
        vendor = db.scalar(select(Vendor).where(Vendor.gstin == gstin))
        if vendor:
            return vendor, False

    clean_name = (name or "").strip()
    if not clean_name:
        return None, False

    vendor = db.scalar(select(Vendor).where(func.lower(Vendor.name) == clean_name.lower()))
    if vendor:
        if gstin and not vendor.gstin:
            vendor.gstin = gstin  # pehle GSTIN nahi tha, ab mil gaya
        return vendor, False

    vendor = Vendor(name=clean_name, gstin=gstin, tally_ledger_name=clean_name)
    db.add(vendor)
    db.flush()
    return vendor, True


@dataclass
class DuplicateMatch:
    invoice: Invoice
    reason: str


def find_duplicate(
    db: Session,
    *,
    vendor_id: int | None,
    invoice_number: str | None,
    invoice_date: date | None,
    total_amount: Decimal | None,
    exclude_invoice_id: int | None = None,
) -> DuplicateMatch | None:
    if vendor_id is None:
        return None

    stmt = select(Invoice).where(
        Invoice.vendor_id == vendor_id,
        Invoice.status != InvoiceStatus.REJECTED.value,  # reject hua bill dobara aa sakta hai
    )
    if exclude_invoice_id is not None:
        stmt = stmt.where(Invoice.id != exclude_invoice_id)
    candidates = db.scalars(stmt).all()

    # Rule 1: same vendor + same invoice number
    target = normalize_invoice_number(invoice_number)
    if target:
        for inv in candidates:
            if normalize_invoice_number(inv.invoice_number) == target:
                return DuplicateMatch(inv, "Same vendor aur same invoice number")

    # Rule 2: same vendor + same date + same amount (number badal ke dobara bheja ho)
    if invoice_date is not None and total_amount is not None:
        for inv in candidates:
            if inv.invoice_date == invoice_date and inv.total_amount == total_amount:
                return DuplicateMatch(inv, "Same vendor, same date aur same amount")

    return None