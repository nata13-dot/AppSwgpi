import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiUser } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { apiError } from '../../services/api'
import { homeForUser, useAuth } from '../../hooks/useAuth'

export default function Login() {
  const [form, setForm] = useState({ id: '', password: '', remember: false })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const user = await login(form)
      toast.success(`Bienvenido, ${user.nombres}`)
      navigate(location.state?.from?.pathname || homeForUser(user), { replace: true })
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-shade" />
        <div className="auth-brand"><img src="/images/itssmt.webp" alt="ITSSMT" /><span>Excelencia en educación tecnológica</span></div>
        <div className="auth-copy">
          <span className="eyebrow light">Plataforma institucional</span>
          <h1>Ideas que se convierten en proyectos con impacto.</h1>
          <p>Gestiona propuestas, avances, entregables y evaluaciones desde un mismo espacio.</p>
        </div>
        <small className="auth-photo-caption">Instituto Tecnológico Superior San Martín Texmelucan</small>
      </section>
      <section className="auth-panel">
        <div className="login-card">
          <div className="mobile-auth-logo"><img src="/images/itssmt.webp" alt="" /><strong>SGPI ITSSMT</strong></div>
          <span className="eyebrow">Bienvenido</span>
          <h2>Inicia sesión</h2>
          <p>Usa tu número de control o número de empleado.</p>
          {new URLSearchParams(location.search).has('expired') && <div className="alert alert-warning">Tu sesión terminó. Ingresa nuevamente.</div>}
          <form onSubmit={submit}>
            <label>No. de control o empleado
              <span className="input-icon"><FiUser /><input autoFocus required value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="Ej. 20CS001" /></span>
            </label>
            <label>Contraseña
              <span className="input-icon"><FiLock /><input required type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tu contraseña" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></span>
            </label>
            <div className="login-options">
              <label className="check-label"><input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} /> Mantener sesión</label>
              <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
            </div>
            <button className="btn-primary-app" disabled={loading}>{loading ? <span className="spinner-border spinner-border-sm" /> : <>Entrar al sistema <FiArrowRight /></>}</button>
          </form>
          <Link className="public-link" to="/repository">Consultar repositorio público</Link>
        </div>
      </section>
    </main>
  )
}
