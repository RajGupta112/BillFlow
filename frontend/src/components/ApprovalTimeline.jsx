import { CheckCircle2, Circle, Clock3, MinusCircle, XCircle } from 'lucide-react'
import { formatDateTime } from '../api/client'

const STEP = {
  approved: { icon: CheckCircle2, ring: 'text-emerald-600 bg-emerald-50', label: 'Approved' },
  rejected: { icon: XCircle, ring: 'text-red-600 bg-red-50', label: 'Rejected' },
  pending: { icon: Clock3, ring: 'text-blue-600 bg-blue-50', label: 'Waiting for decision' },
  waiting: { icon: Circle, ring: 'text-ink-400 bg-ink-100', label: 'Not started' },
  skipped: { icon: MinusCircle, ring: 'text-ink-400 bg-ink-100', label: 'Skipped' },
}

export default function ApprovalTimeline({ steps = [] }) {
  if (steps.length === 0) {
    return <p className="text-sm text-ink-500">No approval chain yet. It starts once the bill is submitted.</p>
  }

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const s = STEP[step.status] ?? STEP.waiting
        const Icon = s.icon
        const last = i === steps.length - 1
        return (
          <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px bg-ink-200" />}
            <span className={`z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ${s.ring}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-semibold text-ink-900">{step.step_label}</p>
              <p className="text-xs text-ink-500">
                {s.label}
                {step.acted_at && ` · ${formatDateTime(step.acted_at)}`}
              </p>
              {step.comment && (
                <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">"{step.comment}"</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}