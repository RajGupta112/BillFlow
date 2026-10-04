import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronLeft, ChevronRight, FileText, Loader2, Plus, Search, UploadCloud } from 'lucide-react'
import { invoiceApi, formatDate, formatDateTime, formatINR, getErrorMessage } from '../api/client'
import StatusBadge, { STATUS_FILTERS } from '../components/StatusBadge'

const PAGE_SIZE = 20
const SOURCE_LABEL = { upload: 'Upload', email: 'Email', webhook: 'Webhook' }

export default function InvoiceList() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  // Typing ruke tab hi search chale
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim())
      setPage(0)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['invoices', { status, q, page }],
    queryFn: () =>
      invoiceApi.list({
        status: status || undefined,
        q: q || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, total)
  const hasFilters = Boolean(status || q)

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Invoices</h2>
          <p className="mt-1 text-ink-500">Every bill, from upload to Tally voucher.</p>
        </div>
        <Link
          to="/app/upload"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Upload invoice
        </Link>
      </div>

      {/* filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value)
                setPage(0)
              }}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                status === f.value
                  ? 'bg-ink-900 text-white'
                  : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, invoice no. or file"
            className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
          />
        </div>
      </div>

      {/* table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs font-semibold uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-5 py-3.5">Invoice</th>
                <th className="px-5 py-3.5">Vendor</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Source</th>
                <th className="px-5 py-3.5">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-ink-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!isLoading &&
                items.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/app/invoices/${inv.id}`)}
                    className="cursor-pointer transition-colors hover:bg-brand-50/50"
                  >
                    <td className="px-5 py-4">
                      <Link
                        to={`/app/invoices/${inv.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-ink-900 hover:text-brand-600"
                      >
                        {inv.invoice_number ?? `Invoice #${inv.id}`}
                      </Link>
                      <p className="mt-0.5 max-w-[200px] truncate text-xs text-ink-400">{inv.original_filename}</p>
                    </td>
                    <td className="px-5 py-4 text-ink-700">{inv.vendor?.name ?? '-'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-600">{formatDate(inv.invoice_date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-ink-900">
                      {formatINR(inv.total_amount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-4 text-ink-500">{SOURCE_LABEL[inv.source] ?? inv.source}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-500">{formatDateTime(inv.created_at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {isError && (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {getErrorMessage(error, 'Could not load invoices')}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">
              <FileText className="h-7 w-7" />
            </span>
            <h3 className="mt-4 text-base font-bold text-ink-900">
              {hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              {hasFilters ? 'Try a different status or search term.' : 'Upload your first vendor bill to get started.'}
            </p>
            {!hasFilters && (
              <Link
                to="/app/upload"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800"
              >
                <UploadCloud className="h-4 w-4" />
                Upload invoice
              </Link>
            )}
          </div>
        )}

        {/* pagination */}
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
                className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
                className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
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