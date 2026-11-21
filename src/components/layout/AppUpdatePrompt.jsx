import { useCallback, useEffect, useState } from 'react'
import { FiDownloadCloud, FiFolder } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { Button } from '../ui'
import { registerBackHandler } from '../../utils/backNavigation'
import { AppUpdater, UPDATE_EVENT, checkForUpdate, postpone, updatesSupported } from '../../services/appUpdate'

const size = (bytes) => (bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '')

/**
 * Ofrece la versión nueva de la app cada vez que se abre desde cero (no al volver de segundo plano), o cuando se
 * pide desde Mi perfil.
 * Si la versión es obligatoria no se puede cerrar el aviso.
 */
export default function AppUpdatePrompt() {
  const [release, setRelease] = useState(null)
  const [installed, setInstalled] = useState(null)
  const [stage, setStage] = useState('idle') // idle | downloading | ready (descargada: la instala el sistema)
  const [percent, setPercent] = useState(-1)
  const [error, setError] = useState('')

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
      await AppUpdater.downloadAndInstall({ url: release.url, sha256: release.sha256, version: release.version_name })
      setStage('ready')
    } catch (e) {
      setStage('idle'); setError(e?.message || 'No se pudo descargar la actualización.')
    }
  }, [release])

  useEffect(() => {
    if (!updatesSupported()) return undefined
    // Un momento después de abrir, para no competir con el inicio de sesión ni la carga de la pantalla.
    const first = setTimeout(() => check(false), 2500)
    // Volver de segundo plano no vuelve a buscar: sólo al abrir la app desde cero.
    const progress = AppUpdater.addListener('progress', ({ percent: value }) => setPercent(value))
    const manual = () => check(true)
    window.addEventListener(UPDATE_EVENT, manual)
    return () => { clearTimeout(first); progress.then((h) => h.remove()); window.removeEventListener(UPDATE_EVENT, manual) }
  }, [check])

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
          {/* Sólo la última versión: es la que se instala aunque falten varias. */}
          {release.notas?.[0]?.notas ? <div><strong>Novedades</strong><p>{release.notas[0].notas}</p></div> : <p>Mejoras y correcciones.</p>}
        </div>
        {busy && (
          <div className="update-progress" role="progressbar" aria-label="Descarga de la actualización" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent >= 0 ? percent : undefined}>
            <div className="update-bar"><span style={{ width: percent >= 0 ? `${percent}%` : '35%' }} className={percent < 0 ? 'indeterminate' : ''} /></div>
            <small className="muted">{percent >= 0 ? `Descargando… ${percent}%` : 'Descargando…'}</small>
          </div>
        )}
        {stage === 'ready' && (
          <div className="alert-app success update-ready">
            <strong>Descarga lista y verificada.</strong>
            <span>Toca la notificación «SGPI {release.version_name}» (o ábrela desde Descargas) y luego «Instalar». Tus datos y tu sesión se conservan.</span>
            <span className="muted small-text">La primera vez, Android puede pedirte permitir instalaciones desde esa app; acéptalo y vuelve a tocar la notificación.</span>
          </div>
        )}
        {error && <div className="alert-app danger">{error}</div>}
        <div className="update-actions">
          {stage === 'ready' ? (
            <>
              <Button icon={FiFolder} onClick={() => AppUpdater.openDownloads()}>Abrir Descargas</Button>
              {!required && <Button variant="ghost" onClick={() => { postpone(release); setRelease(null) }}>Listo</Button>}
            </>
          ) : (
            <>
              <Button icon={FiDownloadCloud} loading={busy} disabled={busy} onClick={install}>Actualizar ahora</Button>
              {!required && <Button variant="ghost" disabled={busy} onClick={close}>Recordármelo más tarde</Button>}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
