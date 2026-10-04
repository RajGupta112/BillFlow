import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
    ResponsiveContainer, Tooltip, XAxis, YAxis,
  } from 'recharts'
  
  export const STATUS_META = {
    uploaded: { label: 'Processing', color: '#94a3b8' },
    needs_review: { label: 'Needs review', color: '#f59e0b' },
    pending_approval: { label: 'Pending approval', color: '#3b82f6' },
    approved: { label: 'Approved', color: '#14b8a6' },
    rejected: { label: 'Rejected', color: '#ef4444' },
    sync_pending: { label: 'Syncing to Tally', color: '#8b5cf6' },
    synced: { label: 'Posted to Tally', color: '#10b981' },
    sync_failed: { label: 'Sync failed', color: '#dc2626' },
  }
  
  const AXIS = { fontSize: 12, fill: '#8a91ae' }
  
  function Empty({ text }) {
    return <div className="grid h-full place-items-center text-sm text-ink-400">{text}</div>
  }
  
  function TooltipBox({ active, payload, label, unit = 'invoices' }) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-lg">
        {label && <p className="font-semibold text-ink-900">{label}</p>}
        <p className="text-ink-600">
          {payload[0].value} {unit}
        </p>
      </div>
    )
  }
  
  export function StatusDonut({ data = [] }) {
    const rows = data
      .filter((d) => d.count > 0)
      .map((d) => ({
        key: d.key,
        name: STATUS_META[d.key]?.label ?? d.key,
        value: d.count,
        color: STATUS_META[d.key]?.color ?? '#94a3b8',
      }))
    const total = rows.reduce((sum, r) => sum + r.value, 0)
  
    if (total === 0) return <Empty text="No invoices yet" />
  
    return (
      <div className="flex h-full flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-52 w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="none"
              >
                {rows.map((r) => (
                  <Cell key={r.key} fill={r.color} />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-ink-900">{total}</p>
              <p className="text-xs text-ink-400">invoices</p>
            </div>
          </div>
        </div>
  
        <ul className="w-full space-y-2.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                {r.name}
              </span>
              <span className="font-semibold text-ink-900">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  
  export function TrendArea({ data = [] }) {
    const rows = data.map((d) => ({
      ...d,
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    }))
    if (rows.every((r) => r.count === 0)) return <Empty text="No uploads in the last 14 days" />
  
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eceef5" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TooltipBox />} />
          <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>
    )
  }
  
  const AGING_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444']
  
  export function AgingBars({ data = [] }) {
    if (data.every((d) => d.count === 0)) return <Empty text="Nothing waiting for approval" />
  
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eceef5" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: '#f6f7fb' }} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={56}>
            {data.map((_, i) => (
              <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }