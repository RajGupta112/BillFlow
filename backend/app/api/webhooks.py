import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.invoices import MAX_FILE_BYTES, IngestError, ingest_invoice
from app.config import settings
from app.database import get_db
from app.models import (
    ApprovalStatus, ApprovalStep, Invoice, InvoiceSource, InvoiceStatus, User,
)
from app.services.audit import log_action

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = settings.WEBHOOK_API_KEY
    if not expected or not x_api_key:
        raise HTTPException(401, "Invalid or missing API key")
    # constant-time compare, taaki timing se key guess na ho
    if not hmac.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(401, "Invalid or missing API key")


@router.post("/invoice", status_code=201, dependencies=[Depends(require_api_key)])
def receive_invoice(
    file: UploadFile = File(...),
    sender: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    data = file.file.read(MAX_FILE_BYTES + 1)
    try:
        invoice = ingest_invoice(
            db,
            file_bytes=data,
            filename=file.filename or "invoice",
            source=InvoiceSource.EMAIL.value,
            user_id=None,
        )
    except IngestError as exc:
        # n8n retry kare to error nahi, shaanti se jawab do
        if exc.status_code == 409:
            return {"status": "duplicate_file", "invoice_id": exc.invoice_id}
        if exc.status_code == 415:
            return {"status": "skipped_unsupported_type"}   # jaise email signature ki image
        raise HTTPException(exc.status_code, exc.message)

    if sender:
        log_action(db, "email_received", invoice_id=invoice.id, details={"sender": sender[:255]})
        db.commit()

    return {
        "status": "received",
        "invoice_id": invoice.id,
        "invoice_status": invoice.status,
        "needs_review": invoice.status == InvoiceStatus.NEEDS_REVIEW.value,
    }


@router.get("/pending-summary", dependencies=[Depends(require_api_key)])
def pending_summary(db: Session = Depends(get_db)):
    """n8n ke daily reminder ke liye: kis approver ke paas kitne bill pending hain."""
    rows = db.execute(
        select(User.email, User.full_name, func.count(ApprovalStep.id), func.min(Invoice.created_at))
        .join(ApprovalStep, ApprovalStep.approver_id == User.id)
        .join(Invoice, Invoice.id == ApprovalStep.invoice_id)
        .where(
            ApprovalStep.status == ApprovalStatus.PENDING.value,
            Invoice.status == InvoiceStatus.PENDING_APPROVAL.value,
        )
        .group_by(User.id)
    ).all()

    now = datetime.now(timezone.utc)
    approvers = [
        {
            "email": email,
            "name": name,
            "pending_count": count,
            "oldest_pending_days": (now - oldest).days,
        }
        for email, name, count, oldest in rows
    ]
    sync_failed = db.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.status == InvoiceStatus.SYNC_FAILED.value)
    )
    needs_review = db.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.status == InvoiceStatus.NEEDS_REVIEW.value)
    )
    return {"approvers": approvers, "sync_failed": sync_failed, "needs_review": needs_review}