const STATUS = {
    uploaded: { label: 'Processing', cls: 'bg-ink-100 text-ink-600 ring-ink-200', dot: 'bg-ink-400' },
    needs_review: { label: 'Needs review', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    pending_approval: { label: 'Pending approval', cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
    approved: { label: 'Approved', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
    sync_pending: { label: 'Syncing to Tally', cls: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
    synced: { label: 'Posted to Tally', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    sync_failed: { label: 'Sync failed', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  }
  
  export const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'needs_review', label: 'Needs review' },
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'sync_pending', label: 'Syncing' },
    { value: 'synced', label: 'Posted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'sync_failed', label: 'Sync failed' },
  ]
  
  export default function StatusBadge({ status }) {
    const s = STATUS[status] ?? {
      label: status || 'Unknown',
      cls: 'bg-ink-100 text-ink-600 ring-ink-200',
      dot: 'bg-ink-400',
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.cls}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {s.label}
      </span>
    )
  }