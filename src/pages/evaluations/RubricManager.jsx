import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiChevronDown, FiChevronUp, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Badge, Button, confirmAction, Empty, Field, IconButton, Loading, Sheet } from '../../components/ui'
import { SCALE_NAMES, scaleOf, scalePreview, STAGE_NAMES } from './evaluationShared'

/**
 * Rúbricas por semestre (rubricModal de evaluations.php). Cada pregunta tiene su propia escala; al calificar
 * cada respuesta se convierte de 0 a 100 % y todas pesan igual en el promedio.
 */
export default function RubricManager({ projectId: initialProject = '', projects, onClose }) {
  const client = useQueryClient()
  const [semester, setSemester] = useState(initialProject ? '8' : '5')
  const [projectId, setProjectId] = useState(initialProject ? String(initialProject) : '')
  const [text, setText] = useState('')
  const [scale, setScale] = useState('acuerdo')
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState({})
  const query = useQuery({ queryKey: ['evaluation-criteria'], queryFn: () => api.get('/evaluations/criteria', { timeout: 30_000 }).then((response) => response.data), staleTime: 0 })
  const criteria = useMemo(() => (query.data?.criteria || [])
    .filter((criterion) => String(criterion.semestre) === semester && String(criterion.project_id ?? '') === (semester === '8' ? projectId : ''))
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0) || Number(a.id) - Number(b.id)), [projectId, query.data, semester])

  const reload = () => client.invalidateQueries({ queryKey: ['evaluation-criteria'] })
  const valueOf = (criterion) => ({ pregunta: edits[criterion.id]?.pregunta ?? criterion.label, escala: edits[criterion.id]?.escala ?? scaleOf(criterion) })
  const edit = (id, patch) => setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  const put = (criterion, changes = {}) => api.put(`/evaluations/rubric-criteria/${criterion.id}`, { ...valueOf(criterion), orden: criterion.orden || 0, ...changes })
  const guard = async (action, success) => {
    setBusy(true)
    try { await action(); if (success) toast.success(success); await reload() } catch (error) { toast.error(apiError(error)) } finally { setBusy(false) }
  }

  const add = () => {
    if (!text.trim()) { toast.warning('Escribe la pregunta antes de agregarla.'); return }
    guard(async () => {
      await api.post('/evaluations/rubric-criteria', { semestre: semester, pregunta: text.trim(), escala: scale, ...(projectId && semester === '8' ? { project_id: Number(projectId) } : {}) })
      setText('')
    }, 'Pregunta agregada')
  }
  // Intercambia la posición con la pregunta vecina y renumera 1..n.
  const move = (index, delta) => guard(async () => {
    const order = criteria.map((criterion) => criterion)
    ;[order[index], order[index + delta]] = [order[index + delta], order[index]]
    for (const [position, criterion] of order.entries()) {
      if (Number(criterion.orden) !== position + 1) await put(criterion, { orden: position + 1 })
    }
  })
  const remove = async (criterion) => {
    if (await confirmAction({ title: 'Desactivar pregunta', text: '¿Desactivar esta pregunta de la rúbrica?', confirmText: 'Sí, desactivar', danger: true })) {
      guard(() => api.delete(`/evaluations/rubric-criteria/${criterion.id}`), 'Pregunta desactivada')
    }
  }
  const counts = criteria.reduce((result, criterion) => ({ ...result, [scaleOf(criterion)]: (result[scaleOf(criterion)] || 0) + 1 }), {})
  const eighthProjects = projects.filter((project) => Number(project.presentation_semester ?? project.semestre) === 8)

  return (
    <Sheet open title="Rúbricas por semestre" subtitle="Cada pregunta tiene su propia escala; todas pesan igual en el promedio (0 a 100 %)." onClose={onClose} size="lg">
      <div className="stack">
        <div className="semester-chips" role="radiogroup" aria-label="Semestre de la rúbrica">
          {['5', '6', '7', '8'].map((value) => (
            <button type="button" key={value} role="radio" aria-checked={semester === value} className={semester === value ? 'active' : ''} onClick={() => { setSemester(value); setEdits({}); if (value !== '8') setProjectId('') }}>
              <strong>{value}°</strong><small>{STAGE_NAMES[value]}</small>
            </button>
          ))}
        </div>
        {semester === '8' && (
          <Field label="Proyecto de 8° (rúbrica personalizada)">
            <select className="control" value={projectId} onChange={(event) => { setProjectId(event.target.value); setEdits({}) }}>
              <option value="">Rúbrica general de 8°</option>
              {eighthProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </Field>
        )}
        <section className="card-app tinted">
          <h2 className="card-title-sm">Nueva pregunta</h2>
          <div className="form-grid">
            <Field label="Pregunta" full><input className="control" maxLength={255} placeholder="Ej. El problema está bien delimitado y justificado" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), add())} /></Field>
            <Field label="Escala de respuesta" hint={scalePreview(scale)}>
              <select className="control" value={scale} onChange={(event) => setScale(event.target.value)}>{Object.entries(SCALE_NAMES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </Field>
            <div className="field align-end"><Button icon={FiPlus} loading={busy} onClick={add}>Agregar</Button></div>
          </div>
        </section>
        <div className="row-wrap">
          <h3 className="card-title-sm">Preguntas de {semester}° · {STAGE_NAMES[semester]}{projectId ? ' (personalizadas del proyecto)' : ''}</h3>
          <span className="spacer" />
          {criteria.length > 0 && <small className="muted">{criteria.length} pregunta(s): {Object.entries(counts).map(([key, count]) => `${count} de ${SCALE_NAMES[key].toLowerCase()}`).join(', ')}</small>}
        </div>
        {query.isLoading ? <Loading /> : !criteria.length ? <Empty title="Sin preguntas" message={projectId ? 'Este proyecto aún no tiene preguntas personalizadas.' : 'Esta rúbrica todavía no tiene preguntas. Agrega la primera arriba.'} /> : (
          <ol className="rubric-list">
            {criteria.map((criterion, index) => {
              const value = valueOf(criterion)
              const dirty = value.pregunta !== criterion.label || value.escala !== scaleOf(criterion)
              return (
                <li key={criterion.id}>
                  <span className="q-number">{index + 1}</span>
                  <div className="rubric-fields">
                    <input className="control" maxLength={255} aria-label={`Pregunta ${index + 1}`} value={value.pregunta} onChange={(event) => edit(criterion.id, { pregunta: event.target.value })} />
                    <div className="row-wrap">
                      <select className="control compact" aria-label={`Escala de la pregunta ${index + 1}`} value={value.escala} onChange={(event) => edit(criterion.id, { escala: event.target.value })}>{Object.entries(SCALE_NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                      <small className="muted">{scalePreview(value.escala)}</small>
                      {criterion.project_id && <Badge tone="info">Personalizada</Badge>}
                    </div>
                  </div>
                  <div className="rubric-actions">
                    <IconButton icon={FiChevronUp} label="Subir" disabled={busy || index === 0} onClick={() => move(index, -1)} />
                    <IconButton icon={FiChevronDown} label="Bajar" disabled={busy || index === criteria.length - 1} onClick={() => move(index, 1)} />
                    <IconButton icon={FiSave} label="Guardar cambios" className={dirty ? 'success' : ''} disabled={busy || !dirty} onClick={() => guard(() => put(criterion), 'Pregunta guardada')} />
                    <IconButton icon={FiTrash2} label="Desactivar" className="danger" disabled={busy} onClick={() => remove(criterion)} />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <p className="muted small-text">Una pregunta que ya tiene calificaciones no se puede editar: conserva el historial. Desactívala y crea una nueva.</p>
      </div>
    </Sheet>
  )
}
