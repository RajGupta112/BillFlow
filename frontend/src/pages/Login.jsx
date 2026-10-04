import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/client'
import { Logo } from '../components/landing/Navbar'

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@demo.com', password: 'Admin@1234' },
  { label: 'Finance Head', email: 'finance@demo.com', password: 'Finance@1234' },
  { label: 'Manager', email: 'manager@demo.com', password: 'Manager@1234' },
  { label: 'Clerk', email: 'clerk@demo.com', password: 'Clerk@1234' },
]

const POINTS = [
  'AI reads every invoice and flags GST errors',
  'Approvals route by amount, with a full audit trail',
  'Approved bills post to Tally automatically',
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign in'))
    } finally {
      setSubmitting(false)
    }
  }

  function fillDemo(account) {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* brand panel */}
      <aside className="relative isolate hidden overflow-hidden bg-ink-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top_left,black_25%,transparent_75%)]" />
        <div className="absolute -left-20 top-1/4 -z-10 h-[420px] w-[420px] rounded-full bg-brand-600/30 blur-[110px]" />
        <div className="absolute -bottom-24 right-0 -z-10 h-[320px] w-[320px] rounded-full bg-violet-600/20 blur-[100px]" />

        <Logo />

        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white">
            Vendor bills in. <span className="text-gradient">Tally vouchers out.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-ink-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-ink-500">Accounts payable automation for Tally teams</p>
      </aside>

      {/* form */}
      <main className="flex flex-col bg-ink-50 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="lg:hidden [&_span:last-child]:!text-ink-900">
            <Logo />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900">Welcome back</h1>
            <p className="mt-2 text-ink-500">Sign in to review, approve and post invoices.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-ink-200 bg-white py-3 pl-11 pr-4 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-ink-200 bg-white py-3 pl-11 pr-12 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-400 transition-colors hover:text-ink-700"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            {/* demo accounts: real deployment se pehle hata dena */}
            <div className="mt-8 rounded-2xl border border-dashed border-ink-300 bg-white/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Demo accounts · click to fill
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => fillDemo(a)}
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {a.label}
                    <span className="block truncate text-xs font-normal text-ink-400">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}