import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, BadgeCheck, CheckCircle2, FileText, History,
  Loader2, ShieldCheck, Sparkles, Zap,
} from 'lucide-react'

const TRUST = ['Tally Prime XML', 'GST-aware checks', 'Full audit trail']

const STEPS = [
  { label: 'AI extraction', sub: 'Fields read from the PDF', icon: Sparkles },
  { label: 'Approved', sub: 'Finance Head · Level 2', icon: ShieldCheck },
  { label: 'Posted to Tally', sub: 'Voucher AP-2041 created', icon: Zap },
]

const FIELDS = [
  ['Vendor', 'Sharma Building Materials'],
  ['GSTIN', '03ABCDE1234F1Z5'],
  ['Invoice no.', 'INV-2041'],
  ['Date', '12 Sep 2026'],
]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
})

function Pipeline() {
  // 0-2 = us step pe kaam chal raha hai, 3 = sab complete
  const [active, setActive] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % 4), 1700)
    return () => clearInterval(t)
  }, [])

  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => {
        const done = i < active
        const current = i === active
        const Icon = step.icon
        return (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all duration-500 ${
                done
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                  : current
                    ? 'border-brand-400/50 bg-brand-500/20 text-brand-200'
                    : 'border-white/10 bg-white/5 text-ink-500'
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-[18px] w-[18px]" />
              ) : current ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <Icon className="h-[18px] w-[18px]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold transition-colors ${done || current ? 'text-white' : 'text-ink-500'}`}>
                {step.label}
              </p>
              <p className="truncate text-xs text-ink-400">{step.sub}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-500 ${
                done
                  ? 'bg-emerald-400/15 text-emerald-300'
                  : current
                    ? 'bg-brand-500/20 text-brand-200'
                    : 'bg-white/5 text-ink-500'
              }`}
            >
              {done ? 'Done' : current ? 'In progress' : 'Waiting'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[480px]">
      {/* glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-500/30 via-violet-500/20 to-cyan-400/20 blur-3xl" />

      <motion.div
        {...fadeUp(0.25)}
        className="glass rounded-3xl p-5 shadow-2xl shadow-black/40 sm:p-6"
      >
        {/* header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-brand-200">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">invoice_2041.pdf</p>
              <p className="text-xs text-ink-400">Received via email · just now</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <BadgeCheck className="h-3.5 w-3.5" />
            98% confidence
          </span>
        </div>

        {/* extracted fields */}
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/5 bg-ink-950/40 p-4">
          {FIELDS.map(([label, value], i) => (
            <motion.div key={label} {...fadeUp(0.5 + i * 0.12)}>
              <p className="text-[11px] uppercase tracking-wider text-ink-500">{label}</p>
              <p className="mt-0.5 truncate font-mono text-[13px] text-ink-100">{value}</p>
            </motion.div>
          ))}
          <motion.div {...fadeUp(1)} className="col-span-2 flex items-end justify-between border-t border-white/5 pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-500">Total payable</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-white">₹1,24,500.00</p>
            </div>
            <p className="font-mono text-[11px] text-ink-400">CGST 9% · SGST 9%</p>
          </motion.div>
        </div>

        {/* pipeline */}
        <div className="mt-5">
          <Pipeline />
        </div>
      </motion.div>

      {/* floating chips */}
      <motion.div
        {...fadeUp(1.1)}
        className="absolute -left-4 top-10 hidden animate-float sm:block lg:-left-10"
      >
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white shadow-xl shadow-black/30">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          GSTIN verified
        </div>
      </motion.div>

      <motion.div
        {...fadeUp(1.3)}
        className="absolute -right-3 top-1/2 hidden animate-float [animation-delay:1.5s] sm:block lg:-right-10"
      >
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white shadow-xl shadow-black/30">
          <CheckCircle2 className="h-4 w-4 text-brand-300" />
          No duplicate found
        </div>
      </motion.div>

      <motion.div
        {...fadeUp(1.5)}
        className="absolute -bottom-5 left-6 hidden animate-float [animation-delay:3s] sm:block lg:left-2"
      >
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white shadow-xl shadow-black/30">
          <History className="h-4 w-4 text-violet-300" />
          Audit entry logged
        </div>
      </motion.div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink-950 pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* background layers */}
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -top-40 left-1/2 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[120px]" />
      <div className="absolute top-40 -right-40 -z-10 h-[360px] w-[360px] rounded-full bg-violet-600/20 blur-[110px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* copy */}
        <div className="text-center lg:text-left">
          <motion.div {...fadeUp(0)}>
            <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-brand-200">
              <Sparkles className="h-3.5 w-3.5" />
              AI-powered accounts payable for Tally teams
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp(0.1)}
            className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.6rem]"
          >
            Vendor bills in.
            <br />
            <span className="text-gradient">Tally vouchers out.</span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.2)}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg lg:mx-0"
          >
            BillFlow reads every invoice with AI, checks it for GST errors and duplicates,
            routes it to the right approver, and posts the voucher to Tally. No retyping,
            no chasing, a full audit trail on every rupee.
          </motion.p>

          <motion.div
            {...fadeUp(0.3)}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link
              to="/login"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-brand-500/30 transition hover:shadow-brand-500/50 hover:brightness-110 sm:w-auto"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="glass inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              See how it works
            </a>
          </motion.div>

          <motion.ul
            {...fadeUp(0.42)}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start"
          >
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-ink-400">
                <CheckCircle2 className="h-4 w-4 text-brand-400" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* visual */}
        <ProductMockup />
      </div>
    </section>
  )
}