from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import require_roles
from app.database import get_db
from app.models import Invoice, InvoiceStatus, User, UserRole

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

ASSUMED_MINUTES_SAVED_PER_INVOICE = 10   # manual Tally entry ka andaza, baseline measure karke badalna


class StatusCount(BaseModel):
    key: str
    count: int
    amount: float


class AgingBucket(BaseModel):
    label: str
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class DashboardSummary(BaseModel):
    total_invoices: int
    total_amount: float
    pending_approval_count: int
    pending_approval_amount: float
    needs_review_count: int
    synced_count: int
    sync_failed_count: int
    by_status: list[StatusCount]
    by_source: list[StatusCount]
    pending_aging: list[AgingBucket]
    last_14_days: list[DailyCount]
    assumed_minutes_saved_per_invoice: int
    estimated_hours_saved: float


@router.get("/summary", response_model=DashboardSummary)
def summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.APPROVER.value, UserRole.ADMIN.value)),
):
    amount_sum = func.coalesce(func.sum(Invoice.total_amount), 0)

    by_status_rows = db.execute(
        select(Invoice.status, func.count(), amount_sum).group_by(Invoice.status)
    ).all()
    by_status = [StatusCount(key=s, count=c, amount=float(a)) for s, c, a in by_status_rows]
    status_map = {row.key: row for row in by_status}

    by_source_rows = db.execute(
        select(Invoice.source, func.count(), amount_sum).group_by(Invoice.source)
    ).all()
    by_source = [StatusCount(key=s, count=c, amount=float(a)) for s, c, a in by_source_rows]

    def count_of(status: str) -> int:
        return status_map[status].count if status in status_map else 0

    pending = status_map.get(InvoiceStatus.PENDING_APPROVAL.value)

    # Pending invoices kitne din se atke hain
    now = datetime.now(timezone.utc)
    pending_dates = db.scalars(
        select(Invoice.created_at).where(Invoice.status == InvoiceStatus.PENDING_APPROVAL.value)
    ).all()
    buckets = {"0-1 din": 0, "2-3 din": 0, "4-7 din": 0, "7+ din": 0}
    for created in pending_dates:
        age_days = (now - created).days
        if age_days <= 1:
            buckets["0-1 din"] += 1
        elif age_days <= 3:
            buckets["2-3 din"] += 1
        elif age_days <= 7:
            buckets["4-7 din"] += 1
        else:
            buckets["7+ din"] += 1

    # Pichle 14 din ka trend (khali din 0 dikhenge)
    since = now - timedelta(days=13)
    day_col = func.date(Invoice.created_at)
    trend_rows = db.execute(
        select(day_col, func.count()).where(Invoice.created_at >= since.replace(hour=0, minute=0, second=0))
        .group_by(day_col)
    ).all()
    trend_map = {str(d): c for d, c in trend_rows}
    last_14 = []
    for i in range(14):
        d = (since + timedelta(days=i)).date().isoformat()
        last_14.append(DailyCount(date=d, count=trend_map.get(d, 0)))

    synced = count_of(InvoiceStatus.SYNCED.value)

    return DashboardSummary(
        total_invoices=sum(r.count for r in by_status),
        total_amount=sum(r.amount for r in by_status),
        pending_approval_count=pending.count if pending else 0,
        pending_approval_amount=pending.amount if pending else 0.0,
        needs_review_count=count_of(InvoiceStatus.NEEDS_REVIEW.value),
        synced_count=synced,
        sync_failed_count=count_of(InvoiceStatus.SYNC_FAILED.value),
        by_status=by_status,
        by_source=by_source,
        pending_aging=[AgingBucket(label=k, count=v) for k, v in buckets.items()],
        last_14_days=last_14,
        assumed_minutes_saved_per_invoice=ASSUMED_MINUTES_SAVED_PER_INVOICE,
        estimated_hours_saved=round(synced * ASSUMED_MINUTES_SAVED_PER_INVOICE / 60, 1),
    )