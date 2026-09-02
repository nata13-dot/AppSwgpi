import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiClock, FiPlus, FiSearch, FiSend, FiTrash2, FiUserPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, StatusBadge } from '../components/common/Ui'
import { formatDate, fullName } from '../utils/formatters'

export default function Proposals() {
  const { user } = useAuth()
  const role = roleFromUser(user)
  if (role === 'student') return <StudentProposal />
  if (role === 'teacher') return <TeacherReviews />
  return <ProposalConfiguration />
}

function StudentProposal() {
  const client = useQueryClient()
  const [form, setForm] = useState({ title: '', description: '', modalidad: 'proyecto_integrador', company_id: '', company_name: '', company_rfc: '', company_giro: '', company_contact_name: '', company_contact_position: '', company_address: '', request_company_registration: true, teammate_ids: '' })
  const query = useQuery({ queryKey: ['proposal-student-status'], queryFn: () => api.get('/proposal/student-status').then((response) => response.data) })
  const companies = useQuery({ queryKey: ['company-suggestions', form.company_name], queryFn: () => api.get('/companies', { params: { q: form.company_name } }).then((response) => response.data), enabled: form.company_name.trim().length >= 2 })
  const mutation = useMutation({
    mutationFn: () => api.post('/projects', {
      ...form,
      subject_group_id: query.data.subject_group.id,
      student_ids: String(form.teammate_ids || '').split(',').map((value) => value.trim()).filter(Boolean),
    }),
    onSuccess: () => { toast.success('Propuesta registrada para revisión.'); client.invalidateQueries({ queryKey: ['proposal-student-status'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const data = query.data
  if (data.project) return <>
    <PageHeader eyebrow="Proyecto integrador" title="Mi propuesta" description="Consulta el avance de revisión de tu propuesta." />
    <section className="panel proposal-status-card"><StatusBadge value={data.project.proposal_status} /><h2>{data.project.title}</h2><p>{data.project.description}</p>{data.project.proposal_review_comment && <div className="review-comment"><strong>Retroalimentación</strong><p>{data.project.proposal_review_comment}</p></div>}<small>Registrada el {formatDate(data.project.created_at)}</small></section>
  </>
  if (data.profile_required) return <ErrorState message="Completa tu perfil inicial antes de registrar una propuesta." />
  if (!data.can_register) return <><PageHeader eyebrow="Proyecto integrador" title="Registro de propuesta" description="El registro depende de la ventana asignada a tu grupo." /><section className="panel closed-window"><FiClock /><h2>La ventana de registro no está abierta</h2><p>Tu grupo: {data.subject_group ? `${data.subject_group.semestre} ${data.subject_group.grupo}` : 'sin carga asignada'}.</p></section></>
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const selectCompany = (id) => {
    const company = (companies.data || []).find((item) => String(item.id) === String(id))
    if (!company) return
    setForm((current) => ({ ...current, company_id: company.id, company_name: company.nombre, company_rfc: company.rfc || '', company_giro: company.giro || '', company_contact_name: company.contacto_nombre || '', company_contact_position: company.contacto_cargo || '', company_address: company.direccion || '', request_company_registration: false }))
  }
  return <>
    <PageHeader eyebrow="Proyecto integrador" title="Registrar propuesta" description={`Carga asignada: ${data.subject_group?.nombre}. Completa todos los datos de vinculación.`} />
    <form className="panel proposal-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <div className="form-grid">
        <label className="full-field">Título del proyecto<input required value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
        <label className="full-field">Descripción<textarea required rows="5" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
        <label>Modalidad<select required value={form.modalidad} onChange={(event) => update('modalidad', event.target.value)}><option value="dual">Modalidad Dual</option><option value="proyecto_integrador">Proyecto integrador</option><option value="caso_integrador">Caso integrador</option></select></label>
        <label>Empresa registrada<select value={form.company_id} onChange={(event) => selectCompany(event.target.value)}><option value="">Nueva empresa</option>{(companies.data || []).map((company) => <option key={company.id} value={company.id}>{company.nombre} · {company.rfc || 'sin RFC histórico'}</option>)}</select></label>
        <label>Empresa u organización<input required value={form.company_name} onChange={(event) => update('company_name', event.target.value)} /></label>
        <label>RFC<input required={!form.company_id} maxLength="13" value={form.company_rfc} onChange={(event) => update('company_rfc', event.target.value.toUpperCase())} placeholder="ABC010203AB1" /></label>
        <label>Giro de la empresa<input required value={form.company_giro} onChange={(event) => update('company_giro', event.target.value)} /></label>
        <label>Persona de contacto<input required value={form.company_contact_name} onChange={(event) => update('company_contact_name', event.target.value)} /></label>
        <label>Cargo del contacto<input required value={form.company_contact_position} onChange={(event) => update('company_contact_position', event.target.value)} /></label>
        <label className="full-field">Dirección de la empresa<input required value={form.company_address} onChange={(event) => update('company_address', event.target.value)} /></label>
        {!form.company_id && <label className="full-field switch-field"><input type="checkbox" checked={form.request_company_registration} onChange={(event) => update('request_company_registration', event.target.checked)} /><span>Solicitar a jefatura o administración que valide y guarde esta empresa en el catálogo</span></label>}
        <label className="full-field">Matrículas de compañeros <small>Separadas por coma. Tú se agregas automáticamente.</small><input value={form.teammate_ids} onChange={(event) => update('teammate_ids', event.target.value)} /></label>
      </div>
      <button className="btn-primary-app compact" disabled={mutation.isPending}><FiSend /> Enviar propuesta</button>
    </form>
  </>
}

function TeacherReviews() {
  const client = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [review, setReview] = useState({ proposal_status: 'aprobado', proposal_review_comment: '', revision_allowed_until: '' })
  const query = useQuery({ queryKey: ['teacher-proposals'], queryFn: () => api.get('/proposal/teacher-projects').then((response) => response.data) })
  const mutation = useMutation({
    mutationFn: () => api.post(`/proposal/projects/${selected.id}/review`, review),
    onSuccess: () => { toast.success('Revisión registrada.'); setSelected(null); client.invalidateQueries({ queryKey: ['teacher-proposals'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  return <>
    <PageHeader eyebrow="Docencia" title="Revisión de propuestas" description="Evalúa las propuestas de los grupos que tienes asignados." />
    {query.data?.length ? <section className="proposal-grid">{query.data.map((project) => <article className="panel proposal-card" key={project.id}><div><StatusBadge value={project.proposal_status} /><small>{project.subject_group ? `${project.subject_group.semestre} ${project.subject_group.grupo}` : 'Sin grupo'}</small></div><h2>{project.title}</h2><p>{project.description}</p><small>{project.students?.map(fullName).join(', ')}</small><button className="btn-primary-app compact" onClick={() => setSelected(project)}>Revisar propuesta</button></article>)}</section> : <Empty title="Sin propuestas pendientes" />}
    <Modal open={Boolean(selected)} title="Registrar revisión" onClose={() => setSelected(null)}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <label>Resultado<select value={review.proposal_status} onChange={(event) => setReview({ ...review, proposal_status: event.target.value })}><option value="aprobado">Aprobar</option><option value="requiere_cambios">Solicitar cambios</option><option value="rechazado">Rechazar</option></select></label>
      {review.proposal_status === 'requiere_cambios' && <label>Fecha límite para corregir<input required type="datetime-local" value={review.revision_allowed_until} onChange={(event) => setReview({ ...review, revision_allowed_until: event.target.value })} /></label>}
      <label>Comentarios<textarea rows="5" value={review.proposal_review_comment} onChange={(event) => setReview({ ...review, proposal_review_comment: event.target.value })} /></label>
      <div className="modal-actions"><button type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="btn-primary-app compact">Guardar revisión</button></div>
    </form></Modal>
  </>
}

function ProposalConfiguration() {
  const client = useQueryClient()
  const [windowForm, setWindowForm] = useState({ subject_group_id: '', starts_at: '', ends_at: '', activo: true, notes: '' })
  const [assignment, setAssignment] = useState({ subject_group_id: '', teacher_id: '' })
  const [exception, setException] = useState({ subject_group_id: '', student_id: '', notes: '' })
  const [studentSearch, setStudentSearch] = useState('')
  const query = useQuery({ queryKey: ['proposal-config'], queryFn: () => api.get('/proposal/config').then((response) => response.data) })
  const students = useQuery({ queryKey: ['proposal-students', studentSearch], queryFn: () => api.get('/proposal/students/search', { params: { q: studentSearch } }).then((response) => response.data), enabled: studentSearch.trim().length >= 2 })
  const mutation = useMutation({
    mutationFn: ({ method = 'post', endpoint, body }) => api[method](endpoint, body),
    onSuccess: ({ data }) => { toast.success(data.message || 'Configuración actualizada.'); client.invalidateQueries({ queryKey: ['proposal-config'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const data = query.data
  const remove = async (title, endpoint) => {
    if (await confirmAction({ title, text: 'El cambio se aplicará a la configuración de propuestas.' })) mutation.mutate({ method: 'delete', endpoint })
  }
  return <>
    <PageHeader eyebrow="Administración" title="Configuración de propuestas" description={`Materia predeterminada: ${data.default_subject?.nombre || 'sin configurar'}. Administra responsables, excepciones y ventanas por grupo.`} />
    <section className="proposal-config-grid">
      <form className="panel proposal-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ endpoint: '/proposal/windows', body: windowForm }) }}><h2>Nueva ventana de registro</h2>
        <label>Grupo<select required value={windowForm.subject_group_id} onChange={(event) => setWindowForm({ ...windowForm, subject_group_id: Number(event.target.value) })}><option value="">Selecciona</option>{data.subject_groups.map((group) => <option key={group.id} value={group.id}>{group.semestre} {group.grupo} · {group.nombre}</option>)}</select></label>
        <label>Inicio<input required type="datetime-local" value={windowForm.starts_at} onChange={(event) => setWindowForm({ ...windowForm, starts_at: event.target.value })} /></label>
        <label>Fin<input required type="datetime-local" value={windowForm.ends_at} onChange={(event) => setWindowForm({ ...windowForm, ends_at: event.target.value })} /></label>
        <label>Notas<textarea rows="3" value={windowForm.notes} onChange={(event) => setWindowForm({ ...windowForm, notes: event.target.value })} /></label>
        <button className="btn-primary-app compact" disabled={mutation.isPending}><FiClock /> Crear ventana</button>
      </form>
      <section className="panel"><h2>Grupos y ventanas</h2><div className="window-list">{data.subject_groups.map((group) => <article key={group.id}><strong>{group.semestre} {group.grupo} · {group.nombre}</strong>{group.registration_windows?.length ? group.registration_windows.map((window) => <span className="window-row" key={window.id}><span><StatusBadge value={window.activo ? 'activo' : 'inactivo'} /> {formatDate(window.starts_at)} a {formatDate(window.ends_at)}</span><button className="icon-action danger" title="Eliminar ventana" onClick={() => remove('Eliminar ventana', `/proposal/windows/${window.id}`)}><FiTrash2 /></button></span>) : <small>Sin ventanas registradas</small>}</article>)}</div></section>
    </section>
    <section className="panel proposal-admin-section"><header className="panel-heading"><div><span className="eyebrow">Responsables</span><h2>Docentes por grupo</h2></div></header><form className="proposal-inline-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ endpoint: '/proposal/assignments', body: { ...assignment, asignatura_id: data.default_subject.id, labor: `Revisión de propuesta: ${data.default_subject.nombre}`, activo: true } }) }}><label>Grupo<select required value={assignment.subject_group_id} onChange={(event) => setAssignment({ ...assignment, subject_group_id: Number(event.target.value) })}><option value="">Selecciona una carga</option>{data.subject_groups.map((group) => <option key={group.id} value={group.id}>{group.nombre} · {group.grupo}</option>)}</select></label><label>Docente<select required value={assignment.teacher_id} onChange={(event) => setAssignment({ ...assignment, teacher_id: event.target.value })}><option value="">Selecciona un docente</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.id} · {fullName(teacher)}</option>)}</select></label><button className="btn-primary-app compact"><FiUserPlus /> Asignar</button></form><div className="assignment-grid">{data.subject_groups.map((group) => <article key={group.id}><strong>{group.nombre} · {group.grupo}</strong>{group.teacher_assignments?.length ? group.teacher_assignments.map((item) => <span key={item.id}>{fullName(item.teacher)}<button className="icon-action danger" onClick={() => remove('Quitar docente responsable', `/proposal/assignments/${item.id}`)}><FiTrash2 /></button></span>) : <small>Sin docente responsable</small>}</article>)}</div></section>
    <section className="panel proposal-admin-section"><header className="panel-heading"><div><span className="eyebrow">Acceso excepcional</span><h2>Alumnos de otros grupos</h2></div></header><form className="proposal-inline-form exception-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ endpoint: '/proposal/exceptions', body: exception }) }}><label>Buscar alumno<input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Matrícula o nombre" /></label><label>Alumno<select required value={exception.student_id} onChange={(event) => setException({ ...exception, student_id: event.target.value })}><option value="">Selecciona</option>{(students.data || []).map((student) => <option key={student.id} value={student.id}>{student.id} · {fullName(student)} ({student.semestre || '—'}{student.grupo || ''})</option>)}</select></label><label>Carga asignada<select required value={exception.subject_group_id} onChange={(event) => setException({ ...exception, subject_group_id: Number(event.target.value) })}><option value="">Selecciona</option>{data.subject_groups.map((group) => <option key={group.id} value={group.id}>{group.nombre} · {group.grupo}</option>)}</select></label><label>Nota<input value={exception.notes} onChange={(event) => setException({ ...exception, notes: event.target.value })} /></label><button className="btn-primary-app compact"><FiPlus /> Agregar</button></form>{data.exceptions?.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Materia</th><th>Carga</th><th>Alumno</th><th>Grupo alumno</th><th>Nota</th><th>Acción</th></tr></thead><tbody>{data.exceptions.map((item) => <tr key={item.id}><td data-label="Materia">{item.asignatura?.nombre || '—'}</td><td data-label="Carga">{item.subject_group?.nombre || '—'}</td><td data-label="Alumno" className="mobile-primary-cell">{item.student?.id} · {fullName(item.student)}</td><td data-label="Grupo alumno">{item.student?.semestre || '—'} {item.student?.grupo || ''}</td><td data-label="Nota">{item.notes || '—'}</td><td data-label="Acción" className="row-actions"><button className="danger" onClick={() => remove('Quitar excepción', `/proposal/exceptions/${item.id}`)}><FiTrash2 /> Quitar</button></td></tr>)}</tbody></table></div> : <Empty message="No hay alumnos con acceso excepcional." />}</section>
  </>
}
