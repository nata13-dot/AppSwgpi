import { useEffect } from 'react'
import { PushNotifications } from '@capacitor/push-notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../hooks/useAuth'
import { isNativeApp } from '../../services/appLock'
import { registerPushDevice, safeNotificationPath, sendPushToken } from '../../services/pushNotifications'

/** Conecta las notificaciones del teléfono con la sesión: registra el token, avisa en primer plano y abre la pantalla al tocarlas. */
export default function PushNotificationsBridge() {
  const { token: session } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const active = isNativeApp() && Boolean(session)

  useEffect(() => {
    if (!active) return undefined
    const handles = [
      PushNotifications.addListener('registration', ({ value }) => { sendPushToken(value).catch(() => {}) }),
      // Con la app abierta Android no la muestra: se avisa dentro de la app.
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        if (notification.title) toast.info(notification.title)
        client.invalidateQueries({ queryKey: ['activity-notifications'] })
      }),
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const path = safeNotificationPath(notification.data?.url)
        if (path) navigate(path)
      }),
    ]
    registerPushDevice().catch(() => {})
    return () => { handles.forEach((handle) => handle.then((listener) => listener.remove())) }
  }, [active, client, navigate])

  return null
}
