import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { FiLock, FiLogOut } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { useAuth } from '../../hooks/useAuth'
import { biometricsChanged, isAppLockEnabled, revokeAppLock, verifyDevice } from '../../services/appLock'
import { Button } from '../ui'

const LOCK_AFTER_MS = 5 * 60 * 1000

/**
 * Pide la huella o el bloqueo del teléfono al abrir la app y al volver tras 5 minutos en segundo plano.
 * Al abrir, la app no se monta hasta verificar, así que no se consultan datos. Al volver, sólo se cubre:
 * así un formulario a medias no se pierde. Si se activa durante la sesión (al iniciarla o en Mi perfil),
 * la persona acaba de verificarse: no se le vuelve a pedir. Si cambiaron las huellas, termina la sesión.
 */
export default function AppLockGate({ children }) {
  const { user, token, logout } = useAuth()
  const enabled = Boolean(token) && isAppLockEnabled(user?.id)
  const [locked, setLocked] = useState(enabled)
  const [mounted, setMounted] = useState(!enabled)
  const [message, setMessage] = useState('')
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
    } catch (error) {
      setMessage(error.code === 'CANCELED' ? '' : error.code === 'UNAVAILABLE'
        ? 'Tu teléfono ya no tiene bloqueo de pantalla. Entra con tu contraseña.'
        : 'No se pudo verificar. Intenta de nuevo.')
    } finally {
      verifying.current = false
    }
  }, [closeIfBiometricsChanged])

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
          <img src="/images/itssmt.webp" alt="" />
          <h1>SGPI bloqueado</h1>
          <p>{user?.nombres ? `Hola, ${user.nombres}. ` : ''}Desbloquea para continuar.</p>
          {message && <p className="text-danger" role="alert">{message}</p>}
          <Button size="lg" icon={FiLock} onClick={unlock}>Desbloquear</Button>
          <Button variant="ghost" icon={FiLogOut} onClick={() => logout()}>Entrar con mi contraseña</Button>
        </main>
      )}
    </>
  )
}
