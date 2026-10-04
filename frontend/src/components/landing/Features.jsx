import { motion } from 'framer-motion'
import { BadgeCheck, Copy, History, Layers, RefreshCw, ScanText } from 'lucide-react'

const STATS = [
  { value: '3', label: 'duplicate checks on every bill' },
  { value: '15-char', label: 'GSTIN checksum verified' },
  { value: '5', label: 'auto-retries if Tally is down' },
  { value: '100%', label: 'of actions in the audit trail' },
]

const FEATURES = [
  {
    icon: ScanText,
    title: 'AI invoice extraction',
    text: 'Drop in a PDF or photo and BillFlow reads vendor, GSTIN, dates, tax split and line items. Low-confidence reads go to a human, not straight into your books.',
    tags: ['PDF & images', 'Line items', 'Confidence score'],
  },
  {
    icon: BadgeCheck,
    title: 'GST-aware validation',
    text: 'Every GSTIN is checked for format and checksum. Subtotal plus tax must match the total, and CGST/SGST cannot be mixed with IGST.',
    tags: ['GSTIN checksum', 'Tax math', 'Review queue'],
  },
  {
    icon: Copy,
    title: 'Duplicate protection',
    text: 'The same file, the same invoice number, or the same vendor, date and amount is flagged before anyone approves it. Overrides are admin-only and logged.',
    tags: ['File hash', 'Invoice no.', 'Date + amount'],
  },
  {
    icon: Layers,
    title: 'Multi-level approvals',
    text: 'The approval chain builds itself from each approver\'s limit, so a Rs 30,000 bill and a Rs 20 lakh bill take different paths. Nobody approves their own upload.',
    tags: ['Amount-based', 'Segregation of duties', 'Reject with reason'],
  },
  {
    icon: RefreshCw,
    title: 'Reliable Tally sync',
    text: 'Approved bills enter a queue and post to Tally as purchase vouchers. If Tally is closed or offline, BillFlow retries with backoff and never posts the same voucher twice.',
    tags: ['Retry queue', 'Idempotent', 'Tally Prime XML'],
  },
  {
    icon: History,
    title: 'Audit and reconciliation',
    text: 'Who uploaded, edited, approved or rejected what, and when. A reconciliation view surfaces stuck, failed or mismatched bills before month-end does.',
    tags: ['Immutable log', 'Recon report', 'Usage tracking'],
  },
]

export function StatsStrip() {
  return (
    <section className="border-y border-white/5 bg-ink-950">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-8 px-5 py-10 sm:px-8 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="text-center lg:border-l lg:border-white/10 lg:first:border-l-0"
          >
            <p className="text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl">{s.value}</p>
            <p className="mx-auto mt-1.5 max-w-[11rem] text-sm text-ink-400">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default function Features() {
  return (
    <section id="features" className="relative scroll-mt-16 bg-ink-50 py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">Features</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Everything between the inbox and the ledger
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-500 sm:text-lg">
            Built for finance teams who run on Tally and are tired of retyping bills, chasing
            approvals and explaining mismatches.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: (i % 3) * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-500/10"
              >
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-100 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-lg shadow-brand-500/25">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>

                <h3 className="relative mt-5 text-lg font-bold text-ink-900">{f.title}</h3>
                <p className="relative mt-2 text-[15px] leading-relaxed text-ink-500">{f.text}</p>

                <ul className="relative mt-5 flex flex-wrap gap-2">
                  {f.tags.map((t) => (
                    <li key={t} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">
                      {t}
                    </li>
                  ))}
                </ul>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}