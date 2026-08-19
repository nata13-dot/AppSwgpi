import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArchive, FiBarChart2, FiCheckCircle, FiClock, FiDownload, FiEye,
  FiFileText, FiPlus, FiRefreshCw, FiUsers,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../services/api'
import { isProjectManagementRole, roleFromUser, useAuth } from '../hooks/useAuth'
import { confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, SearchField, StatusBadge } from '../components/common/Ui'
import { formatDate } from '../utils/formatters'
import EvaluationRooms from './evaluations/EvaluationRooms'
import RubricManager from './evaluations/RubricManager'
import EvaluationManagers from './evaluations/EvaluationManagers'
import { downloadApiFile } from '../utils/downloads'

const emptyEvaluation = { project_id: '', evaluation_room_id: '', semestre: 5, fecha_exposicion: '' }
const draftKey = (id) => `sgpi-score-draft:${id}`
const scoreTone = (evaluation) => {
  if (!Number(evaluation?.evaluators_count || 0)) return 'unscored'
  const score = Number(evaluation?.global_average || 0)
  if (score <= 69) return 'low'
  if (score <= 85) return 'medium'
  return 'high'
}
const evaluationProgress = (evaluation) => {
  const completed = Number(evaluation?.evaluators_count || 0)
  const expected = Number(evaluation?.expected_evaluators_count || 0)
  if (!completed) return { label: 'Sin evaluar', tone: 'unscored', percent: 0 }
  if (evaluation?.is_completed || (expected > 0 && completed >= expected)) return { label: 'Evaluado', tone: 'evaluated', percent: 100 }
  return { label: 'En evaluación', tone: 'in-progress', percent: expected ? Math.min(100, (completed / expected) * 100) : 0 }
}

export default function Evaluations({ initialTab = 'evaluations', initialArchived = false }) {
  const { user } = useAuth()
  const role = roleFromUser(user)
  const canManage = isProjectManagementRole(role) || Boolean(user?.is_evaluation_manager)
  const client = useQueryClient()
  const [tab, setTab] = useState(initialTab)
  const [archived, setArchived] = useState(initialArchived)
  const [selected, setSelected] = useState(null)
  const [scoreTarget, setScoreTarget] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyEvaluation)
  const [search, setSearch] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('')
  const [progressFilter, setProgressFilter] = useState('all')

  const evaluationsQuery = useQuery({
    queryKey: ['evaluations', archived],
    queryFn: () => api.get('/evaluations', { params: { archived: archived ? 1 : 0, per_page: 200 } }).then((response) => unwrapCollection(response.data)),
    refetchInterval: tab === 'evaluations' ? 15_000 : false,
  })
  const criteriaQuery = useQuery({
    queryKey: ['evaluation-criteria'],
    queryFn: () => api.get('/evaluations/criteria').then((response) => response.data),
  })
  const projectsQuery = useQuery({
    queryKey: ['evaluation-projects'],
    queryFn: () => api.get('/evaluations/projects').then((response) => unwrapCollection(response.data)),
    enabled: canManage,
  })
  const roomsQuery = useQuery({
    queryKey: ['evaluation-rooms', false],
    queryFn: () => api.get('/evaluations/rooms').then((response) => response.data),
    enabled: canManage,
  })

  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['evaluations'] })
    client.invalidateQueries({ queryKey: ['evaluation-rooms'] })
  }
  const action = useMutation({
    mutationFn: ({ endpoint, body }) => api.post(endpoint, body || {}),
    onSuccess: ({ data }) => { toast.success(data.message || 'Operación completada.'); invalidate(); setSelected(data.evaluation || selected) },
    onError: (error) => toast.error(apiError(error)),
  })
  const createEvaluation = useMutation({
    mutationFn: () => api.post('/evaluations', {
      ...form,
      project_id: Number(form.project_id),
      evaluation_room_id: form.evaluation_room_id ? Number(form.evaluation_room_id) : null,
      semestre: Number(form.semestre),
      fecha_exposicion: form.fecha_exposicion || null,
    }),
    onSuccess: () => { toast.success('Evaluación creada.'); setCreating(false); setForm(emptyEvaluation); invalidate() },
    onError: (error) => toast.error(apiError(error)),
  })
  const archiveEvaluation = async (evaluation) => {
    const verb = archived ? 'restaurar' : 'archivar'
    if (!await confirmAction({ title: `${verb[0].toUpperCase()}${verb.slice(1)} evaluación`, text: `Se va a ${verb} la evaluación de ${evaluation.project?.title || 'este proyecto'}.`, confirmText: `Sí, ${verb}` })) return
    action.mutate({ endpoint: `/evaluations/${evaluation.id}/${archived ? 'unarchive' : 'archive'}` })
  }
  const report = async (evaluation, teachers = false) => {
    try {
      const suffix = teachers ? '?audience=teachers' : ''
      await downloadApiFile(`/evaluations/${evaluation.id}/report.pdf${suffix}`, `reporte_evaluacion_${evaluation.id}${teachers ? '_docentes' : ''}.pdf`)
    } catch (error) { toast.error(apiError(error)) }
  }

  const filteredEvaluations = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return (evaluationsQuery.data || []).filter((evaluation) => {
      if (semesterFilter && Number(evaluation.semestre) !== Number(semesterFilter)) return false
      if (progressFilter === 'completed' && !evaluation.is_completed) return false
      if (progressFilter === 'pending' && evaluation.is_completed) return false
      if (progressFilter === 'unscored' && Number(evaluation.evaluators_count || 0) > 0) return false
      if (!term) return true
      const haystack = [
        evaluation.project?.title,
        evaluation.room?.nombre,
        evaluation.room?.salon,
        ...(evaluation.project?.students || []).flatMap((student) => [student.id, student.nombres, student.apa, student.ama]),
      ].filter(Boolean).join(' ').toLocaleLowerCase('es')
      return haystack.includes(term)
    })
  }, [evaluationsQuery.data, progressFilter, search, semesterFilter])

  const summary = useMemo(() => {
    const scored = filteredEvaluations.filter((item) => Number(item.evaluators_count || 0) > 0)
    const average = scored.length
      ? scored.reduce((total, item) => total + Number(item.global_average || 0), 0) / scored.length
      : 0
    return {
      total: filteredEvaluations.length,
      completed: filteredEvaluations.filter((item) => item.is_completed).length,
      pendingScores: filteredEvaluations.filter((item) => Number(item.evaluators_count || 0) < Number(item.expected_evaluators_count || 0)).length,
      average,
    }
  }, [filteredEvaluations])

  const groups = useMemo(() => {
    const map = new Map()
    for (const evaluation of filteredEvaluations) {
      const semester = evaluation.semestre || 'Sin semestre'
      if (!map.has(semester)) map.set(semester, new Map())
      const roomKey = evaluation.room?.id || `none-${semester}`
      const semesterRooms = map.get(semester)
      if (!semesterRooms.has(roomKey)) semesterRooms.set(roomKey, { room: evaluation.room, semester, evaluations: [] })
      semesterRooms.get(roomKey).evaluations.push(evaluation)
    }
    return [...map.entries()]
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([semester, rooms]) => ({
        semester,
        rooms: [...rooms.values()].map((group) => ({
          ...group,
          evaluations: group.evaluations.sort((a, b) => Number(a.presentation_order || 0) - Number(b.presentation_order || 0)),
        })),
      }))
  }, [filteredEvaluations])

  return <>
    <PageHeader eyebrow="Evaluación" title="Evaluaciones" description="Gestiona salas, secuencias, rúbricas, resultados y reportes con el mismo flujo operativo del sistema actual." actions={tab === 'evaluations' && canManage && <button className="btn-primary-app compact" onClick={() => setCreating(true)}><FiPlus /> Nueva evaluación</button>} />
    <div className="module-tabs">
      <button className={tab === 'evaluations' ? 'active' : ''} onClick={() => setTab('evaluations')}>Evaluaciones</button>
      <button className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>Salas</button>
      {canManage && <button className={tab === 'rubric' ? 'active' : ''} onClick={() => setTab('rubric')}>Rúbrica</button>}
      {role === 'admin' && <button className={tab === 'managers' ? 'active' : ''} onClick={() => setTab('managers')}>Gestores</button>}
    </div>

    {tab === 'rooms' && <EvaluationRooms canManage={canManage} />}
    {tab === 'rubric' && <RubricManager canManage={canManage} projects={projectsQuery.data || []} />}
    {tab === 'managers' && <EvaluationManagers />}
    {tab === 'evaluations' && <>
      <div className="stats-grid evaluation-stats">
        <article className="stat-card"><span className="stat-icon"><FiFileText /></span><div><small>Evaluaciones visibles</small><strong>{summary.total}</strong></div></article>
        <article className="stat-card"><span className="stat-icon color-1"><FiCheckCircle /></span><div><small>Finalizadas</small><strong>{summary.completed}</strong></div></article>
        <article className="stat-card"><span className="stat-icon color-2"><FiUsers /></span><div><small>Rúbricas pendientes</small><strong>{summary.pendingScores}</strong></div></article>
        <article className="stat-card"><span className="stat-icon color-3"><FiBarChart2 /></span><div><small>Promedio general</small><strong>{summary.average.toFixed(1)}%</strong></div></article>
      </div>
      <section className="panel">
      <div className="evaluation-toolbar">
        <div className="module-tabs compact-tabs">
          <button className={!archived ? 'active' : ''} onClick={() => setArchived(false)}>Activas</button>
          <button className={archived ? 'active' : ''} onClick={() => setArchived(true)}>Archivadas</button>
        </div>
        <button className="icon-text-button" onClick={() => evaluationsQuery.refetch()}><FiRefreshCw /> Actualizar</button>
      </div>
      <div className="table-toolbar admin-toolbar evaluation-filters">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar proyecto, estudiante o sala..." />
        <select value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}>
          <option value="">Todos los semestres</option>
          {[5, 6, 7, 8].map((semester) => <option value={semester} key={semester}>{semester}° semestre</option>)}
        </select>
        <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value)}>
          <option value="all">Todo el avance</option>
          <option value="pending">Pendientes</option>
          <option value="completed">Finalizadas</option>
          <option value="unscored">Sin calificaciones</option>
        </select>
      </div>
      {evaluationsQuery.isLoading ? <Loading /> : evaluationsQuery.isError ? <ErrorState message={apiError(evaluationsQuery.error)} onRetry={evaluationsQuery.refetch} /> : groups.length === 0 ? <Empty title={archived ? 'Sin evaluaciones archivadas' : 'Sin evaluaciones activas'} /> : (
        <div className="evaluation-semesters">{groups.map((semesterGroup) => <section className="evaluation-semester-section" key={semesterGroup.semester}>
          <header className="semester-heading"><div><span className="eyebrow">Etapa académica</span><h2>Semestre {semesterGroup.semester}</h2></div><span>{semesterGroup.rooms.reduce((total, room) => total + room.evaluations.length, 0)} evaluaciones</span></header>
          <div className="evaluation-groups">{semesterGroup.rooms.map((group) => <section className="evaluation-room-group" key={group.room?.id || `s-${group.semester}`}>
            <header>
              <div><span className="eyebrow">{group.room?.etapa || 'Evaluación'}</span><h2>{group.room?.nombre || 'Sin sala'}</h2><p>{group.room?.salon || 'Sin salón'}{group.room?.responsible_teacher ? ` · Responsable: ${[group.room.responsible_teacher.nombres, group.room.responsible_teacher.apa].filter(Boolean).join(' ')}` : ''}</p></div>
              <div className="room-summary-badges"><span>{group.evaluations.length} proyectos</span><span>{group.evaluations.filter((item) => item.is_completed).length} completos</span></div>
            </header>
            <div className="evaluation-card-list">{group.evaluations.map((evaluation) => {
              const progress = evaluationProgress(evaluation)
              const tone = scoreTone(evaluation)
              return <article className={`evaluation-work-card evaluation-${progress.tone} score-${tone} ${evaluation.is_completed ? 'complete' : ''}`} key={evaluation.id}>
            <div className="evaluation-order">{evaluation.presentation_order || '-'}</div>
            <div className="evaluation-main">
              <div className="evaluation-title-row"><div><h3>{evaluation.project?.title || `Proyecto #${evaluation.project_id}`}</h3><small>{evaluation.project?.students?.map((student) => [student.nombres, student.apa].filter(Boolean).join(' ')).join(', ') || 'Sin integrantes'}</small></div><div className="evaluation-status-stack"><span className={`evaluation-state-badge ${progress.tone}`}>{progress.label}</span><StatusBadge value={evaluation.is_completed ? 'finalizada' : evaluation.sequence_status || evaluation.estado} /></div></div>
              <div className="evaluation-metrics">
                <span><FiClock /> Fecha <strong>{formatDate(evaluation.fecha_exposicion)}</strong></span>
                <span className={`score-indicator ${tone}`}>Promedio <strong>{Number(evaluation.evaluators_count || 0) ? `${Number(evaluation.global_average || 0).toFixed(1)}%` : 'Sin calificar'}</strong><i><b style={{ width: Number(evaluation.evaluators_count || 0) ? `${Math.min(100, Number(evaluation.global_average || 0))}%` : '0%' }} /></i></span>
                <span className="rubric-progress">Rúbricas <strong>{evaluation.evaluators_count}/{evaluation.expected_evaluators_count} docentes</strong><i><b style={{ width: `${progress.percent}%` }} /></i></span>
                <span>Documentos <strong>{evaluation.document_readiness?.all_students_released ? 'Listos' : 'Pendientes'}</strong></span>
              </div>
              {evaluation.current_teacher_has_scores && <p className="evaluation-context-note">Tu rúbrica ya fue registrada. Intentos utilizados: {evaluation.current_teacher_attempts}/{evaluation.max_attempts}.</p>}
              {!evaluation.can_score_now && !evaluation.is_completed && <p className="evaluation-context-note warning">La evaluación aún no está habilitada para captura según la secuencia de la sala.</p>}
              <div className="row-actions evaluation-actions">
                <button onClick={() => setSelected(evaluation)}><FiEye /> Detalle</button>
                {evaluation.can_score_now && <button onClick={() => setScoreTarget(evaluation)}><FiCheckCircle /> {evaluation.current_teacher_has_scores ? 'Modificar rúbrica' : 'Evaluar'}</button>}
                <button onClick={() => report(evaluation)}><FiDownload /> PDF</button>
                <button onClick={() => report(evaluation, true)}><FiDownload /> PDF docentes</button>
                {canManage && <button onClick={() => archiveEvaluation(evaluation)}><FiArchive /> {archived ? 'Restaurar' : 'Archivar'}</button>}
              </div>
            </div>
            </article>})}</div>
          </section>)}</div>
        </section>)}</div>
      )}
      </section>
    </>}

    <EvaluationDetail key={selected?.id || 'no-detail'} evaluation={selected} canManage={canManage} onClose={() => setSelected(null)} onAction={(endpoint, body) => action.mutate({ endpoint, body })} />
    <ScoreModal key={scoreTarget?.id || 'no-score'} evaluation={scoreTarget} criteriaPayload={criteriaQuery.data} onClose={() => setScoreTarget(null)} onSaved={() => { setScoreTarget(null); invalidate() }} />
    <Modal open={creating} title="Nueva evaluación" onClose={() => setCreating(false)}>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createEvaluation.mutate() }}><div className="form-grid">
        <label className="full-field">Proyecto<select required value={form.project_id} onChange={(event) => {
          const project = projectsQuery.data?.find((item) => String(item.id) === event.target.value)
          setForm({ ...form, project_id: event.target.value, semestre: project?.presentation_semester || project?.semestre || form.semestre })
        }}><option value="">Selecciona</option>{projectsQuery.data?.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>
        <label>Sala<select value={form.evaluation_room_id} onChange={(event) => setForm({ ...form, evaluation_room_id: event.target.value })}><option value="">Sin sala</option>{roomsQuery.data?.map((room) => <option value={room.id} key={room.id}>{room.nombre} · S{room.semestre}</option>)}</select></label>
        <label>Semestre<select value={form.semestre} onChange={(event) => setForm({ ...form, semestre: event.target.value })}>{[5, 6, 7, 8].map((semester) => <option key={semester}>{semester}</option>)}</select></label>
        <label className="full-field">Fecha de exposición<input type="datetime-local" value={form.fecha_exposicion} onChange={(event) => setForm({ ...form, fecha_exposicion: event.target.value })} /></label>
      </div><div className="modal-actions"><button type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="btn-primary-app compact" disabled={createEvaluation.isPending}>Crear evaluación</button></div></form>
    </Modal>
  </>
}

function ScoreModal({ evaluation, criteriaPayload, onClose, onSaved }) {
  let initialDraft = {}
  try { initialDraft = evaluation ? JSON.parse(localStorage.getItem(draftKey(evaluation.id)) || '{}') : {} } catch { initialDraft = {} }
  const [form, setForm] = useState(() => ({
    scores: Object.fromEntries((initialDraft.scores || []).map((score) => [score.criterio, score.nivel])),
    comments: Object.fromEntries((initialDraft.scores || []).map((score) => [score.criterio, score.comentario || ''])),
    general_comment: initialDraft.general_comment || '',
    apto_titulacion: initialDraft.apto_titulacion ?? (evaluation?.current_teacher_apto_titulacion === true ? '1' : evaluation?.current_teacher_apto_titulacion === false ? '0' : ''),
  }))
  const criteria = (criteriaPayload?.criteria || []).filter((criterion) => Number(criterion.semestre) === Number(evaluation?.semestre) && (!criterion.project_id || Number(criterion.project_id) === Number(evaluation?.project_id)))
  const levels = criteriaPayload?.levels || []
  const mode = criteriaPayload?.score_modes?.[String(evaluation?.semestre)] || 'levels'
  const scoreOptions = mode === 'numeric'
    ? ['totalmente_en_desacuerdo', 'en_desacuerdo', 'neutral', 'de_acuerdo', 'totalmente_de_acuerdo'].map((key, index) => ({ key, label: `${index + 1} punto${index ? 's' : ''}` }))
    : levels.map((level) => ({ key: level.key, label: `${level.label} (${level.puntaje} pts)` }))

  useEffect(() => {
    if (!evaluation) return
    localStorage.setItem(draftKey(evaluation.id), JSON.stringify({
      general_comment: form.general_comment,
      apto_titulacion: form.apto_titulacion,
      scores: criteria.map((criterion) => ({ criterio: criterion.key, nivel: form.scores[criterion.key] || '', comentario: form.comments[criterion.key] || '' })),
    }))
  }, [form, criteria, evaluation])

  const mutation = useMutation({
    mutationFn: async () => {
      let confirm_update = false
      if (evaluation.current_teacher_has_scores) {
        confirm_update = await confirmAction({ title: 'Modificar evaluación existente', text: `Oportunidades usadas: ${evaluation.current_teacher_attempts}/${evaluation.max_attempts}.`, confirmText: 'Sí, modificar' })
        if (!confirm_update) throw new Error('cancelled')
      }
      const body = {
        scores: criteria.map((criterion) => ({ criterio: criterion.key, nivel: form.scores[criterion.key], comentario: form.comments[criterion.key] || null })),
        general_comment: form.general_comment || null,
        confirm_update,
      }
      if (form.apto_titulacion !== '') body.apto_titulacion = form.apto_titulacion === '1'
      return api.post(`/evaluations/${evaluation.id}/score`, body)
    },
    onSuccess: () => { localStorage.removeItem(draftKey(evaluation.id)); toast.success('Rúbrica guardada correctamente.'); onSaved() },
    onError: (error) => { if (error.message !== 'cancelled') toast.error(apiError(error)) },
  })
  const submit = (event) => {
    event.preventDefault()
    if (criteria.some((criterion) => !form.scores[criterion.key])) return toast.warning('Responde todas las preguntas de la rúbrica.')
    mutation.mutate()
  }
  return <Modal open={Boolean(evaluation)} title={`Evaluar: ${evaluation?.project?.title || ''}`} onClose={onClose}>
    <form className="modal-form score-form" onSubmit={submit}>
      <div className="score-context"><span>Orden #{evaluation?.presentation_order || '-'}</span><span>Intentos {evaluation?.current_teacher_attempts || 0}/{evaluation?.max_attempts || 1}</span><span>Método {mode === 'numeric' ? '1 a 5' : 'Niveles'}</span></div>
      {criteria.length === 0 ? <Empty title="Rúbrica sin criterios" message="Un gestor debe configurar preguntas para este semestre." /> : criteria.map((criterion) => <fieldset className="score-question" key={criterion.id}>
        <legend>{criterion.label}{criterion.project_id ? ' (proyecto)' : ''}</legend>
        <select required value={form.scores[criterion.key] || ''} onChange={(event) => setForm({ ...form, scores: { ...form.scores, [criterion.key]: event.target.value } })}>
          <option value="">Selecciona una respuesta</option>
          {scoreOptions.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}
        </select>
        <textarea rows="2" placeholder="Comentario opcional" value={form.comments[criterion.key] || ''} onChange={(event) => setForm({ ...form, comments: { ...form.comments, [criterion.key]: event.target.value } })} />
      </fieldset>)}
      <label>Comentario general<textarea rows="3" value={form.general_comment} onChange={(event) => setForm({ ...form, general_comment: event.target.value })} /></label>
      {Number(evaluation?.semestre) === 8 && <label>Apto para titulación<select value={form.apto_titulacion} onChange={(event) => setForm({ ...form, apto_titulacion: event.target.value })}><option value="">Sin respuesta</option><option value="1">Sí</option><option value="0">No</option></select></label>}
      <small className="draft-note">El progreso se guarda automáticamente en este navegador.</small>
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={mutation.isPending || criteria.length === 0}>Guardar rúbrica</button></div>
    </form>
  </Modal>
}

function EvaluationDetail({ evaluation, canManage, onClose, onAction }) {
  const [feedback, setFeedback] = useState(evaluation?.room_feedback || '')
  return <Modal open={Boolean(evaluation)} title="Detalle de evaluación" onClose={onClose}>
    <div className="modal-form evaluation-detail">
      <h3>{evaluation?.project?.title}</h3>
      <div className="evaluation-metrics"><span>Promedio <strong>{evaluation?.global_average || 0}%</strong></span><span>Evaluadores <strong>{evaluation?.evaluators_count}/{evaluation?.expected_evaluators_count}</strong></span><span>Resultado <strong>{evaluation?.resultado || 'pendiente'}</strong></span></div>
      {evaluation?.titulation_apt_summary?.applies && <div className="review-comment"><strong>Apto para titulación:</strong> {evaluation.titulation_apt_summary.label}</div>}
      {(evaluation?.teacher_breakdown || []).length === 0 ? <Empty title="Sin rúbricas registradas" /> : evaluation.teacher_breakdown.map((teacher) => <article className="teacher-score-card" key={teacher.teacher_id}>
        <header><strong>{teacher.teacher_name}</strong><StatusBadge value={`${teacher.average}%`} /></header>
        {teacher.general_comment && <p><strong>Comentario general:</strong> {teacher.general_comment}</p>}
        {teacher.can_view_score_detail ? <div>{teacher.scores.map((score) => <div className="criterion-result" key={score.criterio}><strong>{score.criterio_label}</strong><span>{score.score_mode === 'numeric' ? `${score.puntaje}/${score.puntaje_max}` : score.nivel_label}</span><p>{score.comentario || 'Sin comentario.'}</p></div>)}</div> : <p className="privacy-note">El desglose de este docente es privado.</p>}
      </article>)}
      <section className="feedback-box"><h3>Retroalimentación de sala</h3><p>{evaluation?.room_feedback || 'Sin retroalimentación registrada.'}</p>
        {(canManage || evaluation?.is_room_responsible) && <><textarea rows="3" value={feedback} onChange={(event) => setFeedback(event.target.value)} /><button className="btn-primary-app compact" onClick={() => onAction(`/evaluations/${evaluation.id}/feedback`, { room_feedback: feedback })}>Guardar retroalimentación</button></>}
      </section>
      {evaluation?.can_mark_completed && <button className="btn-primary-app" onClick={() => onAction(`/evaluations/${evaluation.id}/mark-completed`)}><FiCheckCircle /> Marcar evaluación como completada</button>}
    </div>
  </Modal>
}
