import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCamera, FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { roleLabel, viewAs } from '../lib/permissions'
import { fullName, publicAssetUrl } from '../utils/formatters'
import { Button, Card, ErrorState, Field, Loading, Page } from '../components/ui'

/** Perfil propio (Frontend_Swgpi/pages/profile.php): foto, teléfono, especialidad y contraseña. */
export default function Profile() {
  const { user, refreshUser } = useAuth()
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then((response) => response.data), gcTime: 0 })
  return (
    <Page title="Mi perfil" subtitle={`${roleLabel(user)}${user?.active_career ? ` · ${user.active_career.nombre_corto}` : ''}`}>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <ProfileForm profile={query.data} readOnly={Boolean(viewAs(user))} onSaved={async () => { await refreshUser(); query.refetch() }} />}
    </Page>
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
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={readOnly} onChange={(event) => event.target.files[0] && setPhoto(event.target.files[0])} />
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
