import { Capacitor, registerPlugin } from '@capacitor/core'
import { confirmAction } from '../components/ui'

/*
 * Bloqueo de la app con la huella, el rostro o el bloqueo de pantalla del teléfono (AppLockPlugin.java).
 * La sesión queda en el teléfono y este bloqueo decide cuándo mostrarla; la contraseña nunca se guarda aquí.
 * Cerrar sesión la termina de verdad: para volver a entrar se usa la contraseña o el gestor del teléfono.
 * Si cambian las huellas del teléfono, el desbloqueo se desactiva y se vuelve a pedir la contraseña.
 */
const AppLock = registerPlugin('AppLock')
const key = (userId, kind) => `sgpi-app-lock-${kind}:${userId}`
const read = (name) => { try { return localStorage.getItem(name) } catch { return null } }
const write = (name, value) => { try { localStorage.setItem(name, value) } catch { /* sin almacenamiento no se recuerda */ } }

export const isNativeApp = () => Capacitor.isNativePlatform()
export const isAppLockEnabled = (userId) => isNativeApp() && Boolean(userId) && read(key(userId, 'on')) === '1'

export const appLockAvailable = async () => {
  if (!isNativeApp()) return false
  try { return (await AppLock.status()).available } catch { return false }
}

/** Resuelve si la verificación fue correcta; si no, rechaza con code CANCELED, UNAVAILABLE o FAILED. */
export const verifyDevice = (options = {}) => AppLock.authenticate(options)

export const enableAppLock = async (userId) => {
  await verifyDevice({ title: 'Activar desbloqueo rápido', subtitle: 'Confirma que eres tú' })
  await AppLock.prepare()
  write(key(userId, 'on'), '1')
}

export const disableAppLock = async (userId) => {
  await verifyDevice({ title: 'Desactivar desbloqueo rápido', subtitle: 'Confirma que eres tú' })
  await AppLock.reset()
  write(key(userId, 'on'), '0')
}

/** true si cambiaron las huellas desde que se activó. Quien venía de una versión sin esta detección queda registrado ahora. */
export async function biometricsChanged() {
  const { state } = await AppLock.check()
  if (state === 'unprepared') await AppLock.prepare()
  return state === 'changed'
}

/** Desactiva el desbloqueo por el cambio de huellas; se ofrecerá de nuevo al entrar con la contraseña. */
export async function revokeAppLock(userId) {
  await AppLock.reset()
  write(key(userId, 'on'), '0')
  try { localStorage.removeItem(key(userId, 'asked')) } catch { /* sin almacenamiento no se recuerda */ }
}

/** Tras iniciar sesión lo ofrece una sola vez por usuario. Devuelve true si quedó activado. */
export async function offerAppLock(user) {
  if (!isNativeApp() || read(key(user.id, 'asked')) || isAppLockEnabled(user.id) || !(await appLockAvailable())) return false
  write(key(user.id, 'asked'), '1')
  const accepted = await confirmAction({ title: '¿Entrar más rápido?', text: 'Desbloquea la app con tu huella, rostro o el bloqueo de tu teléfono, sin escribir tu contraseña cada vez.', confirmText: 'Activar' })
  if (!accepted) return false
  try { await enableAppLock(user.id); return true } catch { return false }
}
