import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { activeProfileId, roleFromUser, useAuth } from '../../hooks/useAuth'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />
}

export function RoleRoute({ role }) {
  const { user } = useAuth()
  return roleFromUser(user) === role ? <Outlet /> : <Navigate to={`/${roleFromUser(user)}`} replace />
}

export function GeneralAdminRoute() {
  const { user } = useAuth()
  return activeProfileId(user) === 4 ? <Outlet /> : <Navigate to={`/${roleFromUser(user)}`} replace />
}

export function GuestRoute() {
  const { isAuthenticated, user } = useAuth()
  return isAuthenticated ? <Navigate to={`/${roleFromUser(user)}`} replace /> : <Outlet />
}
