import { Capacitor, registerPlugin } from '@capacitor/core'
import { API_URL } from './api'

/**
 * Actualización de la app fuera de Play Store (android/.../AppUpdaterPlugin.java). La API dice cuál es la
 * última versión publicada; el plugin descarga el APK, verifica su huella y abre el instalador de Android.
 */
export const AppUpdater = registerPlugin('AppUpdater')
export const UPDATE_EVENT = 'sgpi:check-update'
const DISMISSED_KEY = 'sgpi-update-dismissed'
// Se revisa cada vez que la app se abre desde cero (no al volver de segundo plano); «Más tarde» la vuelve a ofrecer al día siguiente.
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000

export const updatesSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const read = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key, value) => { try { localStorage.setItem(key, value) } catch { /* sin almacenamiento */ } }

export async function installedVersion() {
  return AppUpdater.info()
}

/**
 * Consulta la última versión. `force` (búsqueda manual) ignora lo que el usuario pospuso.
 * Devuelve { installed, release } con release = null si no hay nada nuevo que ofrecer.
 */
export async function checkForUpdate({ force = false } = {}) {
  if (!updatesSupported()) return { installed: null, release: null }
  const installed = await installedVersion()
  const response = await fetch(`${API_URL}/app/latest?current=${encodeURIComponent(installed.versionCode)}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('No fue posible consultar las actualizaciones.')
  const release = (await response.json()).data
  if (!release || release.version_code <= Number(installed.versionCode)) return { installed, release: null }
  // Lo pospuesto espera su recordatorio, salvo que sea obligatorio o lo pida el usuario.
  if (!force && !release.obligatoria && snoozed(release)) return { installed, release: null }
  return { installed, release }
}

/** «Recordármelo más tarde»: no se vuelve a mostrar esa versión hasta dentro de 24 h. */
export const postpone = (release) => write(DISMISSED_KEY, JSON.stringify({ code: release.version_code, until: Date.now() + REMIND_AFTER_MS }))

function snoozed(release) {
  try {
    const value = JSON.parse(read(DISMISSED_KEY) || 'null')
    return value?.code === release.version_code && Date.now() < Number(value.until || 0)
  } catch { return false }
}
