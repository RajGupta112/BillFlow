"""Measure extraction accuracy on labelled sample invoices.

Usage (project root, venv active, backend/.env me GEMINI_API_KEY set):
    python scripts/measure_accuracy.py
    python scripts/measure_accuracy.py --delay 8 --limit 10

Setup:
  1. 20-50 DUMMY invoices (PDF/PNG/JPG) tests/sample_invoices/ me rakho.
  2. tests/sample_invoices/expected_results.json banao, jaise:
     {
       "bill_001.pdf": {
         "vendor_gstin": "27AAAPL1234C1ZV",
         "invoice_number": "INV-2041",
         "invoice_date": "2026-09-12",
         "subtotal": 100000,
         "cgst": 9000,
         "sgst": 9000,
         "igst": null,
         "total_amount": 118000
       }
     }
     Jo field expected me nahi likhoge, wo check nahi hoga.
"""
import argparse
import json
import re
import statistics
import sys
import time
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings  # noqa: E402
from app.services.extractor import ExtractionError, extract_invoice  # noqa: E402
from app.services.validator import validate_extraction  # noqa: E402

SAMPLES = ROOT / "tests" / "sample_invoices"
EXPECTED = SAMPLES / "expected_results.json"
REPORT = ROOT / "docs" / "test_report.md"

MIME = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}
FIELDS = [
    "vendor_gstin", "invoice_number", "invoice_date",
    "subtotal", "cgst", "sgst", "igst", "total_amount",
]
AMOUNT_FIELDS = {"subtotal", "cgst", "sgst", "igst", "total_amount"}


def norm_text(value) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def matches(field: str, expected, actual) -> bool:
    if field in AMOUNT_FIELDS:
        exp = Decimal(str(expected)) if expected not in (None, "") else Decimal(0)
        act = actual if actual is not None else Decimal(0)
        return abs(exp - act) <= Decimal("0.01")
    if field == "invoice_date":
        return (expected or None) == (actual.isoformat() if actual else None)
    return norm_text(expected) == norm_text(actual)


def pct(part: int, whole: int) -> str:
    return f"{part / whole * 100:.1f}%" if whole else "n/a"


def main() -> None:
    ap = argparse.ArgumentParser(description="Measure invoice extraction accuracy")
    ap.add_argument("--delay", type=float, default=5.0, help="seconds between API calls (free-tier rate limits)")
    ap.add_argument("--limit", type=int, default=0, help="only test the first N files")
    args = ap.parse_args()

    if not EXPECTED.exists():
        sys.exit(f"Missing {EXPECTED}\nSee the docstring at the top of this script for the format.")

    expected_all = json.loads(EXPECTED.read_text(encoding="utf-8"))
    names = [n for n in expected_all if not n.startswith("_")]
    if args.limit:
        names = names[: args.limit]

    records = []
    field_total, field_ok = defaultdict(int), defaultdict(int)

    for idx, name in enumerate(names, start=1):
        path = SAMPLES / name
        if not path.exists() or path.suffix.lower() not in MIME:
            print(f"[{idx}/{len(names)}] SKIP {name} (file missing or unsupported type)")
            continue

        expected = {k: v for k, v in expected_all[name].items() if k in FIELDS}
        result, error = None, None
        started = time.perf_counter()
        try:
            extracted = extract_invoice(path.read_bytes(), MIME[path.suffix.lower()])
            result = validate_extraction(extracted)
        except ExtractionError as exc:
            error = str(exc)
        elapsed = time.perf_counter() - started

        mismatches = []
        for field, exp in expected.items():
            field_total[field] += 1
            actual = getattr(result, field) if result else None
            if result and matches(field, exp, actual):
                field_ok[field] += 1
            else:
                mismatches.append((field, exp, actual))

        flagged = bool(error) or bool(result and result.needs_review)
        all_ok = not mismatches and not error
        records.append({
            "name": name, "seconds": elapsed, "error": error, "flagged": flagged,
            "all_ok": all_ok, "silent_error": (not all_ok) and (not flagged),
            "mismatches": mismatches, "warnings": result.warnings if result else [],
        })
        state = "OK " if all_ok else ("FLAG" if flagged else "BAD ")
        print(f"[{idx}/{len(names)}] {state} {name}  ({elapsed:.1f}s, {len(mismatches)} wrong fields)")

        if idx < len(names):
            time.sleep(args.delay)

    if not records:
        sys.exit("No invoices were evaluated.")

    n = len(records)
    total_fields = sum(field_total.values())
    ok_fields = sum(field_ok.values())
    perfect = sum(r["all_ok"] for r in records)
    flagged = sum(r["flagged"] for r in records)
    silent = sum(r["silent_error"] for r in records)
    failures = sum(1 for r in records if r["error"])
    avg_seconds = statistics.mean(r["seconds"] for r in records)

    lines = [
        "# Extraction test report",
        "",
        f"Generated: {datetime.now():%Y-%m-%d %H:%M} | Model: `{settings.GEMINI_MODEL}` | Invoices tested: **{n}**",
        "",
        "## Summary",
        "",
        "| Metric | Result |",
        "|---|---|",
        f"| Field-level accuracy | **{pct(ok_fields, total_fields)}** ({ok_fields}/{total_fields} fields) |",
        f"| Invoices with every field correct | **{pct(perfect, n)}** ({perfect}/{n}) |",
        f"| Sent to human review (flagged) | {pct(flagged, n)} ({flagged}/{n}) |",
        f"| **Silent errors** (wrong data, not flagged) | **{silent}** ({pct(silent, n)}) |",
        f"| Extraction failures (API/parse) | {failures} |",
        f"| Average time per invoice | {avg_seconds:.1f}s |",
        "",
        "Silent errors are the real risk: the data is wrong and nothing warned the reviewer.",
        "",
        "## Accuracy by field",
        "",
        "| Field | Correct | Accuracy |",
        "|---|---|---|",
    ]
    for field in FIELDS:
        if field_total[field]:
            lines.append(f"| {field} | {field_ok[field]}/{field_total[field]} | {pct(field_ok[field], field_total[field])} |")

    problems = [r for r in records if not r["all_ok"]]
    lines += ["", "## Invoices with problems", ""]
    if not problems:
        lines.append("None. Every tested invoice matched the expected values.")
    for r in problems:
        tag = "flagged for review" if r["flagged"] else "SILENT ERROR"
        lines.append(f"### {r['name']} ({tag})")
        if r["error"]:
            lines.append(f"- Extraction failed: {r['error']}")
        for field, exp, act in r["mismatches"]:
            lines.append(f"- `{field}`: expected `{exp}`, got `{act}`")
        for warning in r["warnings"]:
            lines.append(f"- Validator warning: {warning}")
        lines.append("")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")

    print("\n" + "=" * 52)
    print(f"Field accuracy       : {pct(ok_fields, total_fields)}")
    print(f"Fully correct bills  : {pct(perfect, n)}")
    print(f"Flagged for review   : {pct(flagged, n)}")
    print(f"Silent errors        : {silent}")
    print(f"Avg time per invoice : {avg_seconds:.1f}s")
    print(f"Report written to    : {REPORT}")


if __name__ == "__main__":
    main()