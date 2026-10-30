import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { isGeneralAdmin } from '../../lib/permissions'
import { ordinal, useSemesters } from '../../lib/semesters'
import { Button, Field, Loading, promptPassword, Sheet } from '../../components/ui'

const EMPTY = { id: '', email: '', telefonos: '', perfil_id: '', semestre: '', grupo: '', activo: '1', nombres: '', apa: '', ama: '', especialidad: '', password: '', password_confirmation: '' }

/** Alta y edición de usuario (modal userFormModal de users.php). */
export default function UserForm({ userId, onClose, onSaved }) {
  const { user } = useAuth()
  const editing = Boolean(userId)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { semesters } = useSemesters('period')
  const loaded = useQuery({ queryKey: ['user', userId], queryFn: () => api.get(`/users/${userId}`).then((response) => response.data), enabled: editing, gcTime: 0 })
  const groups = useQuery({ queryKey: ['subject-groups', form.semestre], queryFn: () => api.get('/subject-groups', { params: { semestre: form.semestre } }).then((response) => response.data), enabled: Boolean(form.semestre), staleTime: 60_000 })

  // Al llegar el usuario se copian sus datos al formulario (ajuste durante el render, sin efecto).
  const [syncedFrom, setSyncedFrom] = useState(null)
  const data = loaded.data
  if (data && syncedFrom !== data) {
    setSyncedFrom(data)
    setForm({
      ...EMPTY, id: data.id || '', email: data.email || '', telefonos: data.telefonos || '', perfil_id: String(data.perfil_id || ''),
      semestre: data.semestre ? String(data.semestre) : '', grupo: data.grupo || '', activo: data.activo ? '1' : '0',
      nombres: data.nombres || '', apa: data.apa || '', ama: data.ama || '', especialidad: data.especialidad || '',
    })
  }

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value, ...(key === 'semestre' ? { grupo: '' } : {}) }))
  const student = form.perfil_id === '3'
  // Semestres del periodo abierto; si el alumno ya tiene uno fuera del periodo se conserva visible.
  const semesterOptions = form.semestre && !semesters.includes(Number(form.semestre)) ? [...semesters, Number(form.semestre)] : semesters

  const submit = async (event) => {
    event.preventDefault()
    if ((form.password || form.password_confirmation) && form.password !== form.password_confirmation) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    const payload = {
      email: form.email.trim(), activo: form.activo === '1', semestre: form.semestre || null, grupo: form.grupo || null,
      nombres: form.nombres.trim(), apa: form.apa.trim() || null, ama: form.ama.trim() || null,
      especialidad: student ? null : form.especialidad.trim() || null, telefonos: form.telefonos.trim() || null, perfil_id: form.perfil_id,
    }
    if (!editing) payload.id = form.id.trim()
    if (form.password) Object.assign(payload, { password: form.password, password_confirmation: form.password_confirmation })
    // Cambiar perfil o desactivar a una jefatura exige la contraseña del administrador general.
    if (loaded.data && Number(loaded.data.perfil_id) === 5 && (!payload.activo || Number(payload.perfil_id) !== 5)) {
      const adminPassword = await promptPassword({ title: 'Autoridad protegida', placeholder: 'Contraseña del administrador general', confirmText: 'Autorizar cambio' })
      if (!adminPassword) return
      payload.admin_password = adminPassword
    }
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/users/${userId}`, payload)
      else await api.post('/users', payload)
      toast.success(editing ? 'Usuario actualizado' : 'Usuario creado')
      onSaved()
      onClose()
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="user-form" icon={FiSave} loading={saving}>{editing ? 'Guardar cambios' : 'Guardar'}</Button></>}>
      {editing && loaded.isLoading ? <Loading /> : (
        <form id="user-form" className="form-grid" onSubmit={submit}>
          {error && <div className="alert-app danger full">{error}</div>}
          <Field label="No. de control o de empleado"><input className="control" required maxLength={10} readOnly={editing} value={form.id} onChange={set('id')} /></Field>
          <Field label="Perfil" hint={editing ? 'Sólo el administrador general modifica perfiles con autoridad.' : undefined}>
            <select className="control" required value={form.perfil_id} onChange={set('perfil_id')}>
              <option value="">Seleccionar...</option>
              {isGeneralAdmin(user) && <option value="5">Jefe de carrera</option>}
              {isGeneralAdmin(user) && <option value="6">Asistente de jefatura</option>}
              <option value="7">Coordinador de proyectos integradores</option>
              <option value="2">Docente</option>
              <option value="3">Estudiante</option>
            </select>
          </Field>
          <Field label="Nombres"><input className="control" required value={form.nombres} onChange={set('nombres')} /></Field>
          <Field label="Apellido paterno"><input className="control" value={form.apa} onChange={set('apa')} /></Field>
          <Field label="Apellido materno"><input className="control" value={form.ama} onChange={set('ama')} /></Field>
          <Field label="Correo"><input className="control" type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Teléfono"><input className="control" type="tel" maxLength={200} placeholder="Opcional" value={form.telefonos} onChange={set('telefonos')} /></Field>
          <Field label="Estado"><select className="control" value={form.activo} onChange={set('activo')}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
          {student ? <>
            <Field label="Semestre" hint="Sólo los semestres del periodo abierto.">
              <select className="control" value={form.semestre} onChange={set('semestre')}>
                <option value="">Seleccionar...</option>
                {semesterOptions.map((value) => <option key={value} value={value}>{ordinal(value)}{semesters.includes(value) ? '' : ' (fuera del periodo actual)'}</option>)}
              </select>
            </Field>
            <Field label="Grupo">
              <select className="control" value={form.grupo} onChange={set('grupo')} disabled={!form.semestre}>
                <option value="">{form.semestre ? 'Seleccionar grupo...' : 'Selecciona un semestre'}</option>
                {(groups.data || []).map((item) => <option key={item.id} value={item.grupo}>{item.semestre} {item.grupo} - {item.nombre}</option>)}
              </select>
            </Field>
          </> : <Field label="Especialidad" full><input className="control" maxLength={255} placeholder="Opcional, por ejemplo: Redes, Bases de datos" value={form.especialidad} onChange={set('especialidad')} /></Field>}
          <Field label="Contraseña" hint={editing ? 'Déjala vacía para conservar la contraseña actual.' : 'Si la dejas vacía, la contraseña inicial será la matrícula y se pedirá cambiarla al entrar.'}>
            <input className="control" type="password" minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <Field label="Confirmar contraseña"><input className="control" type="password" minLength={6} autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} /></Field>
        </form>
      )}
    </Sheet>
  )
}
