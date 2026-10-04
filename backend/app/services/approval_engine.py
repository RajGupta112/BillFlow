from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    ApprovalStatus, ApprovalStep, Invoice, InvoiceStatus, User, UserRole,
)
from app.services.audit import Actions, log_action


class ApprovalError(Exception):
    """Galat request (API me 400)."""


class ApprovalPermissionError(ApprovalError):
    """Is user ko ye action karne ka haq nahi (API me 403)."""


def _append_note(invoice: Invoice, text: str) -> None:
    invoice.validation_notes = f"{invoice.validation_notes}\n{text}" if invoice.validation_notes else text


def build_approver_chain(
    db: Session, amount: Decimal, uploader_id: int | None
) -> tuple[list[User], str | None]:
    users = db.scalars(
        select(User).where(
            User.is_active.is_(True),
            User.role.in_([UserRole.APPROVER.value, UserRole.ADMIN.value]),
        )
    ).all()
    users = [u for u in users if u.id != uploader_id]
    # chhoti limit pehle, unlimited (None) sabse last
    users.sort(key=lambda u: (u.approval_limit is None, u.approval_limit or Decimal(0), u.id))

    chain: list[User] = []
    for user in users:
        chain.append(user)
        if user.approval_limit is None or user.approval_limit >= amount:
            return chain, None

    if not chain:
        return [], "Koi active approver configure nahi hai"
    return chain, f"Koi approver Rs {amount} tak approve nahi kar sakta"


def start_approval(db: Session, invoice: Invoice) -> bool:
    """Approval steps banata hai. True = chain ban gayi, False = needs_review me gaya."""
    if invoice.total_amount is None:
        raise ApprovalError("Total amount ke bina approval shuru nahi ho sakta")

    chain, problem = build_approver_chain(db, invoice.total_amount, invoice.uploaded_by)
    if problem:
        invoice.status = InvoiceStatus.NEEDS_REVIEW.value
        _append_note(invoice, problem)
        log_action(
            db, Actions.APPROVAL_CHAIN_FAILED,
            invoice_id=invoice.id, details={"reason": problem},
        )
        return False

    # Dobara shuru ho raha ho to purane steps hata do
    invoice.approval_steps.clear()
    db.flush()

    for order, user in enumerate(chain, start=1):
        db.add(ApprovalStep(
            invoice_id=invoice.id,
            step_order=order,
            approver_id=user.id,
            step_label=f"Level {order} - {user.full_name}",
            status=ApprovalStatus.PENDING.value if order == 1 else ApprovalStatus.WAITING.value,
        ))

    invoice.status = InvoiceStatus.PENDING_APPROVAL.value
    log_action(
        db, Actions.APPROVAL_STARTED,
        invoice_id=invoice.id,
        details={"amount": str(invoice.total_amount), "approvers": [u.email for u in chain]},
    )
    return True


def act_on_invoice(
    db: Session,
    invoice: Invoice,
    user: User,
    action: str,              # "approve" ya "reject"
    comment: str | None = None,
) -> str:
    """Current step pe approve/reject karta hai. Invoice ka naya status return karta hai.

    Agar status 'approved' aaye to caller ko Tally sync queue me daalna hai.
    """
    if action not in ("approve", "reject"):
        raise ApprovalError("action 'approve' ya 'reject' hona chahiye")
    if invoice.status != InvoiceStatus.PENDING_APPROVAL.value:
        raise ApprovalError("Ye invoice abhi approval ke liye pending nahi hai")
    if user.id == invoice.uploaded_by:
        raise ApprovalPermissionError("Apna upload kiya hua invoice aap approve/reject nahi kar sakte")

    comment = (comment or "").strip() or None
    if action == "reject" and not comment:
        raise ApprovalError("Reject karte waqt reason likhna zaroori hai")

    # with_for_update: double click ya do log ek saath karein to ek hi jeete
    step = db.scalar(
        select(ApprovalStep)
        .where(
            ApprovalStep.invoice_id == invoice.id,
            ApprovalStep.status == ApprovalStatus.PENDING.value,
        )
        .with_for_update()
    )
    if step is None:
        raise ApprovalError("Koi pending approval step nahi mila")
    if step.approver_id != user.id:
        raise ApprovalPermissionError("Ye step aapke liye nahi hai")

    step.comment = comment
    step.acted_at = datetime.now(timezone.utc)

    if action == "reject":
        step.status = ApprovalStatus.REJECTED.value
        for other in db.scalars(
            select(ApprovalStep).where(
                ApprovalStep.invoice_id == invoice.id,
                ApprovalStep.status == ApprovalStatus.WAITING.value,
            )
        ):
            other.status = ApprovalStatus.SKIPPED.value
        invoice.status = InvoiceStatus.REJECTED.value
        invoice.rejection_reason = comment
        log_action(
            db, Actions.REJECTED, invoice_id=invoice.id, user_id=user.id,
            details={"step": step.step_order, "reason": comment},
        )
        return invoice.status

    # approve
    step.status = ApprovalStatus.APPROVED.value
    next_step = db.scalar(
        select(ApprovalStep)
        .where(
            ApprovalStep.invoice_id == invoice.id,
            ApprovalStep.status == ApprovalStatus.WAITING.value,
        )
        .order_by(ApprovalStep.step_order)
    )
    if next_step:
        next_step.status = ApprovalStatus.PENDING.value
    else:
        invoice.status = InvoiceStatus.APPROVED.value

    log_action(
        db, Actions.APPROVED, invoice_id=invoice.id, user_id=user.id,
        details={"step": step.step_order, "comment": comment, "final": next_step is None},
    )
    return invoice.status


def pending_for_user(db: Session, user_id: int) -> list[Invoice]:
    """'My Approvals' page ke liye: jin invoices pe is user ki baari hai."""
    return list(db.scalars(
        select(Invoice)
        .join(ApprovalStep, ApprovalStep.invoice_id == Invoice.id)
        .where(
            ApprovalStep.approver_id == user_id,
            ApprovalStep.status == ApprovalStatus.PENDING.value,
            Invoice.status == InvoiceStatus.PENDING_APPROVAL.value,
        )
        .order_by(Invoice.created_at)
    ))