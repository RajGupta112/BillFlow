from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import require_roles
from app.config import settings
from app.database import get_db
from app.models import AuditLog, Invoice, InvoiceStatus, SyncQueue, SyncStatus, User, UserRole
from app.services.sync_worker import requeue_invoice
from app.services.tally_client import tally_is_running
from app.api.auth import get_current_user, require_roles
from app.models import AuditLog, Invoice, InvoiceStatus, SyncQueue, SyncStatus, User, UserRole, Vendor

router = APIRouter(prefix="/api", tags=["operations"])

approver_or_admin = require_roles(UserRole.APPROVER.value, UserRole.ADMIN.value)
admin_only = require_roles(UserRole.ADMIN.value)

STUCK_AFTER = timedelta(minutes=30)


# ------------------------------------------------------------- schemas

class QueueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    status: str
    attempts: int
    max_attempts: int
    next_retry_at: datetime
    last_error: str | None = None
    updated_at: datetime


class SyncStatusOut(BaseModel):
    tally_running: bool
    tally_url: str
    queue_counts: dict[str, int]
    recent_failures: list[QueueItem]


class ReconIssue(BaseModel):
    severity: str          # "error" ya "warning"
    kind: str
    invoice_id: int
    invoice_number: str | None = None
    message: str


class ReconReport(BaseModel):
    generated_at: datetime
    synced_count: int
    synced_amount: float
    issue_count: int
    issues: list[ReconIssue]


class AuditOut(BaseModel):
    id: int
    invoice_id: int | None = None
    action: str
    details: dict | None = None
    user_email: str | None = None
    user_name: str | None = None
    created_at: datetime


class AuditListResponse(BaseModel):
    items: list[AuditOut]
    total: int


# ------------------------------------------------------------- sync

@router.get("/sync/status", response_model=SyncStatusOut)
def sync_status(db: Session = Depends(get_db), user: User = Depends(approver_or_admin)):
    counts = {s.value: 0 for s in SyncStatus}
    for status, count in db.execute(select(SyncQueue.status, func.count()).group_by(SyncQueue.status)):
        counts[status] = count

    failures = db.scalars(
        select(SyncQueue)
        .where(SyncQueue.last_error.is_not(None))
        .order_by(SyncQueue.updated_at.desc())
        .limit(5)
    ).all()
    return SyncStatusOut(
        tally_running=tally_is_running(),
        tally_url=settings.TALLY_URL,
        queue_counts=counts,
        recent_failures=list(failures),
    )


@router.get("/sync/queue", response_model=list[QueueItem])
def sync_queue(
    status: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(approver_or_admin),
):
    stmt = select(SyncQueue).order_by(SyncQueue.updated_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(SyncQueue.status == status)
    return db.scalars(stmt).all()


@router.post("/sync/{invoice_id}/retry")
def retry_sync(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    try:
        requeue_invoice(db, invoice_id, user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))
    return {"status": "requeued", "invoice_id": invoice_id}


# ------------------------------------------------------------- reconciliation

@router.get("/reconciliation", response_model=ReconReport)
def reconciliation(db: Session = Depends(get_db), user: User = Depends(approver_or_admin)):
    now = datetime.now(timezone.utc)
    issues: list[ReconIssue] = []

    def add(severity: str, kind: str, inv: Invoice, message: str) -> None:
        issues.append(ReconIssue(
            severity=severity, kind=kind, invoice_id=inv.id,
            invoice_number=inv.invoice_number, message=message,
        ))

    # 1. Tally me push fail hua
    for inv in db.scalars(select(Invoice).where(Invoice.status == InvoiceStatus.SYNC_FAILED.value)):
        add("error", "sync_failed", inv, "Tally me post nahi ho paya. Sync page se retry karo.")

    # 2. Queue me bahut der se atka hua
    for inv in db.scalars(
        select(Invoice).where(
            Invoice.status == InvoiceStatus.SYNC_PENDING.value,
            Invoice.updated_at < now - STUCK_AFTER,
        )
    ):
        add("warning", "stuck_in_queue", inv, "30 minute se zyada se Tally sync ka intezar kar raha hai.")

    # 3. Synced hai par voucher number nahi
    for inv in db.scalars(
        select(Invoice).where(
            Invoice.status == InvoiceStatus.SYNCED.value,
            Invoice.tally_voucher_id.is_(None),
        )
    ):
        add("error", "missing_voucher_id", inv, "Status synced hai lekin Tally voucher number record nahi hai.")

    # 4. Queue me DONE par invoice synced nahi
    for inv in db.scalars(
        select(Invoice)
        .join(SyncQueue, SyncQueue.invoice_id == Invoice.id)
        .where(
            SyncQueue.status == SyncStatus.DONE.value,
            Invoice.status != InvoiceStatus.SYNCED.value,
        )
    ):
        add("error", "queue_done_invoice_not_synced", inv, f"Queue me done hai par invoice status '{inv.status}' hai.")

    # 5. Approved hai par queue me gaya hi nahi
    queued_ids = set(db.scalars(select(SyncQueue.invoice_id)))
    for inv in db.scalars(select(Invoice).where(Invoice.status == InvoiceStatus.APPROVED.value)):
        if inv.id not in queued_ids:
            add("error", "approved_not_queued", inv, "Approved hai par Tally queue me nahi gaya.")

    synced_count, synced_amount = db.execute(
        select(func.count(), func.coalesce(func.sum(Invoice.total_amount), 0))
        .where(Invoice.status == InvoiceStatus.SYNCED.value)
    ).one()

    return ReconReport(
        generated_at=now,
        synced_count=synced_count,
        synced_amount=float(synced_amount),
        issue_count=len(issues),
        issues=issues,
    )


# ------------------------------------------------------------- audit log

@router.get("/audit", response_model=AuditListResponse)
def audit_log(
    invoice_id: int | None = None,
    action: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(admin_only),
):
    base = select(AuditLog)
    if invoice_id is not None:
        base = base.where(AuditLog.invoice_id == invoice_id)
    if action:
        base = base.where(AuditLog.action == action)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.execute(
        base.add_columns(User.email, User.full_name)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    items = [
        AuditOut(
            id=log.id, invoice_id=log.invoice_id, action=log.action, details=log.details,
            user_email=email, user_name=name, created_at=log.created_at,
        )
        for log, email, name in rows
    ]
    return AuditListResponse(items=items, total=total)


@router.get("/vendors")
def list_vendors(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Vendor).order_by(Vendor.name)).all()
    return [{"id": v.id, "name": v.name, "gstin": v.gstin} for v in rows]