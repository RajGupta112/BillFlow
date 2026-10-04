from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class Actions:
    INVOICE_UPLOADED = "invoice_uploaded"
    EXTRACTED = "extracted"
    EXTRACTION_FAILED = "extraction_failed"
    VENDOR_CREATED = "vendor_created"
    DUPLICATE_FLAGGED = "duplicate_flagged"
    EDITED = "invoice_edited"
    APPROVAL_STARTED = "approval_started"
    APPROVAL_CHAIN_FAILED = "approval_chain_failed"
    APPROVED = "approved"
    REJECTED = "rejected"
    SYNC_QUEUED = "sync_queued"
    TALLY_SYNCED = "tally_synced"
    TALLY_FAILED = "tally_failed"


def log_action(
    db: Session,
    action: str,
    *,
    invoice_id: int | None = None,
    user_id: int | None = None,   # None = system / n8n
    details: dict | None = None,  # JSON serializable hona chahiye (Decimal ko str() karke daalo)
) -> AuditLog:
    entry = AuditLog(
        action=action,
        invoice_id=invoice_id,
        user_id=user_id,
        details=details,
    )
    db.add(entry)
    return entry