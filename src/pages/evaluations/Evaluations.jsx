import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArchive, FiCheckCircle, FiChevronDown, FiChevronRight, FiClipboard, FiEyeOff, FiFileText, FiGrid,
  FiInfo, FiList, FiSkipForward, FiTrash2, FiArrowLeft, FiX,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { canDownloadFullEvaluationReports, isAdmin, isEvaluationManager } from '../../lib/permissions'
import { useSemesters } from '../../lib/semesters'
import { formatDateTime, fullName } from '../../utils/formatters'
import { Badge, Button, Card, confirmAction, Empty, ErrorState, IconButton, Loading, Page, Sheet } from '../../components/ui'
import { controlNumbers, downloadReport, projectCompany, projectDetailRows, roomName, stageLabel, Verdict, verdictFor } from './evaluationShared'
import ScoreSheet from './ScoreSheet'
import BreakdownSheet from './BreakdownSheet'
import RubricManager from './RubricManager'

const roomKeyOf = (evaluation) => String(evaluation.room?.id || evaluation.evaluation_room_id || 'sin-sala')

// Una evaluación por sala y proyecto, en el orden de paso de cada sala.
function normalize(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = `${item.evaluation_room_id || item.room?.id || 'sin-sala'}:${item.project_id || item.project?.id || item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => {
    if (Number(a.semestre || 0) !== Number(b.semestre || 0)) return Number(a.semestre || 0) - Number(b.semestre || 0)
    const roomA = String(a.room?.id || a.evaluation_room_id || '')
    const roomB = String(b.room?.id || b.evaluation_room_id || '')
    if (roomA !== roomB) return roomA.localeCompare(roomB, 'es', { numeric: true })
    const orderA = Number(a.presentation_order || 0)
    const orderB = Number(b.presentation_order || 0)
    if (orderA && orderB && orderA !== orderB) return orderA - orderB
    if (orderA !== orderB) return orderA ? -1 : 1
    return new Date(a.fecha_exposicion || 0) - new Date(b.fecha_exposicion || 0)
  })
}

async function fetchAll(params) {
  const first = (await api.get('/evaluations', { params: { ...params, per_page: 200 }, timeout: 30_000 })).data
  let items = first.data || []
  for (let page = Number(first.current_page || 1) + 1; page <= Number(first.last_page || 1); page++) {
    items = items.concat((await api.get('/evaluations', { params: { ...params, per_page: 200, page } })).data.data || [])
  }
  return normalize(items)
}

/** Evaluaciones por semestre y sala (Frontend_Swgpi/pages/admin/evaluations.php y evaluations-archived.php). */
export default function Evaluations({ archived = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const manager = isEvaluationManager(user)
  const fullReports = canDownloadFullEvaluationReports(user)
  const { semesters } = useSemesters('career', { min: 5, max: 8 })
  const [semester, setSemester] = useState('')
  const [projectId, setProjectId] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [sheet, setSheet] = useState(null) // { type: 'score' | 'breakdown' | 'details', id } | { type: 'rubric', projectId }

  const params = { archived: archived ? 1 : 0, ...(semester ? { semestre: semester } : {}), ...(projectId ? { project_id: projectId } : {}) }
  // Actualización en vivo cada 15 s mientras no haya una hoja abierta (igual que el front de PHP).
  const query = useQuery({ queryKey: ['evaluations', params], queryFn: () => fetchAll(params), refetchInterval: sheet || selecting ? false : 15_000, refetchIntervalInBackground: false })
  const projects = useQuery({ queryKey: ['evaluation-projects'], queryFn: () => api.get('/evaluations/projects', { timeout: 45_000 }).then((response) => response.data || []), staleTime: 30_000 })
  const evaluations = useMemo(() => query.data || [], [query.data])
  const refresh = () => client.invalidateQueries({ queryKey: ['evaluations'] })
  const projectOf = (evaluation) => evaluation?.project || (projects.data || []).find((project) => String(project.id) === String(evaluation?.project_id)) || {}
  const current = sheet?.id ? evaluations.find((item) => Number(item.id) === Number(sheet.id)) : null

  // Semestre → sala → evaluaciones.
  const groups = useMemo(() => {
    const result = []
    evaluations.forEach((evaluation) => {
      const semesterKey = String(evaluation.semestre || 'Sin semestre')
      let semesterGroup = result.at(-1)
      if (semesterGroup?.key !== semesterKey) { semesterGroup = { key: semesterKey, rooms: [] }; result.push(semesterGroup) }
      const roomKey = roomKeyOf(evaluation)
      let room = semesterGroup.rooms.at(-1)
      if (room?.key !== roomKey) { room = { key: roomKey, room: evaluation.room, items: [] }; semesterGroup.rooms.push(room) }
      room.items.push(evaluation)
    })
    return result
  }, [evaluations])

  const archivable = (items) => (manager && !archived ? items.filter((item) => item.can_manage_evaluations).map((item) => Number(item.id)) : [])
  const toggleIds = (ids, on) => setSelected((currentSet) => { const next = new Set(currentSet); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next })
  const allSelected = (ids) => ids.length > 0 && ids.every((id) => selected.has(id))
  const toggleRoom = (key) => setExpanded((currentSet) => { const next = new Set(currentSet); if (next.has(key)) next.delete(key); else next.add(key); return next })

  const run = async (action, success) => {
    try {
      const response = await action()
      toast.success(response?.data?.message || success)
      refresh()
    } catch (error) { toast.error(apiError(error)) }
  }
  const archiveSelected = async () => {
    if (!selecting) { setSelecting(true); setSelected(new Set()); return }
    if (!selected.size) { toast.warning('Selecciona evaluaciones, una sala completa o un semestre completo para archivar.'); return }
    const ids = [...selected]
    if (!(await confirmAction({ title: 'Archivar seleccionados', text: `Se archivarán las evaluaciones seleccionadas. Se conservan sus reportes y detalle. Total: ${ids.length} evaluación${ids.length === 1 ? '' : 'es'}.`, confirmText: 'Archivar seleccionados' }))) return
    await run(() => api.post('/evaluations/archive-selected', { ids }, { timeout: 45_000 }), 'Evaluaciones archivadas correctamente')
    setSelecting(false)
    setSelected(new Set())
  }
  const advance = async (roomId) => {
    if (await confirmAction({ title: 'Avanzar turno', text: 'El proyecto actual se marcará como finalizado y se activará el siguiente proyecto de la sala.', confirmText: 'Sí, avanzar' })) {
      run(() => api.post(`/evaluations/rooms/${roomId}/advance`, { continue_next: true }), 'Turno actualizado')
    }
  }
  const markCompleted = async (evaluation) => {
    if (await confirmAction({ title: 'Marcar evaluación como completada', text: `Se conservan las ${evaluation.evaluators_count || 0} rúbricas registradas de ${evaluation.expected_evaluators_count || 0} docentes asignados. Los docentes ausentes quedarán sin evaluación.`, confirmText: 'Sí, marcar evaluada' })) {
      run(() => api.post(`/evaluations/${evaluation.id}/mark-completed`, {}), 'Evaluación marcada como completada')
    }
  }
  const archiveOne = async (evaluation) => {
    if (await confirmAction({ title: 'Archivar evaluación', text: 'La evaluación dejará de aparecer en la vista principal, pero conserva sus reportes y detalle.', confirmText: 'Sí, archivar' })) {
      run(() => api.post(`/evaluations/${evaluation.id}/archive`, {}), 'Evaluación archivada')
    }
  }
  const removeOne = async (evaluation) => {
    if (await confirmAction({ title: 'Eliminar evaluación', text: '¿Eliminar esta evaluación?', confirmText: 'Sí, eliminar', danger: true })) {
      run(() => api.delete(`/evaluations/${evaluation.id}`), 'Evaluación eliminada')
    }
  }

  return (
    <Page title={archived ? 'Evaluaciones archivadas' : 'Evaluaciones'}
      subtitle={archived ? 'Evaluaciones finalizadas que ya no aparecen en la vista principal. El historial no se restaura: para repetir una presentación registra una autorización de nuevo intento en Seguimiento académico.' : 'Califica en el turno de tu sala, revisa el desglose y descarga los reportes.'}
      actions={<>
        <Button variant="ghost" icon={archived ? FiArrowLeft : FiArchive} onClick={() => navigate(archived ? '/evaluations' : '/evaluations-archived')}>{archived ? 'Volver a evaluaciones' : 'Ver archivadas'}</Button>
        {manager && !archived && <Button variant={selecting ? 'warning' : 'ghost'} icon={FiArchive} onClick={archiveSelected}>{selecting ? `Archivar seleccionados${selected.size ? ` (${selected.size})` : ''}` : 'Archivar'}</Button>}
        {selecting && <Button variant="ghost" icon={FiX} onClick={() => { setSelecting(false); setSelected(new Set()) }}>Cancelar</Button>}
        {manager && <Button variant="soft" icon={FiList} onClick={() => setSheet({ type: 'rubric', projectId: '' })}>Rúbricas</Button>}
        {isAdmin(user) && <Button variant="soft" icon={FiGrid} onClick={() => navigate('/evaluation-rooms')}>Gestionar salas</Button>}
      </>}>
      <div className="toolbar">
        <select className="control" aria-label="Semestre" value={semester} onChange={(event) => setSemester(event.target.value)}>
          <option value="">Todos los semestres</option>
          {semesters.map((value) => <option key={value} value={value}>{value} - {stageLabel({ 5: 'propuesta', 6: 'avance', 7: 'avance', 8: 'titulacion' }[value])}</option>)}
        </select>
        <select className="control grow" aria-label="Proyecto" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Todos los proyectos</option>
          {(projects.data || []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
      </div>

      {query.isLoading ? <Loading rows={5} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !evaluations.length ? <Empty title={archived ? 'No hay evaluaciones archivadas' : 'No hay evaluaciones'} message="Las evaluaciones aparecen cuando se crean salas con proyectos." /> : groups.map((semesterGroup) => {
        const items = semesterGroup.rooms.flatMap((room) => room.items)
        const done = items.filter((item) => item.is_completed).length
        const semesterIds = archivable(items)
        return (
          <section key={semesterGroup.key} className="eval-semester">
            <header className="eval-semester-head">
              {selecting && semesterIds.length > 0 && <input type="checkbox" aria-label={`Seleccionar semestre ${semesterGroup.key}`} checked={allSelected(semesterIds)} onChange={(event) => toggleIds(semesterIds, event.target.checked)} />}
              <div><h2>Semestre {semesterGroup.key}</h2><small>{archived ? 'Evaluaciones archivadas' : 'Evaluaciones activas'}</small></div>
              <span className="spacer" />
              <Badge>{items.length} evaluación{items.length === 1 ? '' : 'es'}</Badge>
              <Badge tone="success">{done} completa{done === 1 ? '' : 's'}</Badge>
              {items.length - done > 0 && <Badge tone="warning">{items.length - done} pendiente{items.length - done === 1 ? '' : 's'}</Badge>}
            </header>
            {semesterGroup.rooms.map(({ key, room, items: roomItems }) => {
              const open = expanded.has(key)
              const evaluated = roomItems.filter((item) => item.is_completed).length
              const active = roomItems.filter((item) => item.sequence_status === 'activo').length
              const canAdvance = room?.id && roomItems.some((item) => item.can_manage_evaluations || item.is_room_responsible) && room?.sequence_locked && !room?.completed_at
              const roomIds = archivable(roomItems)
              return (
                <Card key={key} className="eval-room" flush>
                  <header className="eval-room-head">
                    {selecting && roomIds.length > 0 && <input type="checkbox" aria-label="Seleccionar sala" checked={allSelected(roomIds)} onChange={(event) => toggleIds(roomIds, event.target.checked)} />}
                    <button type="button" className="eval-room-toggle" aria-expanded={open} onClick={() => toggleRoom(key)}>
                      {open ? <FiChevronDown /> : <FiChevronRight />}
                      <span><strong>{roomName(room)}</strong><small>{room?.salon || '—'} · Responsable: {fullName(room?.responsible_teacher) === 'Sin nombre' ? '—' : fullName(room?.responsible_teacher)}</small></span>
                    </button>
                    <div className="row-wrap">
                      <Badge>{roomItems.length} proyecto{roomItems.length === 1 ? '' : 's'}</Badge>
                      <Badge tone="success">{evaluated} evaluado{evaluated === 1 ? '' : 's'}</Badge>
                      {active > 0 && <Badge tone="info">{active} en turno</Badge>}
                      {roomItems.length - evaluated > 0 && <Badge tone="warning">{roomItems.length - evaluated} pendiente{roomItems.length - evaluated === 1 ? '' : 's'}</Badge>}
                    </div>
                    <div className="row-wrap">
                      {canAdvance && <Button size="sm" variant="warning" icon={FiSkipForward} onClick={() => advance(room.id)}>Siguiente proyecto</Button>}
                      {room?.id && fullReports && <Button size="sm" variant="ghost" icon={FiFileText} onClick={() => downloadReport('room', room.id, false)}>Reporte completo</Button>}
                      {room?.id && <Button size="sm" variant="ghost" icon={FiEyeOff} onClick={() => downloadReport('room', room.id, true)}>{fullReports ? 'Informe limitado' : 'Informe de sala'}</Button>}
                    </div>
                  </header>
                  {open && (
                    <ul className="eval-list">
                      {roomItems.map((evaluation) => (
                        <EvaluationItem key={evaluation.id} evaluation={evaluation} project={projectOf(evaluation)} fullReports={fullReports} archived={archived}
                          selecting={selecting && evaluation.can_manage_evaluations} checked={selected.has(Number(evaluation.id))} onCheck={(on) => toggleIds([Number(evaluation.id)], on)}
                          onScore={() => setSheet({ type: 'score', id: evaluation.id })} onBreakdown={() => setSheet({ type: 'breakdown', id: evaluation.id })}
                          onDetails={() => setSheet({ type: 'details', id: evaluation.id })} onRubric={() => setSheet({ type: 'rubric', projectId: evaluation.project_id })}
                          onComplete={() => markCompleted(evaluation)} onArchive={() => archiveOne(evaluation)} onDelete={() => removeOne(evaluation)} />
                      ))}
                    </ul>
                  )}
                </Card>
              )
            })}
          </section>
        )
      })}

      {sheet?.type === 'score' && current && <ScoreSheet evaluation={current} project={projectOf(current)} onClose={() => setSheet(null)} onSaved={refresh} />}
      {sheet?.type === 'breakdown' && current && <BreakdownSheet evaluation={current} onClose={() => setSheet(null)} onSaved={refresh} />}
      {sheet?.type === 'details' && current && <EvaluationDetails evaluation={current} project={projectOf(current)} onClose={() => setSheet(null)} />}
      {sheet?.type === 'rubric' && <RubricManager projectId={sheet.projectId} projects={projects.data || []} onClose={() => setSheet(null)} />}
    </Page>
  )
}

function EvaluationItem({ evaluation, project, fullReports, archived, selecting, checked, onCheck, onScore, onBreakdown, onDetails, onRubric, onComplete, onArchive, onDelete }) {
  const statuses = new Map((evaluation.document_readiness?.students || []).map((student) => [String(student.id), student]))
  const uploaded = Boolean(evaluation.document_readiness?.presentation_uploaded)
  const statusTone = { activo: 'info', evaluado: 'success', pendiente: 'neutral' }[evaluation.sequence_status] || 'neutral'
  const verdict = evaluation.verdict || verdictFor(evaluation.global_average)
  const company = projectCompany(project)
  return (
    <li className={`eval-item ${evaluation.is_completed ? 'done' : ''} ${evaluation.sequence_status === 'activo' ? 'active' : ''}`}>
      <div className="eval-item-main">
        {selecting && <input type="checkbox" aria-label="Seleccionar evaluación" checked={checked} onChange={(event) => onCheck(event.target.checked)} />}
        <span className="eval-order"><small>Orden</small>#{evaluation.presentation_order || '–'}</span>
        <div className="eval-item-text">
          <strong>{project?.title || 'N/A'}</strong>
          <small>Semestre {evaluation.semestre || '–'} · {stageLabel(evaluation.etapa)} · {evaluation.fecha_exposicion ? formatDateTime(evaluation.fecha_exposicion) : 'Sin fecha'}</small>
          <div className="row-wrap mt-1">
            <Badge tone={statusTone}>{evaluation.sequence_status || evaluation.estado || '—'}</Badge>
            <Badge tone={uploaded ? 'success' : 'danger'}>{uploaded ? 'Presentación cargada' : 'Presentación pendiente'}</Badge>
            {evaluation.is_completed && <Badge tone="success" icon={FiCheckCircle}>{evaluation.evaluated_by_all ? 'Evaluado por todos' : 'Evaluación completada'}</Badge>}
          </div>
          <ul className="member-dots">
            {(project?.students || []).map((student) => {
              const released = Boolean(statuses.get(String(student.id))?.released)
              return <li key={student.id} className={released ? 'ok' : 'no'} title={released ? 'Alumno liberado' : 'Alumno no liberado'}>{fullName(student)}</li>
            })}
            {!(project?.students || []).length && <li className="muted">Sin integrantes</li>}
          </ul>
          {(company || controlNumbers(project)) && <small className="muted">{[company && `Empresa: ${company}`, controlNumbers(project) && `No. control: ${controlNumbers(project)}`].filter(Boolean).join(' · ')}</small>}
        </div>
      </div>
      <div className="eval-item-side">
        <button type="button" className={`eval-score ${evaluation.evaluators_count > 0 ? verdict.tone : 'secondary'}`} onClick={onBreakdown}>
          {evaluation.evaluators_count > 0
            ? <><Verdict verdict={verdict} /><strong>{evaluation.global_average}%</strong><small>{evaluation.evaluators_count}/{evaluation.expected_evaluators_count || 0} evaluadores</small></>
            : <><strong>Sin calificaciones</strong><small>0/{evaluation.expected_evaluators_count || 0} evaluadores</small></>}
        </button>
        <div className="eval-actions">
          {!archived && <Button size="sm" variant="success" icon={FiClipboard} disabled={!evaluation.can_score_now} title={evaluation.score_block_reason || 'Evaluar'} onClick={onScore}>Evaluar</Button>}
          {evaluation.can_mark_completed && <Button size="sm" variant="ghost" icon={FiCheckCircle} onClick={onComplete}>Marcar evaluada</Button>}
          <IconButton icon={FiInfo} label="Detalles del proyecto" onClick={onDetails} />
          {fullReports && <IconButton icon={FiFileText} label="Reporte completo con nombres de evaluadores" onClick={() => downloadReport('evaluation', evaluation.id, false)} />}
          <IconButton icon={FiEyeOff} label="Informe limitado: evaluadores sin nombre y sólo comentarios generales" onClick={() => downloadReport('evaluation', evaluation.id, true)} />
          {evaluation.can_manage_evaluations && Number(evaluation.semestre) === 8 && <IconButton icon={FiList} label="Rúbrica personalizada" onClick={onRubric} />}
          {evaluation.can_manage_evaluations && !archived && <IconButton icon={FiArchive} label="Archivar" onClick={onArchive} />}
          {evaluation.can_manage_evaluations && <IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={onDelete} />}
        </div>
        {!evaluation.can_score_now && evaluation.score_block_reason && !archived && <small className="muted">{evaluation.score_block_reason}</small>}
      </div>
    </li>
  )
}

function EvaluationDetails({ evaluation, project, onClose }) {
  const rows = projectDetailRows(project)
  return (
    <Sheet open title={project?.title || 'Detalles del proyecto'} onClose={onClose} size="md">
      <div className="row-wrap mb-3">
        <Badge>Orden #{evaluation.presentation_order || '–'}</Badge><Badge>Semestre {evaluation.semestre || '–'}</Badge><Badge>{stageLabel(evaluation.etapa)}</Badge>
      </div>
      {rows.length ? <dl className="detail-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted">No hay datos adicionales registrados para este proyecto.</p>}
    </Sheet>
  )
}
