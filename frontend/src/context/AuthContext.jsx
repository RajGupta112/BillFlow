import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authApi, tokenStore } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()))   // token hai to pehle verify karo

  // Page refresh par token se user wapas laao
  useEffect(() => {
    if (!tokenStore.get()) return
    authApi.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  // Token expire hone par axios ye event bhejta hai
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email.trim().toLowerCase(), password)
    tokenStore.set(data.access_token)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isApprover: user?.role === 'approver' || user?.role === 'admin',
  }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <div className="h-9 w-9 rounded-full border-[3px] border-brand-200 border-t-brand-600 animate-spin" />
    </div>
  )
}

/**
 * Routes me wrapper ki tarah lagega:
 *   <Route element={<ProtectedRoute />}> ... </Route>
 *   <Route element={<ProtectedRoute roles={['admin']} />}> ... </Route>
 */
export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />
  return <Outlet />
}