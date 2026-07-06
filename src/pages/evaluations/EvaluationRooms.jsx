import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiDownload, FiEdit2, FiLock, FiPlus, FiSkipForward, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../../services/api'
import { confirmAction, Empty, ErrorState, Loading, Modal, StatusBadge } from '../../components/common/Ui'
import { formatDate, fullName } from '../../utils/formatters'
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
  const [form, setForm] = useState(emptyRoom)
  const roomsQuery = useQuery({ queryKey: ['evaluation-rooms', archived], queryFn: () => api.get('/evaluations/rooms', { params: { archived: archived ? 1 : 0 } }).then((response) => response.data) })
  const projectsQuery = useQuery({ queryKey: ['evaluation-projects'], queryFn: () => api.get('/evaluations/projects').then((response) => unwrapCollection(response.data)), enabled: canManage })
  const teachersQuery = useQuery({
    queryKey: ['evaluation-staff'],
    queryFn: () => api.get('/users', { params: { perfil_ids: '1,2', status: 'active', compact: 1, per_page: 500 } }).then((response) => unwrapCollection(response.data)),
    enabled: canManage,
  })
  const refresh = () => { client.invalidateQueries({ queryKey: ['evaluation-rooms'] }); client.invalidateQueries({ queryKey: ['evaluations'] }); client.invalidateQueries({ queryKey: ['evaluation-projects'] }) }
  const mutation = useMutation({
    mutationFn: ({ method = 'post', endpoint, body }) => api[method](endpoint, body),
    onSuccess: ({ data }) => { toast.success(data.message || 'Sala actualizada.'); setEditing(null); refresh() },
    onError: (error) => toast.error(apiError(error)),
  })

  const conflicts = useMemo(() => {
    if (!form.fecha_evaluacion || !form.fecha_fin_evaluacion) return []
    const start = new Date(form.fecha_evaluacion)
    const end = new Date(form.fecha_fin_evaluacion)
    return (roomsQuery.data || []).filter((room) => room.id !== editing?.id && start < new Date(room.fecha_fin_evaluacion) && end > new Date(room.fecha_evaluacion))
  }, [form.fecha_evaluacion, form.fecha_fin_evaluacion, roomsQuery.data, editing])
  const busyTeachers = new Set(conflicts.flatMap((room) => room.teachers.map((teacher) => String(teacher.id))))
  const busyProjects = new Set(conflicts.flatMap((room) => room.projects.map((project) => Number(project.id))))
  const teachers = (teachersQuery.data || []).filter((teacher) => !busyTeachers.has(String(teacher.id)) || form.teacher_ids.includes(String(teacher.id)))
  const projects = (projectsQuery.data || []).filter((project) => {
    const semester = project.presentation_semester || project.semestre
    return Number(semester) === Number(form.semestre)
      && (!project.assigned_room_id || Number(project.assigned_room_id) === Number(editing?.id))
      && (!busyProjects.has(Number(project.id)) || form.project_ids.includes(Number(project.id)))
  })

  const open = (room = null) => {
    if (!room) { setForm(emptyRoom); setEditing({ __new: true }); return }
    const ordered = [...(room.projects || [])].sort((a, b) => a.presentation_order - b.presentation_order)
    setForm({
      ...emptyRoom, ...room,
      fecha_evaluacion: toLocalInput(room.fecha_evaluacion),
      fecha_fin_evaluacion: toLocalInput(room.fecha_fin_evaluacion),
      responsible_teacher_id: room.responsible_teacher_id || '',
      teacher_ids: room.teachers.map((teacher) => String(teacher.id)),
      project_ids: ordered.map((project) => Number(project.id)),
      project_order: Object.fromEntries(ordered.map((project, index) => [project.id, project.presentation_order || index + 1])),
    })
    setEditing(room)
  }
  const save = (event) => {
    event.preventDefault()
    if (new Date(form.fecha_fin_evaluacion) <= new Date(form.fecha_evaluacion)) return toast.warning('La hora de fin debe ser posterior al inicio.')
    if (!form.teacher_ids.length || !form.project_ids.length) return toast.warning('Selecciona al menos un docente y un proyecto.')
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
  const roomAction = async (room, operation, text) => {
    if (!await confirmAction({ title: text, text: `Sala: ${room.nombre}`, confirmText: 'Sí, continuar' })) return
    mutation.mutate({ endpoint: `/evaluations/rooms/${room.id}/${operation}`, body: operation === 'advance' ? { continue_next: true } : {} })
  }
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
      <header><div><h2>{room.nombre}</h2><p>{room.salon || 'Sin salón'} · {formatDate(room.fecha_evaluacion)}</p></div><StatusBadge value={room.completed_at ? 'finalizada' : room.sequence_locked ? 'orden bloqueado' : 'programada'} /></header>
      <div className="room-facts"><span>Semestre <strong>{room.semestre}</strong></span><span>Exposición <strong>{room.project_presentation_minutes} min</strong></span><span>Evaluación <strong>{room.teacher_evaluation_minutes} min</strong></span><span>Intentos <strong>{room.max_attempts}</strong></span></div>
      <p><strong>Responsable:</strong> {fullName(room.responsible_teacher)}</p>
      <p><strong>Evaluadores:</strong> {room.teachers.map(fullName).join(', ') || 'Sin asignar'}</p>
      <ol className="room-project-order">{[...(room.projects || [])].sort((a, b) => a.presentation_order - b.presentation_order).map((project) => <li className={Number(room.current_order) === Number(project.presentation_order) ? 'current' : ''} key={project.id}><span>{project.presentation_order}</span>{project.title}</li>)}</ol>
      <div className="row-actions room-actions">
        <button onClick={() => report(room)}><FiDownload /> Reporte</button><button onClick={() => report(room, true)}><FiDownload /> Docentes</button>
        {archived && canManage && <button onClick={() => roomAction(room, 'unarchive', 'Restaurar sala')}><FiArchive /> Restaurar</button>}
        {!archived && canManage && <><button onClick={() => open(room)}><FiEdit2 /> Editar</button><button onClick={() => roomAction(room, 'lock-sequence', 'Bloquear orden')}><FiLock /> Bloquear</button>{room.sequence_locked && !room.completed_at && <button onClick={() => roomAction(room, 'advance', 'Avanzar al siguiente proyecto')}><FiSkipForward /> Avanzar</button>}<button onClick={() => roomAction(room, 'archive', 'Archivar sala')}><FiArchive /> Archivar</button><button className="danger" onClick={() => remove(room)}><FiTrash2 /> Eliminar</button></>}
      </div>
    </article>)}</div>}

    <Modal open={Boolean(editing)} title={editing?.__new ? 'Crear sala de evaluación' : 'Editar sala de evaluación'} onClose={() => setEditing(null)}>
      <form className="modal-form room-form" onSubmit={save}><div className="form-grid">
        <label>Nombre<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
        <label>Salón<input value={form.salon} onChange={(event) => setForm({ ...form, salon: event.target.value })} /></label>
        <label>Semestre<select value={form.semestre} onChange={(event) => setForm({ ...form, semestre: event.target.value, project_ids: [], project_order: {} })}>{[5, 6, 7, 8].map((semester) => <option key={semester}>{semester}</option>)}</select></label>
        <label>Intentos máximos<input type="number" min="1" max="10" value={form.max_attempts} onChange={(event) => setForm({ ...form, max_attempts: event.target.value })} /></label>
        <label>Inicio<input required type="datetime-local" value={form.fecha_evaluacion} onChange={(event) => {
          const start = event.target.value
          const end = form.fecha_fin_evaluacion || (start ? toLocalInput(new Date(new Date(start).getTime() + 3_600_000)) : '')
          setForm({ ...form, fecha_evaluacion: start, fecha_fin_evaluacion: end })
        }} /></label>
        <label>Fin<input required type="datetime-local" value={form.fecha_fin_evaluacion} onChange={(event) => setForm({ ...form, fecha_fin_evaluacion: event.target.value })} /></label>
        <label>Minutos de exposición<input type="number" min="1" max="240" value={form.project_presentation_minutes} onChange={(event) => setForm({ ...form, project_presentation_minutes: event.target.value })} /></label>
        <label>Minutos para evaluar<input type="number" min="1" max="240" value={form.teacher_evaluation_minutes} onChange={(event) => setForm({ ...form, teacher_evaluation_minutes: event.target.value })} /></label>
      </div>
      {conflicts.length > 0 && <div className="review-comment">Conflictos de horario con: {conflicts.map((room) => room.nombre).join(', ')}. Las personas y proyectos ocupados no se muestran.</div>}
      <fieldset className="selection-fieldset"><legend>Evaluadores disponibles</legend><div className="selection-grid">{teachers.map((teacher) => <label className="selection-card" key={teacher.id}><input type="checkbox" checked={form.teacher_ids.includes(String(teacher.id))} onChange={(event) => {
        const ids = event.target.checked ? [...form.teacher_ids, String(teacher.id)] : form.teacher_ids.filter((id) => id !== String(teacher.id))
        setForm({ ...form, teacher_ids: ids, responsible_teacher_id: ids.includes(String(form.responsible_teacher_id)) ? form.responsible_teacher_id : '' })
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
  </section>
}
