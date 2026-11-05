import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'

/*
 * Apariencia: tema claro, oscuro o según el dispositivo, y letra del equipo por la escala personal.
 * Se guarda en la cuenta (GET/PUT /appearance) y se copia aquí para aplicarla antes de iniciar sesión.
 */
const THEME_KEY = 'sgpi-theme'
const SCALE_KEY = 'sgpi-font-scale'
const DeviceDisplay = registerPlugin('DeviceDisplay')
// Por debajo o por encima de esto la interfaz deja de ser utilizable.
const MIN_FONT_PERCENT = 85
const MAX_FONT_PERCENT = 175

let device = { fontScale: 1, dark: null }

const read = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key, value) => { try { localStorage.setItem(key, value) } catch { /* Sin almacenamiento dura hasta cerrar. */ } }

export const themePreference = () => (['light', 'dark', 'system'].includes(read(THEME_KEY)) ? read(THEME_KEY) : 'light')
export const fontScalePreference = () => Number(read(SCALE_KEY)) || 100
export const deviceFontPercent = () => Math.round(device.fontScale * 100)

const deviceIsDark = () => device.dark ?? Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches)

export function applyAppearance() {
  const root = document.documentElement
  const theme = themePreference() === 'system' ? (deviceIsDark() ? 'dark' : 'light') : themePreference()
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111827' : '#1B396A')
  // Un porcentaje conserva además el tamaño que el navegador tenga configurado.
  root.style.fontSize = `${Math.min(MAX_FONT_PERCENT, Math.max(MIN_FONT_PERCENT, device.fontScale * fontScalePreference()))}%`
  window.dispatchEvent(new CustomEvent('sgpi:appearance'))
}

/** Guarda en este dispositivo y aplica; la cuenta se actualiza aparte con accountAppearance(). */
export function setAppearance({ theme, fontScale }) {
  if (theme) write(THEME_KEY, theme)
  if (fontScale) write(SCALE_KEY, String(fontScale))
  applyAppearance()
}

export const accountAppearance = () => ({ theme: themePreference(), font_scale: fontScalePreference() })

async function syncDevice() {
  if (!Capacitor.isNativePlatform()) return
  try {
    device = await DeviceDisplay.get()
    applyAppearance()
  } catch { /* Sin el dato del teléfono se usa la escala normal. */ }
}

export function initAppearance() {
  applyAppearance()
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyAppearance)
  if (Capacitor.isNativePlatform()) {
    syncDevice()
    // El usuario pudo cambiar la letra o el tema del teléfono mientras la app estaba en segundo plano.
    CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) syncDevice() })
  }
}
