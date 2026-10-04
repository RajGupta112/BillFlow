import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckSquare, FileText, History, LayoutDashboard, LogOut, Menu, Scale, UploadCloud, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { approvalApi, opsApi } from '../api/client'
import { Logo } from './landing/Navbar'

const APPROVER_ROLES = ['approver', 'admin']

const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: APPROVER_ROLES },
  { to: '/app/upload', label: 'Upload invoice', icon: UploadCloud },
  { to: '/app/invoices', label: 'Invoices', icon: FileText },
  { to: '/app/approvals', label: 'My approvals', icon: CheckSquare, roles: APPROVER_ROLES, badge: true },
  { to: '/app/reconciliation', label: 'Reconciliation', icon: Scale, roles: APPROVER_ROLES },
  { to: '/app/audit', label: 'Audit log', icon: History, roles: ['admin'] },
]

const ROLE_LABEL = { admin: 'Admin', approver: 'Approver', uploader: 'Uploader' }

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}

function Sidebar({ onNavigate }) {
  const { user, logout, isApprover } = useAuth()

  const { data: pending } = useQuery({
    queryKey: ['my-approvals'],
    queryFn: approvalApi.mine,
    enabled: isApprover,
    refetchInterval: 30_000,
  })
  const pendingCount = pending?.length ?? 0

  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role))

  return (
    <div className="flex h-full flex-col bg-ink-950 text-white">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-brand-500/25 to-violet-500/10 text-white ring-1 ring-brand-400/30'
                  : 'text-ink-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && pendingCount > 0 && (
              <span className="grid min-w-[22px] place-items-center rounded-full bg-brand-500 px-1.5 text-xs font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-sm font-bold text-white">
            {initials(user.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user.full_name}</p>
            <p className="truncate text-xs text-ink-400">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  )
}

function TallyStatus() {
  const { isApprover } = useAuth()
  const { data, isError } = useQuery({
    queryKey: ['sync-status'],
    queryFn: opsApi.syncStatus,
    enabled: isApprover,
    refetchInterval: 30_000,
  })
  if (!isApprover) return null

  const running = Boolean(data?.tally_running) && !isError
  const failed = data?.queue_counts?.failed ?? 0

  return (
    <div
      title={running ? 'Tally is reachable' : 'Tally is not reachable. Approved bills will queue and retry.'}
      className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:inline-flex ${
        running
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${running ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {running ? 'Tally connected' : 'Tally offline'}
      {failed > 0 && <span className="text-red-600">· {failed} failed</span>}
    </div>
  )
}

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  // Page badalte hi mobile drawer band
  useEffect(() => setDrawer(false), [location.pathname])

  const current = NAV.find((n) => location.pathname.startsWith(n.to))
  const title = location.pathname.startsWith('/app/invoices/') ? 'Invoice details' : current?.label ?? 'BillFlow'

  return (
    <div className="min-h-screen bg-ink-50">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
              className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawer(false)}
                className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-ink-300 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/80 px-4 backdrop-blur-xl sm:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="grid h-10 w-10 place-items-center rounded-lg text-ink-700 hover:bg-ink-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="flex-1 truncate text-lg font-bold tracking-tight text-ink-900">{title}</h1>

          <TallyStatus />
          <span className="hidden text-sm text-ink-500 md:block">{user.full_name}</span>
        </header>

        <main className="px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}