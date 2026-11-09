import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { FiLogOut, FiShield } from 'react-icons/fi'
import { MdFingerprint } from 'react-icons/md'
import { toast } from 'react-toastify'
import { useAuth } from '../../hooks/useAuth'
import { biometricsChanged, isAppLockEnabled, revokeAppLock, verifyDevice } from '../../services/appLock'
import { publicAssetUrl } from '../../utils/formatters'

const LOCK_AFTER_MS = 5 * 60 * 1000

const PHOTO_SIZE = 192
const photoKey = (userId) => `sgpi-lock-photo:${userId}`
const readCachedPhoto = (userId) => {
  try { return JSON.parse(localStorage.getItem(photoKey(userId)) || 'null') } catch { return null }
}

/** Copia reducida de la foto en el teléfono: la pantalla de bloqueo la muestra al instante y sin conexión. */
async function cachePhoto(userId, path) {
  if (!path) { try { localStorage.removeItem(photoKey(userId)) } catch { /* sin almacenamiento */ } return }
  if (readCachedPhoto(userId)?.path === path) return
  const blob = await fetch(publicAssetUrl(path)).then((response) => {
    if (!response.ok) throw new Error('Foto no disponible')
    return response.blob()
  })
  const bitmap = await createImageBitmap(blob)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  bitmap.close()
  localStorage.setItem(photoKey(userId), JSON.stringify({ path, data: canvas.toDataURL('image/jpeg', 0.85) }))
}

function greeting(hour) {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * Pide la huella o el bloqueo del teléfono al abrir la app y al volver tras 5 minutos en segundo plano.
 * Al abrir, la app no se monta hasta verificar, así que no se consultan datos. Al volver, sólo se cubre:
 * así un formulario a medias no se pierde. Si se activa durante la sesión (al iniciarla o en Mi perfil),
 * la persona acaba de verificarse: no se le vuelve a pedir. Si cambiaron las huellas, termina la sesión.
 */
export default function AppLockGate({ children }) {
  const { user, token, logout, refreshUser } = useAuth()
  const enabled = Boolean(token) && isAppLockEnabled(user?.id)
  const [locked, setLocked] = useState(enabled)
  const [mounted, setMounted] = useState(!enabled)
  const [message, setMessage] = useState('')
  const [photoFailed, setPhotoFailed] = useState(false)
  const verifying = useRef(false)
  const leftAt = useRef(null)

  // Sin sesión no hay nada que bloquear; el siguiente inicio de sesión ya viene verificado.
  if (!enabled && locked) setLocked(false)
  if (!enabled && !mounted) setMounted(true)

  const userId = user?.id
  // Devuelve true si cerró la sesión. Si el aviso no se puede consultar, se sigue con la verificación normal.
  const closeIfBiometricsChanged = useCallback(async () => {
    if (!(await biometricsChanged().catch(() => false))) return false
    await revokeAppLock(userId).catch(() => {})
    toast.warning('Cambiaron las huellas de tu teléfono. Por seguridad, entra de nuevo con tu contraseña.', { autoClose: 10_000 })
    await logout().catch(() => {})
    return true
  }, [logout, userId])

  const unlock = useCallback(async () => {
    if (verifying.current) return
    verifying.current = true
    try {
      if (await closeIfBiometricsChanged()) return
      await verifyDevice()
      setMessage('')
      setLocked(false)
      setMounted(true)
      setPhotoFailed(false)
      // Trae la foto vigente por si se cambió desde otro dispositivo.
      refreshUser().catch(() => {})
    } catch (error) {
      setMessage(error.code === 'CANCELED' ? '' : error.code === 'UNAVAILABLE'
        ? 'Tu teléfono ya no tiene bloqueo de pantalla. Entra con tu contraseña.'
        : 'No se pudo verificar. Intenta de nuevo.')
    } finally {
      verifying.current = false
    }
  }, [closeIfBiometricsChanged, refreshUser])

  const photoPath = user?.photo_path || user?.foto_ruta
  useEffect(() => {
    if (!enabled || !userId) return
    cachePhoto(userId, photoPath).catch(() => {})
  }, [enabled, userId, photoPath])

  useEffect(() => {
    if (!enabled) return undefined
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) { leftAt.current = Date.now(); return }
      // Las huellas se revisan siempre al volver, aunque no hayan pasado los 5 minutos.
      if (leftAt.current && Date.now() - leftAt.current >= LOCK_AFTER_MS) setLocked(true)
      else closeIfBiometricsChanged()
      leftAt.current = null
    })
    return () => { listener.then((handle) => handle.remove()) }
  }, [closeIfBiometricsChanged, enabled])

  const showLock = enabled && locked
  const cached = showLock && userId ? readCachedPhoto(userId) : null
  const photo = photoFailed || !photoPath ? '' : (cached?.path === photoPath ? cached.data : publicAssetUrl(photoPath))
  const initials = [user?.nombres, user?.apa].map((part) => (part || '').trim().charAt(0)).join('').toUpperCase() || '?'
  useEffect(() => {
    if (!showLock) return undefined
    // Diferido y cancelable: el modo estricto de React monta dos veces y abriría el diálogo dos veces.
    const timer = setTimeout(unlock, 0)
    return () => clearTimeout(timer)
  }, [showLock, unlock])

  // La misma estructura con o sin bloqueo: cambiarla volvería a montar toda la app.
  return (
    <>
      {mounted && children}
      {showLock && (
        <main className="app-lock" role="dialog" aria-modal="true" aria-label="Aplicación bloqueada">
          <header className="app-lock-brand">
            <img src="/images/itssmt.webp" alt="" />
            <span><strong>SGPI</strong><small>Gestión de Proyectos Integradores</small></span>
          </header>
          <section className="app-lock-user">
            <span className="app-lock-avatar">{photo ? <img src={photo} alt="" onError={() => setPhotoFailed(true)} /> : initials}</span>
            <small>{greeting(new Date().getHours())}</small>
            <h1>{user?.nombres || 'SGPI bloqueado'}</h1>
            <p><FiShield aria-hidden="true" /> Tu sesión está protegida</p>
          </section>
          <section className="app-lock-actions">
            <button type="button" className="app-lock-finger" onClick={unlock} aria-label="Desbloquear">
              <MdFingerprint aria-hidden="true" />
            </button>
            <strong>Toca para desbloquear</strong>
            <span>Usa tu huella o el bloqueo de tu teléfono.</span>
            {message && <p className="app-lock-error" role="alert">{message}</p>}
            <button type="button" className="app-lock-exit" onClick={() => logout()}><FiLogOut aria-hidden="true" /> Entrar con mi contraseña</button>
          </section>
        </main>
      )}
    </>
  )
}
