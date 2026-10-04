import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

const PLANS = [
  {
    name: 'Starter',
    price: '₹4,999',
    period: '/month',
    blurb: 'For small finance teams moving off manual entry.',
    cta: 'Start with Starter',
    features: [
      'Up to 200 invoices a month',
      '3 users',
      'AI extraction and GST checks',
      'Duplicate detection',
      'Two-level approvals',
      'Tally voucher sync with retries',
    ],
  },
  {
    name: 'Business',
    price: '₹14,999',
    period: '/month',
    blurb: 'For teams with several approvers and a steady bill flow.',
    cta: 'Start with Business',
    popular: true,
    features: [
      'Up to 1,500 invoices a month',
      '15 users',
      'Unlimited approval levels',
      'Email-to-invoice automation',
      'Dashboard and aging reports',
      'Reconciliation and full audit log',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    blurb: 'For groups with multiple entities and custom systems.',
    cta: 'Talk to us',
    features: [
      'Volume-based pricing',
      'Unlimited users',
      'Custom integrations (Zoho, Google Workspace)',
      'Dedicated onboarding and training',
      'Priority support with an SLA',
    ],
  },
]

const FAQS = [
  {
    q: 'Which Tally versions does it work with?',
    a: 'BillFlow posts vouchers through Tally Prime\'s XML import interface over HTTP, so Tally needs to be open with the target company loaded and the HTTP port enabled. We recommend a test company first, then your live one.',
  },
  {
    q: 'What happens if Tally is closed or offline?',
    a: 'Approved bills wait in a sync queue. BillFlow retries with increasing delays, up to five attempts, and a bill is never posted twice. Anything that still fails is flagged in the reconciliation view, and an admin can retry it with one click.',
  },
  {
    q: 'How accurate is the AI extraction?',
    a: 'Every bill gets a confidence score and goes through GST and arithmetic checks. If anything looks off, such as an invalid GSTIN, totals that do not add up or a low score, the bill goes to a review queue instead of the approval chain. Accuracy depends on scan quality, so measure it on a sample of your own bills before going live.',
  },
  {
    q: 'Can someone approve a bill they uploaded?',
    a: 'No. The uploader is excluded from that invoice\'s approval chain, and rejecting always needs a written reason. Both rules are enforced on the server, not just hidden in the interface.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Invoices and records live in your own database and file storage. For extraction, the document is sent to the AI model provider, so for real vendor bills use a paid API tier whose terms exclude training on your data, and keep demo or free-tier use to sample invoices.',
  },
  {
    q: 'Do I need to set anything up in Tally first?',
    a: 'Yes. The ledgers BillFlow posts to, such as your purchase account, the input CGST, SGST and IGST ledgers, round off and each vendor\'s ledger, must exist in Tally with matching names. If one is missing, Tally rejects the voucher and the bill shows up as a sync failure with the reason.',
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-16 bg-ink-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">Pricing</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Simple plans that scale with your bills
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-500 sm:text-lg">
            Pay for the invoice volume you process, not for every seat in the building.
          </p>
          <p className="mt-2 text-xs text-ink-400">Illustrative pricing for this demo project.</p>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-3xl p-8 ${
                plan.popular
                  ? 'bg-ink-950 text-white shadow-2xl shadow-brand-500/20 ring-1 ring-brand-400/40 lg:-my-4 lg:py-12'
                  : 'border border-ink-200 bg-white text-ink-900 shadow-sm'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1 text-xs font-semibold text-white shadow-lg shadow-brand-500/30">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className={`mt-1 text-sm ${plan.popular ? 'text-ink-300' : 'text-ink-500'}`}>{plan.blurb}</p>

              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className={`text-sm ${plan.popular ? 'text-ink-400' : 'text-ink-500'}`}>{plan.period}</span>
                )}
              </p>

              <ul className="mt-7 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check
                      className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${plan.popular ? 'text-brand-300' : 'text-brand-600'}`}
                      strokeWidth={2.5}
                    />
                    <span className={plan.popular ? 'text-ink-200' : 'text-ink-600'}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className={`mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                  plan.popular
                    ? 'bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-lg shadow-brand-500/30 hover:brightness-110'
                    : 'bg-ink-900 text-white hover:bg-ink-800'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-brand-600">FAQ</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Questions finance teams ask first
          </h2>
        </div>

        <div className="mt-12 divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-white">
          {FAQS.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-[15px] font-semibold text-ink-900 sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-ink-400 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-brand-600' : ''
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-500">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}