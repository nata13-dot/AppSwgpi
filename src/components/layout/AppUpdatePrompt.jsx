import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { FiDownloadCloud, FiShield } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { Button } from '../ui'
import { registerBackHandler } from '../../utils/backNavigation'
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

  // Botón Atrás de Android: equivale a «Recordármelo más tarde» (no hace nada si es obligatoria o descargando).
  useEffect(() => {
    if (!release) return undefined
    return registerBackHandler(() => { if (!release.obligatoria && stage !== 'downloading') { postpone(release); setRelease(null) } })
  }, [release, stage])

  if (!release) return null
  const required = release.obligatoria
  const close = required || stage === 'downloading' ? undefined : () => { postpone(release); setRelease(null) }
  const busy = stage === 'downloading'

  return (
    <div className="update-backdrop" role="presentation">
      <section className="update-modal" role="dialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-desc">
        <div className="update-icon" aria-hidden="true"><FiDownloadCloud /></div>
        <h2 id="update-title">Hay una nueva versión de SGPI</h2>
        <p id="update-desc" className="update-version">
          <strong>{release.version_name}</strong>
          {installed && <span> · tienes la {installed.versionName}</span>}
          {release.tamano_bytes ? <span> · {size(release.tamano_bytes)}</span> : null}
        </p>
        {required && <div className="alert-app warning">Esta actualización es obligatoria: instálala para seguir usando SGPI.</div>}
        <div className="update-notes">
          {release.notas?.length > 0 ? release.notas.map((note) => (
            <div key={note.version}><strong>Novedades de la {note.version}</strong><p>{note.notas}</p></div>
          )) : <p>Mejoras y correcciones.</p>}
        </div>
        {busy && (
          <div className="update-progress" role="progressbar" aria-label="Descarga de la actualización" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent >= 0 ? percent : undefined}>
            <div className="update-bar"><span style={{ width: percent >= 0 ? `${percent}%` : '35%' }} className={percent < 0 ? 'indeterminate' : ''} /></div>
            <small className="muted">{percent >= 0 ? `Descargando… ${percent}%` : 'Descargando…'}</small>
          </div>
        )}
        {stage === 'installing' && <div className="alert-app">Confirma la instalación en la ventana de Android. Tus datos y tu sesión se conservan.</div>}
        {stage === 'permission' && <div className="alert-app">Android necesita que permitas a SGPI instalar actualizaciones. Toca «Permitir instalación», activa la opción y vuelve a la app.</div>}
        {error && <div className="alert-app danger">{error}</div>}
        <div className="update-actions">
          {stage === 'permission' ? (
            <>
              <Button icon={FiShield} onClick={() => { waitingPermission.current = true; AppUpdater.openInstallSettings() }}>Permitir instalación</Button>
              <Button variant="ghost" onClick={install}>Ya lo permití</Button>
            </>
          ) : (
            <>
              <Button icon={FiDownloadCloud} loading={busy} disabled={busy} onClick={install}>{stage === 'installing' ? 'Volver a abrir el instalador' : 'Actualizar ahora'}</Button>
              {!required && <Button variant="ghost" disabled={busy} onClick={close}>Recordármelo más tarde</Button>}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
