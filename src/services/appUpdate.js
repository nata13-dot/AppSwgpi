import { Capacitor, registerPlugin } from '@capacitor/core'
import { API_URL } from './api'

/**
 * Actualización de la app fuera de Play Store (android/.../AppUpdaterPlugin.java). La API dice cuál es la
 * última versión publicada; el plugin descarga el APK, verifica su huella y abre el instalador de Android.
 */
export const AppUpdater = registerPlugin('AppUpdater')
export const UPDATE_EVENT = 'sgpi:check-update'
const CHECKED_KEY = 'sgpi-update-checked'
const DISMISSED_KEY = 'sgpi-update-dismissed'
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export const updatesSupported = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const read = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key, value) => { try { localStorage.setItem(key, value) } catch { /* sin almacenamiento */ } }

export async function installedVersion() {
  return AppUpdater.info()
}

/**
 * Consulta la última versión. `force` ignora el intervalo y lo que el usuario pospuso.
 * Devuelve { installed, release } con release = null si no hay nada nuevo que ofrecer.
 */
export async function checkForUpdate({ force = false } = {}) {
  if (!updatesSupported()) return { installed: null, release: null }
  const installed = await installedVersion()
  const last = Number(read(CHECKED_KEY) || 0)
  if (!force && Date.now() - last < CHECK_EVERY_MS) return { installed, release: null }
  const response = await fetch(`${API_URL}/app/latest?current=${encodeURIComponent(installed.versionCode)}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('No fue posible consultar las actualizaciones.')
  const release = (await response.json()).data
  write(CHECKED_KEY, String(Date.now()))
  if (!release || release.version_code <= Number(installed.versionCode)) return { installed, release: null }
  // Lo pospuesto no se vuelve a ofrecer solo, salvo que sea obligatorio o lo pida el usuario.
  if (!force && !release.obligatoria && read(DISMISSED_KEY) === String(release.version_code)) return { installed, release: null }
  return { installed, release }
}

export const postpone = (release) => write(DISMISSED_KEY, String(release.version_code))
