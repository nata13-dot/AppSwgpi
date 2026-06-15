import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

export default function PasswordRecovery() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ id: '', email: '', token: '', password: '', password_confirmation: '' })
  const { login } = useAuth()
  const navigate = useNavigate()

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      if (step === 1) {
        await api.post('/auth/password/request-token', { id: form.id, email: form.email })
        toast.success('Revisa tu correo: enviamos un código de seis dígitos.')
        setStep(2)
      } else if (step === 2) {
        await api.post('/auth/password/verify-token', { id: form.id, email: form.email, token: form.token })
        setStep(3)
      } else {
        await api.post('/auth/password/reset', form)
        await login({ id: form.id, password: form.password, remember: true })
        toast.success('Contraseña actualizada.')
        navigate('/', { replace: true })
      }
    } catch (error) { toast.error(apiError(error)) } finally { setLoading(false) }
  }

  return (
    <main className="simple-auth-page">
      <section className="login-card">
        <img className="recovery-logo" src="/images/itssmt.webp" alt="ITSSMT" />
        <span className="eyebrow">Recuperación · Paso {step} de 3</span>
        <h2>Recupera tu acceso</h2>
        <p>{step === 1 ? 'Confirma los datos asociados a tu cuenta.' : step === 2 ? 'Escribe el código que recibiste.' : 'Crea una contraseña nueva.'}</p>
        <form onSubmit={submit}>
          {step === 1 && <>
            <label>No. de control o empleado<input required value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></label>
            <label>Correo institucional<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </>}
          {step === 2 && <label>Código de seis dígitos<input required minLength="6" maxLength="6" inputMode="numeric" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value.replace(/\D/g, '') })} /></label>}
          {step === 3 && <>
            <label>Nueva contraseña<input required minLength="6" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>Confirmar contraseña<input required type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} /></label>
          </>}
          <button className="btn-primary-app" disabled={loading}>{loading ? 'Procesando...' : step === 3 ? 'Actualizar contraseña' : 'Continuar'}</button>
        </form>
        <Link className="public-link" to="/login">Volver al inicio de sesión</Link>
      </section>
    </main>
  )
}
