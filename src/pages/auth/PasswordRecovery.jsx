import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { Button, Field, Steps } from '../../components/ui'

export default function PasswordRecovery() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ id: '', email: '', token: '', password: '', password_confirmation: '' })
  const { login } = useAuth()
  const navigate = useNavigate()
  const set = (key, transform = (value) => value) => (event) => setForm({ ...form, [key]: transform(event.target.value) })

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (step === 0) {
        await api.post('/auth/password/request-token', { id: form.id, email: form.email })
        toast.success('Revisa tu correo: enviamos un código de seis dígitos.')
        setStep(1)
      } else if (step === 1) {
        await api.post('/auth/password/verify-token', { id: form.id, email: form.email, token: form.token })
        setStep(2)
      } else {
        await api.post('/auth/password/reset', form)
        await login({ id: form.id, password: form.password, remember: true })
        toast.success('Contraseña actualizada.')
        navigate('/', { replace: true })
      }
    } catch (error) { toast.error(apiError(error)) } finally { setLoading(false) }
  }

  return (
    <main className="center-page">
      <form className="card-app narrow" onSubmit={submit}>
        <div className="auth-logo"><img src="/images/itssmt.webp" alt="ITSSMT" /><span><strong>Recupera tu acceso</strong><small>SGPI ITSSMT</small></span></div>
        <Steps steps={['Tus datos', 'Código', 'Contraseña']} current={step} />
        <p className="muted">{step === 0 ? 'Confirma los datos asociados a tu cuenta.' : step === 1 ? 'Escribe el código que recibiste por correo.' : 'Crea una contraseña nueva.'}</p>
        {step === 0 && <>
          <Field label="No. de control o empleado"><input className="control" required autoFocus value={form.id} onChange={set('id')} /></Field>
          <Field label="Correo institucional"><input className="control" required type="email" value={form.email} onChange={set('email')} /></Field>
        </>}
        {step === 1 && <Field label="Código de seis dígitos"><input className="control code-input" required autoFocus minLength="6" maxLength="6" inputMode="numeric" autoComplete="one-time-code" value={form.token} onChange={set('token', (value) => value.replace(/\D/g, ''))} /></Field>}
        {step === 2 && <>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres."><input className="control" required autoFocus minLength="8" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
          <Field label="Confirmar contraseña"><input className="control" required type="password" autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} /></Field>
        </>}
        <Button type="submit" size="lg" className="w-100" loading={loading}>{step === 2 ? 'Actualizar contraseña' : 'Continuar'}</Button>
        <Link className="auth-public" to="/login">Volver al inicio de sesión</Link>
      </form>
    </main>
  )
}
