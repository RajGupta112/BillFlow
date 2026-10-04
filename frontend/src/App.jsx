import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AppLayout from './components/AppLayout'
import { ProtectedRoute, useAuth } from './context/AuthContext'

import Upload from './pages/Upload'
import InvoiceList from './pages/InvoiceList'
import InvoiceDetail from './pages/InvoiceDetail'
import Dashboard from './pages/Dashboard'
import MyApprovals from './pages/MyApprovals'
import Reconciliation from './pages/Reconciliation'
import AuditLog from './pages/AuditLog'

// /app khulne par role ke hisaab se sahi page
function HomeRedirect() {
  const { isApprover } = useAuth()
  return <Navigate to={isApprover ? '/app/dashboard' : '/app/invoices'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="upload" element={<Upload />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />

          <Route element={<ProtectedRoute roles={['approver', 'admin']} />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="approvals" element={<MyApprovals />} />
            <Route path="reconciliation" element={<Reconciliation />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="audit" element={<AuditLog />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}