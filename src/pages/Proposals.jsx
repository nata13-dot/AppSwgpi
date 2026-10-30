import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheck, FiEdit3, FiPlus, FiRefreshCw, FiSend, FiTrash2, FiUserPlus, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { isStudent, isTeacher, viewAs } from '../lib/permissions'
import { formatDateTime, fullName } from '../utils/formatters'
import { Badge, Button, Card, confirmAction, Empty, ErrorState, Field, IconButton, Loading, Page, promptText, SearchInput, useDebounced } from '../components/ui'

export default function ProposalsPage() {
  const { user } = useAuth()
  if (isStudent(user)) return <ProposalRegister />
  if (isTeacher(user)) return <ProposalReview />
  return <ProposalConfig />
}

const STATUS_TONE = { pendiente: 'warning', aprobado: 'success', requiere_cambios: 'info', rechazado: 'danger' }
const authors = (project) => (project?.students || []).map(fullName).filter(Boolean).join(', ') || '—'

/** Alta y baja de ventanas de registro de un grupo (compartido por jefatura y docentes). */
function WindowEditor({ group, onChanged }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const add = async () => {
    if (!start || !end) return toast.warning('Indica inicio y cierre de la ventana.')
    try { await api.post('/proposal/windows', { subject_group_id: group.id, starts_at: start, ends_at: end, activo: true }); toast.success('Ventana creada'); setStart(''); setEnd(''); onChanged() } catch (error) { toast.error(apiError(error)) }
    return undefined
  }
  const remove = async (id) => {
    if (!(await confirmAction({ title: 'Eliminar ventana', text: 'Los alumnos ya no podrán registrar en ese periodo.', confirmText: 'Sí, eliminar', danger: true }))) return
    try { await api.delete(`/proposal/windows/${id}`); toast.success('Ventana eliminada'); onChanged() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <section className="card-app">
      <header className="card-head"><h2>{group.nombre}</h2><div className="row-wrap">{group.grupo && <Badge tone="info">{group.grupo}</Badge>}{group.semestre && <Badge>{group.semestre}° semestre</Badge>}</div></header>
      <ul className="list-app">
        {(group.registration_windows || []).map((item) => (
          <li key={item.id} className="list-row">
            <div><strong>{formatDateTime(item.starts_at)}</strong><small>Hasta {formatDateTime(item.ends_at)}</small></div>
            <Badge tone={item.activo ? 'success' : 'neutral'}>{item.activo ? 'Activa' : 'Inactiva'}</Badge>
            <IconButton icon={FiTrash2} className="danger" label="Eliminar ventana" onClick={() => remove(item.id)} />
          </li>
        ))}
        {!(group.registration_windows || []).length && <li className="muted small-text">Sin ventanas configuradas.</li>}
      </ul>
      <div className="form-grid mt-2">
        <Field label="Inicio"><input className="control" type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></Field>
        <Field label="Cierre"><input className="control" type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></Field>
      </div>
      <Button size="sm" variant="soft" icon={FiPlus} className="mt-2" onClick={add}>Agregar ventana</Button>
    </section>
  )
}

/** Responsables y ventanas de registro de Fundamentos de Ingeniería de Software (admin/proposal-config.php). */
function ProposalConfig() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['proposal-config'], queryFn: () => api.get('/proposal/config').then((response) => response.data) })
  const [semester, setSemester] = useState('')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState({})
  const refresh = () => client.invalidateQueries({ queryKey: ['proposal-config'] })
  const config = query.data || { subject_groups: [], teachers: [], asignaturas: [] }
  const subject = config.default_subject ? config.asignaturas.find((item) => Number(item.id) === Number(config.default_subject.id)) || config.default_subject : null
  const groups = subject ? config.subject_groups.filter((group) => (group.asignaturas || []).some((item) => Number(item.id) === Number(subject.id))
    && (!semester || String(group.semestre) === semester) && (!search.trim() || `${group.nombre} ${group.periodo || ''}`.toLowerCase().includes(search.trim().toLowerCase()))) : []

  const assign = async (group) => {
    const teacherId = picked[group.id]
    if (!teacherId) return toast.warning('Selecciona un docente activo.')
    try {
      await api.post('/proposal/assignments', { subject_group_id: group.id, asignatura_id: subject.id, teacher_id: teacherId, labor: `Revisión de propuesta: ${subject.nombre}`, activo: true })
      toast.success('Docente asignado al grupo')
      setPicked({ ...picked, [group.id]: '' })
      refresh()
    } catch (error) { toast.error(apiError(error)) }
    return undefined
  }
  const unassign = async (assignment) => {
    if (!(await confirmAction({ title: 'Quitar docente responsable', text: `${fullName(assignment.teacher)} dejará de revisar las propuestas de este grupo.`, confirmText: 'Sí, quitar' }))) return
    try { await api.delete(`/proposal/assignments/${assignment.id}`); toast.success('Responsable removido'); refresh() } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <Page title="Gestión de propuestas" subtitle="Responsables, excepciones y periodos de registro de Fundamentos de Ingeniería de Software." actions={<Button variant="ghost" icon={FiRefreshCw} onClick={refresh}>Actualizar</Button>}>
      {query.isLoading ? <Loading rows={4} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <>
          <Card title="Docentes responsables por materia" subtitle="La materia se toma de las asignaturas ligadas a cada carga/grupo." actions={<Badge tone="info">{groups.length} grupo{groups.length === 1 ? '' : 's'}</Badge>}>
            <div className="toolbar">
              <select className="control grow" aria-label="Materia a supervisar" disabled value={subject?.id || ''}><option value={subject?.id || ''}>{subject ? `${subject.clave ? `${subject.clave} - ` : ''}${subject.nombre}` : 'Materia predeterminada no encontrada'}</option></select>
              <select className="control" aria-label="Semestre" value={semester} onChange={(event) => setSemester(event.target.value)}><option value="">Todos los semestres</option>{[5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}° semestre</option>)}</select>
              <SearchInput value={search} onChange={setSearch} placeholder="Ej. 5to A, B, 2026" />
            </div>
            {!subject ? <div className="alert-app">Selecciona una materia para ver los grupos donde está ligada.</div> : !groups.length ? <div className="alert-app warning">No hay grupos con esta materia. Lígala primero desde Asignaturas → Gestionar cargas.</div> : (
              <ul className="assign-list">
                {groups.map((group) => {
                  const assignments = (group.teacher_assignments || []).filter((item) => Number(item.asignatura_id) === Number(subject.id))
                  return (
                    <li key={group.id}>
                      <div className="assign-text">
                        <strong>{group.nombre}</strong><small>{group.periodo || `${group.semestre}° semestre`}</small>
                        <span className="row-wrap">
                          {assignments.length ? assignments.map((item) => <span key={item.id} className="chip-removable">{fullName(item.teacher)}<button type="button" aria-label={`Quitar a ${fullName(item.teacher)}`} onClick={() => unassign(item)}><FiX /></button></span>) : <Badge tone="warning">Sin docente</Badge>}
                        </span>
                      </div>
                      <div className="assign-controls">
                        <select className="control" aria-label="Asignar docente al grupo" value={picked[group.id] || ''} onChange={(event) => setPicked({ ...picked, [group.id]: event.target.value })}>
                          <option value="">Seleccionar docente</option>
                          {config.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.id} - {fullName(teacher)}</option>)}
                        </select>
                        <IconButton icon={FiUserPlus} label="Asignar docente" onClick={() => assign(group)} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <h2 className="section-title">Ventanas de registro por grupo</h2>
          <div className="grid-2">{config.subject_groups.map((group) => <WindowEditor key={group.id} group={group} onChanged={refresh} />)}</div>
        </>
      )}
    </Page>
  )
}

/** Revisión de propuestas de los grupos asignados al docente (teacher/proposal-review.php). */
function ProposalReview() {
  const client = useQueryClient()
  const projects = useQuery({ queryKey: ['proposal-teacher-projects'], queryFn: () => api.get('/proposal/teacher-projects').then((response) => response.data || []) })
  const windows = useQuery({ queryKey: ['proposal-window-groups'], queryFn: () => api.get('/proposal/window-groups').then((response) => response.data) })
  const review = async (project, status) => {
    const comment = await promptText({ title: 'Comentario', placeholder: 'Observaciones para el alumno', confirmText: 'Continuar', required: false })
    if (comment === null) return
    let until = null
    if (status === 'requiere_cambios') {
      until = await promptText({ title: 'Permitir corrección hasta', input: 'datetime-local', confirmText: 'Guardar' })
      if (!until) return
    }
    try {
      await api.post(`/proposal/projects/${project.id}/review`, { proposal_status: status, proposal_review_comment: comment || '', revision_allowed_until: until })
      toast.success('Revisión registrada')
      client.invalidateQueries({ queryKey: ['proposal-teacher-projects'] })
    } catch (error) { toast.error(apiError(error)) }
  }
  const list = projects.data || []
  return (
    <Page title="Revisión de propuestas" subtitle="Fundamentos de Ingeniería de Software" actions={<Button variant="ghost" icon={FiRefreshCw} onClick={() => { projects.refetch(); windows.refetch() }}>Actualizar</Button>}>
      <h2 className="section-title">Periodos de registro de mis grupos</h2>
      {windows.isLoading ? <Loading /> : !(windows.data?.groups || []).length ? <p className="muted">No tienes grupos asignados para supervisar propuestas.</p> : (
        <div className="grid-2">{windows.data.groups.map((group) => <WindowEditor key={group.id} group={group} onChanged={() => client.invalidateQueries({ queryKey: ['proposal-window-groups'] })} />)}</div>
      )}
      <div className="row-wrap"><h2 className="section-title">Propuestas asignadas</h2><Badge>{list.length} propuesta{list.length === 1 ? '' : 's'}</Badge></div>
      {projects.isLoading ? <Loading /> : projects.isError ? <ErrorState error={projects.error} onRetry={projects.refetch} /> : !list.length ? <Empty message="No tienes propuestas pendientes en tus grupos asignados." /> : (
        <div className="grid-2">
          {list.map((project) => (
            <Card key={project.id} title={project.title} actions={<Badge tone={STATUS_TONE[project.proposal_status] || 'neutral'}>{project.proposal_status}</Badge>}>
              <p className="muted small-text">{project.description || 'Sin descripción'}</p>
              <dl className="meta-grid">
                <div className="wide"><dt>Integrantes</dt><dd>{authors(project)}</dd></div>
                <div><dt>Grupo</dt><dd>{project.subject_group?.nombre || '—'}</dd></div>
                <div><dt>Empresa</dt><dd>{project.company_name || '—'}<br /><small className="muted">{[project.company_contact_name, project.company_contact_position].filter(Boolean).join(' · ')}</small></dd></div>
              </dl>
              {project.proposal_review_comment && <div className="alert-app">{project.proposal_review_comment}</div>}
              <div className="row-wrap mt-2">
                <Button size="sm" variant="success" icon={FiCheck} onClick={() => review(project, 'aprobado')}>Aprobar</Button>
                <Button size="sm" variant="warning" icon={FiEdit3} onClick={() => review(project, 'requiere_cambios')}>Solicitar cambios</Button>
                <Button size="sm" variant="ghost-danger" icon={FiX} onClick={() => review(project, 'rechazado')}>Rechazar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}

const COMPANY_FIELDS = [['company_name', 'Empresa o negocio'], ['company_giro', 'Giro'], ['company_contact_name', 'Persona a cargo'], ['company_contact_position', 'Puesto']]

/** Registro (o corrección) de la propuesta del alumno (student/proposal-register.php). */
function ProposalRegister() {
  const { user } = useAuth()
  const client = useQueryClient()
  const status = useQuery({ queryKey: ['proposal-student-status'], queryFn: () => api.get('/proposal/student-status').then((response) => response.data) })
  const [form, setForm] = useState(null)
  const [members, setMembers] = useState([])
  const [term, setTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const debounced = useDebounced(term, 300)
  const search = useQuery({ queryKey: ['proposal-students', debounced], queryFn: () => api.get('/proposal/students/search', { params: { q: debounced } }).then((response) => response.data || []), enabled: debounced.trim().length >= 2 })
  const data = status.data
  const project = data?.project
  const canFix = project?.proposal_status === 'requiere_cambios' && project.revision_allowed_until && new Date(project.revision_allowed_until) > new Date()
  const open = !project && data?.subject_group && data?.active_window
  const values = form || (canFix ? Object.fromEntries(['title', 'description', 'company_address', ...COMPANY_FIELDS.map(([key]) => key)].map((key) => [key, project[key] || ''])) : { title: '', description: '', company_name: '', company_giro: '', company_contact_name: '', company_contact_position: '', company_address: '' })
  const set = (key) => (event) => setForm({ ...values, [key]: event.target.value })
  const subjectName = data?.default_subject?.nombre || 'Fundamentos de Ingeniería de Software'

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (canFix) { await api.put(`/projects/${project.id}`, values); toast.success('Corrección enviada') }
      else { await api.post('/projects', { ...values, subject_group_id: data.subject_group.id, student_ids: members.map((student) => student.id) }); toast.success('Proyecto registrado') }
      setForm(null)
      client.invalidateQueries({ queryKey: ['proposal-student-status'] })
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }

  const banner = () => {
    if (data.profile_required) return <div className="alert-app warning">Debes completar tu perfil inicial antes de registrar un proyecto.</div>
    if (project) return (
      <div className={`alert-app ${canFix ? 'warning' : ''}`}>
        <strong>Proyecto ligado:</strong> {project.title}<br />Estado: <Badge tone={STATUS_TONE[project.proposal_status]}>{project.proposal_status}</Badge>
        {project.revision_allowed_until && <><br />Correcciones hasta: {formatDateTime(project.revision_allowed_until)}</>}
        {project.proposal_review_comment && <><br /><strong>Observaciones:</strong> {project.proposal_review_comment}</>}
      </div>
    )
    if (!data.subject_group) return <div className="alert-app">El registro corresponde a quinto semestre. Solicita una excepción a la jefatura para poder participar.</div>
    if (!data.active_window) return <div className="alert-app">El registro para <strong>{subjectName}</strong> no está abierto para la carga {data.subject_group.nombre || 'asignada'}.</div>
    return <div className="alert-app success"><strong>{subjectName}</strong><br />{data.has_exception && <>Acceso habilitado mediante excepción.<br /></>}Registro disponible hasta {formatDateTime(data.active_window.ends_at)}</div>
  }

  return (
    <Page title="Registro de proyecto" subtitle="Registra la propuesta de tu equipo para revisión.">
      {status.isLoading ? <Loading /> : status.isError ? <ErrorState error={status.error} onRetry={status.refetch} /> : (
        <>
          {banner()}
          {(open || canFix) && !viewAs(user) && (
            <Card>
              <form className="form-grid" onSubmit={submit}>
                <Field label="Nombre del proyecto" full><input className="control" required value={values.title} onChange={set('title')} /></Field>
                <Field label="Descripción" full><textarea className="control" rows={4} required value={values.description} onChange={set('description')} /></Field>
                {COMPANY_FIELDS.map(([key, label]) => <Field key={key} label={label}><input className="control" required value={values[key]} onChange={set(key)} /></Field>)}
                <Field label="Dirección" hint="Separa calle, número, colonia y municipio con comas (,)." full><input className="control" required value={values.company_address} onChange={set('company_address')} /></Field>
                {!canFix && (
                  <div className="full stack-tight">
                    <span className="field-label">Integrantes disponibles</span>
                    <SearchInput value={term} onChange={setTerm} placeholder="Número de control o nombre (mín. 2 letras)" />
                    {(search.data || []).filter((student) => !members.some((item) => String(item.id) === String(student.id))).slice(0, 8).map((student) => (
                      <button type="button" key={student.id} className="file-chip" onClick={() => { setMembers([...members, student]); setTerm('') }}><FiUserPlus /><span><strong>{student.id} - {fullName(student)}</strong></span></button>
                    ))}
                    <div className="row-wrap">{members.map((student) => <span key={student.id} className="chip-removable">{student.id} - {fullName(student)}<button type="button" aria-label={`Quitar a ${fullName(student)}`} onClick={() => setMembers(members.filter((item) => item.id !== student.id))}><FiX /></button></span>)}</div>
                  </div>
                )}
                <div className="form-actions full"><Button type="submit" icon={FiSend} loading={saving}>{canFix ? 'Enviar corrección' : 'Registrar propuesta'}</Button></div>
              </form>
            </Card>
          )}
        </>
      )}
    </Page>
  )
}
