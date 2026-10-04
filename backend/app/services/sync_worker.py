import logging
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import SessionLocal
from app.models import Invoice, InvoiceStatus, SyncQueue, SyncStatus
from app.services.audit import Actions, log_action
from app.services.tally_client import (
    TallyConnectionError, TallyDataError, TallyRejectedError,
    build_purchase_voucher_xml, post_to_tally,
)

log = logging.getLogger("uvicorn.error")   # uvicorn ke console me dikhe

STALE_AFTER = timedelta(minutes=5)
_stop = threading.Event()
_thread: threading.Thread | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _backoff(attempts: int) -> timedelta:
    return timedelta(seconds=min(30 * 2 ** (attempts - 1), 900))


def _claim_next(db: Session) -> SyncQueue | None:
    now = _now()
    row = db.scalar(
        select(SyncQueue)
        .where(or_(
            and_(SyncQueue.status == SyncStatus.PENDING.value, SyncQueue.next_retry_at <= now),
            and_(SyncQueue.status == SyncStatus.PROCESSING.value, SyncQueue.updated_at < now - STALE_AFTER),
        ))
        .order_by(SyncQueue.next_retry_at)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if row is None:
        return None
    row.status = SyncStatus.PROCESSING.value
    row.attempts += 1
    db.commit()
    return row


def _on_success(db: Session, row: SyncQueue, invoice: Invoice, result) -> None:
    row.status = SyncStatus.DONE.value
    row.response_text = result.raw_response[:5000]
    row.last_error = None
    invoice.status = InvoiceStatus.SYNCED.value
    invoice.tally_voucher_id = result.voucher_number
    invoice.synced_at = _now()
    log_action(
        db, Actions.TALLY_SYNCED, invoice_id=invoice.id,
        details={"voucher_number": result.voucher_number, "attempts": row.attempts,
                 "already_existed": result.already_existed},
    )
    db.commit()
    log.info("Tally sync OK: invoice %s -> voucher %s", invoice.id, result.voucher_number)


def _on_permanent_failure(db: Session, row: SyncQueue, invoice: Invoice, message: str, gave_up: bool) -> None:
    row.status = SyncStatus.FAILED.value
    row.last_error = message[:2000]
    invoice.status = InvoiceStatus.SYNC_FAILED.value
    log_action(
        db, Actions.TALLY_FAILED, invoice_id=invoice.id,
        details={"error": message[:1000], "attempts": row.attempts,
                 "will_retry": False, "gave_up_after_retries": gave_up},
    )
    db.commit()
    log.warning("Tally sync FAILED: invoice %s: %s", invoice.id, message)


def _on_retryable_failure(db: Session, row: SyncQueue, invoice: Invoice, message: str) -> None:
    if row.attempts >= row.max_attempts:
        _on_permanent_failure(db, row, invoice, message, gave_up=True)
        return
    row.status = SyncStatus.PENDING.value
    row.next_retry_at = _now() + _backoff(row.attempts)
    row.last_error = message[:2000]
    log_action(
        db, Actions.TALLY_FAILED, invoice_id=invoice.id,
        details={"error": message[:1000], "attempts": row.attempts, "will_retry": True},
    )
    db.commit()
    log.warning("Tally sync retry scheduled: invoice %s (attempt %s): %s", invoice.id, row.attempts, message)


def _process(db: Session, row_id: int) -> None:
    row = db.get(SyncQueue, row_id)
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == row.invoice_id).options(selectinload(Invoice.vendor))
    )
    if invoice is None or invoice.status == InvoiceStatus.SYNCED.value:
        row.status = SyncStatus.DONE.value      # pehle se synced hai, dobara post nahi karna
        db.commit()
        return

    try:
        xml, voucher_number = build_purchase_voucher_xml(invoice)
        row.request_xml = xml
        result = post_to_tally(xml, voucher_number)
    except TallyConnectionError as exc:
        _on_retryable_failure(db, row, invoice, str(exc))
    except (TallyDataError, TallyRejectedError) as exc:
        _on_permanent_failure(db, row, invoice, str(exc), gave_up=False)
    except Exception as exc:  # koi anjaan error: retry safe maano
        log.exception("Unexpected error while syncing invoice %s", invoice.id)
        _on_retryable_failure(db, row, invoice, f"Unexpected error: {exc}")
    else:
        _on_success(db, row, invoice, result)


def process_pending(max_items: int = 20) -> int:
    processed = 0
    for _ in range(max_items):
        with SessionLocal() as db:
            row = _claim_next(db)
            if row is None:
                break
            _process(db, row.id)
        processed += 1
    return processed


def requeue_invoice(db: Session, invoice_id: int, user_id: int | None) -> None:
    """sync_failed invoice ko manually dobara queue me daalo (jaise Tally me ledger bana dene ke baad)."""
    row = db.scalar(select(SyncQueue).where(SyncQueue.invoice_id == invoice_id))
    invoice = db.get(Invoice, invoice_id)
    if row is None or invoice is None:
        raise ValueError("Is invoice ka sync record nahi mila")
    if invoice.status != InvoiceStatus.SYNC_FAILED.value:
        raise ValueError("Sirf sync_failed invoice dobara queue ho sakta hai")

    row.status = SyncStatus.PENDING.value
    row.attempts = 0
    row.next_retry_at = _now()
    row.last_error = None
    invoice.status = InvoiceStatus.SYNC_PENDING.value
    log_action(db, "sync_requeued", invoice_id=invoice_id, user_id=user_id)
    db.commit()


def _loop() -> None:
    log.info("Tally sync worker started")
    while not _stop.is_set():
        processed = 0
        try:
            processed = process_pending()
        except Exception:
            log.exception("Sync worker error")
        if processed == 0:
            _stop.wait(settings.SYNC_POLL_SECONDS)
    log.info("Tally sync worker stopped")


def start_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, name="tally-sync-worker", daemon=True)
    _thread.start()


def stop_worker() -> None:
    _stop.set()