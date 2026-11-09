import { registerPlugin } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import api from './api'
import { isNativeApp } from './appLock'

/*
 * Notificaciones al teléfono (Firebase). El token del teléfono se registra en la API mientras hay sesión
 * y se retira al cerrarla, para que el siguiente usuario de ese teléfono no reciba avisos ajenos.
 */
const TOKEN_KEY = 'sgpi-push-token'
/** Tono y vibración de las notificaciones (NotificationTonePlugin.java). */
export const NotificationTone = registerPlugin('NotificationTone')
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
const saveToken = (token) => { try { localStorage.setItem(TOKEN_KEY, token) } catch { /* se registrará de nuevo */ } }

/** Sólo acepta rutas internas: una notificación no debe poder abrir un sitio externo. */
export const safeNotificationPath = (url) => (typeof url === 'string' && /^\/(?!\/)/.test(url) ? url : null)

export async function registerPushDevice() {
  if (!isNativeApp()) return
  const current = await PushNotifications.checkPermissions()
  const permission = current.receive === 'prompt' ? await PushNotifications.requestPermissions() : current
  if (permission.receive !== 'granted') return
  await NotificationTone.ensureChannel()
  await PushNotifications.register()
}

export async function sendPushToken(token) {
  const { channelId } = await NotificationTone.ensureChannel().catch(() => ({}))
  await api.post('/devices/push-token', { token, platform: 'android', ...(channelId ? { channel: channelId } : {}) })
  saveToken(token)
}

/** Tras cambiar el tono o la vibración, la API debe enviar al canal nuevo. */
export async function refreshPushChannel() {
  const token = isNativeApp() ? readToken() : null
  if (token) await sendPushToken(token)
}

export async function unregisterPushDevice() {
  const token = isNativeApp() ? readToken() : null
  if (!token) return
  await api.delete('/devices/push-token', { data: { token } }).catch(() => {})
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* sin almacenamiento no hay nada que quitar */ }
}
