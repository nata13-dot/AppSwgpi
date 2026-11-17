import { useState } from 'react'
import { FiArchive, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Button, Field, Sheet } from '../../components/ui'

const OPTIONS = {
  archive: {
    icon: FiArchive,
    title: 'Enviar al archivo histórico',
    tone: 'info',
    points: [
      'Deja de aparecer en listas, grupos, búsquedas y reportes, y no puede iniciar sesión.',
      'Se conservan sus calificaciones, entregas, evaluaciones y documentos.',
      'Se puede restaurar cuando quieras desde Archivo histórico.',
    ],
  },
  delete: {
    icon: FiTrash2,
    title: 'Eliminar definitivamente',
    tone: 'danger',
    points: [
      'Se borra la cuenta en todo el sistema, con su historial propio: matrículas, movimientos de semestre, liberaciones, residencias y autorizaciones.',
      'Sus entregas, documentos y evaluaciones quedan sin autor; los reportes pasados ya no mostrarán su nombre.',
      'No se puede deshacer. Si dejó registros como autoridad (operaciones, revisiones o asesorías), el sistema pedirá archivarlo en su lugar.',
    ],
  },
}

/**
 * Eliminar usuarios inactivos (POST /users/bulk): elegir entre archivo histórico o eliminación definitiva, con la
 * contraseña de quien lo hace. Muestra a quiénes no se pudo aplicar y por qué.
 */
export default function UserRemovalSheet({ users, onClose, onDone }) {
  const [choice, setChoice] = useState('archive')
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [skipped, setSkipped] = useState([])
  const label = users.length === 1 ? users[0].name : `${users.length} usuarios`

  const submit = async (event) => {
    event.preventDefault()
    if (!password) return toast.warning('Escribe tu contraseña para confirmar.')
    setSaving(true)
    try {
      const { data } = await api.post('/users/bulk', { action: choice, ids: users.map((user) => user.id), admin_password: password, motivo: reason.trim() || null })
      ;(data.done?.length ? toast.success : toast.error)(data.message)
      onDone()
      if (data.skipped?.length) setSkipped(data.skipped)
      else onClose()
    } catch (error) {
      const data = error.response?.data
      if (data?.skipped?.length) { setSkipped(data.skipped); onDone() }
      toast.error(apiError(error))
    } finally { setSaving(false) }
    return undefined
  }

  return (
    <Sheet open title={`Eliminar ${label}`} subtitle="Elige qué hacer con la cuenta. Ambas opciones piden tu contraseña." onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>{skipped.length ? 'Cerrar' : 'Cancelar'}</Button>
        {!skipped.length && <Button type="submit" form="user-removal" variant={choice === 'delete' ? 'danger' : 'primary'} icon={OPTIONS[choice].icon} loading={saving}>{OPTIONS[choice].title}</Button>}</>}>
      {skipped.length ? (
        <div className="stack">
          <div className="alert-app warning">No se pudo aplicar a {skipped.length} usuario(s):</div>
          <ul className="removal-skipped">{skipped.map((item) => <li key={item.id}><strong>{item.name}</strong><span>{item.reason}</span></li>)}</ul>
        </div>
      ) : (
        <form id="user-removal" className="stack" onSubmit={submit}>
          <div className="removal-options" role="radiogroup" aria-label="Qué hacer">
            {Object.entries(OPTIONS).map(([key, option]) => {
              const Icon = option.icon
              return (
                <button type="button" key={key} role="radio" aria-checked={choice === key} className={`removal-option ${option.tone} ${choice === key ? 'active' : ''}`} onClick={() => setChoice(key)}>
                  <strong><Icon aria-hidden="true" /> {option.title}</strong>
                  <ul>{option.points.map((point) => <li key={point}>{point}</li>)}</ul>
                </button>
              )
            })}
          </div>
          {choice === 'archive' && <Field label="Motivo (opcional)"><input className="control" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Por ejemplo: egresó, baja definitiva" /></Field>}
          <Field label="Tu contraseña" hint="La de tu cuenta, para confirmar que eres tú."><input className="control" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        </form>
      )}
    </Sheet>
  )
}
