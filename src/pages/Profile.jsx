import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCamera, FiSave, FiSmartphone } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { appLockAvailable, disableAppLock, enableAppLock, isAppLockEnabled, isNativeApp } from '../services/appLock'
import { roleLabel, viewAs } from '../lib/permissions'
import { accountAppearance, deviceFontPercent, fontScalePreference, setAppearance, themePreference } from '../lib/theme'
import { fullName, publicAssetUrl } from '../utils/formatters'
import { Button, Card, Chips, ErrorState, Field, Loading, Page, rejectEmptyFile, Switch } from '../components/ui'

/** Perfil propio (Frontend_Swgpi/pages/profile.php): foto, teléfono, especialidad y contraseña. */
export default function Profile() {
  const { user, refreshUser } = useAuth()
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then((response) => response.data), gcTime: 0 })
  return (
    <Page title="Mi perfil" subtitle={`${roleLabel(user)}${user?.active_career ? ` · ${user.active_career.nombre_corto}` : ''}`}>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <ProfileForm profile={query.data} readOnly={Boolean(viewAs(user))} onSaved={async () => { await refreshUser(); query.refetch() }} />}
      <AppearanceCard readOnly={Boolean(viewAs(user))} />
      {!viewAs(user) && <QuickUnlockCard userId={user?.id} />}
      {!viewAs(user) && <NotificationPreferences />}
    </Page>
  )
}

/** Recordatorios y resúmenes que cada quien puede apagar. Lo que requiere una acción suya siempre llega. */
const THEMES = [{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Según el dispositivo' }]
const FONT_SCALES = [{ value: 90, label: 'Chica' }, { value: 100, label: 'Normal' }, { value: 115, label: 'Grande' }, { value: 130, label: 'Muy grande' }]

/** Tema y letra de la cuenta. Se aplican al momento; en la vista simulada no se guardan. */
function AppearanceCard({ readOnly }) {
  const client = useQueryClient()
  const [theme, setTheme] = useState(themePreference)
  const [fontScale, setFontScale] = useState(fontScalePreference)
  // La apariencia de la cuenta puede llegar después de abrir esta pantalla.
  useEffect(() => {
    const sync = () => { setTheme(themePreference()); setFontScale(fontScalePreference()) }
    window.addEventListener('sgpi:appearance', sync)
    return () => window.removeEventListener('sgpi:appearance', sync)
  }, [])
  const change = async (next) => {
    if (next.theme) setTheme(next.theme)
    if (next.fontScale) setFontScale(next.fontScale)
    setAppearance(next)
    if (readOnly) return
    try {
      await api.put('/appearance', accountAppearance())
      client.removeQueries({ queryKey: ['appearance'] })
    } catch (error) { toast.error(apiError(error)) }
  }
  const native = isNativeApp()
  return (
    <Card title="Apariencia" subtitle="Se guarda en tu cuenta y te acompaña en tus otros dispositivos.">
      <div className="stack">
        <Field label="Tema" hint={theme === 'system' ? 'Cada dispositivo usará su propio tema, claro u oscuro.' : undefined}><Chips options={THEMES} value={theme} onChange={(value) => change({ theme: value })} /></Field>
        <Field label="Tamaño de letra" hint={native ? `Se suma al tamaño de letra de tu teléfono (${deviceFontPercent()}%).` : 'Se suma al tamaño de letra de tu navegador.'}><Chips options={FONT_SCALES} value={fontScale} onChange={(value) => change({ fontScale: value })} /></Field>
      </div>
    </Card>
  )
}

function NotificationPreferences() {
  const query = useQuery({ queryKey: ['notification-preferences'], queryFn: () => api.get('/notifications/preferences').then((response) => response.data.data) })
  const toggle = async (item) => {
    try {
      await api.put('/notifications/preferences', { event: item.key, enabled: !item.enabled })
      query.refetch()
    } catch (error) { toast.error(apiError(error)) }
  }
  if (!query.data?.length) return null
  return (
    <Card title="Avisos" subtitle="Los avisos sobre algo que requiere tu atención (calificaciones, cambios de sala, solicitudes) siempre llegan. De 22:00 a 7:00 sólo llegan cambios urgentes.">
      <div className="stack">{query.data.map((item) => (
        <Switch key={item.key} checked={item.enabled} onChange={() => toggle(item)} label={item.label} hint={item.hint} />
      ))}</div>
    </Card>
  )
}

/** Sólo en la app: huella, rostro o bloqueo del teléfono en lugar de escribir la contraseña. */
function QuickUnlockCard({ userId }) {
  const { keepSession } = useAuth()
  const [available, setAvailable] = useState(null)
  const [enabled, setEnabled] = useState(() => isAppLockEnabled(userId))
  const [busy, setBusy] = useState(false)
  useEffect(() => { appLockAvailable().then(setAvailable) }, [])
  if (!isNativeApp() || available === null) return null
  const toggle = async () => {
    setBusy(true)
    try {
      if (enabled) await disableAppLock(userId)
      else { await enableAppLock(userId); keepSession() }
      setEnabled(!enabled)
      toast.success(enabled ? 'Desbloqueo rápido desactivado.' : 'Desbloqueo rápido activado.')
    } catch (error) {
      if (error.code !== 'CANCELED') toast.error(error.message || 'No se pudo verificar.')
    } finally { setBusy(false) }
  }
  return (
    <Card title="Desbloqueo rápido" subtitle="La app te pedirá la huella, el rostro o el bloqueo de tu teléfono al abrirla y al volver tras 5 minutos. Tu contraseña no se guarda en la app. Si se agrega una huella al teléfono, tendrás que entrar de nuevo con tu contraseña.">
      {available || enabled
        ? <Button variant={enabled ? 'ghost' : undefined} icon={FiSmartphone} loading={busy} onClick={toggle}>{enabled ? 'Desactivar' : 'Activar'}</Button>
        : <p className="muted">Configura un bloqueo de pantalla en tu teléfono para usar esta opción.</p>}
    </Card>
  )
}

function ProfileForm({ profile, readOnly, onSaved }) {
  const student = Number(profile.perfil_id) === 3
  const [form, setForm] = useState({ telefonos: profile.telefonos || '', especialidad: profile.especialidad || '', current_password: '', password: '', password_confirmation: '' })
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const preview = photo ? URL.createObjectURL(photo) : publicAssetUrl(profile.photo_path)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => {
    event.preventDefault()
    const body = new FormData()
    body.append('telefonos', form.telefonos)
    if (!student) body.append('especialidad', form.especialidad)
    ;['current_password', 'password', 'password_confirmation'].forEach((key) => form[key].trim() && body.append(key, form[key]))
    if (photo) body.append('photo', photo)
    setSaving(true)
    try {
      await api.post('/profile', body)
      toast.success('Perfil actualizado')
      setPhoto(null)
      setForm({ ...form, current_password: '', password: '', password_confirmation: '' })
      await onSaved()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  return (
    <form className="stack" onSubmit={submit}>
      <Card>
        <div className="profile-head">
          <label className="profile-photo" title="Cambiar foto">
            {preview ? <img src={preview} alt="" /> : <span>{(profile.nombres || '?').charAt(0)}</span>}
            <i><FiCamera /></i>
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={readOnly} onChange={(event) => { const file = event.target.files[0]; if (file && !rejectEmptyFile(file)) setPhoto(file); else event.target.value = '' }} />
          </label>
          <div><h2>{fullName(profile)}</h2><p className="muted">{profile.id} · {profile.email}</p>{photo && <small className="text-success">Nueva foto lista para guardar</small>}</div>
        </div>
      </Card>
      <Card title="Datos personales" subtitle="El nombre y el correo los actualiza la jefatura.">
        <div className="form-grid">
          <Field label="Nombre"><input className="control" disabled value={profile.nombres || ''} /></Field>
          <Field label="Apellidos"><input className="control" disabled value={[profile.apa, profile.ama].filter(Boolean).join(' ')} /></Field>
          <Field label="Correo"><input className="control" disabled value={profile.email || ''} /></Field>
          {student && <Field label="Semestre y grupo"><input className="control" disabled value={`${profile.semestre || '–'}° ${profile.grupo || ''}`} /></Field>}
          <Field label="Teléfono"><input className="control" type="tel" disabled={readOnly} value={form.telefonos} onChange={set('telefonos')} /></Field>
          {!student && <Field label="Especialidad"><input className="control" disabled={readOnly} value={form.especialidad} onChange={set('especialidad')} /></Field>}
        </div>
      </Card>
      <Card title="Cambiar contraseña" subtitle="Déjalo vacío para conservar tu contraseña actual.">
        <div className="form-grid three">
          <Field label="Contraseña actual"><input className="control" type="password" autoComplete="current-password" disabled={readOnly} value={form.current_password} onChange={set('current_password')} /></Field>
          <Field label="Nueva contraseña"><input className="control" type="password" autoComplete="new-password" disabled={readOnly} value={form.password} onChange={set('password')} /></Field>
          <Field label="Confirmar contraseña"><input className="control" type="password" autoComplete="new-password" disabled={readOnly} value={form.password_confirmation} onChange={set('password_confirmation')} /></Field>
        </div>
      </Card>
      {!readOnly && <div className="form-actions sticky-actions"><Button type="submit" icon={FiSave} loading={saving}>Guardar cambios</Button></div>}
    </form>
  )
}
