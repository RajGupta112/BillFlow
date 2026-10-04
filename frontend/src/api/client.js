import axios from 'axios'

const TOKEN_KEY = 'billflow_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// Vite proxy /api ko backend (port 8000) pe bhejta hai
const api = axios.create({ baseURL: '' })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginCall = error.config?.url?.includes('/api/auth/login')
    if (error.response?.status === 401 && !isLoginCall) {
      tokenStore.clear()
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(error)
  },
)

/** Backend ke alag-alag error shapes se readable message nikalta hai. */
export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (!error?.response) {
    return error?.code === 'ERR_NETWORK'
      ? 'Cannot reach the server. Is the backend running?'
      : error?.message || fallback
  }
  const detail = error.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(', ')   // 422 validation
  if (detail?.message) return detail.message                              // duplicate upload
  return fallback
}

// ---------- formatting helpers (backend amounts string me aate hain) ----------

export const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))

export function formatINR(value, { compact = false } = {}) {
  const n = num(value)
  if (n === null || Number.isNaN(n)) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(n)
}

export function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ---------- endpoints ----------

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', new URLSearchParams({ username: email, password }))
      .then((r) => r.data),
  me: () => api.get('/api/auth/me').then((r) => r.data),
}

export const invoiceApi = {
  list: (params) => api.get('/api/invoices', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/invoices/${id}`).then((r) => r.data),
  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/invoices/upload', form, {
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    }).then((r) => r.data)
  },
  // PDF/image ko blob banake dete hain, kyunki <iframe src> token header nahi bhej sakta
  fileBlob: (id) =>
    api.get(`/api/invoices/${id}/file`, { responseType: 'blob' }).then((r) => r.data),
  edit: (id, body) => api.patch(`/api/invoices/${id}`, body).then((r) => r.data),
  submit: (id, overrideDuplicate = false) =>
    api.post(`/api/invoices/${id}/submit`, null, {
      params: { override_duplicate: overrideDuplicate },
    }).then((r) => r.data),
  discard: (id, reason) =>
    api.post(`/api/invoices/${id}/discard`, { reason }).then((r) => r.data),
}

export const approvalApi = {
  mine: () => api.get('/api/approvals/mine').then((r) => r.data),
  approve: (id, comment) =>
    api.post(`/api/approvals/${id}/approve`, { comment }).then((r) => r.data),
  reject: (id, comment) =>
    api.post(`/api/approvals/${id}/reject`, { comment }).then((r) => r.data),
}

export const vendorApi = {
  list: () => api.get('/api/vendors').then((r) => r.data),
}

export const dashboardApi = {
  summary: () => api.get('/api/dashboard/summary').then((r) => r.data),
}

export const opsApi = {
  syncStatus: () => api.get('/api/sync/status').then((r) => r.data),
  syncQueue: (params) => api.get('/api/sync/queue', { params }).then((r) => r.data),
  retrySync: (id) => api.post(`/api/sync/${id}/retry`).then((r) => r.data),
  reconciliation: () => api.get('/api/reconciliation').then((r) => r.data),
  audit: (params) => api.get('/api/audit', { params }).then((r) => r.data),
}

export default api