import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.schemas.invoice import ExtractedInvoice

GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

MIN_CONFIDENCE = Decimal("0.70")
TOTAL_TOLERANCE = Decimal("1.00")  # rounding ke liye Rs. 1 tak ka farq chalega


@dataclass
class ValidationResult:
    invoice_number: str | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal | None = None
    cgst: Decimal | None = None
    sgst: Decimal | None = None
    igst: Decimal | None = None
    total_amount: Decimal | None = None
    vendor_gstin: str | None = None
    confidence: Decimal | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def needs_review(self) -> bool:
        return len(self.warnings) > 0


def to_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def is_valid_gstin(gstin: str) -> bool:
    """Format + checksum (15th character) dono check karta hai."""
    gstin = gstin.strip().upper()
    if not GSTIN_REGEX.match(gstin):
        return False

    total = 0
    for i, ch in enumerate(gstin[:14]):
        value = GSTIN_CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += value // 36 + value % 36
    check_char = GSTIN_CHARS[(36 - total % 36) % 36]
    return check_char == gstin[14]


def validate_extraction(data: ExtractedInvoice) -> ValidationResult:
    result = ValidationResult()
    warnings = result.warnings

    result.invoice_number = (data.invoice_number or "").strip() or None
    result.invoice_date = parse_date(data.invoice_date)
    result.due_date = parse_date(data.due_date)
    result.subtotal = to_decimal(data.subtotal)
    result.cgst = to_decimal(data.cgst)
    result.sgst = to_decimal(data.sgst)
    result.igst = to_decimal(data.igst)
    result.total_amount = to_decimal(data.total_amount)
    result.confidence = to_decimal(data.confidence)

    # Zaroori fields
    if not data.vendor_name:
        warnings.append("Vendor name nahi mila")
    if not result.invoice_number:
        warnings.append("Invoice number nahi mila")
    if result.invoice_date is None:
        warnings.append("Invoice date nahi mili ya format samajh nahi aaya")
    if result.total_amount is None or result.total_amount <= 0:
        warnings.append("Total amount nahi mila ya galat hai")

    # GSTIN
    if data.vendor_gstin:
        gstin = data.vendor_gstin.strip().upper()
        if is_valid_gstin(gstin):
            result.vendor_gstin = gstin
        else:
            warnings.append(f"Vendor GSTIN invalid hai: {gstin}")
    else:
        warnings.append("Vendor GSTIN nahi mila")

    # CGST+SGST aur IGST ek saath nahi hone chahiye
    if (result.cgst or result.sgst) and result.igst:
        warnings.append("CGST/SGST aur IGST dono aaye hain, ek hi hona chahiye")

    # Total ka hisaab
    if result.subtotal is not None and result.total_amount is not None:
        tax = (result.cgst or Decimal("0")) + (result.sgst or Decimal("0")) + (result.igst or Decimal("0"))
        expected = result.subtotal + tax
        if abs(expected - result.total_amount) > TOTAL_TOLERANCE:
            warnings.append(
                f"Total match nahi karta: subtotal+tax = {expected}, invoice total = {result.total_amount}"
            )

    # Confidence
    if result.confidence is not None and result.confidence < MIN_CONFIDENCE:
        warnings.append(f"AI confidence kam hai ({result.confidence})")

    return result