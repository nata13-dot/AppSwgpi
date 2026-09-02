import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'https://apiswgpi-production-0e59.up.railway.app/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
})

let refreshPromise = null

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = ['/auth/login', '/auth/refresh', '/auth/logout'].some((path) => original?.url?.includes(path))
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')

    if (error.response?.status === 401 && token && !isAuthEndpoint && !original?._retried) {
      original._retried = true
      try {
        refreshPromise ||= axios.post(`${API_URL}/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }).finally(() => { refreshPromise = null })
        const { data } = await refreshPromise
        const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage
        storage.setItem('auth_token', data.access_token)
        if (data.user) storage.setItem('auth_user', JSON.stringify(data.user))
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        // The refresh response is terminal; the cleanup below handles the session.
      }
    }

    if (error.response?.status === 401 && !original?.url?.includes('/auth/login')) {
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem('auth_token')
        storage.removeItem('auth_user')
      }
      if (window.location.pathname !== '/login') window.location.assign('/login?expired=1')
    }
    return Promise.reject(error)
  },
)

export const apiError = (error) => {
  if (!error?.response && !error?.request && error?.message) return error.message
  if (error.code === 'ECONNABORTED') return 'La solicitud tardó demasiado. Revisa tu conexión e intenta de nuevo.'
  if (error.request && !error.response) {
    return 'No hubo respuesta de la API. En la app móvil puede deberse a conexión o CORS del servidor.'
  }
  const data = error.response?.data
  if (data?.errors) return Object.values(data.errors).flat().join(' ')
  return data?.error || data?.message || 'No fue posible completar la solicitud.'
}

export const unwrapCollection = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.data)) return payload.data.data
  return []
}

export default api
