import { motion } from 'framer-motion'
import { CheckCheck, Inbox, ScanSearch, Send } from 'lucide-react'

const STEPS = [
  {
    icon: Inbox,
    title: 'Bills arrive',
    text: 'Vendors email invoices to a shared inbox or your team uploads them in the app. An n8n workflow forwards every attachment to BillFlow automatically.',
    note: 'Email · Upload · Webhook',
  },
  {
    icon: ScanSearch,
    title: 'AI reads and checks',
    text: 'Fields are extracted, GSTIN and totals are verified, duplicates are caught. Anything doubtful lands in a review queue with the exact reason.',
    note: 'Extraction · GST checks · Duplicates',
  },
  {
    icon: CheckCheck,
    title: 'The right people approve',
    text: 'Approvers see the bill beside the extracted data and approve or reject with a comment. Higher amounts move up the chain on their own.',
    note: 'Limits · Comments · Audit',
  },
  {
    icon: Send,
    title: 'Voucher posts to Tally',
    text: 'The approved bill becomes a purchase voucher in Tally Prime. If Tally is unavailable, it waits in the queue and retries until it lands.',
    note: 'Queue · Retries · Reconciliation',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative isolate scroll-mt-16 overflow-hidden bg-ink-950 py-24 sm:py-32">
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="absolute left-1/2 top-1/3 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-[130px]" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-300">How it works</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            From inbox to ledger in four steps
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-300 sm:text-lg">
            Humans stay in charge of decisions. BillFlow handles the typing, checking and posting.
          </p>
        </div>

        <div className="relative mt-16">
          {/* connecting line (desktop) */}
          <div className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-gradient-to-r from-brand-500/0 via-brand-400/50 to-brand-500/0 lg:block" />

          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.li
                  key={s.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                  className="relative"
                >
                  <div className="relative z-10 mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-xl shadow-brand-500/30 ring-8 ring-ink-950 lg:mx-0 lg:ml-1/2">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                    <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-bold text-ink-900">
                      {i + 1}
                    </span>
                  </div>

                  <div className="glass mt-6 h-[calc(100%-2.5rem)] rounded-2xl p-6 text-center transition-colors duration-300 hover:bg-white/[0.08] lg:text-left">
                    <h3 className="text-lg font-bold text-white">{s.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-300">{s.text}</p>
                    <p className="mt-4 font-mono text-xs text-brand-300">{s.note}</p>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}