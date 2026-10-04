"""Mock Tally server. Chalao: python tally\\mock_tally\\server.py  (port 9000)

Browser se control:
  http://localhost:9000/vouchers      -> abhi tak post hue vouchers (JSON)
  http://localhost:9000/fail?count=3  -> agle 3 requests pe Tally 'down' (503)
  http://localhost:9000/reset         -> sab vouchers hata do
"""
import json
import threading
import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST, PORT = "127.0.0.1", 9000

LOCK = threading.Lock()
VOUCHERS: list[dict] = []
STATE = {"fail_count": 0, "next_id": 1}


def tally_response(created=0, errors=0, line_errors=None) -> bytes:
    body = (
        "<RESPONSE>\n"
        f" <CREATED>{created}</CREATED>\n <ALTERED>0</ALTERED>\n <DELETED>0</DELETED>\n"
        " <LASTVCHID>0</LASTVCHID>\n <COMBINED>0</COMBINED>\n <IGNORED>0</IGNORED>\n"
        f" <ERRORS>{errors}</ERRORS>\n <CANCELLED>0</CANCELLED>\n"
    )
    for err in line_errors or []:
        body += f" <LINEERROR>{err}</LINEERROR>\n"
    body += "</RESPONSE>"
    return body.encode("utf-8")


def process_import(raw: bytes) -> bytes:
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        return tally_response(errors=1, line_errors=[f"Malformed XML: {exc}"])

    vouchers = list(root.iter("VOUCHER"))
    if not vouchers:
        return tally_response(errors=1, line_errors=["No VOUCHER found in request"])

    created, line_errors = 0, []
    for v in vouchers:
        number = (v.findtext("VOUCHERNUMBER") or "").strip()
        vtype = (v.findtext("VOUCHERTYPENAME") or v.get("VCHTYPE") or "").strip()
        date = (v.findtext("DATE") or "").strip()
        party = (v.findtext("PARTYLEDGERNAME") or "").strip()

        try:
            datetime.strptime(date, "%Y%m%d")
        except ValueError:
            line_errors.append(f"Invalid voucher date '{date}'")
            continue
        if not number or not party:
            line_errors.append("Voucher number or party ledger is missing")
            continue

        entries, total_sum, credit_total = [], Decimal("0"), Decimal("0")
        try:
            for e in v.findall("ALLLEDGERENTRIES.LIST"):
                amount = Decimal((e.findtext("AMOUNT") or "0").strip())
                entries.append({"ledger": (e.findtext("LEDGERNAME") or "").strip(), "amount": str(amount)})
                total_sum += amount
                if amount > 0:
                    credit_total += amount
        except InvalidOperation:
            line_errors.append("Invalid amount in ledger entry")
            continue
        if len(entries) < 2:
            line_errors.append("Voucher needs at least two ledger entries")
            continue
        if total_sum != 0:
            line_errors.append(f"Voucher totals do not match (difference {total_sum})")
            continue

        with LOCK:
            if any(x["number"] == number and x["type"] == vtype for x in VOUCHERS):
                line_errors.append(f"Voucher number '{number}' already exists")
                continue
            VOUCHERS.append({
                "id": STATE["next_id"], "type": vtype, "number": number, "date": date,
                "party": party, "reference": (v.findtext("REFERENCE") or "").strip(),
                "amount": str(credit_total), "entries": entries,
                "received_at": datetime.now().isoformat(timespec="seconds"),
            })
            STATE["next_id"] += 1
        created += 1
        print(f"[mock-tally] CREATED {vtype} {number} party={party} amount={credit_total}")

    return tally_response(created=created, errors=len(line_errors), line_errors=line_errors)


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type="text/xml; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        with LOCK:
            if STATE["fail_count"] > 0:
                STATE["fail_count"] -= 1
                print("[mock-tally] simulating outage (503)")
                return self._send(503, b"Service unavailable", "text/plain")
        self._send(200, process_import(raw))

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/vouchers":
            with LOCK:
                data = json.dumps(VOUCHERS, indent=2).encode("utf-8")
            return self._send(200, data, "application/json")
        if url.path == "/fail":
            count = int(parse_qs(url.query).get("count", ["1"])[0])
            with LOCK:
                STATE["fail_count"] = count
            return self._send(200, f"Next {count} requests will fail".encode(), "text/plain")
        if url.path == "/reset":
            with LOCK:
                VOUCHERS.clear()
                STATE.update(fail_count=0, next_id=1)
            return self._send(200, b"Reset done", "text/plain")
        self._send(200, b"TallyPrime Server is Running (MOCK)", "text/plain")

    def log_message(self, *args):  # default access log band
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[mock-tally] listening on http://{HOST}:{PORT}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[mock-tally] stopped")