import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../services/api'
import { clearCredentials, setCredentials, setUser } from '../store/store'

export const activeProfileId = (user) => Number(user?.active_profile_id ?? user?.perfil_id)
export const roleFromUser = (user) => ({
  1: 'admin', 2: 'teacher', 3: 'student', 4: 'admin', 5: 'admin', 6: 'assistant', 7: 'coordinator',
})[activeProfileId(user)] || 'student'
export const roleLabel = (user) => ({
  1: 'Administrador',
  2: 'Docente',
  3: 'Estudiante',
  4: 'Administrador general',
  5: 'Jefe de Carrera',
  6: 'Asistente de Jefe de Carrera',
  7: 'Coordinador de Proyectos',
})[activeProfileId(user)] || 'Usuario'
export const isProjectManagementRole = (role) => ['admin', 'assistant', 'coordinator'].includes(role)
export const isAcademicManagementRole = (role) => ['admin', 'assistant'].includes(role)
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

  const switchCareer = useCallback(async (careerId) => {
    const { data } = await api.post('/auth/switch-career', { carrera_id: Number(careerId) }, {
      headers: { 'X-SGPI-Remember': auth.remember ? '1' : '0' },
    })
    dispatch(setCredentials({ token: data.access_token, user: data.user, remember: data.remember ?? auth.remember }))
    return data.user
  }, [auth.remember, dispatch])

  return { ...auth, isAuthenticated: Boolean(auth.token), login, logout, refreshUser, switchCareer }
}
