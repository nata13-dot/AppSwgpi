import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiUser, FiUserPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { homePath, mustChangePassword } from '../../lib/permissions'
import { Button } from '../../components/ui'

export default function Login() {
  const location = useLocation()
  const [form, setForm] = useState({ id: location.state?.id || '', password: '', remember: false })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  // "Crear cuenta" sólo aparece mientras alguna carrera tenga abierto el autoregistro.
  const signup = useQuery({ queryKey: ['self-registration'], queryFn: () => api.get('/self-registration').then((response) => response.data), staleTime: 60000, retry: false })

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const user = await login(form)
      toast.success(`Bienvenido, ${user.nombres}`)
      navigate(mustChangePassword(user) ? '/change-password' : location.state?.from?.pathname || homePath(user), { replace: true })
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-app">
      <section className="auth-visual" aria-hidden="true">
        <img src="/images/itssmt.webp" alt="" />
        <span className="eyebrow">Plataforma institucional</span>
        <h1>Ideas que se convierten en proyectos con impacto.</h1>
        <p>Gestiona propuestas, avances, entregables y evaluaciones desde un mismo espacio.</p>
        <small>Instituto Tecnológico Superior San Martín Texmelucan</small>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-logo"><img src="/images/itssmt.webp" alt="ITSSMT" /><span><strong>SGPI</strong><small>Gestión de Proyectos Integradores</small></span></div>
          <h2>Inicia sesión</h2>
          <p className="muted">Usa tu número de control o número de empleado.</p>
          {new URLSearchParams(location.search).has('expired') && <div className="alert-app warning">Tu sesión terminó. Ingresa nuevamente.</div>}
          <label className="field"><span className="field-label">No. de control o empleado</span>
            <span className="input-icon"><FiUser aria-hidden="true" /><input className="control" autoFocus required autoComplete="username" value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="Ej. 20CS001" /></span>
          </label>
          <label className="field"><span className="field-label">Contraseña</span>
            <span className="input-icon"><FiLock aria-hidden="true" /><input className="control" required autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Tu contraseña" />
              <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <FiEyeOff /> : <FiEye />}</button></span>
          </label>
          <div className="row-wrap">
            <label className="check-inline"><input type="checkbox" checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} /> Mantener sesión</label>
            <span className="spacer" />
            <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
          </div>
          <Button type="submit" size="lg" className="w-100" loading={loading} icon={FiArrowRight}>Entrar al sistema</Button>
          {signup.data?.open && <Link className="auth-signup" to="/register"><FiUserPlus aria-hidden="true" /> ¿Eres alumno y no tienes cuenta? <strong>Crear cuenta</strong></Link>}
          <Link className="auth-public" to="/repository">Consultar repositorio público</Link>
        </form>
      </section>
    </main>
  )
}
