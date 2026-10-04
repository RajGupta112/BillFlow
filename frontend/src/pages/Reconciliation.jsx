import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ServerCrash, ServerCog, ShieldAlert, Wallet,
} from 'lucide-react'
import { opsApi, formatDateTime, formatINR, getErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

const KIND_LABEL = {
  sync_failed: 'Tally sync failed',
  stuck_in_queue: 'Stuck in queue',
  missing_voucher_id: 'Voucher number missing',
  queue_done_invoice_not_synced: 'Queue and invoice disagree',
  approved_not_queued: 'Approved but not queued',
}

const QUEUE_STATUS = {
  pending: { label: 'Pending', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  processing: { label: 'Processing', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200' },
}

const QUEUE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
  { value: 'done', label: 'Done' },
]

function Stat({ icon: Icon, label, value, sub, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600',
    brand: 'bg-brand-50 text-brand-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-ink-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function Reconciliation() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [queueFilter, setQueueFilter] = useState('')
  const [retryingId, setRetryingId] = useState(null)
  const [notice, setNotice] = useState(null)

  const recon = useQuery({
    queryKey: ['reconciliation'],
    queryFn: opsApi.reconciliation,
    refetchInterval: 30_000,
  })
  const status = useQuery({
    queryKey: ['sync-status'],
    queryFn: opsApi.syncStatus,
    refetchInterval: 30_000,
  })
  const queue = useQuery({
    queryKey: ['sync-queue', queueFilter],
    queryFn: () => opsApi.syncQueue({ status: queueFilter || undefined, limit: 50 }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })

  const retry = useMutation({
    mutationFn: (invoiceId) => opsApi.retrySync(invoiceId),
    onMutate: (invoiceId) => {
      setRetryingId(invoiceId)
      setNotice(null)
    },
    onSuccess: (_, invoiceId) => {
      setNotice({ type: 'success', text: `Invoice #${invoiceId} queued for another Tally attempt.` })
      for (const key of ['reconciliation', 'sync-queue', 'sync-status', 'invoices', 'dashboard']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
      queryClient.invalidateQueries({ queryKey: ['invoice', String(invoiceId)] })
    },
    onError: (err) => setNotice({ type: 'error', text: getErrorMessage(err, 'Retry failed') }),
    onSettled: () => setRetryingId(null),
  })

  function refreshAll() {
    recon.refetch()
    status.refetch()
    queue.refetch()
  }

  if (recon.isLoading) {
    return (
      <div className="grid h-64 place-items-center text-ink-400">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    )
  }
  if (recon.isError) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="h-4 w-4" />
        {getErrorMessage(recon.error, 'Could not load the reconciliation report')}
      </div>
    )
  }

  const report = recon.data
  const issues = report.issues
  const errors = issues.filter((i) => i.severity === 'error').length
  const tallyUp = Boolean(status.data?.tally_running)
  const counts = status.data?.queue_counts ?? {}
  const queueItems = queue.data ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Reconciliation</h2>
          <p className="mt-1 text-ink-500">
            Checks that every approved bill reached Tally and that our records agree with each other.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-ink-400 sm:block">Updated {formatDateTime(report.generated_at)}</p>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 shadow-sm hover:bg-ink-50"
          >
            <RefreshCw className={`h-4 w-4 ${recon.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {notice.type === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
          {notice.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={CheckCircle2} tone="emerald" label="Vouchers posted" value={report.synced_count} sub="Confirmed in Tally" />
        <Stat icon={Wallet} tone="brand" label="Value posted" value={formatINR(report.synced_amount, { compact: true })} sub={formatINR(report.synced_amount)} />
        <Stat
          icon={issues.length ? ShieldAlert : CheckCircle2}
          tone={errors ? 'red' : issues.length ? 'amber' : 'emerald'}
          label="Open issues"
          value={report.issue_count}
          sub={issues.length ? `${errors} error${errors === 1 ? '' : 's'}, ${issues.length - errors} warning${issues.length - errors === 1 ? '' : 's'}` : 'Everything matches'}
        />
        <Stat
          icon={tallyUp ? ServerCog : ServerCrash}
          tone={tallyUp ? 'emerald' : 'amber'}
          label="Tally connection"
          value={tallyUp ? 'Connected' : 'Offline'}
          sub={status.data?.tally_url ?? '-'}
        />
      </div>

      {/* issues */}
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="border-b border-ink-200 px-5 py-4">
          <h3 className="text-base font-bold text-ink-900">Issues to resolve</h3>
        </div>

        {issues.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h4 className="mt-4 font-bold text-ink-900">All clear</h4>
            <p className="mt-1 text-sm text-ink-500">No mismatches between approvals, the sync queue and Tally vouchers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-ink-50 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Issue</th>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {issues.map((issue) => (
                  <tr key={`${issue.kind}-${issue.invoice_id}`}>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                          issue.severity === 'error'
                            ? 'bg-red-50 text-red-700 ring-red-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {issue.severity === 'error' ? 'Error' : 'Warning'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-ink-900">{KIND_LABEL[issue.kind] ?? issue.kind}</td>
                    <td className="px-5 py-4">
                      <Link to={`/app/invoices/${issue.invoice_id}`} className="font-semibold text-brand-600 hover:text-brand-700">
                        {issue.invoice_number ?? `#${issue.invoice_id}`}
                      </Link>
                    </td>
                    <td className="max-w-sm px-5 py-4 text-ink-600">{issue.message}</td>
                    <td className="px-5 py-4 text-right">
                      {issue.kind === 'sync_failed' && isAdmin ? (
                        <button
                          type="button"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(issue.invoice_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                        >
                          {retryingId === issue.invoice_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Retry sync
                        </button>
                      ) : (
                        <Link to={`/app/invoices/${issue.invoice_id}`} className="text-sm font-medium text-ink-500 hover:text-ink-900">
                          Open
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* sync queue */}
      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-ink-900">Tally sync queue</h3>
            <p className="text-xs text-ink-400">Retries use increasing delays, up to the attempt limit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUEUE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setQueueFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  queueFilter === f.value
                    ? 'bg-ink-900 text-white'
                    : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                }`}
              >
                {f.label}
                {f.value && counts[f.value] != null && <span className="ml-1.5 opacity-70">{counts[f.value]}</span>}
              </button>
            ))}
          </div>
        </div>

        {queueItems.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-ink-400">Nothing in the queue for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-ink-50 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Attempts</th>
                  <th className="px-5 py-3">Next retry</th>
                  <th className="px-5 py-3">Last error</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {queueItems.map((q) => {
                  const st = QUEUE_STATUS[q.status] ?? { label: q.status, cls: 'bg-ink-100 text-ink-600 ring-ink-200' }
                  return (
                    <tr key={q.id}>
                      <td className="px-5 py-3.5">
                        <Link to={`/app/invoices/${q.invoice_id}`} className="font-semibold text-brand-600 hover:text-brand-700">
                          #{q.invoice_id}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">
                        {q.attempts} / {q.max_attempts}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-ink-500">
                        {q.status === 'pending' ? formatDateTime(q.next_retry_at) : '-'}
                      </td>
                      <td className="max-w-xs px-5 py-3.5">
                        {q.last_error ? (
                          <p className="truncate text-xs text-red-600" title={q.last_error}>
                            {q.last_error}
                          </p>
                        ) : (
                          <span className="text-ink-300">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-ink-500">{formatDateTime(q.updated_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}