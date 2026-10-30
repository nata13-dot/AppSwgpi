import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { noticesForUser } from '../../lib/notices'
import { applyTheme, resolveTheme } from '../../lib/theme'

/**
 * Ajustes públicos del sistema (Frontend_Swgpi/includes/footer.php): tema por omisión, escala de letra,
 * modo en grises, avisos emergentes y cierre por inactividad para sesiones que no se recuerdan.
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

  useEffect(() => { applyTheme(resolveTheme(settings?.default_theme)) }, [settings?.default_theme])

  useEffect(() => {
    if (!settings) return
    document.documentElement.style.fontSize = `${Number(settings.font_scale || 100)}%`
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
