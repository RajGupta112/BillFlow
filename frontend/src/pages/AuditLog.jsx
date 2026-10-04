import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, History, Loader2, Search } from 'lucide-react'
import { opsApi, formatDateTime, getErrorMessage } from '../api/client'

const PAGE_SIZE = 25

const ACTIONS = [
  'invoice_uploaded', 'email_received', 'extracted', 'extraction_failed', 'vendor_created',
  'duplicate_flagged', 'duplicate_overridden', 'invoice_edited', 'approval_started',
  'approval_chain_failed', 'approved', 'rejected', 'sync_queued', 'tally_synced',
  'tally_failed', 'sync_requeued',
]

const GOOD = ['approved', 'tally_synced', 'extracted', 'approval_started']
const BAD = ['rejected', 'tally_failed', 'extraction_failed', 'approval_chain_failed']
const WARN = ['duplicate_flagged', 'duplicate_overridden', 'sync_requeued']

function actionStyle(action) {
  if (GOOD.includes(action)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (BAD.includes(action)) return 'bg-red-50 text-red-700 ring-red-200'
  if (WARN.includes(action)) return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-brand-50 text-brand-700 ring-brand-200'
}

const pretty = (action) => action.replaceAll('_', ' ')

export default function AuditLog() {
  const [action, setAction] = useState('')
  const [invoiceInput, setInvoiceInput] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setInvoiceId(invoiceInput.trim().replace(/\D/g, ''))
      setPage(0)
    }, 400)
    return () => clearTimeout(t)
  }, [invoiceInput])

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['audit', { action, invoiceId, page }],
    queryFn: () =>
      opsApi.audit({
        action: action || undefined,
        invoice_id: invoiceId || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Audit log</h2>
        <p className="mt-1 text-ink-500">
          Every upload, edit, approval and Tally sync, with who did it and when. Entries are append-only.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(0)
          }}
          className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 sm:w-60"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {pretty(a)}
            </option>
          ))}
        </select>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={invoiceInput}
            onChange={(e) => setInvoiceInput(e.target.value)}
            inputMode="numeric"
            placeholder="Filter by invoice ID"
            className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-5 py-3.5">When</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Invoice</th>
                <th className="px-5 py-3.5">By</th>
                <th className="w-12 px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-ink-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                items.map((a) => {
                  const hasDetails = a.details && Object.keys(a.details).length > 0
                  const open = expanded === a.id
                  return (
                    <Fragment key={a.id}>
                      <tr
                        onClick={() => hasDetails && setExpanded(open ? null : a.id)}
                        className={`transition-colors ${hasDetails ? 'cursor-pointer hover:bg-ink-50' : ''}`}
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 text-ink-500">{formatDateTime(a.created_at)}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${actionStyle(a.action)}`}
                          >
                            {pretty(a.action)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {a.invoice_id ? (
                            <Link
                              to={`/app/invoices/${a.invoice_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-brand-600 hover:text-brand-700"
                            >
                              #{a.invoice_id}
                            </Link>
                          ) : (
                            <span className="text-ink-300">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {a.user_name ? (
                            <>
                              <p className="font-medium text-ink-800">{a.user_name}</p>
                              <p className="text-xs text-ink-400">{a.user_email}</p>
                            </>
                          ) : (
                            <span className="text-ink-500">System / automation</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {hasDetails && (
                            <ChevronDown className={`ml-auto h-4 w-4 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-ink-50/70">
                          <td colSpan={5} className="px-5 py-4">
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-ink-950 p-4 font-mono text-xs leading-relaxed text-ink-200">
                              {JSON.stringify(a.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
            </tbody>
          </table>
        </div>

        {isError && (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {getErrorMessage(error, 'Could not load the audit log')}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">
              <History className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-base font-bold text-ink-900">No entries found</h3>
            <p className="mt-1 text-sm text-ink-500">Try a different action or invoice ID.</p>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-ink-200 bg-ink-50/60 px-5 py-3 text-sm">
            <p className="flex items-center gap-2 text-ink-500">
              Showing {from}-{to} of {total}
              {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
                className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
                className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}