import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheck, FiClock, FiSearch, FiSend, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { Empty, ErrorState, Loading, Modal, PageHeader, StatusBadge } from '../components/common/Ui'
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
  const [form, setForm] = useState({ title: '', description: '', company_name: '', company_giro: '', company_contact_name: '', company_contact_position: '', company_address: '', teammate_ids: '' })
  const query = useQuery({ queryKey: ['proposal-student-status'], queryFn: () => api.get('/proposal/student-status').then((response) => response.data) })
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
  return <>
    <PageHeader eyebrow="Proyecto integrador" title="Registrar propuesta" description={`Carga asignada: ${data.subject_group?.nombre}. Completa todos los datos de vinculación.`} />
    <form className="panel proposal-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <div className="form-grid">
        <label className="full-field">Título del proyecto<input required value={form.title} onChange={(event) => update('title', event.target.value)} /></label>
        <label className="full-field">Descripción<textarea required rows="5" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
        <label>Empresa u organización<input required value={form.company_name} onChange={(event) => update('company_name', event.target.value)} /></label>
        <label>Giro de la empresa<input required value={form.company_giro} onChange={(event) => update('company_giro', event.target.value)} /></label>
        <label>Persona de contacto<input required value={form.company_contact_name} onChange={(event) => update('company_contact_name', event.target.value)} /></label>
        <label>Cargo del contacto<input required value={form.company_contact_position} onChange={(event) => update('company_contact_position', event.target.value)} /></label>
        <label className="full-field">Dirección de la empresa<input required value={form.company_address} onChange={(event) => update('company_address', event.target.value)} /></label>
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
  const query = useQuery({ queryKey: ['proposal-config'], queryFn: () => api.get('/proposal/config').then((response) => response.data) })
  const mutation = useMutation({
    mutationFn: () => api.post('/proposal/windows', windowForm),
    onSuccess: () => { toast.success('Ventana creada.'); client.invalidateQueries({ queryKey: ['proposal-config'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const data = query.data
  return <>
    <PageHeader eyebrow="Administración" title="Configuración de propuestas" description={`Materia predeterminada: ${data.default_subject?.nombre}. Define ventanas por grupo.`} />
    <section className="proposal-config-grid">
      <form className="panel proposal-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><h2>Nueva ventana de registro</h2>
        <label>Grupo<select required value={windowForm.subject_group_id} onChange={(event) => setWindowForm({ ...windowForm, subject_group_id: Number(event.target.value) })}><option value="">Selecciona</option>{data.subject_groups.map((group) => <option key={group.id} value={group.id}>{group.semestre} {group.grupo} · {group.nombre}</option>)}</select></label>
        <label>Inicio<input required type="datetime-local" value={windowForm.starts_at} onChange={(event) => setWindowForm({ ...windowForm, starts_at: event.target.value })} /></label>
        <label>Fin<input required type="datetime-local" value={windowForm.ends_at} onChange={(event) => setWindowForm({ ...windowForm, ends_at: event.target.value })} /></label>
        <label>Notas<textarea rows="3" value={windowForm.notes} onChange={(event) => setWindowForm({ ...windowForm, notes: event.target.value })} /></label>
        <button className="btn-primary-app compact"><FiClock /> Crear ventana</button>
      </form>
      <section className="panel"><h2>Grupos y ventanas</h2><div className="window-list">{data.subject_groups.map((group) => <article key={group.id}><strong>{group.semestre} {group.grupo} · {group.nombre}</strong>{group.registration_windows?.length ? group.registration_windows.map((window) => <span key={window.id}><StatusBadge value={window.activo ? 'activo' : 'inactivo'} /> {formatDate(window.starts_at)} a {formatDate(window.ends_at)}</span>) : <small>Sin ventanas registradas</small>}</article>)}</div></section>
    </section>
  </>
}
