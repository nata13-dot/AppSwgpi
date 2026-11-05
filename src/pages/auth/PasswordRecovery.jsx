import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiCheckCircle, FiCircle, FiEye, FiEyeOff } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { Button, Field, Steps } from '../../components/ui'

const RESEND_SECONDS = 60
const MIN_PASSWORD = 8

/** Confirma a dónde llegó el código sin mostrar la dirección completa. */
const maskEmail = (email) => {
  const [local, domain] = email.split('@')
  if (!domain) return email
  return `${local.slice(0, 2)}•••${local.length > 4 ? local.slice(-2) : ''}@${domain}`
}

const Rule = ({ met, children }) => <li className={met ? 'met' : ''}>{met ? <FiCheckCircle aria-hidden="true" /> : <FiCircle aria-hidden="true" />} {children}</li>

export default function PasswordRecovery() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ id: '', email: '', token: '', password: '', password_confirmation: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()
  const set = (key, transform = (value) => value) => (event) => setForm({ ...form, [key]: transform(event.target.value) })

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const lengthOk = form.password.length >= MIN_PASSWORD
  const matchOk = form.password !== '' && form.password === form.password_confirmation

  const sendCode = () => api.post('/auth/password/request-token', { id: form.id, email: form.email })
  const resend = async () => {
    setLoading(true)
    try {
      await sendCode()
      setForm({ ...form, token: '' })
      setResendIn(RESEND_SECONDS)
      toast.success('Te enviamos un código nuevo. El anterior ya no sirve.')
    } catch (error) { toast.error(apiError(error)) } finally { setLoading(false) }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (step === 2 && !(lengthOk && matchOk)) return toast.warning('Revisa los requisitos de la contraseña.')
    setLoading(true)
    try {
      if (step === 0) {
        await sendCode()
        setResendIn(RESEND_SECONDS)
        setStep(1)
      } else if (step === 1) {
        await api.post('/auth/password/verify-token', { id: form.id, email: form.email, token: form.token })
        setStep(2)
      } else {
        await api.post('/auth/password/reset', form)
        await login({ id: form.id, password: form.password })
        toast.success('Contraseña actualizada.')
        navigate('/', { replace: true })
      }
    } catch (error) {
      if (step === 1) setForm((current) => ({ ...current, token: '' }))
      toast.error(apiError(error))
    } finally { setLoading(false) }
  }

  const passwordType = showPassword ? 'text' : 'password'

  return (
    <main className="center-page">
      <form className="card-app narrow" onSubmit={submit}>
        <div className="auth-logo"><img src="/images/itssmt.webp" alt="ITSSMT" /><span><strong>Recupera tu acceso</strong><small>SGPI ITSSMT</small></span></div>
        <Steps steps={['Tus datos', 'Código', 'Contraseña']} current={step} />
        {step === 0 && <>
          <p className="muted">Confirma los datos de tu cuenta y te enviaremos un código a tu correo.</p>
          <Field label="Número de control o empleado"><input className="control" required autoFocus maxLength={10} placeholder="Escribe tu número" autoComplete="username" autoCapitalize="none" value={form.id} onChange={set('id')} /></Field>
          <Field label="Correo de tu cuenta"><input className="control" required type="email" placeholder="El correo registrado en tu cuenta" autoComplete="email" autoCapitalize="none" value={form.email} onChange={set('email')} /></Field>
        </>}
        {step === 1 && <>
          <p className="muted">Escribe el código de seis dígitos que enviamos a <strong>{maskEmail(form.email)}</strong>. Vence en 15 minutos; si no lo ves, revisa tu carpeta de spam.</p>
          <Field label="Código"><input className="control code-input" required autoFocus minLength="6" maxLength="6" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={form.token} onChange={set('token', (value) => value.replace(/\D/g, ''))} /></Field>
        </>}
        {step === 2 && <>
          <p className="muted">Crea tu nueva contraseña. Al guardarla se cerrarán tus otras sesiones de la app.</p>
          <Field label="Nueva contraseña"><span className="input-icon no-lead"><input className="control" required autoFocus type={passwordType} autoComplete="new-password" value={form.password} onChange={set('password')} />
            <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></span></Field>
          <Field label="Confirmar contraseña"><input className="control" required type={passwordType} autoComplete="new-password" value={form.password_confirmation} onChange={set('password_confirmation')} /></Field>
          <ul className="recovery-rules">
            <Rule met={lengthOk}>Al menos {MIN_PASSWORD} caracteres</Rule>
            <Rule met={matchOk}>Las dos contraseñas coinciden</Rule>
          </ul>
        </>}
        <Button type="submit" size="lg" className="w-100" loading={loading}>{step === 0 ? 'Enviarme el código' : step === 1 ? 'Verificar código' : 'Guardar y entrar'}</Button>
        {step === 1 && (
          <div className="recovery-links">
            <button type="button" className="link-btn" disabled={resendIn > 0 || loading} onClick={resend}>{resendIn > 0 ? `Reenviar código en ${resendIn} s` : 'Reenviar código'}</button>
            <button type="button" className="link-btn" disabled={loading} onClick={() => setStep(0)}>Corregir mis datos</button>
          </div>
        )}
        <Link className="auth-public" to="/login">Volver a iniciar sesión</Link>
      </form>
    </main>
  )
}
