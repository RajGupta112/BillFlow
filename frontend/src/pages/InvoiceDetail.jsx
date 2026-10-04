import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy, Loader2,
  Pencil, RefreshCw, Send, ShieldAlert, Trash2, X,
} from 'lucide-react'
import { approvalApi, getErrorMessage, formatDate, formatDateTime, formatINR, invoiceApi, opsApi, vendorApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import FilePreview from '../components/FilePreview'
import ApprovalTimeline from '../components/ApprovalTimeline'

const inputCls =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15'

function Card({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold text-ink-900 ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    </div>
  )
}

/* ---------------------------------------------------------- edit form */

function toForm(inv) {
  return {
    vendor_id: inv.vendor?.id ? String(inv.vendor.id) : '',
    invoice_number: inv.invoice_number ?? '',
    invoice_date: inv.invoice_date ?? '',
    due_date: inv.due_date ?? '',
    subtotal: inv.subtotal ?? '',
    cgst: inv.cgst ?? '',
    sgst: inv.sgst ?? '',
    igst: inv.igst ?? '',
    total_amount: inv.total_amount ?? '',
  }
}

function toPayload(f) {
  const amount = (v) => (v === '' || v === null ? null : v)
  return {
    vendor_id: f.vendor_id ? Number(f.vendor_id) : null,
    invoice_number: f.invoice_number.trim() || null,
    invoice_date: f.invoice_date || null,
    due_date: f.due_date || null,
    subtotal: amount(f.subtotal),
    cgst: amount(f.cgst),
    sgst: amount(f.sgst),
    igst: amount(f.igst),
    total_amount: amount(f.total_amount),
  }
}

function EditForm({ inv, vendors, saving, onSave, onCancel }) {
  const [f, setF] = useState(() => toForm(inv))
  const set = (key) => (e) => setF((prev) => ({ ...prev, [key]: e.target.value }))

  const n = (v) => Number(v || 0)
  const expected = n(f.subtotal) + n(f.cgst) + n(f.sgst) + n(f.igst)
  const mismatch = f.total_amount !== '' && f.subtotal !== '' && Math.abs(expected - n(f.total_amount)) > 1

  const label = (text, child) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-500">{text}</span>
      {child}
    </label>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {label(
            'Vendor',
            <select value={f.vendor_id} onChange={set('vendor_id')} className={inputCls}>
              <option value="">Select a vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.gstin ? ` · ${v.gstin}` : ''}
                </option>
              ))}
            </select>,
          )}
        </div>
        {label('Invoice number', <input className={inputCls} value={f.invoice_number} onChange={set('invoice_number')} />)}
        <div className="grid grid-cols-2 gap-3">
          {label('Invoice date', <input type="date" className={inputCls} value={f.invoice_date} onChange={set('invoice_date')} />)}
          {label('Due date', <input type="date" className={inputCls} value={f.due_date} onChange={set('due_date')} />)}
        </div>
        {label('Subtotal', <input type="number" step="0.01" className={inputCls} value={f.subtotal} onChange={set('subtotal')} />)}
        {label('Total amount', <input type="number" step="0.01" className={inputCls} value={f.total_amount} onChange={set('total_amount')} />)}
        {label('CGST', <input type="number" step="0.01" className={inputCls} value={f.cgst} onChange={set('cgst')} />)}
        {label('SGST', <input type="number" step="0.01" className={inputCls} value={f.sgst} onChange={set('sgst')} />)}
        {label('IGST', <input type="number" step="0.01" className={inputCls} value={f.igst} onChange={set('igst')} />)}
      </div>

      {mismatch && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Subtotal + taxes = {formatINR(expected)}, but the total is {formatINR(f.total_amount)}.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(toPayload(f))}
          className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- page */

export default function InvoiceDetail() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState(null)       // { type: 'error' | 'success', text }
  const [comment, setComment] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const [discardReason, setDiscardReason] = useState('')
  const [duplicateBlocked, setDuplicateBlocked] = useState(false)

  const { data: inv, isLoading, isError, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoiceApi.get(id),
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: vendorApi.list,
    enabled: editing,
  })

  const { data: audit } = useQuery({
    queryKey: ['audit-invoice', id],
    queryFn: () => opsApi.audit({ invoice_id: id, limit: 50 }),
    enabled: isAdmin,
  })

  function afterChange(updated) {
    if (updated?.id) queryClient.setQueryData(['invoice', id], updated)
    else queryClient.invalidateQueries({ queryKey: ['invoice', id] })
    for (const key of ['invoices', 'my-approvals', 'dashboard', 'reconciliation', 'audit-invoice', 'sync-status']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const run = (fn, { success, onOk } = {}) => ({
    mutationFn: fn,
    onMutate: () => setNotice(null),
    onSuccess: (data) => {
      afterChange(data)
      if (success) setNotice({ type: 'success', text: success })
      onOk?.()
    },
    onError: (err) => {
      const text = getErrorMessage(err)
      setNotice({ type: 'error', text })
      if (err.response?.status === 409) setDuplicateBlocked(true)
    },
  })

  const save = useMutation(run((body) => invoiceApi.edit(id, body), { success: 'Changes saved.', onOk: () => setEditing(false) }))
  const submit = useMutation(run((override) => invoiceApi.submit(id, override), { success: 'Submitted for approval.', onOk: () => setDuplicateBlocked(false) }))
  const discard = useMutation(run(() => invoiceApi.discard(id, discardReason), { success: 'Invoice discarded.', onOk: () => setDiscardOpen(false) }))
  const approve = useMutation(run(() => approvalApi.approve(id, comment || null), { success: 'Approved.', onOk: () => setComment('') }))
  const reject = useMutation(run(() => approvalApi.reject(id, comment), { success: 'Rejected.', onOk: () => setComment('') }))
  const retry = useMutation(run(() => opsApi.retrySync(id), { success: 'Queued for another Tally sync attempt.' }))

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-ink-400">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    )
  }
  if (isError || !inv) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-3 font-semibold text-red-800">{getErrorMessage(error, 'Invoice not found')}</p>
        <Link to="/app/invoices" className="mt-4 inline-block text-sm font-semibold text-red-700 underline">
          Back to invoices
        </Link>
      </div>
    )
  }

  const notes = inv.validation_notes ? inv.validation_notes.split('\n').filter(Boolean) : []
  const pendingStep = inv.approval_steps.find((s) => s.status === 'pending')
  const canAct = inv.status === 'pending_approval' && pendingStep?.approver_id === user.id
  const busy = [save, submit, discard, approve, reject, retry].some((m) => m.isPending)

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/app/invoices" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" />
        All invoices
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">
              {inv.invoice_number ?? `Invoice #${inv.id}`}
            </h2>
            <StatusBadge status={inv.status} />
          </div>
          <p className="mt-1 text-ink-500">
            {inv.vendor?.name ?? 'Vendor not identified'} · uploaded {formatDateTime(inv.created_at)}
          </p>
        </div>
        <p className="text-3xl font-extrabold tracking-tight text-ink-900">{formatINR(inv.total_amount)}</p>
      </div>

      {notice && (
        <div
          role="status"
          className={`mt-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <span className="flex items-start gap-2">
            {notice.type === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {notice.text}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        {/* left: preview */}
        <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <FilePreview invoiceId={inv.id} filename={inv.original_filename} />
        </div>

        {/* right: details */}
        <div className="space-y-5">
          {/* alerts */}
          {(notes.length > 0 || inv.duplicate_of_id || inv.rejection_reason || inv.tally_voucher_id) && (
            <div className="space-y-3">
              {notes.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <ShieldAlert className="h-4 w-4" />
                    Needs your attention
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                    {notes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {inv.duplicate_of_id && (
                <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <Copy className="h-4 w-4 shrink-0" />
                  Possible duplicate of
                  <Link to={`/app/invoices/${inv.duplicate_of_id}`} className="font-bold underline">
                    invoice #{inv.duplicate_of_id}
                  </Link>
                </div>
              )}
              {inv.rejection_reason && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-bold">Rejected</p>
                  <p className="mt-1">{inv.rejection_reason}</p>
                </div>
              )}
              {inv.tally_voucher_id && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Posted to Tally as voucher
                  <span className="font-mono font-bold">{inv.tally_voucher_id}</span>
                  {inv.synced_at && <span className="text-emerald-700">· {formatDateTime(inv.synced_at)}</span>}
                </div>
              )}
            </div>
          )}

          {/* extracted data */}
          <Card
            title="Invoice details"
            action={
              inv.status === 'needs_review' &&
              !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )
            }
          >
            {editing ? (
              <EditForm inv={inv} vendors={vendors} saving={save.isPending} onSave={(p) => save.mutate(p)} onCancel={() => setEditing(false)} />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
                <Field label="Vendor" value={inv.vendor?.name} />
                <Field label="GSTIN" value={inv.vendor?.gstin} mono />
                <Field label="Invoice no." value={inv.invoice_number} mono />
                <Field label="Invoice date" value={inv.invoice_date ? formatDate(inv.invoice_date) : null} />
                <Field label="Due date" value={inv.due_date ? formatDate(inv.due_date) : null} />
                <Field
                  label="AI confidence"
                  value={inv.extraction_confidence != null ? `${Math.round(Number(inv.extraction_confidence) * 100)}%` : null}
                />
                <Field label="Subtotal" value={inv.subtotal != null ? formatINR(inv.subtotal) : null} />
                <Field label="CGST" value={inv.cgst != null ? formatINR(inv.cgst) : null} />
                <Field label="SGST" value={inv.sgst != null ? formatINR(inv.sgst) : null} />
                <Field label="IGST" value={inv.igst != null ? formatINR(inv.igst) : null} />
                <Field label="Total" value={formatINR(inv.total_amount)} />
              </div>
            )}
          </Card>

          {/* line items */}
          {inv.line_items.length > 0 && (
            <Card title={`Line items (${inv.line_items.length})`}>
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2">HSN</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2 text-right">GST</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {inv.line_items.map((li) => (
                      <tr key={li.id}>
                        <td className="px-2 py-2.5 text-ink-800">{li.description}</td>
                        <td className="px-2 py-2.5 font-mono text-xs text-ink-500">{li.hsn_code ?? '-'}</td>
                        <td className="px-2 py-2.5 text-right text-ink-600">{li.quantity != null ? Number(li.quantity) : '-'}</td>
                        <td className="px-2 py-2.5 text-right text-ink-600">{li.rate != null ? formatINR(li.rate) : '-'}</td>
                        <td className="px-2 py-2.5 text-right text-ink-600">{li.gst_rate != null ? `${Number(li.gst_rate)}%` : '-'}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-ink-900">{li.amount != null ? formatINR(li.amount) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* actions: needs review */}
          {inv.status === 'needs_review' && !editing && (
            <Card title="Review actions">
              <p className="text-sm text-ink-500">
                Check the data against the bill, fix anything wrong, then send it into the approval chain.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit.mutate(false)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 hover:brightness-110 disabled:opacity-60"
                >
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit for approval
                </button>
                {duplicateBlocked && isAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submit.mutate(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Submit anyway (admin override)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDiscardOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Discard
                </button>
              </div>

              {discardOpen && (
                <div className="mt-4 space-y-2 rounded-xl bg-ink-50 p-4">
                  <label className="block text-xs font-medium text-ink-500">Why are you discarding this bill?</label>
                  <input
                    className={inputCls}
                    value={discardReason}
                    onChange={(e) => setDiscardReason(e.target.value)}
                    placeholder="e.g. Duplicate of an earlier upload"
                  />
                  <button
                    type="button"
                    disabled={busy || discardReason.trim().length < 3}
                    onClick={() => discard.mutate()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm discard
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* actions: pending approval */}
          {inv.status === 'pending_approval' && (
            <Card title="Your decision">
              {canAct ? (
                <>
                  <label className="mb-1.5 block text-xs font-medium text-ink-500">Comment (required to reject)</label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a note for the audit trail"
                    className={inputCls}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approve.mutate()}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy || comment.trim().length < 3}
                      onClick={() => reject.mutate()}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {reject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-500">
                  {pendingStep ? `Waiting for ${pendingStep.step_label}.` : 'Waiting for the next approver.'}
                </p>
              )}
            </Card>
          )}

          {/* actions: sync failed */}
          {inv.status === 'sync_failed' && (
            <Card title="Tally sync">
              <p className="text-sm text-ink-500">
                Tally did not accept this voucher. Fix the cause (for example, create the missing ledger in Tally)
                and retry. The audit log below shows the exact error.
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => retry.mutate()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                >
                  {retry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Retry Tally sync
                </button>
              ) : (
                <p className="mt-3 text-sm font-medium text-ink-700">Ask an admin to retry the sync.</p>
              )}
            </Card>
          )}

          <Card title="Approval chain">
            <ApprovalTimeline steps={inv.approval_steps} />
          </Card>

          {isAdmin && audit && (
            <Card title={`Audit history (${audit.total})`}>
              {audit.items.length === 0 ? (
                <p className="text-sm text-ink-500">No entries yet.</p>
              ) : (
                <ul className="space-y-3">
                  {audit.items.map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                      <div className="min-w-0">
                        <p className="font-semibold capitalize text-ink-800">{a.action.replaceAll('_', ' ')}</p>
                        <p className="text-xs text-ink-400">
                          {a.user_name ?? 'System'} · {formatDateTime(a.created_at)}
                        </p>
                        {a.details && Object.keys(a.details).length > 0 && (
                          <p className="mt-1 break-words rounded-lg bg-ink-50 px-2.5 py-1.5 font-mono text-[11px] text-ink-500">
                            {JSON.stringify(a.details)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}