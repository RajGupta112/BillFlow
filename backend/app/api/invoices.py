import hashlib
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.auth import get_current_user
from app.database import get_db
from app.models import (
    Invoice, InvoiceSource, InvoiceStatus, LineItem, User, UserRole, Vendor,
)
from app.schemas.invoice import InvoiceDetail, InvoiceListItem, InvoiceUpdate
from app.services.approval_engine import start_approval
from app.services.audit import Actions, log_action
from app.services.duplicate_check import find_duplicate, match_or_create_vendor
from app.services.extractor import ExtractionError, extract_invoice
from app.services.validator import to_decimal, validate_extraction

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"   # backend/uploads
MAX_FILE_BYTES = 10 * 1024 * 1024
EXT_TO_MIME = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


class IngestError(Exception):
    def __init__(self, message: str, status_code: int = 400, invoice_id: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.invoice_id = invoice_id


def load_invoice(db: Session, invoice_id: int) -> Invoice | None:
    return db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(
            selectinload(Invoice.vendor),
            selectinload(Invoice.line_items),
            selectinload(Invoice.approval_steps),
        )
    )


def _get_visible(db: Session, invoice_id: int, user: User) -> Invoice:
    invoice = load_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(404, "Invoice not found")
    # Uploader sirf apne invoices dekh sakta hai
    if user.role == UserRole.UPLOADER.value and invoice.uploaded_by != user.id:
        raise HTTPException(404, "Invoice not found")
    return invoice


def ingest_invoice(
    db: Session, *, file_bytes: bytes, filename: str, source: str, user_id: int | None
) -> Invoice:
    """File lo, extract karo, validate karo, approval chain shuru karo. Commit bhi yahi karta hai."""
    if not file_bytes:
        raise IngestError("File khali hai")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise IngestError("File 10 MB se badi hai", 413)

    filename = Path(filename).name or "invoice"
    ext = Path(filename).suffix.lower()
    mime = EXT_TO_MIME.get(ext)
    if not mime:
        raise IngestError("Sirf PDF, PNG, JPG ya WEBP file allowed hai", 415)

    file_hash = hashlib.sha256(file_bytes).hexdigest()
    existing = db.scalar(select(Invoice).where(Invoice.file_hash == file_hash))
    if existing:
        raise IngestError("Ye file pehle upload ho chuki hai", 409, existing.id)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved_path = UPLOAD_DIR / f"{file_hash}{ext}"
    saved_path.write_bytes(file_bytes)

    invoice = Invoice(
        original_filename=filename[:255],
        file_path=str(saved_path),
        file_hash=file_hash,
        source=source,
        uploaded_by=user_id,
        status=InvoiceStatus.UPLOADED.value,
    )
    db.add(invoice)
    db.flush()
    log_action(
        db, Actions.INVOICE_UPLOADED, invoice_id=invoice.id, user_id=user_id,
        details={"filename": filename, "source": source},
    )

    # 1. Gemini se extraction
    try:
        extracted = extract_invoice(file_bytes, mime)
    except ExtractionError as exc:
        invoice.status = InvoiceStatus.NEEDS_REVIEW.value
        invoice.validation_notes = f"Extraction fail hua: {exc}"
        log_action(db, Actions.EXTRACTION_FAILED, invoice_id=invoice.id, details={"error": str(exc)})
        db.commit()
        return invoice

    # 2. Validation
    result = validate_extraction(extracted)

    # 3. Vendor match / create
    vendor, vendor_created = match_or_create_vendor(
        db, name=extracted.vendor_name, gstin=result.vendor_gstin
    )
    if vendor_created and vendor:
        log_action(db, Actions.VENDOR_CREATED, invoice_id=invoice.id, details={"vendor": vendor.name})

    invoice.vendor_id = vendor.id if vendor else None
    invoice.invoice_number = result.invoice_number
    invoice.invoice_date = result.invoice_date
    invoice.due_date = result.due_date
    invoice.subtotal = result.subtotal
    invoice.cgst = result.cgst
    invoice.sgst = result.sgst
    invoice.igst = result.igst
    invoice.total_amount = result.total_amount
    invoice.extraction_confidence = result.confidence
    invoice.raw_extraction = extracted.model_dump()

    for li in extracted.line_items:
        invoice.line_items.append(LineItem(
            description=(li.description or "-")[:500],
            hsn_code=(li.hsn_code or None),
            quantity=to_decimal(li.quantity),
            rate=to_decimal(li.rate),
            gst_rate=to_decimal(li.gst_rate),
            amount=to_decimal(li.amount),
        ))
    db.flush()

    log_action(
        db, Actions.EXTRACTED, invoice_id=invoice.id,
        details={"confidence": str(result.confidence), "warnings": result.warnings},
    )

    # 4. Duplicate check
    notes = list(result.warnings)
    dup = find_duplicate(
        db,
        vendor_id=invoice.vendor_id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        total_amount=invoice.total_amount,
        exclude_invoice_id=invoice.id,
    )
    if dup:
        invoice.duplicate_of_id = dup.invoice.id
        notes.append(f"Possible duplicate of invoice #{dup.invoice.id}: {dup.reason}")
        log_action(
            db, Actions.DUPLICATE_FLAGGED, invoice_id=invoice.id,
            details={"duplicate_of": dup.invoice.id, "reason": dup.reason},
        )

    # 5. Status
    invoice.validation_notes = "\n".join(notes) or None
    if notes:
        invoice.status = InvoiceStatus.NEEDS_REVIEW.value
    else:
        start_approval(db, invoice)   # chain na bane to ye khud needs_review kar deta hai

    db.commit()
    return invoice


# ---------------------------------------------------------------- endpoints

@router.post("/upload", response_model=InvoiceDetail, status_code=201)
def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    data = file.file.read(MAX_FILE_BYTES + 1)
    try:
        invoice = ingest_invoice(
            db, file_bytes=data, filename=file.filename or "invoice",
            source=InvoiceSource.UPLOAD.value, user_id=user.id,
        )
    except IngestError as exc:
        raise HTTPException(
            exc.status_code, detail={"message": exc.message, "invoice_id": exc.invoice_id}
        )
    return load_invoice(db, invoice.id)


class InvoiceListResponse(BaseModel):
    items: list[InvoiceListItem]
    total: int


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Invoice).outerjoin(Vendor, Invoice.vendor_id == Vendor.id)
    if user.role == UserRole.UPLOADER.value:
        stmt = stmt.where(Invoice.uploaded_by == user.id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(
            Invoice.invoice_number.ilike(like),
            Invoice.original_filename.ilike(like),
            Vendor.name.ilike(like),
        ))

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = db.scalars(
        stmt.options(selectinload(Invoice.vendor))
        .order_by(Invoice.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return InvoiceListResponse(items=list(items), total=total)


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _get_visible(db, invoice_id, user)


@router.get("/{invoice_id}/file")
def get_invoice_file(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = _get_visible(db, invoice_id, user)
    path = Path(invoice.file_path)
    if not path.exists():
        raise HTTPException(404, "File disk par nahi mili")
    media_type = EXT_TO_MIME.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=invoice.original_filename)


@router.patch("/{invoice_id}", response_model=InvoiceDetail)
def edit_invoice(
    invoice_id: int,
    body: InvoiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = _get_visible(db, invoice_id, user)
    if invoice.status != InvoiceStatus.NEEDS_REVIEW.value:
        raise HTTPException(400, "Sirf needs_review wale invoice edit ho sakte hain")

    changes = body.model_dump(exclude_unset=True)
    if changes.get("vendor_id") is not None and db.get(Vendor, changes["vendor_id"]) is None:
        raise HTTPException(400, "Vendor exist nahi karta")

    for field_name, value in changes.items():
        setattr(invoice, field_name, value)

    log_action(
        db, Actions.EDITED, invoice_id=invoice.id, user_id=user.id,
        details={k: (str(v) if v is not None else None) for k, v in changes.items()},
    )
    db.commit()
    return load_invoice(db, invoice.id)


@router.post("/{invoice_id}/submit", response_model=InvoiceDetail)
def submit_for_approval(
    invoice_id: int,
    override_duplicate: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reviewer ne data theek kar diya, ab approval chain shuru karo."""
    invoice = _get_visible(db, invoice_id, user)
    if invoice.status != InvoiceStatus.NEEDS_REVIEW.value:
        raise HTTPException(400, "Sirf needs_review wala invoice submit ho sakta hai")

    missing = [
        label for label, value in (
            ("vendor", invoice.vendor_id),
            ("invoice number", invoice.invoice_number),
            ("invoice date", invoice.invoice_date),
            ("total amount", invoice.total_amount),
        ) if not value
    ]
    if missing:
        raise HTTPException(400, f"Ye fields bharna zaroori hai: {', '.join(missing)}")

    dup = find_duplicate(
        db,
        vendor_id=invoice.vendor_id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        total_amount=invoice.total_amount,
        exclude_invoice_id=invoice.id,
    )
    if dup:
        if not (override_duplicate and user.role == UserRole.ADMIN.value):
            raise HTTPException(
                409,
                f"Ye duplicate lag raha hai (invoice #{dup.invoice.id}: {dup.reason}). "
                "Sirf admin override kar sakta hai.",
            )
        invoice.duplicate_of_id = dup.invoice.id
        log_action(
            db, "duplicate_overridden", invoice_id=invoice.id, user_id=user.id,
            details={"duplicate_of": dup.invoice.id},
        )
    else:
        invoice.duplicate_of_id = None

    invoice.validation_notes = None
    start_approval(db, invoice)
    db.commit()
    return load_invoice(db, invoice.id)


class DiscardBody(BaseModel):
    reason: str = Field(min_length=3)


@router.post("/{invoice_id}/discard", response_model=InvoiceDetail)
def discard_invoice(
    invoice_id: int,
    body: DiscardBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Galat upload ya duplicate ko hata do (status rejected, record audit me rahega)."""
    invoice = _get_visible(db, invoice_id, user)
    if invoice.status != InvoiceStatus.NEEDS_REVIEW.value:
        raise HTTPException(400, "Sirf needs_review wala invoice discard ho sakta hai")

    invoice.status = InvoiceStatus.REJECTED.value
    invoice.rejection_reason = body.reason.strip()
    log_action(
        db, Actions.REJECTED, invoice_id=invoice.id, user_id=user.id,
        details={"discarded": True, "reason": invoice.rejection_reason},
    )
    db.commit()
    return load_invoice(db, invoice.id)