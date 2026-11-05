import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { noticesForUser } from '../../lib/notices'
import { setAppearance } from '../../lib/theme'

/**
 * Ajustes públicos del sistema (Frontend_Swgpi/includes/footer.php): modo en grises, avisos emergentes y cierre
 * por inactividad para sesiones que no se recuerdan. También trae la apariencia guardada en la cuenta.
 */
export default function SystemPreferences() {
  const { user, remember, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.get('/settings/public').then((response) => response.data),
    staleTime: 300_000,
    refetchInterval: 300_000,
  })
  const settings = query.data

  const appearance = useQuery({
    queryKey: ['appearance', user?.id],
    queryFn: () => api.get('/appearance').then((response) => response.data.data),
    enabled: Boolean(isAuthenticated && user?.id),
    staleTime: Infinity,
  })
  useEffect(() => {
    if (appearance.data) setAppearance({ theme: appearance.data.theme, fontScale: appearance.data.font_scale })
  }, [appearance.data])

  useEffect(() => {
    if (!settings) return
    document.documentElement.classList.toggle('grayscale-mode', Boolean(settings.grayscale_mode))
  }, [settings])

  useEffect(() => {
    if (!settings?.system_notices) return
    let shown
    try { shown = new Set(JSON.parse(sessionStorage.getItem('shown_system_notices') || '[]')) } catch { shown = new Set() }
    noticesForUser(settings.system_notices, isAuthenticated ? user : null).forEach((notice) => {
      if (shown.has(notice.id)) return
      toast(notice.message, { type: notice.type === 'danger' ? 'error' : notice.type || 'info', autoClose: Number(notice.duration_seconds || 4) * 1000 })
      shown.add(notice.id)
    })
    sessionStorage.setItem('shown_system_notices', JSON.stringify([...shown]))
  }, [isAuthenticated, settings, user])

  useEffect(() => {
    const minutes = Number(settings?.session_timeout_minutes || 30)
    if (!isAuthenticated || remember || minutes <= 0) return undefined
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await logout().catch(() => {})
        navigate('/login?expired=1', { replace: true })
      }, minutes * 60_000)
    }
    const events = ['click', 'keydown', 'scroll', 'touchstart']
    events.forEach((name) => window.addEventListener(name, reset, { passive: true }))
    reset()
    return () => { clearTimeout(timer); events.forEach((name) => window.removeEventListener(name, reset)) }
  }, [isAuthenticated, logout, navigate, remember, settings?.session_timeout_minutes])

  return null
}
