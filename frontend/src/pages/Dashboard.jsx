import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, Loader2, ShieldAlert, Timer,
} from 'lucide-react'
import { dashboardApi, formatINR, getErrorMessage } from '../api/client'
import { AgingBars, StatusDonut, TrendArea } from '../components/charts/Charts'

function Kpi({ icon: Icon, label, value, sub, tone, to }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  const body = (
    <div className="flex h-full items-start gap-4 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
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
  return to ? <Link to={to}>{body}</Link> : body
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-ink-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

const SOURCE_LABEL = { upload: 'Manual upload', email: 'Email (n8n)', webhook: 'Other webhook' }

export default function Dashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="grid h-64 place-items-center text-ink-400">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertCircle className="h-4 w-4" />
        {getErrorMessage(error, 'Could not load the dashboard')}
      </div>
    )
  }

  const attention = data.needs_review_count + data.sync_failed_count
  const sourceTotal = data.by_source.reduce((s, r) => s + r.count, 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {data.sync_failed_count > 0 && (
        <Link
          to="/app/reconciliation"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-800 transition hover:bg-red-100"
        >
          <span className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {data.sync_failed_count} invoice{data.sync_failed_count > 1 ? 's' : ''} could not be posted to Tally
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            Review <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={FileText}
          tone="brand"
          label="Total invoices"
          value={data.total_invoices}
          sub={`${formatINR(data.total_amount, { compact: true })} in total`}
          to="/app/invoices"
        />
        <Kpi
          icon={Clock3}
          tone="blue"
          label="Pending approval"
          value={data.pending_approval_count}
          sub={`${formatINR(data.pending_approval_amount, { compact: true })} waiting`}
          to="/app/approvals"
        />
        <Kpi
          icon={CheckCircle2}
          tone="emerald"
          label="Posted to Tally"
          value={data.synced_count}
          sub="Vouchers created"
          to="/app/invoices"
        />
        <Kpi
          icon={ShieldAlert}
          tone="amber"
          label="Needs attention"
          value={attention}
          sub={`${data.needs_review_count} to review · ${data.sync_failed_count} sync failed`}
          to="/app/invoices"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Invoices by status" subtitle="Where every bill is right now" className="lg:col-span-2">
          <div className="min-h-[240px]">
            <StatusDonut data={data.by_status} />
          </div>
        </Panel>
        <Panel title="Uploads, last 14 days" subtitle="Invoices received per day" className="lg:col-span-3">
          <div className="h-[240px]">
            <TrendArea data={data.last_14_days} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Approval aging" subtitle="How long pending bills have been waiting" className="lg:col-span-2">
          <div className="h-[220px]">
            <AgingBars data={data.pending_aging} />
          </div>
        </Panel>

        <Panel title="How bills arrive" subtitle="Share of invoices by intake channel" className="lg:col-span-2">
          {sourceTotal === 0 ? (
            <p className="py-10 text-center text-sm text-ink-400">No invoices yet</p>
          ) : (
            <ul className="space-y-5">
              {data.by_source.map((s) => {
                const pct = Math.round((s.count / sourceTotal) * 100)
                return (
                  <li key={s.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink-700">{SOURCE_LABEL[s.key] ?? s.key}</span>
                      <span className="text-ink-500">
                        {s.count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <section className="relative overflow-hidden rounded-2xl bg-ink-950 p-5 text-white shadow-sm lg:col-span-1">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/30 blur-2xl" />
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-brand-200">
            <Timer className="h-5 w-5" />
          </span>
          <p className="relative mt-4 text-3xl font-extrabold tracking-tight">{data.estimated_hours_saved}h</p>
          <p className="relative text-sm text-ink-300">Estimated time saved</p>
          <p className="relative mt-3 text-xs leading-relaxed text-ink-400">
            Assumes {data.assumed_minutes_saved_per_invoice} min of manual entry per posted bill. Replace with your
            measured baseline.
          </p>
        </section>
      </div>
    </div>
  )
}