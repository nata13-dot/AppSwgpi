import { PushNotifications } from '@capacitor/push-notifications'
import api from './api'
import { isNativeApp } from './appLock'

/*
 * Notificaciones al teléfono (Firebase). El token del teléfono se registra en la API mientras hay sesión
 * y se retira al cerrarla, para que el siguiente usuario de ese teléfono no reciba avisos ajenos.
 */
const TOKEN_KEY = 'sgpi-push-token'
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
const saveToken = (token) => { try { localStorage.setItem(TOKEN_KEY, token) } catch { /* se registrará de nuevo */ } }

/** Sólo acepta rutas internas: una notificación no debe poder abrir un sitio externo. */
export const safeNotificationPath = (url) => (typeof url === 'string' && /^\/(?!\/)/.test(url) ? url : null)

export async function registerPushDevice() {
  if (!isNativeApp()) return
  const current = await PushNotifications.checkPermissions()
  const permission = current.receive === 'prompt' ? await PushNotifications.requestPermissions() : current
  if (permission.receive !== 'granted') return
  await PushNotifications.createChannel({ id: 'sgpi', name: 'Avisos de SGPI', description: 'Avisos académicos y de tus proyectos', importance: 4, visibility: 0 })
  await PushNotifications.register()
}

export async function sendPushToken(token) {
  await api.post('/devices/push-token', { token, platform: 'android' })
  saveToken(token)
}

export async function unregisterPushDevice() {
  const token = isNativeApp() ? readToken() : null
  if (!token) return
  await api.delete('/devices/push-token', { data: { token } }).catch(() => {})
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* sin almacenamiento no hay nada que quitar */ }
}
