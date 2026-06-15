import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../services/api'
import { clearCredentials, setCredentials, setUser } from '../store/store'

export const roleFromUser = (user) => ({ 1: 'admin', 2: 'teacher', 3: 'student' })[user?.perfil_id] || 'student'
export const roleLabel = (user) => ({ 1: 'Administrador', 2: 'Docente', 3: 'Estudiante' })[user?.perfil_id] || 'Usuario'
export const homeForUser = (user) => `/${roleFromUser(user)}`

export function useAuth() {
  const dispatch = useDispatch()
  const auth = useSelector((state) => state.auth)

  const login = useCallback(async ({ id, password, remember }) => {
    const { data } = await api.post('/auth/login', { id, password, remember })
    dispatch(setCredentials({ token: data.access_token, user: data.user, remember }))
    return data.user
  }, [dispatch])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    dispatch(setUser(data.user))
    return data.user
  }, [dispatch])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } finally { dispatch(clearCredentials()) }
  }, [dispatch])

  return { ...auth, isAuthenticated: Boolean(auth.token), login, logout, refreshUser }
}
