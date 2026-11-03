import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import api, { API_URL } from '../services/api'
import { clearCredentials, setCredentials, setUser } from '../store/store'
import { activeProfileId } from '../lib/permissions'
import { isNativeApp } from '../services/appLock'

/*
 * Sesión original del administrador general mientras simula un nivel. Vive sólo en sessionStorage:
 * al cerrar la pestaña o la app se pierde y hay que volver a iniciar sesión, igual que en el front de PHP.
 */
const VIEW_ORIGIN_KEY = 'auth_view_origin'
const readOrigin = () => {
  try { return JSON.parse(sessionStorage.getItem(VIEW_ORIGIN_KEY) || 'null') } catch { return null }
}
const withToken = (token) => ({ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
const fetchMe = (token) => axios.get(`${API_URL}/auth/me`, withToken(token)).then((response) => response.data.user)

export function useAuth() {
  const dispatch = useDispatch()
  const auth = useSelector((state) => state.auth)

  const login = useCallback(async ({ id, password, remember }) => {
    // En la app la sesión dura hasta cerrarla: se conserva en el teléfono y el token no expira por inactividad.
    const keep = remember || isNativeApp()
    const { data } = await api.post('/auth/login', { id, password, remember: keep })
    sessionStorage.removeItem(VIEW_ORIGIN_KEY)
    dispatch(setCredentials({ token: data.access_token, user: data.user, remember: keep }))
    return data.user
  }, [dispatch])

  const keepSession = useCallback(() => {
    if (auth.token) dispatch(setCredentials({ token: auth.token, user: auth.user, remember: true }))
  }, [auth.token, auth.user, dispatch])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    dispatch(setUser(data.user))
    return data.user
  }, [dispatch])

  const logout = useCallback(async () => {
    const origin = readOrigin()
    try {
      await api.post('/auth/logout')
      if (origin?.token) await axios.post(`${API_URL}/auth/logout`, null, withToken(origin.token)).catch(() => {})
    } finally {
      sessionStorage.removeItem(VIEW_ORIGIN_KEY)
      dispatch(clearCredentials())
    }
  }, [dispatch])

  const switchCareer = useCallback(async (careerId) => {
    const { data } = await api.post('/auth/switch-career', { carrera_id: Number(careerId) }, {
      headers: { 'X-SGPI-Remember': auth.remember ? '1' : '0' },
    })
    dispatch(setCredentials({ token: data.access_token, user: data.user, remember: data.remember ?? auth.remember }))
    return data.user
  }, [auth.remember, dispatch])

  /** Abre (o cambia) una simulación de sólo lectura con los permisos de otro nivel, en la carrera activa. */
  const startLevelView = useCallback(async (profileId, careerId = auth.user?.active_career?.id) => {
    const origin = readOrigin()
    const adminToken = origin?.token || auth.token
    const { data } = await axios.post(`${API_URL}/admin/view-level`, { carrera_id: careerId, perfil_id: Number(profileId) }, withToken(adminToken))
    const user = await fetchMe(data.access_token)
    // Debe ser una simulación del mismo administrador y del nivel pedido.
    if (!user?.view_as || String(user.view_as.by_id) !== String(user.id) || Number(user.view_as.simulated_profile) !== Number(profileId)) {
      throw new Error('No fue posible verificar la simulación.')
    }
    if (origin) await api.post('/auth/logout').catch(() => {})
    else sessionStorage.setItem(VIEW_ORIGIN_KEY, JSON.stringify({ token: auth.token, remember: auth.remember }))
    dispatch(setCredentials({ token: data.access_token, user, remember: false }))
    return user
  }, [auth.remember, auth.token, auth.user?.active_career?.id, dispatch])

  /** Cierra la simulación y restaura la sesión del administrador general. */
  const exitLevelView = useCallback(async () => {
    const origin = readOrigin()
    await api.post('/auth/logout').catch(() => {})
    sessionStorage.removeItem(VIEW_ORIGIN_KEY)
    if (!origin?.token) {
      dispatch(clearCredentials())
      throw new Error('La sesión del administrador ya no está disponible. Inicia sesión de nuevo.')
    }
    try {
      const user = await fetchMe(origin.token)
      dispatch(setCredentials({ token: origin.token, user, remember: origin.remember }))
      return user
    } catch {
      dispatch(clearCredentials())
      throw new Error('La sesión del administrador expiró. Inicia sesión de nuevo.')
    }
  }, [dispatch])

  const markPasswordChanged = useCallback(() => {
    dispatch(setUser({ ...auth.user, must_change_password: false }))
  }, [auth.user, dispatch])

  return {
    ...auth,
    isAuthenticated: Boolean(auth.token),
    profileId: activeProfileId(auth.user),
    login, logout, keepSession, refreshUser, switchCareer, startLevelView, exitLevelView, markPasswordChanged,
  }
}
