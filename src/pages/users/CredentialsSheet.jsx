import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSend } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Button, Chips, Field, Sheet, Switch } from '../../components/ui'

const PROFILE_OPTIONS = [{ value: 'staff', label: 'Jefatura y coordinación' }, { value: '2', label: 'Docentes' }, { value: '3', label: 'Estudiantes' }]
const PROFILE_NAMES = { 2: 'docentes', 3: 'estudiantes', 5: 'jefes de carrera', 6: 'asistentes de jefatura', 7: 'coordinadores de proyectos' }
const FALLBACK_BODY = 'Hola {{Nombre}},\n\nUsuario: {{Usuario}}\nCorreo: {{Correo}}\nContraseña temporal: {{Contraseña}}\n\nPor seguridad, cambia tu contraseña después de iniciar sesión.'

/** Envío de credenciales por correo a usuarios seleccionados o al filtro actual (credentialEmailModal de users.php). */
export default function CredentialsSheet({ onClose, selected, filters, profile }) {
  const [mode, setMode] = useState(selected.size ? 'selected' : 'filtered')
  const [profiles, setProfiles] = useState(() => (profile === 'all' ? ['staff', '2', '3'] : [profile]))
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [rotate, setRotate] = useState(true)
  const [adminPassword, setAdminPassword] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const template = useQuery({ queryKey: ['credential-email-template'], queryFn: () => api.get('/users/credential-email-template').then((response) => response.data), staleTime: 300_000 })

  const [filled, setFilled] = useState(false)
  if (template.isFetched && !filled) {
    setFilled(true)
      setSubject((current) => current || template.data?.subject || 'Credenciales de acceso al SGPI')
      setBody((current) => current || template.data?.body || FALLBACK_BODY)
  }

  const profileIds = profiles.flatMap((value) => (value === 'staff' ? [5, 6, 7] : [Number(value)]))
  const filterPayload = () => {
    const payload = {}
    if (filters.status !== 'all') payload.status = filters.status
    if (profileIds.length > 0 && profileIds.length < 5) payload.perfil_ids = profileIds
    if (filters.q) payload.q = filters.q
    if (profileIds.length === 1 && profileIds[0] === 3) {
      if (filters.semester) payload.semestre = Number(filters.semester)
      if (filters.group) payload.grupo = filters.group
    }
    return payload
  }
  const scope = () => {
    if (mode === 'selected') return `Se enviará sólo a ${selected.size} usuario(s) seleccionado(s). Es la opción recomendada para pruebas controladas.`
    const payload = filterPayload()
    const parts = [`Usuarios ${{ active: 'activos', inactive: 'inactivos' }[payload.status] || 'de todos los estados'}`]
    if (payload.perfil_ids) parts.push(payload.perfil_ids.map((id) => PROFILE_NAMES[id]).join(', '))
    if (payload.semestre) parts.push(`semestre ${payload.semestre}`)
    if (payload.grupo) parts.push(`grupo ${payload.grupo}`)
    if (payload.q) parts.push(`búsqueda: "${payload.q}"`)
    return `Se enviará a los usuarios con correo que coincidan con el filtro: ${parts.join(', ')}. Máximo 200 destinatarios.`
  }

  const submit = async () => {
    if (mode === 'selected' && !selected.size) return toast.warning('Selecciona al menos un usuario o cambia a filtro actual.')
    if (mode === 'filtered' && !profileIds.length) return toast.warning('Selecciona al menos un perfil para el envío por filtro.')
    if (!subject.trim() || !body.trim()) return toast.warning('Asunto y base del correo son obligatorios.')
    if (!confirming) { setConfirming(true); return undefined }
    if (!adminPassword.trim()) return toast.warning('Escribe tu contraseña de administrador.')
    setSending(true)
    try {
      const payload = { ...(mode === 'selected' ? { user_ids: [...selected] } : filterPayload()), subject: subject.trim(), body: body.trim(), rotate_password: rotate, admin_password: adminPassword.trim() }
      const { data } = await api.post('/users/send-credentials', payload, { timeout: 60_000 })
      setResult(data)
      if (!(data.errors || []).length) toast.success('Credenciales enviadas')
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      setSending(false)
    }
    return undefined
  }

  return (
    <Sheet open title="Enviar credenciales" onClose={onClose} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cerrar</Button><Button variant="warning" icon={FiSend} loading={sending} onClick={submit}>{confirming ? 'Confirmar y enviar' : 'Enviar correos'}</Button></>}>
      <div className="stack">
        <div className="alert-app warning">Por seguridad no se envían contraseñas existentes. Si usas la etiqueta <strong>{'{{Contraseña}}'}</strong>, el sistema genera una contraseña temporal nueva para cada usuario y guarda sólo su hash.</div>
        <div className="option-list">
          <button type="button" className={mode === 'selected' ? 'active' : ''} disabled={!selected.size} onClick={() => setMode('selected')}><span><strong>Sólo usuarios seleccionados</strong><small>{selected.size ? `${selected.size} seleccionado(s) para pruebas controladas.` : 'Selecciona usuarios en la tabla para usar esta opción.'}</small></span></button>
          <button type="button" className={mode === 'filtered' ? 'active' : ''} onClick={() => setMode('filtered')}><span><strong>Todos los usuarios del filtro actual</strong><small>Usa perfil, estado, búsqueda, semestre y grupo actuales.</small></span></button>
        </div>
        {mode === 'filtered' && <div><span className="field-label">Perfiles</span><Chips multiple options={PROFILE_OPTIONS} value={profiles} onChange={setProfiles} /></div>}
        <Field label="Asunto"><input className="control" maxLength={150} required value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <Field label="Base del correo" hint={`Etiquetas: ${(template.data?.tags || ['{{Nombre}}', '{{Usuario}}', '{{Correo}}', '{{Contraseña}}', '{{Perfil}}', '{{Semestre}}', '{{Grupo}}']).join(', ')}`}>
          <textarea className="control" rows={8} maxLength={5000} required value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        <Switch checked={rotate} onChange={setRotate} label="Generar contraseña temporal nueva para cada destinatario" />
        <p className="muted small-text">{scope()}</p>
        {confirming && (
          <Field label="Tu contraseña de administrador" hint="Necesaria para autorizar el envío.">
            <input className="control" type="password" autoComplete="current-password" autoFocus value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
          </Field>
        )}
        {result && (
          <div className={`alert-app ${(result.errors || []).length ? 'warning' : 'success'}`}>
            Enviados: <strong>{Number(result.sent || 0)}</strong>. Fallidos: <strong>{Number(result.failed || 0)}</strong>.
            {(result.errors || []).length > 0 && <ul className="error-list">{result.errors.slice(0, 10).map((item) => <li key={item.id}>{item.id} - {item.email}: {item.error}</li>)}</ul>}
          </div>
        )}
      </div>
    </Sheet>
  )
}
