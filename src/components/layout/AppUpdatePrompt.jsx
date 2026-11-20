import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { FiDownloadCloud, FiShield } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { Button, Sheet } from '../ui'
import { AppUpdater, UPDATE_EVENT, checkForUpdate, postpone, updatesSupported } from '../../services/appUpdate'

const size = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '')

/**
 * Ofrece la versión nueva de la app al abrirla o al volver a ella (cada 6 h), o cuando se pide desde Mi perfil.
 * Si la versión es obligatoria no se puede cerrar el aviso.
 */
export default function AppUpdatePrompt() {
  const [release, setRelease] = useState(null)
  const [installed, setInstalled] = useState(null)
  const [stage, setStage] = useState('idle') // idle | permission | downloading | installing
  const [percent, setPercent] = useState(-1)
  const [error, setError] = useState('')
  const waitingPermission = useRef(false)

  const check = useCallback(async (force = false) => {
    try {
      const result = await checkForUpdate({ force })
      setInstalled(result.installed)
      if (result.release) { setRelease(result.release); setStage('idle'); setError('') }
      else if (force) toast.success(`Tienes la versión más reciente${result.installed ? ` (${result.installed.versionName})` : ''}.`)
    } catch (e) {
      if (force) toast.error(e.message || 'No fue posible buscar actualizaciones.')
    }
  }, [])

  const install = useCallback(async () => {
    if (!release) return
    setError('')
    setStage('downloading'); setPercent(-1)
    try {
      await AppUpdater.downloadAndInstall({ url: release.url, sha256: release.sha256 })
      setStage('installing')
    } catch (e) {
      if (e?.code === 'NEEDS_PERMISSION') { setStage('permission'); return }
      setStage('idle'); setError(e?.message || 'No se pudo descargar la actualización.')
    }
  }, [release])

  useEffect(() => {
    if (!updatesSupported()) return undefined
    // Un momento después de abrir, para no competir con el inicio de sesión ni la carga de la pantalla.
    const first = setTimeout(() => check(false), 2500)
    const progress = AppUpdater.addListener('progress', ({ percent: value }) => setPercent(value))
    const resume = CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return
      // Al volver de los ajustes de Android, se continúa si ya se permitió instalar.
      if (waitingPermission.current) {
        waitingPermission.current = false
        const info = await AppUpdater.info().catch(() => null)
        if (info?.canInstall) { install(); return }
      }
      check(false)
    })
    const manual = () => check(true)
    window.addEventListener(UPDATE_EVENT, manual)
    return () => { clearTimeout(first); progress.then((h) => h.remove()); resume.then((h) => h.remove()); window.removeEventListener(UPDATE_EVENT, manual) }
  }, [check, install])

  if (!release) return null
  const required = release.obligatoria
  const close = required || stage === 'downloading' ? undefined : () => { postpone(release); setRelease(null) }
  const busy = stage === 'downloading'

  return (
    <Sheet
      open
      title={`Nueva versión ${release.version_name}`}
      subtitle={installed ? `Tienes la ${installed.versionName}${release.tamano_bytes ? ` · descarga de ${size(release.tamano_bytes)}` : ''}` : undefined}
      onClose={close}
      footer={stage === 'permission' ? (
        <div className="row-wrap">
          <Button icon={FiShield} onClick={() => { waitingPermission.current = true; AppUpdater.openInstallSettings() }}>Permitir instalación</Button>
          <Button variant="ghost" onClick={install}>Ya lo permití</Button>
        </div>
      ) : (
        <div className="row-wrap">
          {!required && <Button variant="ghost" disabled={busy} onClick={close}>Más tarde</Button>}
          <Button icon={FiDownloadCloud} loading={busy} disabled={busy} onClick={install}>{stage === 'installing' ? 'Volver a abrir el instalador' : 'Actualizar ahora'}</Button>
        </div>
      )}
    >
      {required && <div className="alert-app warning">Esta versión es obligatoria: actualiza para seguir usando SGPI.</div>}
      {release.notas?.length > 0 ? (
        <div className="update-notes">
          {release.notas.map((note) => (
            <div key={note.version}><strong>Novedades de la {note.version}</strong><p className="small-text" style={{ whiteSpace: 'pre-line', margin: '4px 0 10px' }}>{note.notas}</p></div>
          ))}
        </div>
      ) : <p className="muted">Mejoras y correcciones.</p>}
      {busy && (
        <div className="update-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent >= 0 ? percent : undefined}>
          <div className="update-bar"><span style={{ width: percent >= 0 ? `${percent}%` : '35%' }} className={percent < 0 ? 'indeterminate' : ''} /></div>
          <small className="muted">{percent >= 0 ? `Descargando… ${percent}%` : 'Descargando…'}</small>
        </div>
      )}
      {stage === 'installing' && <div className="alert-app mt-2">Confirma la instalación en la ventana de Android. Tus datos y tu sesión se conservan.</div>}
      {stage === 'permission' && <div className="alert-app mt-2">Android necesita que permitas a SGPI instalar actualizaciones. Toca «Permitir instalación», activa la opción y vuelve a la app.</div>}
      {error && <div className="alert-app danger mt-2">{error}</div>}
    </Sheet>
  )
}
