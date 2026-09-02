import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiClock, FiDownload, FiEdit2, FiLock, FiPause, FiPlay, FiPlus, FiRefreshCw, FiSkipForward, FiSquare, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../../services/api'
import { confirmAction, Empty, ErrorState, Loading, Modal, StatusBadge } from '../../components/common/Ui'
import { formatDate, fullName, roomDisplayName } from '../../utils/formatters'
import { downloadApiFile } from '../../utils/downloads'

const emptyRoom = {
  nombre: '', salon: '', semestre: 5, responsible_teacher_id: '', fecha_evaluacion: '',
  fecha_fin_evaluacion: '', teacher_evaluation_minutes: 15, project_presentation_minutes: 20,
  max_attempts: 1, teacher_ids: [], project_ids: [], project_order: {},
}

const toLocalInput = (value) => {
  if (!value) return ''
  if (!(value instanceof Date)) return String(value).slice(0, 16)
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

export default function EvaluationRooms({ canManage }) {
  const client = useQueryClient()
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState(null)
  const [scheduleRoom, setScheduleRoom] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({ fecha_evaluacion: '', fecha_fin_evaluacion: '', allow_late_evaluations: false, late_evaluation_until: '', late_evaluation_reason: '' })
  const [form, setForm] = useState(emptyRoom)
  const roomsQuery = useQuery({
    queryKey: ['evaluation-rooms', archived],
    queryFn: () => api.get('/evaluations/rooms', { params: { archived: archived ? 1 : 0 } }).then((response) => response.data),
    refetchInterval: archived ? false : 5_000,
  })
  const projectsQuery = useQuery({ queryKey: ['evaluation-projects'], queryFn: () => api.get('/evaluations/projects').then((response) => unwrapCollection(response.data)), enabled: canManage })
  const teachersQuery = useQuery({
    queryKey: ['evaluation-staff'],
    queryFn: () => api.get('/users', { params: { perfil_ids: '1,2', status: 'active', compact: 1, per_page: 500 } }).then((response) => unwrapCollection(response.data)),
    enabled: canManage,
  })
  const refresh = () => { client.invalidateQueries({ queryKey: ['evaluation-rooms'] }); client.invalidateQueries({ queryKey: ['evaluations'] }); client.invalidateQueries({ queryKey: ['evaluation-projects'] }) }
  const mutation = useMutation({
    mutationFn: ({ method = 'post', endpoint, body }) => api[method](endpoint, body),
    onSuccess: ({ data }) => { toast.success(data.message || 'Sala actualizada.'); setEditing(null); setScheduleRoom(null); refresh() },
    onError: (error) => toast.error(apiError(error)),
  })

  const conflicts = useMemo(() => {
    if (!form.fecha_evaluacion || !form.fecha_fin_evaluacion) return []
    const start = new Date(form.fecha_evaluacion)
    const end = new Date(form.fecha_fin_evaluacion)
    return (roomsQuery.data || []).filter((room) => room.id !== editing?.id && start < new Date(room.fecha_fin_evaluacion) && end > new Date(room.fecha_evaluacion))
  }, [form.fecha_evaluacion, form.fecha_fin_evaluacion, roomsQuery.data, editing])
  const busyProjects = new Set(conflicts.flatMap((room) => room.projects.map((project) => Number(project.id))))
  const teachers = teachersQuery.data || []
  const projects = (projectsQuery.data || []).filter((project) => {
    const semester = project.presentation_semester || project.semestre
    return Number(semester) === Number(form.semestre)
      && (!project.assigned_room_id || Number(project.assigned_room_id) === Number(editing?.id))
      && (!busyProjects.has(Number(project.id)) || form.project_ids.includes(Number(project.id)))
  })

  const open = (room = null) => {
    if (!room) { setForm(emptyRoom); setEditing({ __new: true }); return }
    const ordered = [...(room.projects || [])]
      .filter((project) => project.sequence_status !== 'evaluado')
      .sort((a, b) => a.presentation_order - b.presentation_order)
    const activeTeacherIds = room.teachers.map((teacher) => String(teacher.id))
    const requestedResponsible = String(room.responsible_teacher_id || '')
    const responsibleId = activeTeacherIds.includes(requestedResponsible)
      ? requestedResponsible
      : (activeTeacherIds.length === 1 ? activeTeacherIds[0] : '')
    setForm({
      ...emptyRoom, ...room,
      fecha_evaluacion: toLocalInput(room.fecha_evaluacion),
      fecha_fin_evaluacion: toLocalInput(room.fecha_fin_evaluacion || new Date(new Date(room.fecha_evaluacion).getTime() + 3_600_000)),
      responsible_teacher_id: responsibleId,
      teacher_ids: activeTeacherIds,
      project_ids: ordered.map((project) => Number(project.id)),
      project_order: Object.fromEntries(ordered.map((project, index) => [project.id, project.presentation_order || index + 1])),
    })
    setEditing(room)
  }
  const save = (event) => {
    event.preventDefault()
    if (new Date(form.fecha_fin_evaluacion) <= new Date(form.fecha_evaluacion)) return toast.warning('La hora de fin debe ser posterior al inicio.')
    if (!form.teacher_ids.length || (editing.__new && !form.project_ids.length)) return toast.warning(editing.__new ? 'Selecciona al menos un docente y un proyecto.' : 'Selecciona al menos un docente.')
    if (!form.responsible_teacher_id) return toast.warning('Selecciona como responsable a un docente activo de la sala.')
    const orders = form.project_ids.map((id) => Number(form.project_order[id] || 0))
    if (new Set(orders).size !== orders.length || orders.some((order) => order < 1)) return toast.warning('Asigna un orden único a cada proyecto.')
    const body = {
      ...form,
      semestre: Number(form.semestre),
      responsible_teacher_id: form.responsible_teacher_id || null,
      teacher_evaluation_minutes: Number(form.teacher_evaluation_minutes),
      project_presentation_minutes: Number(form.project_presentation_minutes),
      max_attempts: Number(form.max_attempts),
    }
    mutation.mutate({ method: editing.__new ? 'post' : 'put', endpoint: editing.__new ? '/evaluations/rooms' : `/evaluations/rooms/${editing.id}`, body })
  }
  const openSchedule = (room) => {
    setScheduleRoom(room)
    setScheduleForm({
      fecha_evaluacion: toLocalInput(room.fecha_evaluacion),
      fecha_fin_evaluacion: toLocalInput(room.fecha_fin_evaluacion),
      allow_late_evaluations: Boolean(room.allow_late_evaluations),
      late_evaluation_until: toLocalInput(room.late_evaluation_until),
      late_evaluation_reason: room.late_evaluation_reason || '',
    })
  }
  const saveSchedule = (event) => {
    event.preventDefault()
    if (new Date(scheduleForm.fecha_fin_evaluacion) <= new Date(scheduleForm.fecha_evaluacion)) return toast.warning('La hora de fin debe ser posterior al inicio.')
    if (scheduleForm.allow_late_evaluations && new Date(scheduleForm.late_evaluation_until) <= new Date(scheduleForm.fecha_fin_evaluacion)) return toast.warning('La autorización fuera de horario debe terminar después del horario ordinario.')
    mutation.mutate({ method: 'put', endpoint: `/evaluations/rooms/${scheduleRoom.id}/schedule`, body: { ...scheduleForm, expected_sequence_version: scheduleRoom.sequence_version } })
  }
  const roomAction = async (room, operation, text) => {
    if (!await confirmAction({ title: text, text: `Sala: ${roomDisplayName(room)}`, confirmText: 'Sí, continuar' })) return
    mutation.mutate({ endpoint: `/evaluations/rooms/${room.id}/${operation}`, body: operation === 'advance' ? { continue_next: true, expected_sequence_version: room.sequence_version } : {} })
  }
  const timerAction = (room, action, durationSeconds = null) => mutation.mutate({
    endpoint: `/evaluations/rooms/${room.id}/timer`,
    body: {
      action,
      expected_sequence_version: room.sequence_version,
      ...(durationSeconds ? { duration_seconds: durationSeconds } : {}),
    },
  })
  const remove = async (room) => {
    if (!await confirmAction({ title: 'Eliminar sala', text: 'También se eliminarán sus evaluaciones, puntajes e intentos.', confirmText: 'Sí, eliminar' })) return
    mutation.mutate({ method: 'delete', endpoint: `/evaluations/rooms/${room.id}` })
  }
  const report = async (room, teachersOnly = false) => {
    try {
      await downloadApiFile(`/evaluations/rooms/${room.id}/report.pdf${teachersOnly ? '?audience=teachers' : ''}`, `reporte_sala_${room.id}${teachersOnly ? '_docentes' : ''}.pdf`)
    } catch (error) { toast.error(apiError(error)) }
  }

  return <section className="panel">
    <div className="evaluation-toolbar"><div className="module-tabs compact-tabs"><button className={!archived ? 'active' : ''} onClick={() => setArchived(false)}>Activas</button><button className={archived ? 'active' : ''} onClick={() => setArchived(true)}>Archivadas</button></div>{canManage && !archived && <button className="btn-primary-app compact" onClick={() => open()}><FiPlus /> Crear sala</button>}</div>
    {roomsQuery.isLoading ? <Loading /> : roomsQuery.isError ? <ErrorState message={apiError(roomsQuery.error)} onRetry={roomsQuery.refetch} /> : !roomsQuery.data?.length ? <Empty title="Sin salas" /> : <div className="room-management-grid">{roomsQuery.data.map((room) => <article className="room-management-card" key={room.id}>
      <header><div><h2>{roomDisplayName(room)}</h2><p>{room.salon || 'Sin salón'} · {formatDate(room.fecha_evaluacion)}</p></div><StatusBadge value={room.completed_at ? 'finalizada' : room.sequence_locked ? 'orden bloqueado' : 'programada'} /></header>
      <div className="room-facts"><span>Semestre <strong>{room.semestre}</strong></span><span>Exposición <strong>{room.project_presentation_minutes} min</strong></span><span>Evaluación <strong>{room.teacher_evaluation_minutes} min</strong></span><span>Intentos <strong>{room.max_attempts}</strong></span></div>
      <p className={`evaluation-context-note ${room.evaluation_window?.is_open ? 'success' : 'warning'}`}>{room.evaluation_window?.status === 'open' ? 'Horario de evaluación abierto' : room.evaluation_window?.status === 'late_authorized' ? `Evaluación fuera de horario autorizada hasta ${formatDate(room.late_evaluation_until)}` : room.evaluation_window?.status === 'scheduled' ? 'La sala todavía no inicia' : 'Horario de evaluación cerrado'}</p>
      <p><strong>Responsable:</strong> {fullName(room.responsible_teacher)}</p>
      <p><strong>Evaluadores:</strong> {room.teachers.map(fullName).join(', ') || 'Sin asignar'}</p>
      {room.sequence_locked && !room.completed_at && <RoomTimer key={`${room.id}-${room.sequence_version}-${room.timer?.remaining_seconds}`} room={room} disabled={mutation.isPending} onAction={timerAction} />}
      <ol className="room-project-order">{[...(room.projects || [])].sort((a, b) => a.presentation_order - b.presentation_order).map((project) => <li className={project.is_current ? 'current' : project.sequence_status === 'evaluado' ? 'completed' : ''} key={project.id}><span>{project.presentation_order}</span><div><strong>{project.title}</strong><small>{project.sequence_status === 'evaluado' ? 'Evaluación finalizada' : `${project.submitted_evaluators_count || 0}/${project.expected_evaluators_count || 0} evaluadores han enviado`}</small></div></li>)}</ol>
      <div className="row-actions room-actions">
        <button onClick={() => report(room)}><FiDownload /> Reporte</button><button onClick={() => report(room, true)}><FiDownload /> Docentes</button>
        {archived && canManage && <button onClick={() => roomAction(room, 'unarchive', 'Restaurar sala')}><FiArchive /> Restaurar</button>}
        {!archived && <>{room.can_edit_room && <button onClick={() => open(room)}><FiEdit2 /> Editar</button>}{room.can_control_room && <button onClick={() => openSchedule(room)}><FiClock /> Horario</button>}{canManage && !room.sequence_locked && <button onClick={() => roomAction(room, 'lock-sequence', 'Bloquear orden')}><FiLock /> Bloquear</button>}{room.can_control_room && room.sequence_locked && !room.completed_at && <button onClick={() => roomAction(room, 'advance', 'Avanzar al siguiente proyecto')}><FiSkipForward /> Avanzar</button>}{canManage && <><button onClick={() => roomAction(room, 'archive', 'Archivar sala')}><FiArchive /> Archivar</button><button className="danger" onClick={() => remove(room)}><FiTrash2 /> Eliminar</button></>}</>}
      </div>
    </article>)}</div>}

    <Modal open={Boolean(editing)} title={editing?.__new ? 'Crear sala de evaluación' : 'Editar sala de evaluación'} onClose={() => setEditing(null)}>
      <form className="modal-form room-form" onSubmit={save}><div className="form-grid">
        <label>Nombre<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
        <label>Salón<input value={form.salon} onChange={(event) => setForm({ ...form, salon: event.target.value })} /></label>
        <label>Semestre<select value={form.semestre} onChange={(event) => setForm({ ...form, semestre: event.target.value, project_ids: [], project_order: {} })}>{[5, 6, 7, 8].map((semester) => <option key={semester}>{semester}</option>)}</select></label>
        <label>Intentos máximos<input type="number" min="1" max="10" value={form.max_attempts} onChange={(event) => setForm({ ...form, max_attempts: event.target.value })} /></label>
        <label>Inicio<input required type="datetime-local" min={editing?.__new ? nextMinuteInput() : undefined} value={form.fecha_evaluacion} onChange={(event) => {
          const start = event.target.value
          const end = form.fecha_fin_evaluacion || (start ? toLocalInput(new Date(new Date(start).getTime() + 3_600_000)) : '')
          setForm({ ...form, fecha_evaluacion: start, fecha_fin_evaluacion: end })
        }} /></label>
        <label>Fin<input required type="datetime-local" value={form.fecha_fin_evaluacion} onChange={(event) => setForm({ ...form, fecha_fin_evaluacion: event.target.value })} /></label>
        <label>Minutos de exposición<input type="number" min="1" max="240" value={form.project_presentation_minutes} onChange={(event) => setForm({ ...form, project_presentation_minutes: event.target.value })} /></label>
        <label>Minutos para evaluar<input type="number" min="1" max="240" value={form.teacher_evaluation_minutes} onChange={(event) => setForm({ ...form, teacher_evaluation_minutes: event.target.value })} /></label>
      </div>
      {conflicts.length > 0 && <div className="review-comment">Coincide en horario con: {conflicts.map(roomDisplayName).join(', ')}. Los docentes pueden participar en varias salas; los proyectos ya asignados permanecen protegidos.</div>}
      <fieldset className="selection-fieldset"><legend>Evaluadores</legend><p className="draft-note">Un docente puede pertenecer a varias salas aunque sus horarios coincidan.</p><div className="selection-grid">{teachers.map((teacher) => <label className="selection-card" key={teacher.id}><input type="checkbox" checked={form.teacher_ids.includes(String(teacher.id))} onChange={(event) => {
        const ids = event.target.checked ? [...form.teacher_ids, String(teacher.id)] : form.teacher_ids.filter((id) => id !== String(teacher.id))
        const responsibleId = ids.includes(String(form.responsible_teacher_id)) ? form.responsible_teacher_id : (ids.length === 1 ? ids[0] : '')
        setForm({ ...form, teacher_ids: ids, responsible_teacher_id: responsibleId })
      }} /><span>{fullName(teacher)}<small>{Number(teacher.perfil_id) === 1 ? 'Administrativo' : 'Docente'}</small></span></label>)}</div></fieldset>
      <label>Responsable de sala<select value={form.responsible_teacher_id} onChange={(event) => setForm({ ...form, responsible_teacher_id: event.target.value })}><option value="">Sin responsable</option>{teachers.filter((teacher) => form.teacher_ids.includes(String(teacher.id))).map((teacher) => <option value={teacher.id} key={teacher.id}>{fullName(teacher)}</option>)}</select></label>
      <fieldset className="selection-fieldset"><legend>Proyectos y orden de presentación</legend><div className="project-selection-list">{projects.map((project) => {
        const checked = form.project_ids.includes(Number(project.id))
        return <label className="project-selection-card" key={project.id}><input type="checkbox" checked={checked} onChange={(event) => {
          const ids = event.target.checked ? [...form.project_ids, Number(project.id)] : form.project_ids.filter((id) => id !== Number(project.id))
          const order = { ...form.project_order }
          if (event.target.checked && !order[project.id]) order[project.id] = ids.length
          if (!event.target.checked) delete order[project.id]
          setForm({ ...form, project_ids: ids, project_order: order })
        }} /><input aria-label={`Orden de ${project.title}`} disabled={!checked} type="number" min="1" value={form.project_order[project.id] || ''} onChange={(event) => setForm({ ...form, project_order: { ...form.project_order, [project.id]: Number(event.target.value) } })} /><span>{project.title}<small>{project.company_name || 'Sin empresa'}</small></span></label>
      })}</div></fieldset>
      <div className="modal-actions"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary-app compact" disabled={mutation.isPending}>Guardar sala</button></div></form>
    </Modal>
    <Modal open={Boolean(scheduleRoom)} title={`Horario · ${scheduleRoom?.nombre || ''}`} onClose={() => setScheduleRoom(null)}>
      <form className="modal-form" onSubmit={saveSchedule}><div className="form-grid">
        <label>Inicio<input required type="datetime-local" disabled={scheduleRoom?.evaluation_window?.status !== 'scheduled'} value={scheduleForm.fecha_evaluacion} onChange={(event) => setScheduleForm({ ...scheduleForm, fecha_evaluacion: event.target.value })} /></label>
        <label>Fin ordinario<input required type="datetime-local" value={scheduleForm.fecha_fin_evaluacion} onChange={(event) => setScheduleForm({ ...scheduleForm, fecha_fin_evaluacion: event.target.value })} /></label>
        <label className="full-field selection-card"><input type="checkbox" checked={scheduleForm.allow_late_evaluations} onChange={(event) => setScheduleForm({ ...scheduleForm, allow_late_evaluations: event.target.checked })} /><span>Permitir evaluaciones fuera del horario ordinario<small>La autorización vencerá automáticamente en la fecha indicada.</small></span></label>
        {scheduleForm.allow_late_evaluations && <><label>Autorizada hasta<input required type="datetime-local" value={scheduleForm.late_evaluation_until} onChange={(event) => setScheduleForm({ ...scheduleForm, late_evaluation_until: event.target.value })} /></label><label className="full-field">Motivo<textarea required minLength="10" rows="3" value={scheduleForm.late_evaluation_reason} onChange={(event) => setScheduleForm({ ...scheduleForm, late_evaluation_reason: event.target.value })} /></label></>}
      </div><div className="modal-actions"><button type="button" onClick={() => setScheduleRoom(null)}>Cancelar</button><button className="btn-primary-app compact" disabled={mutation.isPending}>Guardar horario</button></div></form>
    </Modal>
  </section>
}

function nextMinuteInput() {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + 1)
  return toLocalInput(date)
}

function RoomTimer({ room, disabled, onAction }) {
  const timer = room.timer || {}
  const [remaining, setRemaining] = useState(Number(timer.remaining_seconds || 0))
  const [minutes, setMinutes] = useState(Math.max(1, Math.ceil(Number(timer.duration_seconds || room.project_presentation_minutes * 60) / 60)))

  useEffect(() => {
    if (timer.status !== 'en_curso') return undefined
    const interval = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000)
    return () => window.clearInterval(interval)
  }, [timer.status, room.sequence_version])

  const displayMinutes = Math.floor(remaining / 60).toString().padStart(2, '0')
  const displaySeconds = (remaining % 60).toString().padStart(2, '0')
  const start = () => onAction(room, 'start', Math.max(1, Number(minutes)) * 60)

  return <section className={`room-timer ${timer.status === 'en_curso' ? 'running' : ''} ${remaining === 0 ? 'expired' : ''}`}>
    <div className="room-timer-display"><FiClock /><strong>{displayMinutes}:{displaySeconds}</strong><span>{timer.status === 'en_curso' ? 'En curso' : timer.status === 'pausado' ? 'Pausado' : remaining === 0 ? 'Tiempo terminado' : 'Listo'}</span></div>
    {room.can_control_room && <div className="room-timer-controls">
      <label>Minutos<input type="number" min="1" max="240" value={minutes} disabled={disabled || timer.status === 'en_curso'} onChange={(event) => setMinutes(event.target.value)} /></label>
      {timer.status === 'en_curso'
        ? <button disabled={disabled} onClick={() => onAction(room, 'pause')}><FiPause /> Pausar</button>
        : timer.status === 'pausado'
          ? <button disabled={disabled} onClick={() => onAction(room, 'resume')}><FiPlay /> Reanudar</button>
          : <button disabled={disabled} onClick={start}><FiPlay /> Iniciar</button>}
      <button disabled={disabled} onClick={() => onAction(room, 'reset', Math.max(1, Number(minutes)) * 60)}><FiRefreshCw /> Reiniciar</button>
      <button disabled={disabled} onClick={() => onAction(room, 'finish')}><FiSquare /> Finalizar</button>
    </div>}
  </section>
}
