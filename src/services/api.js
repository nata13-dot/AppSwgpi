import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
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
