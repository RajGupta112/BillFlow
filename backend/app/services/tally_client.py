import re
from dataclasses import dataclass
from decimal import Decimal
from xml.sax.saxutils import escape

import httpx

from app.config import settings

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
ROUND_OFF_LIMIT = Decimal("1.00")


class TallyError(Exception):
    pass


class TallyConnectionError(TallyError):
    """Tally tak pahunch nahi paye. Baad me retry karna theek hai."""


class TallyDataError(TallyError):
    """Invoice ka data hi galat hai. Retry se kuch nahi badlega."""


class TallyRejectedError(TallyError):
    """Tally ne voucher reject kiya (ledger missing, etc.)."""


@dataclass
class TallyResult:
    voucher_number: str
    already_existed: bool
    raw_response: str


def _x(value) -> str:
    """XML ke liye safe text (& < > escape, control chars hata do)."""
    return escape(_CONTROL_CHARS.sub("", str(value)))


def _amt(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


def voucher_number_for(invoice) -> str:
    # Hamara system id, taaki Tally me voucher se wapas invoice trace ho sake
    return f"AP-{invoice.id}"


def build_purchase_voucher_xml(invoice) -> tuple[str, str]:
    """(xml, voucher_number) return karta hai. Invoice ke saath vendor load hona chahiye."""
    if invoice.vendor is None:
        raise TallyDataError("Invoice ka vendor set nahi hai")
    if invoice.invoice_date is None or invoice.total_amount is None:
        raise TallyDataError("Invoice date ya total amount missing hai")

    zero = Decimal("0")
    total = invoice.total_amount
    cgst = invoice.cgst or zero
    sgst = invoice.sgst or zero
    igst = invoice.igst or zero
    taxes = cgst + sgst + igst
    subtotal = invoice.subtotal if invoice.subtotal is not None else total - taxes

    diff = total - (subtotal + taxes)
    if abs(diff) > ROUND_OFF_LIMIT:
        raise TallyDataError(
            f"Amounts balance nahi karte: subtotal {subtotal} + tax {taxes} != total {total}"
        )

    # Tally convention: credit = positive + ISDEEMEDPOSITIVE No, debit = negative + Yes
    entries: list[tuple[str, Decimal, str]] = []
    party = invoice.vendor.tally_ledger_name or invoice.vendor.name
    entries.append((party, total, "No"))
    entries.append((settings.TALLY_PURCHASE_LEDGER, -subtotal, "Yes"))
    if cgst > 0:
        entries.append((settings.TALLY_CGST_LEDGER, -cgst, "Yes"))
    if sgst > 0:
        entries.append((settings.TALLY_SGST_LEDGER, -sgst, "Yes"))
    if igst > 0:
        entries.append((settings.TALLY_IGST_LEDGER, -igst, "Yes"))
    if diff > 0:
        entries.append((settings.TALLY_ROUNDOFF_LEDGER, -diff, "Yes"))
    elif diff < 0:
        entries.append((settings.TALLY_ROUNDOFF_LEDGER, -diff, "No"))

    if sum(amount for _, amount, _ in entries) != 0:   # apne aap ka safety check
        raise TallyDataError("Voucher entries ka total zero nahi aa raha")

    voucher_number = voucher_number_for(invoice)
    narration = f"Auto-posted by Invoice-to-Tally | Supplier inv {invoice.invoice_number} | ID {invoice.id}"
    date_str = invoice.invoice_date.strftime("%Y%m%d")

    entry_xml = "".join(
        f"""
      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>{_x(name)}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>{positive}</ISDEEMEDPOSITIVE>
       <AMOUNT>{_amt(amount)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>"""
        for name, amount, positive in entries
    )

    xml = f"""<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>{_x(settings.TALLY_COMPANY)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER REMOTEID="invoice-to-tally-{invoice.id}" VCHTYPE="{_x(settings.TALLY_VOUCHER_TYPE)}" ACTION="Create" OBJVIEW="Accounting Voucher View">
      <DATE>{date_str}</DATE>
      <EFFECTIVEDATE>{date_str}</EFFECTIVEDATE>
      <VOUCHERTYPENAME>{_x(settings.TALLY_VOUCHER_TYPE)}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>{_x(voucher_number)}</VOUCHERNUMBER>
      <REFERENCE>{_x(invoice.invoice_number or "")}</REFERENCE>
      <PARTYLEDGERNAME>{_x(party)}</PARTYLEDGERNAME>
      <NARRATION>{_x(narration)}</NARRATION>{entry_xml}
     </VOUCHER>
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>"""
    return xml, voucher_number


def _count(text: str, tag: str) -> int | None:
    match = re.search(rf"<{tag}>\s*(\d+)\s*</{tag}>", text)
    return int(match.group(1)) if match else None


def parse_response(text: str, voucher_number: str) -> TallyResult:
    created = _count(text, "CREATED")
    altered = _count(text, "ALTERED")
    errors = _count(text, "ERRORS")
    line_errors = [e.strip() for e in re.findall(r"<LINEERROR>(.*?)</LINEERROR>", text, re.S)]

    if created is None and errors is None:
        raise TallyRejectedError(f"Tally ka response samajh nahi aaya: {text[:300]}")

    if errors or line_errors:
        joined = "; ".join(line_errors) or "Tally ne error diya (details nahi mili)"
        low = joined.lower()
        if "svcurrentcompany" in low or "could not set" in low:
            raise TallyConnectionError(f"Tally me company open nahi hai: {joined}")
        if "already exists" in low:
            # Best effort: pehle post ho chuka hai (jaise response kho gaya tha). Real Tally me message check karna.
            return TallyResult(voucher_number, True, text)
        raise TallyRejectedError(joined)

    if not (created or altered):
        raise TallyRejectedError("Tally ne voucher create nahi kiya (CREATED=0)")
    return TallyResult(voucher_number, False, text)


def post_to_tally(xml: str, voucher_number: str) -> TallyResult:
    try:
        resp = httpx.post(
            settings.TALLY_URL,
            content=xml.encode("utf-8"),
            headers={"Content-Type": "text/xml; charset=utf-8"},
            timeout=settings.TALLY_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise TallyConnectionError(f"Tally se connect nahi hua ({settings.TALLY_URL}): {exc}") from exc

    if resp.status_code >= 500:
        raise TallyConnectionError(f"Tally server error {resp.status_code}")
    return parse_response(resp.text, voucher_number)


def tally_is_running() -> bool:
    try:
        return httpx.get(settings.TALLY_URL, timeout=3).status_code == 200
    except httpx.HTTPError:
        return False