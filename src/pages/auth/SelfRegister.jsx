import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { FiCheckCircle, FiMail, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Button, ErrorState, Field, Loading, Steps } from '../../components/ui'
import { formatDateTime } from '../../utils/formatters'

const EMPTY = { carrera_id: '', id: '', email: '', nombres: '', apa: '', ama: '', grupo_id: '', password: '', password_confirmation: '' }

/** Mismo criterio que la API: correo = prefijo + número de control @ dominio de la carrera. */
const expectedEmail = (rule, id) => (rule && id ? `${rule.email_prefix}${id.trim().toLowerCase()}@${rule.domain}` : '')

/** Autoregistro de alumnos: datos → código enviado al correo institucional → revisión de la jefatura. */
export default function SelfRegister() {
  const navigate = useNavigate()
  const careers = useQuery({ queryKey: ['self-registration'], queryFn: () => api.get('/self-registration').then((response) => response.data) })
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const open = careers.data?.careers || []
  const career = open.find((item) => String(item.id) === String(form.carrera_id)) || (open.length === 1 ? open[0] : null)
  const rule = career?.rule
  // Los alumnos nuevos entran a 5°: sólo eligen su grupo.
  const groups = career?.groups || []
  const expected = expectedEmail(rule, form.id)
  const emailMismatch = form.email && expected && form.email.trim().toLowerCase() !== expected
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value, ...(key === 'carrera_id' ? { grupo_id: '' } : {}) })

  const sendData = async () => {
    setLoading(true)
    try {
      const response = await api.post('/self-registration', { ...form, carrera_id: career.id, id: form.id.trim(), email: form.email.trim().toLowerCase() })
      toast.success(response.data.message)
      setStep(1)
    } catch (error) { toast.error(apiError(error)) } finally { setLoading(false) }
  }
  const submit = async (event) => {
    event.preventDefault()
    if (step === 0) {
      if (emailMismatch) return toast.warning(`Tu correo institucional debe ser ${expected}.`)
      if (form.password !== form.password_confirmation) return toast.warning('Las contraseñas no coinciden.')
      return sendData()
    }
    setLoading(true)
    try {
      await api.post('/self-registration/verify', { email: form.email.trim().toLowerCase(), code })
      setStep(2)
    } catch (error) { toast.error(apiError(error)) } finally { setLoading(false) }
    return undefined
  }

  const content = () => {
    if (careers.isLoading) return <Loading rows={2} />
    if (careers.isError) return <ErrorState error={careers.error} onRetry={careers.refetch} />
    if (!open.length) return <div className="alert-app">El registro de cuentas de alumnos está cerrado. Consulta a la jefatura de tu carrera.</div>
    if (step === 2) return (
      <div className="stack">
        <div className="alert-app success"><FiCheckCircle aria-hidden="true" /> Confirmamos tu correo. Tu solicitud quedó en revisión: te avisaremos en <strong>{form.email.trim().toLowerCase()}</strong> cuando la jefatura de tu carrera la responda. Después podrás iniciar sesión con tu número de control <strong>{form.id.trim().toLowerCase()}</strong> y tu contraseña.</div>
        <Button size="lg" variant="ghost" className="w-100" onClick={() => navigate('/login', { replace: true, state: { id: form.id.trim().toLowerCase() } })}>Volver al inicio de sesión</Button>
      </div>
    )
    if (step === 1) return (
      <>
        <p className="muted"><FiMail aria-hidden="true" /> Enviamos un código de seis dígitos a <strong>{form.email.trim().toLowerCase()}</strong>. Vence en 15 minutos.</p>
        <Field label="Código de seis dígitos"><input className="control code-input" required autoFocus minLength="6" maxLength="6" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></Field>
        <Button type="submit" size="lg" className="w-100" loading={loading}>Confirmar correo</Button>
        <div className="row-wrap">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setStep(0); setCode('') }}>Corregir datos</Button>
          <span className="spacer" />
          <Button type="button" variant="ghost" size="sm" icon={FiRefreshCw} disabled={loading} onClick={sendData}>Reenviar código</Button>
        </div>
      </>
    )
    return (
      <>
        {open.length > 1 && (
          <Field label="Carrera">
            <select className="control" required value={form.carrera_id} onChange={set('carrera_id')}>
              <option value="">Elige tu carrera</option>
              {open.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </Field>
        )}
        {career && <p className="muted small-text">{career.nombre} · periodo {career.period} · registro abierto hasta {formatDateTime(career.closes_at)}</p>}
        <div className="form-grid">
          <Field label="Número de control" hint={rule?.description}><input className="control" required autoFocus autoComplete="username" value={form.id} onChange={set('id')} placeholder={rule ? rule.example.split('@')[0].slice(1) : ''} /></Field>
          <Field label="Correo institucional" error={emailMismatch ? `Debe ser ${expected}` : null} hint={expected || [rule?.example, rule?.example_b].filter(Boolean).join(' o ')}>
            <input className="control" required type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder={expected || rule?.example} />
          </Field>
          <Field label="Nombre(s)"><input className="control" required autoComplete="given-name" value={form.nombres} onChange={set('nombres')} /></Field>
          <Field label="Apellido paterno"><input className="control" required autoComplete="family-name" value={form.apa} onChange={set('apa')} /></Field>
          <Field label="Apellido materno"><input className="control" value={form.ama} onChange={set('ama')} /></Field>
          <Field label="Grupo" hint="Los alumnos nuevos entran a 5° semestre.">
            <select className="control" required disabled={!career} value={form.grupo_id} onChange={set('grupo_id')}>
              <option value="">Elige tu grupo</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.semestre}° {group.grupo}</option>)}
            </select>
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres."><input className="control" required minLength="8" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
          <Field label="Confirmar contraseña"><input className="control" required type="password" autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} /></Field>
        </div>
        <Button type="submit" size="lg" className="w-100" loading={loading} disabled={!career}>Enviar código a mi correo</Button>
      </>
    )
  }

  return (
    <main className="center-page">
      <form className="card-app narrow auth-card wide" onSubmit={submit}>
        <div className="auth-logo"><img src="/images/itssmt.webp" alt="ITSSMT" /><span><strong>Crear cuenta de alumno</strong><small>SGPI ITSSMT</small></span></div>
        {open.length > 0 && <Steps steps={['Tus datos', 'Código', 'En revisión']} current={step} />}
        {content()}
        <Link className="auth-public" to="/login">Ya tengo cuenta · Iniciar sesión</Link>
      </form>
    </main>
  )
}
