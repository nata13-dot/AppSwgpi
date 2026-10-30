import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { homePath, mustChangePassword } from '../../lib/permissions'

export function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (mustChangePassword(user)) return <Navigate to="/change-password" replace />
  return <Outlet />
}

/** Permite la ruta sólo si `allow(user)` es verdadero; si no, regresa al inicio del perfil. */
export function Require({ allow, children }) {
  const { user } = useAuth()
  if (!allow(user)) return <Navigate to={homePath(user)} replace />
  return children ?? <Outlet />
}

export function GuestRoute() {
  const { isAuthenticated, user } = useAuth()
  return isAuthenticated ? <Navigate to={homePath(user)} replace /> : <Outlet />
}
