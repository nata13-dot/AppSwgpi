import { useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { registerPlugin } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { viewAs } from '../../lib/permissions'
import { isNativeApp } from '../../services/appLock'
import { safeNotificationPath } from '../../services/pushNotifications'
import { LIVE_EVENT } from './LiveSync'

/** Widget de la pantalla de inicio (HomeWidgetPlugin.java). */
const HomeWidget = registerPlugin('HomeWidget')
const REFRESH_MS = 10 * 60 * 1000

/**
 * Mantiene al día el widget con /widget mientras la app está abierta y al volver a ella, lo vacía al cerrar
 * sesión y abre la pantalla del cuadro que se tocó. Una simulación "ver como" no lo actualiza.
 */
export default function HomeWidgetBridge() {
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const native = isNativeApp()
  const active = native && Boolean(token) && !viewAs(user)

  useEffect(() => {
    if (!native) return undefined
    const go = (path) => { const safe = safeNotificationPath(path); if (safe) navigate(safe) }
    HomeWidget.takeLaunchPath().then(({ path }) => go(path)).catch(() => {})
    const listener = HomeWidget.addListener('open', ({ path }) => go(path))
    return () => { listener.then((handle) => handle.remove()) }
  }, [native, navigate])

  useEffect(() => {
    if (!native) return undefined
    if (!token) {
      HomeWidget.clear().catch(() => {})
      return undefined
    }
    if (!active) return undefined
    const refresh = () => api.get('/widget')
      .then((response) => HomeWidget.update({ data: response.data }))
      .catch(() => {})
    refresh()
    const timer = setInterval(refresh, REFRESH_MS)
    const resume = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) refresh() })
    // Si el pulso detecta un cambio (una solicitud nueva, una entrega…), el widget se pone al día de inmediato.
    window.addEventListener(LIVE_EVENT, refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener(LIVE_EVENT, refresh)
      resume.then((handle) => handle.remove())
    }
  }, [native, token, active])

  return null
}
