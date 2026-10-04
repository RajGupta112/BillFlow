import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Logo } from './Navbar'

export function CtaBand() {
  return (
    <section className="bg-white px-5 pb-24 sm:px-8 sm:pb-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
        className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl bg-ink-950 px-6 py-16 text-center sm:px-12 sm:py-20"
      >
        <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
        <div className="absolute -top-32 left-1/2 -z-10 h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-brand-600/40 blur-[110px]" />

        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Stop retyping bills. <span className="text-gradient">Start closing faster.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">
          Upload a sample invoice and watch it become an approved, audit-ready Tally voucher.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-ink-900 transition hover:bg-brand-50 sm:w-auto"
          >
            Get started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how-it-works"
            className="glass inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
          >
            See how it works
          </a>
        </div>
      </motion.div>
    </section>
  )
}

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'AI extraction', href: '#features' },
      { label: 'Approvals', href: '#features' },
      { label: 'Tally sync', href: '#features' },
      { label: 'Audit trail', href: '#features' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
              AI-powered accounts payable for teams that run on Tally. Read, check, approve and post,
              with an audit trail behind every voucher.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-ink-400 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-ink-500 sm:flex-row">
          <p>© {new Date().getFullYear()} BillFlow. All rights reserved.</p>
          <p>Built with FastAPI, PostgreSQL, React and Tally Prime.</p>
        </div>
      </div>
    </footer>
  )
}