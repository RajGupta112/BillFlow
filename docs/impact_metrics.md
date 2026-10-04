# Impact metrics

Only measured numbers go into the README or resume. Estimates are labelled as estimates.

## 1. Baseline: time per bill without the system

Time yourself (or a colleague) entering real or realistic bills in Tally by hand. Use at least 15 bills, stopwatch from opening the PDF to saving the voucher.

| Bill # | Lines | Minutes (manual) |
|---|---|---|
| 1 | | |
| ... | | |

**Baseline minutes per bill (B)** = average of the column above.

## 2. With the system

Time the same kind of bills through BillFlow. Count only human effort: upload, check the extracted data, approve. AI wait time is not human effort.

**Assisted minutes per bill (A)** = average human minutes with the system.

## 3. Formulas

```
Minutes saved per bill      = B - A
Monthly hours saved         = (B - A) x bills per month / 60
Monthly cost saved (Rs.)    = monthly hours saved x hourly cost of the person doing entry
Payback                     = build cost / monthly cost saved
```

Fill in:

| Input | Value | Source |
|---|---|---|
| B (manual min/bill) | | stopwatch test |
| A (assisted min/bill) | | stopwatch test |
| Bills per month | | AP register / Tally voucher count |
| Hourly cost (Rs.) | | salary / working hours |

## 4. JD success metrics and where each number comes from

| Metric | How to measure |
|---|---|
| Workflows automated | Count them: email intake, extraction and validation, approval routing, Tally posting, daily digest, reconciliation |
| Manual hours eliminated | Section 3 |
| User adoption rate | Bills processed in BillFlow divided by total bills in the period (from Tally voucher count). Intake mix is on the dashboard |
| Cost savings / ROI | Section 3 |
| Delivery vs timeline | Planned vs actual dates for each build step |
| Repeat issues and errors | Compare duplicate and error counts before and after (see queries) |

## 5. Useful queries

Run in psql: `docker exec -it invoice_db psql -U invoice_user -d invoice_db`

```sql
-- how bills arrive (adoption by channel)
select source, count(*) from invoices group by source;

-- average hours from upload to posted in Tally
select round(avg(extract(epoch from (synced_at - created_at)) / 3600)::numeric, 1) as avg_hours
from invoices where status = 'synced';

-- how many bills needed human review
select status, count(*) from invoices group by status order by 2 desc;

-- duplicates caught before approval
select count(*) from audit_logs where action = 'duplicate_flagged';

-- Tally sync failures vs successes
select action, count(*) from audit_logs
where action in ('tally_synced', 'tally_failed') group by action;
```

## 6. Results (fill after testing)

| Metric | Value | Date measured |
|---|---|---|
| Baseline minutes per bill | | |
| Assisted minutes per bill | | |
| Minutes saved per bill | | |
| Extraction field accuracy | | |
| Duplicates caught | | |
| Tally sync success rate | | |