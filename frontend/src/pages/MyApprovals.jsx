import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, FileText, Loader2 } from 'lucide-react'
import { approvalApi, formatDate, formatINR, getErrorMessage } from '../api/client'

function ageOf(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days <= 0) return { text: 'Today', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  if (days <= 3) return { text: `${days}d waiting`, cls: 'bg-ink-100 text-ink-600 ring-ink-200' }
  if (days <= 7) return { text: `${days}d waiting`, cls: 'bg-amber-50 text-amber-700 ring-amber-200' }
  return { text: `${days}d waiting`, cls: 'bg-red-50 text-red-700 ring-red-200' }
}

export default function MyApprovals() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['my-approvals'],
    queryFn: approvalApi.mine,
    refetchInterval: 30_000,
  })

  const items = data ?? []
  const totalValue = items.reduce((sum, inv) => sum + Number(inv.total_amount ?? 0), 0)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">My approvals</h2>
          <p className="mt-1 text-ink-500">Bills waiting for your decision, oldest first.</p>
        </div>
        {items.length > 0 && (
          <div className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-right shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Total waiting</p>
            <p className="text-lg font-extrabold text-ink-900">{formatINR(totalValue)}</p>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid h-48 place-items-center text-ink-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {getErrorMessage(error, 'Could not load your approvals')}
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-lg font-bold text-ink-900">You're all caught up</h3>
          <p className="mt-1 text-sm text-ink-500">No bills are waiting for your approval right now.</p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {items.map((inv) => {
          const age = ageOf(inv.created_at)
          return (
            <li key={inv.id}>
              <Link
                to={`/app/invoices/${inv.id}`}
                className="group flex flex-wrap items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:flex-nowrap sm:p-5"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-6 w-6" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-ink-900">{inv.vendor?.name ?? 'Unknown vendor'}</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${age.cls}`}
                    >
                      <Clock3 className="h-3 w-3" />
                      {age.text}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">
                    <span className="font-mono text-xs">{inv.invoice_number ?? `#${inv.id}`}</span>
                    {inv.invoice_date && ` · ${formatDate(inv.invoice_date)}`}
                  </p>
                </div>

                <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
                  <p className="text-xl font-extrabold tracking-tight text-ink-900">{formatINR(inv.total_amount)}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
                    Review
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}