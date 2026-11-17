import { useState } from 'react'
import { FiUserX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Button, Field, Sheet } from '../../components/ui'

/**
 * Docentes que no se pudieron desactivar por tener cursos, salas, asesorías o residencias en la carrera: muestra los
 * pendientes y los libera o los pasa a otro docente (POST /users/bulk con release y replacement_id).
 */
export default function ReleaseSheet({ people, replacements, onClose, onDone }) {
  const [replacement, setReplacement] = useState('')
  const [saving, setSaving] = useState(false)
  const hasResidency = people.some((person) => (person.commitments || []).some((label) => label.startsWith('Residencia')))

  const submit = async () => {
    if (hasResidency && !replacement) { toast.warning('Elige al docente que asesorará las residencias.'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/users/bulk', { action: 'deactivate', ids: people.map((person) => person.id), release: true, replacement_id: replacement || null })
      ;(data.done?.length ? toast.success : toast.error)(data.done?.length ? `${data.message} Sus pendientes se liberaron.` : data.message)
      if (data.skipped?.length) toast.warning(data.skipped.map((item) => `${item.name}: ${item.reason}`).join(' · '), { autoClose: 10_000 })
      onDone()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }

  return (
    <Sheet open title={people.length > 1 ? 'Tienen pendientes en la carrera' : 'Tiene pendientes en la carrera'} subtitle="Para desactivar hay que liberar esto primero." onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Dejar así</Button><Button variant="danger" icon={FiUserX} loading={saving} onClick={submit}>Liberar y desactivar</Button></>}>
      <div className="stack">
        {people.map((person) => (
          <div key={person.id} className="alert-app">
            <strong>{person.name}</strong>
            <ul className="removal-skipped">{(person.commitments || []).map((label) => <li key={label}><span>{label}</span></li>)}</ul>
          </div>
        ))}
        <Field label="Pasar sus pendientes a" hint="Con un docente elegido, él recibe los cursos, las salas (también como responsable), las asesorías y las residencias. Sin docente, se quitan de los cursos, salas y asesorías.">
          <select className="control" value={replacement} onChange={(event) => setReplacement(event.target.value)}>
            <option value="">{hasResidency ? 'Elige un docente (hay residencias que necesitan asesor)' : 'Nadie: sólo quitarlos'}</option>
            {replacements.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </Field>
      </div>
    </Sheet>
  )
}
