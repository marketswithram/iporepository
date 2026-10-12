import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }) {
  const { loading, isAuthenticated, profile, isAdmin } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isAdmin && profile && profile.is_approved === false) {
    return <Navigate to="/pending-approval" replace />
  }
  return children
}

export function AdminRoute({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!isAdmin) return <Navigate to="/user/dashboard" replace />
  return children
}

export function PublicOnlyRoute({ children }) {
  const { loading, isAuthenticated, isAdmin, profile } = useAuth()
  if (loading) return <LoadingScreen />
  if (isAuthenticated) {
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />
    if (profile && profile.is_approved === false) return <Navigate to="/pending-approval" replace />
    return <Navigate to="/user/dashboard" replace />
  }
  return children
}
