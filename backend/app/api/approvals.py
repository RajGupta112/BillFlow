from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import require_roles
from app.api.invoices import load_invoice
from app.database import get_db
from app.models import Invoice, InvoiceStatus, SyncQueue, User, UserRole
from app.schemas.invoice import InvoiceDetail, InvoiceListItem
from app.services.approval_engine import (
    ApprovalError, ApprovalPermissionError, act_on_invoice, pending_for_user,
)
from app.services.audit import Actions, log_action

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

approver_only = require_roles(UserRole.APPROVER.value, UserRole.ADMIN.value)


class ActionBody(BaseModel):
    comment: str | None = None


def _enqueue_tally_sync(db: Session, invoice: Invoice) -> None:
    key = f"invoice-{invoice.id}"   # idempotency: ek invoice = ek hi queue row
    exists = db.scalar(select(SyncQueue).where(SyncQueue.idempotency_key == key))
    if not exists:
        db.add(SyncQueue(invoice_id=invoice.id, idempotency_key=key))
    invoice.status = InvoiceStatus.SYNC_PENDING.value
    log_action(db, Actions.SYNC_QUEUED, invoice_id=invoice.id, details={"idempotency_key": key})


def _act(db: Session, invoice_id: int, user: User, action: str, comment: str | None):
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(404, "Invoice not found")
    try:
        new_status = act_on_invoice(db, invoice, user, action, comment)
    except ApprovalPermissionError as exc:
        db.rollback()
        raise HTTPException(403, str(exc))
    except ApprovalError as exc:
        db.rollback()
        raise HTTPException(400, str(exc))

    if new_status == InvoiceStatus.APPROVED.value:
        _enqueue_tally_sync(db, invoice)

    db.commit()
    return load_invoice(db, invoice_id)


@router.get("/mine", response_model=list[InvoiceListItem])
def my_pending_approvals(
    db: Session = Depends(get_db),
    user: User = Depends(approver_only),
):
    return pending_for_user(db, user.id)


@router.post("/{invoice_id}/approve", response_model=InvoiceDetail)
def approve(
    invoice_id: int,
    body: ActionBody,
    db: Session = Depends(get_db),
    user: User = Depends(approver_only),
):
    return _act(db, invoice_id, user, "approve", body.comment)


@router.post("/{invoice_id}/reject", response_model=InvoiceDetail)
def reject(
    invoice_id: int,
    body: ActionBody,
    db: Session = Depends(get_db),
    user: User = Depends(approver_only),
):
    return _act(db, invoice_id, user, "reject", body.comment)