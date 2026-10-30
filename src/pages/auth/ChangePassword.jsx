import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiCheckCircle, FiLogOut, FiShield } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { homePath, mustChangePassword } from '../../lib/permissions'
import { Button, Field } from '../../components/ui'

/** Primer ingreso con contraseña temporal (matrícula o número de empleado): hay que elegir una nueva. */
export default function ChangePassword() {
  const { user, isAuthenticated, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!mustChangePassword(user)) return <Navigate to={homePath(user)} replace />

  const submit = async (event) => {
    event.preventDefault()
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (form.password !== form.password_confirmation) return setError('La confirmación no coincide.')
    setSaving(true)
    setError('')
    try {
      await api.post('/auth/password/change-initial', form)
      const fresh = await refreshUser()
      toast.success('Contraseña actualizada.')
      navigate(homePath({ ...fresh, must_change_password: false }), { replace: true })
    } catch (requestError) {
      setError(apiError(requestError))
      setSaving(false)
    }
  }
  const exit = async () => { await logout(); navigate('/login', { replace: true }) }

  return (
    <main className="center-page">
      <form className="card-app narrow" onSubmit={submit} noValidate>
        <span className="hero-icon"><FiShield /></span>
        <h1>Cambia tu contraseña</h1>
        <p className="muted">Hola {user?.nombres}. Entraste con una contraseña temporal (tu matrícula o número de empleado). Para continuar, elige una contraseña nueva.</p>
        {error && <div className="alert-app danger" role="alert">{error}</div>}
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres y distinta de tu matrícula.">
          <input className="control" type="password" autoComplete="new-password" minLength={8} maxLength={72} required autoFocus value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </Field>
        <Field label="Confirmar contraseña">
          <input className="control" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} />
        </Field>
        <div className="form-actions split">
          <Button variant="ghost" icon={FiLogOut} onClick={exit}>Salir</Button>
          <Button type="submit" icon={FiCheckCircle} loading={saving}>Guardar y continuar</Button>
        </div>
      </form>
    </main>
  )
}
