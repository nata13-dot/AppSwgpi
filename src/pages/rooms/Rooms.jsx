import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiArrowLeft, FiClock, FiEdit2, FiEyeOff, FiFileText, FiLock, FiPause, FiPlay, FiPlus, FiRotateCcw, FiSave, FiSkipForward, FiSquare, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { canDownloadFullEvaluationReports, canManageProjects } from '../../lib/permissions'
import { useSemesters } from '../../lib/semesters'
import { formatDateTime, matchesSearch } from '../../utils/formatters'
import { Badge, Button, Card, Chips, confirmAction, Empty, ErrorState, Field, IconButton, Loading, Page, SearchInput, Sheet, Switch, Tabs } from '../../components/ui'
import { downloadReport, roomName } from '../evaluations/evaluationShared'
import { apiToInput, authorsOf, EVALUATOR_PROFILES, nextMinute, orderedProjects, personName, projectSemester, ROOM_STAGES, roomPayload, roomSearchText } from './roomShared'
import RoomWizard from './RoomWizard'
import { RoomCountdown } from '../../components/RoomCountdown'

/** Salas de evaluación (Frontend_Swgpi/pages/admin/evaluation-rooms.php). */
export default function Rooms() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const manage = canManageProjects(user)
  const fullReports = canDownloadFullEvaluationReports(user)
  const { semesters } = useSemesters('career', { min: 5, max: 8 })
  const [semester, setSemester] = useState('')
  const [status, setStatus] = useState('active')
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [view, setView] = useState('rooms')
  const [sheet, setSheet] = useState(null) // { type: 'wizard', room } | { type: 'schedule', room }
  const archived = status === 'archived'

  // Las salas se consultan cada 5 s (turnos y temporizador en vivo) mientras no haya una hoja abierta.
  const roomsQuery = useQuery({ queryKey: ['evaluation-rooms', archived], queryFn: () => api.get('/evaluations/rooms', { params: { archived: archived ? 1 : 0 }, timeout: 30_000 }).then((response) => response.data || []), refetchInterval: sheet ? false : 5_000 })
  const projectsQuery = useQuery({ queryKey: ['evaluation-projects'], queryFn: () => api.get('/evaluations/projects', { timeout: 45_000 }).then((response) => response.data || []), enabled: manage, staleTime: 30_000 })
  const teachersQuery = useQuery({
    queryKey: ['evaluators'],
    queryFn: () => api.get('/users', { params: { perfil_ids: Object.keys(EVALUATOR_PROFILES).join(','), status: 'active', compact: 1, per_page: 500 }, timeout: 45_000 }).then((response) => (response.data.data || [])
      .sort((a, b) => (Number(a.perfil_id) === 2 ? 0 : 1) - (Number(b.perfil_id) === 2 ? 0 : 1) || personName(a).localeCompare(personName(b)))),
    enabled: manage, staleTime: 60_000,
  })
  const catalog = useQuery({ queryKey: ['academic-catalog'], queryFn: () => api.get('/academic-operations/catalog').then((response) => response.data), enabled: manage, staleTime: 60_000 })
  const rooms = useMemo(() => roomsQuery.data || [], [roomsQuery.data])

  // El proyecto queda "asignado" a la sala que lo tiene, según la lista de salas más reciente.
  const projects = useMemo(() => {
    const assignments = new Map()
    rooms.forEach((room) => (room.projects || []).forEach((project) => assignments.set(String(project.id), room.id)))
    return (projectsQuery.data || []).map((project) => ({ ...project, assigned_room_id: assignments.get(String(project.id)) || null }))
  }, [projectsQuery.data, rooms])
  const roomOf = (projectId) => rooms.find((room) => (room.projects || []).some((project) => Number(project.id) === Number(projectId))) || null
  const needle = search
  const visibleRooms = rooms.filter((room) => (!semester || String(room.semestre) === semester) && matchesSearch(roomSearchText(room, roomName(room)), needle))
  const visibleProjects = projects.filter((project) => (!semester || String(projectSemester(project)) === semester) && matchesSearch(`${project.title} ${authorsOf(project)} ${roomOf(project.id)?.nombre || ''}`, needle))
  const assigned = new Set(rooms.flatMap((room) => (room.projects || []).map((project) => Number(project.id))))
  const refresh = () => { client.invalidateQueries({ queryKey: ['evaluation-rooms'] }); client.invalidateQueries({ queryKey: ['evaluations'] }) }

  const act = async (request, success) => {
    try { const response = await request(); toast.success(response?.data?.message || success); refresh() } catch (error) { toast.error(apiError(error)); refresh() }
  }
  const confirmAndAct = async (confirm, request, success) => { if (await confirmAction(confirm)) act(request, success) }
  // La duración sale de la sala (exposición o preguntas); la API decide según la fase.
  const timer = (room, action) => act(() => api.post(`/evaluations/rooms/${room.id}/timer`, { action, expected_sequence_version: room.sequence_version }), 'Temporizador actualizado')
  const assignProject = async (project, targetId, order) => {
    const current = roomOf(project.id)
    const target = targetId ? rooms.find((room) => Number(room.id) === Number(targetId)) : null
    try {
      if (current && (!target || Number(current.id) !== Number(target.id))) {
        await api.put(`/evaluations/rooms/${current.id}`, roomPayload(current, orderedProjects(current).filter((item) => Number(item.id) !== Number(project.id))))
      }
      if (target) {
        const existing = orderedProjects(target).filter((item) => Number(item.id) !== Number(project.id))
        existing.push({ ...project, presentation_order: Number(order) || existing.length + 1 })
        await api.put(`/evaluations/rooms/${target.id}`, roomPayload(target, existing))
      }
      toast.success('Asignación de proyecto actualizada')
    } catch (error) { toast.error(apiError(error)) }
    refresh()
  }

  const evaluatorCount = new Set(visibleRooms.flatMap((room) => (room.teachers || []).map((teacher) => String(teacher.id)))).size
  return (
    <Page title="Salas de evaluación" subtitle="Programa salas, responsables, docentes y orden de proyectos."
      actions={<>
        <Button variant="ghost" icon={FiArrowLeft} onClick={() => navigate('/evaluations')}>Volver a evaluaciones</Button>
        {manage && <Button icon={FiPlus} onClick={() => { setStatus('active'); setSheet({ type: 'wizard', room: null }) }}>Crear sala</Button>}
      </>}>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Sala, docente, proyecto o salón" />
        <select className="control" aria-label="Semestre" value={semester} onChange={(event) => setSemester(event.target.value)}>
          <option value="">Todos los semestres</option>
          {semesters.map((value) => <option key={value} value={value}>{value} - {ROOM_STAGES[value]}</option>)}
        </select>
        <Chips options={[{ value: 'active', label: 'Activas' }, { value: 'archived', label: 'Archivadas' }]} value={status} onChange={setStatus} />
      </div>
      <div className="stats-row">
        <div className="kpi"><strong>{visibleRooms.length}</strong><span>Salas</span></div>
        <div className="kpi"><strong>{visibleRooms.reduce((total, room) => total + (room.projects || []).length, 0)}</strong><span>Proyectos asignados</span></div>
        <div className="kpi"><strong>{evaluatorCount}</strong><span>Evaluadores</span></div>
        {manage && <div className="kpi"><strong>{visibleProjects.filter((project) => !assigned.has(Number(project.id))).length}</strong><span>Sin sala</span></div>}
      </div>
      {manage && <Tabs value={view} onChange={setView} items={[{ key: 'rooms', label: 'Por sala' }, { key: 'projects', label: 'Por proyecto' }, { key: 'teachers', label: 'Por evaluador' }]} />}

      {roomsQuery.isLoading ? <Loading rows={5} /> : roomsQuery.isError ? <ErrorState error={roomsQuery.error} onRetry={roomsQuery.refetch} /> : view === 'rooms' ? (
        !visibleRooms.length ? <Empty title="Sin salas" message="No hay salas con los filtros seleccionados." /> : (
          <div className="grid-2">
            {visibleRooms.map((room) => (
              <RoomCard key={room.id} room={room} archived={archived} manage={manage} fullReports={fullReports}
                onEdit={() => setSheet({ type: 'wizard', room })} onSchedule={() => setSheet({ type: 'schedule', room })} onTimer={(action, minutes) => timer(room, action, minutes)}
                onLock={() => confirmAndAct({ title: 'Bloquear orden de paso', text: 'Después de bloquear, sólo el proyecto en turno podrá evaluarse.', confirmText: 'Sí, bloquear' }, () => api.post(`/evaluations/rooms/${room.id}/lock-sequence`, {}), 'Orden bloqueado')}
                onAdvance={() => confirmAndAct({ title: 'Avanzar turno', text: 'Se finalizará el proyecto actual y se activará el siguiente.', confirmText: 'Sí, avanzar' }, () => api.post(`/evaluations/rooms/${room.id}/advance`, { continue_next: true, expected_sequence_version: room.sequence_version ?? null }), 'Turno actualizado')}
                onArchive={() => confirmAndAct({ title: 'Archivar sala', text: 'Todas las evaluaciones de esta sala dejarán la vista principal.', confirmText: 'Sí, archivar sala' }, () => api.post(`/evaluations/rooms/${room.id}/archive`, {}), 'Sala archivada')}
                onDelete={() => confirmAndAct({ title: 'Eliminar sala', text: 'Se eliminarán también evaluaciones, puntajes e intentos vinculados.', confirmText: 'Sí, eliminar', danger: true }, () => api.delete(`/evaluations/rooms/${room.id}`), 'Sala eliminada')} />
            ))}
          </div>
        )
      ) : view === 'projects' ? (
        <Card flush>
          {projectsQuery.isLoading ? <div className="card-pad"><Loading /></div> : !visibleProjects.length ? <Empty message="No hay proyectos con los filtros seleccionados." /> : (
            <ul className="assign-list">{visibleProjects.map((project) => <ProjectAssign key={project.id} project={project} current={roomOf(project.id)} rooms={rooms.filter((room) => String(room.semestre) === String(projectSemester(project)))} onSave={assignProject} onOpen={(room) => setSheet({ type: 'wizard', room })} />)}</ul>
          )}
        </Card>
      ) : (
        <TeacherView teachers={teachersQuery.data || []} rooms={visibleRooms} search={needle} />
      )}

      {sheet?.type === 'wizard' && <RoomWizard room={sheet.room} rooms={rooms} projects={projects} teachers={teachersQuery.data || []} classrooms={catalog.data?.rooms || []} onClose={() => setSheet(null)} onSaved={() => { refresh(); client.invalidateQueries({ queryKey: ['evaluation-projects'] }) }} />}
      {sheet?.type === 'schedule' && <ScheduleSheet room={sheet.room} onClose={() => setSheet(null)} onSaved={refresh} />}
    </Page>
  )
}

const WINDOW_LABELS = { open: 'Horario abierto', late_authorized: 'Fuera de horario autorizado', scheduled: 'Pendiente de inicio', closed: 'Horario cerrado' }

function RoomCard({ room, archived, manage, fullReports, onEdit, onSchedule, onTimer, onLock, onAdvance, onArchive, onDelete }) {
  const windowStatus = room.evaluation_window?.status || 'closed'
  const end = room.fecha_fin_evaluacion ? new Date(String(room.fecha_fin_evaluacion).replace(' ', 'T')).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <Card className="room-card" title={roomName(room)} subtitle={`${room.salon || 'Sin salón'} · ${room.fecha_evaluacion ? formatDateTime(room.fecha_evaluacion) : 'Sin inicio'}${end ? ` – ${end}` : ''}`}
      actions={<div className="row-wrap"><Badge>Semestre {room.semestre}</Badge>{room.sequence_locked && <Badge tone="info">Orden bloqueado</Badge>}{room.completed_at && <Badge tone="success">Finalizada</Badge>}</div>}>
      <dl className="meta-grid">
        <div><dt>Responsable</dt><dd>{personName(room.responsible_teacher) || '—'}</dd></div>
        <div><dt>Tiempos por turno</dt><dd>{room.project_presentation_minutes} min exposición + {room.teacher_evaluation_minutes} min preguntas · {room.tolerance_minutes ?? 3} min de tolerancia</dd></div>
        <div className="wide"><dt>Evaluadores</dt><dd>{(room.teachers || []).map(personName).filter(Boolean).join(', ') || '—'}</dd></div>
      </dl>
      <p className={`small-text ${room.evaluation_window?.is_open ? 'text-success' : 'text-warning'}`}><FiClock /> {WINDOW_LABELS[windowStatus] || 'Horario cerrado'}{windowStatus === 'late_authorized' && room.late_evaluation_until ? ` hasta ${formatDateTime(room.late_evaluation_until)}` : ''}</p>
      {room.sequence_locked && !room.completed_at && <RoomTimer room={room} onTimer={onTimer} />}
      <h3 className="card-title-sm mt-2">Proyectos ({(room.projects || []).length})</h3>
      <ol className="room-projects">
        {orderedProjects(room).map((project) => <li key={project.id} className={project.is_current ? 'current' : ''}><span>{project.title}</span><Badge>Orden {project.presentation_order || project.pivot?.presentation_order || '–'}</Badge></li>)}
      </ol>
      <div className="card-footer-actions">
        {fullReports && <IconButton icon={FiFileText} label="Reporte completo con nombres de evaluadores" onClick={() => downloadReport('room', room.id, false)} />}
        <IconButton icon={FiEyeOff} label="Informe limitado: evaluadores sin nombre y sólo comentarios generales" onClick={() => downloadReport('room', room.id, true)} />
        {!archived && <>
          {room.can_edit_room && <IconButton icon={FiEdit2} label="Editar" onClick={onEdit} />}
          {room.can_control_room && <IconButton icon={FiClock} label="Modificar horario" onClick={onSchedule} />}
          {manage && !room.sequence_locked && <IconButton icon={FiLock} label="Bloquear orden" onClick={onLock} />}
          {room.can_control_room && room.sequence_locked && !room.completed_at && <Button size="sm" variant="warning" icon={FiSkipForward} onClick={onAdvance}>Siguiente</Button>}
          {manage && <><IconButton icon={FiArchive} label="Archivar" onClick={onArchive} /><IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={onDelete} /></>}
        </>}
      </div>
    </Card>
  )
}

/** Tiempo del equipo en turno (exposición y luego preguntas). Lo controla el encargado de la sala o un gestor. */
function RoomTimer({ room, onTimer }) {
  const data = room.timer || {}
  const running = data.status === 'en_curso'
  return (
    <RoomCountdown timer={data}>
      {room.can_control_room && (
        <div className="row-wrap mt-2">
          {running ? <Button size="sm" variant="ghost" icon={FiPause} onClick={() => onTimer('pause')}>Pausar</Button>
            : data.status === 'pausado' ? <Button size="sm" variant="ghost" icon={FiPlay} onClick={() => onTimer('resume')}>Reanudar</Button>
              : <Button size="sm" variant="success" icon={FiPlay} onClick={() => onTimer('start')}>{data.phase === 'preguntas' ? 'Iniciar preguntas' : 'Iniciar exposición'}</Button>}
          {data.phase !== 'preguntas' && <Button size="sm" variant="ghost" icon={FiSkipForward} onClick={() => onTimer('questions')}>Pasar a preguntas</Button>}
          <IconButton icon={FiRotateCcw} label="Reiniciar desde la exposición" onClick={() => onTimer('reset')} />
          <IconButton icon={FiSquare} className="danger" label="Terminar tiempo" onClick={() => onTimer('finish')} />
          <small className="muted">{data.auto_questions ? 'Pasa sola a preguntas al terminar la exposición.' : 'Las preguntas se inician a mano.'}</small>
        </div>
      )}
    </RoomCountdown>
  )
}

function ProjectAssign({ project, current, rooms, onSave, onOpen }) {
  const currentOrder = current ? orderedProjects(current).find((item) => Number(item.id) === Number(project.id))?.presentation_order || '' : ''
  const [target, setTarget] = useState(current ? String(current.id) : '')
  const [order, setOrder] = useState(String(currentOrder))
  const [saving, setSaving] = useState(false)
  return (
    <li>
      <div className="assign-text"><strong>{project.title}</strong><small>{authorsOf(project) || 'Sin integrantes registrados'}</small><span className="row-wrap"><Badge>{projectSemester(project) || '–'}°</Badge>{current ? <Badge tone="info">{roomName(current)}</Badge> : <Badge tone="warning">Sin sala</Badge>}</span></div>
      <div className="assign-controls">
        <select className="control" aria-label="Asignar a sala" value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">Sin sala</option>
          {rooms.map((room) => <option key={room.id} value={room.id}>{roomName(room)} - {room.salon || 'Sin salón'}</option>)}
        </select>
        <input className="control order-input" type="number" min={1} aria-label="Orden" placeholder="Orden" value={order} onChange={(event) => setOrder(event.target.value)} />
        <IconButton icon={FiSave} label="Guardar asignación" disabled={saving} onClick={async () => { setSaving(true); await onSave(project, target, order); setSaving(false) }} />
        {current && <IconButton icon={FiEdit2} label="Abrir sala" onClick={() => onOpen(current)} />}
      </div>
    </li>
  )
}

function TeacherView({ teachers, rooms, search }) {
  const cards = teachers.map((teacher) => ({
    teacher,
    evaluator: rooms.filter((room) => (room.teachers || []).some((item) => String(item.id) === String(teacher.id))),
    responsible: rooms.filter((room) => String(room.responsible_teacher_id || room.responsible_teacher?.id || '') === String(teacher.id)),
  })).filter((item) => (item.evaluator.length || item.responsible.length) && (matchesSearch(`${item.teacher.id} ${personName(item.teacher)} ${item.teacher.email || ''}`, search) || item.evaluator.some((room) => matchesSearch(room.nombre, search))))
    .sort((a, b) => (b.evaluator.length + b.responsible.length) - (a.evaluator.length + a.responsible.length) || personName(a.teacher).localeCompare(personName(b.teacher)))
  if (!cards.length) return <Empty title="Sin evaluadores" message="No hay evaluadores con salas en los filtros actuales." />
  return (
    <div className="grid-2">
      {cards.map((item) => (
        <Card key={item.teacher.id} title={personName(item.teacher)} subtitle={item.teacher.id} actions={<div className="row-wrap"><Badge tone="info">{item.evaluator.length} como evaluador</Badge><Badge tone="success">{item.responsible.length} responsable</Badge></div>}>
          <ul className="list-app">
            {[...new Map([...item.evaluator, ...item.responsible].map((room) => [room.id, room])).values()].map((room) => (
              <li key={room.id} className="list-row"><div><strong>{roomName(room)}</strong><small>{room.salon || '—'} · {room.fecha_evaluacion ? formatDateTime(room.fecha_evaluacion) : '—'} · {(room.projects || []).length} proyecto(s)</small></div><Badge>{room.semestre}°</Badge></li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}

/** Horario de la sala y autorización de evaluación fuera de tiempo (roomScheduleModal). */
function ScheduleSheet({ room, onClose, onSaved }) {
  const [form, setForm] = useState({
    start: apiToInput(room.fecha_evaluacion), late: Boolean(room.allow_late_evaluations),
    lateUntil: apiToInput(room.late_evaluation_until), reason: room.late_evaluation_reason || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  // El fin se calcula como en la API: turnos completos más la tolerancia entre ellos.
  const count = Math.max(1, (room.projects || []).length)
  const minutes = count * (Number(room.project_presentation_minutes) + Number(room.teacher_evaluation_minutes)) + (count - 1) * Number(room.tolerance_minutes ?? 3)
  const end = form.start ? new Date(new Date(form.start).getTime() + minutes * 60000) : null
  const submit = async (event) => {
    event.preventDefault()
    if (form.late && end && new Date(form.lateUntil) <= end) return toast.warning('La autorización fuera de horario debe terminar después de que termine la sala.')
    setSaving(true)
    try {
      const { data } = await api.put(`/evaluations/rooms/${room.id}/schedule`, {
        fecha_evaluacion: form.start, allow_late_evaluations: form.late,
        late_evaluation_until: form.late ? form.lateUntil : null, late_evaluation_reason: form.late ? form.reason.trim() : null, expected_sequence_version: room.sequence_version,
      })
      toast.success(data.message || 'Horario actualizado')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)); onSaved() } finally { setSaving(false) }
    return undefined
  }
  return (
    <Sheet open title="Horario y evaluación fuera de tiempo" subtitle={roomName(room)} onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="schedule-form" icon={FiSave} loading={saving}>Guardar horario</Button></>}>
      <form id="schedule-form" className="form-grid" onSubmit={submit}>
        <Field label="Inicio"><input className="control" type="datetime-local" required min={form.start === apiToInput(room.fecha_evaluacion) ? undefined : nextMinute()} disabled={room.evaluation_window?.status !== 'scheduled'} value={form.start} onChange={(event) => set({ start: event.target.value })} /></Field>
        <Field label="Termina aproximadamente" hint={`${count} turno(s), ${minutes} min en total.`}><output className="control readonly-value">{end ? end.toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</output></Field>
        <div className="full"><Switch checked={form.late} onChange={(value) => set({ late: value })} label="Permitir evaluaciones fuera del horario" /></div>
        {form.late && <>
          <Field label="Autorizada hasta"><input className="control" type="datetime-local" required min={form.lateUntil === apiToInput(room.late_evaluation_until) ? undefined : nextMinute()} value={form.lateUntil} onChange={(event) => set({ lateUntil: event.target.value })} /></Field>
          <Field label="Motivo" full><textarea className="control" rows={3} required minLength={10} maxLength={500} value={form.reason} onChange={(event) => set({ reason: event.target.value })} /></Field>
        </>}
        <p className="muted small-text full">Si la sala ya comenzó, la hora de inicio queda protegida; todavía puedes autorizar una captura tardía.</p>
      </form>
    </Sheet>
  )
}
