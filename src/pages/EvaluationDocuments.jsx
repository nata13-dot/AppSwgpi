import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiGlobe, FiUpload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../services/api'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { Empty, ErrorState, Loading, PageHeader, StatusBadge } from '../components/common/Ui'
import { formatDate, fullName } from '../utils/formatters'

export default function EvaluationDocuments() {
  const { user } = useAuth()
  const role = roleFromUser(user)
  const client = useQueryClient()
  const [section, setSection] = useState('evaluations')
  const [uploadTarget, setUploadTarget] = useState(null)
  const fileInput = useRef()
  const evaluations = useQuery({ queryKey: ['evaluation-documents'], queryFn: () => api.get('/repositorio/evaluation-documents').then((response) => response.data.data || []) })
  const thesis = useQuery({ queryKey: ['thesis-documents'], queryFn: () => api.get('/repositorio/thesis-documents').then((response) => unwrapCollection(response.data)) })
  const upload = useMutation({
    mutationFn: ({ target, file }) => {
      const body = new FormData()
      body.append('project_id', target.project.project.id)
      body.append('document_type', target.type)
      body.append('nombre', target.type === 'release_sheet' ? 'Hoja de liberación' : 'Presentación')
      body.append('descripcion', `Entrega de evaluación: ${target.type === 'release_sheet' ? 'hoja de liberación' : 'presentación'}.`)
      body.append('autores', target.project.integrantes.map(fullName).join(', '))
      body.append('archivo', file)
      return api.post('/repositorio/evaluation-documents', body)
    },
    onSuccess: () => { toast.success('Documento guardado para revisión.'); client.invalidateQueries({ queryKey: ['evaluation-documents'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const review = useMutation({
    mutationFn: ({ id, students }) => api.put(`/repositorio/evaluation-documents/${id}/release-status`, { students }),
    onSuccess: () => { toast.success('Liberación actualizada.'); client.invalidateQueries({ queryKey: ['evaluation-documents'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const publish = useMutation({
    mutationFn: ({ id, makePublic }) => api.post(`/repositorio/${id}/publish`, { public: makePublic }),
    onSuccess: () => { toast.success('Visibilidad actualizada.'); client.invalidateQueries({ queryKey: ['thesis-documents'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const download = async (document) => {
    try {
      const response = await api.get(`/repositorio/${document.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = document.nombre || `documento-${document.id}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { toast.error(apiError(error)) }
  }
  const loading = section === 'evaluations' ? evaluations.isLoading : thesis.isLoading
  const error = section === 'evaluations' ? evaluations.error : thesis.error
  return <>
    <PageHeader eyebrow="Evaluación" title="Documentos de evaluación" description="Gestiona hojas de liberación, presentaciones y avances privados de tesis o residencias." />
    <input ref={fileInput} hidden type="file" onChange={(event) => {
      const file = event.target.files?.[0]
      if (file && uploadTarget) upload.mutate({ target: uploadTarget, file })
      event.target.value = ''
    }} />
    <div className="module-tabs"><button className={section === 'evaluations' ? 'active' : ''} onClick={() => setSection('evaluations')}>Entregas de evaluación</button><button className={section === 'thesis' ? 'active' : ''} onClick={() => setSection('thesis')}>Tesis y residencias</button></div>
    {loading ? <Loading /> : error ? <ErrorState message={apiError(error)} /> : section === 'evaluations' ? <EvaluationProjectDocuments projects={evaluations.data || []} upload={(project, type) => {
      setUploadTarget({ project, type })
      fileInput.current.accept = type === 'presentation' ? '.pdf,.ppt,.pptx' : '.pdf,.doc,.docx'
      fileInput.current.click()
    }} download={download} review={(id, students) => review.mutate({ id, students })} /> : <ThesisDocuments documents={thesis.data || []} role={role} user={user} download={download} publish={(id, makePublic) => publish.mutate({ id, makePublic })} />}
  </>
}

function EvaluationProjectDocuments({ projects, upload, download, review }) {
  if (!projects.length) return <section className="panel"><Empty title="Sin proyectos disponibles" /></section>
  const semesters = [...new Set(projects.map((item) => Number(item.project.semestre)))].sort()
  return <div className="evaluation-document-sections">{semesters.map((semester) => <section key={semester}><h2>Semestre {semester}</h2><div className="evaluation-document-list">{projects.filter((item) => Number(item.project.semestre) === semester).map((project) => <article className="evaluation-document-project" key={project.project.id}>
    <header><div><h3>{project.project.title}</h3><p>{project.integrantes.map(fullName).join(', ') || 'Sin integrantes'}</p></div><StatusBadge value={`semestre ${semester}`} /></header>
    <div className="delivery-slot-grid"><DeliverySlot title="1. Hoja de liberación" project={project} type="release_sheet" delivery={project.release_sheet} upload={upload} download={download} review={review} /><DeliverySlot title="2. Presentación" project={project} type="presentation" delivery={project.presentation} upload={upload} download={download} /></div>
  </article>)}</div></section>)}</div>
}

function DeliverySlot({ title, project, type, delivery, upload, download, review }) {
  const [students, setStudents] = useState(() => delivery.students || [])
  const document = delivery.document
  return <section className="delivery-slot-react">
    <header><h4><FiFileText /> {title}</h4><StatusBadge value={delivery.uploaded ? 'archivo cargado' : 'archivo pendiente'} /></header>
    {document && <div className="document-summary"><strong>{document.nombre}</strong><small>{formatDate(document.created_at)}</small><button onClick={() => download(document)}><FiDownload /> Descargar</button></div>}
    {project.puede_subir && <button className="btn-primary-app compact" onClick={() => upload(project, type)}><FiUpload /> {delivery.uploaded ? 'Reemplazar archivo' : 'Subir archivo'}</button>}
    {type === 'release_sheet' && delivery.uploaded && <div className="release-review">
      <h5>Alumnos liberados</h5>
      {students.map((student) => <label key={student.id}>
        <span>{fullName(student)}</span>
        <input
          type="checkbox"
          disabled={!project.puede_revisar}
          checked={student.released}
          onChange={(event) => setStudents(students.map((item) => item.id === student.id ? { ...item, released: event.target.checked } : item))}
        />
      </label>)}
      {project.puede_revisar && <button
        className="btn-primary-app compact"
        onClick={() => review(document.id, students.map((student) => ({ student_id: student.id, released: student.released })))}
      >Guardar liberación</button>}
    </div>}
  </section>
}

function ThesisDocuments({ documents, role, user, download, publish }) {
  const client = useQueryClient()
  const [form, setForm] = useState({ tipo: 'tesis', nombre: '', descripcion: '', autores: '', archivo: null })
  const upload = useMutation({
    mutationFn: () => {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => value != null && body.append(key, value))
      return api.post('/repositorio/thesis-documents', body)
    },
    onSuccess: () => { toast.success('Avance guardado para revisión.'); setForm({ tipo: 'tesis', nombre: '', descripcion: '', autores: '', archivo: null }); client.invalidateQueries({ queryKey: ['thesis-documents'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  return <section className="panel thesis-document-list">
    {role === 'student' && Number(user?.semestre) === 9 && <form className="thesis-upload-form" onSubmit={(event) => { event.preventDefault(); upload.mutate() }}>
      <h3>Subir avance de 9.º semestre</h3>
      <div className="form-grid">
        <label>Tipo<select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}><option value="tesis">Tesis general</option><option value="residencias">Residencias</option></select></label>
        <label>Nombre<input required maxLength="255" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
        <label className="full-field">Descripción<textarea rows="3" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label>
        <label>Autores<input value={form.autores} onChange={(event) => setForm({ ...form, autores: event.target.value })} /></label>
        <label>Archivo PDF, DOC o DOCX<input required type="file" accept=".pdf,.doc,.docx" onChange={(event) => setForm({ ...form, archivo: event.target.files?.[0] || null })} /></label>
      </div><button className="btn-primary-app compact" disabled={upload.isPending}><FiUpload /> Guardar avance</button>
    </form>}
    {!documents.length ? <Empty title="Sin avances cargados" /> : documents.map((document) => <article key={document.id}><div><div className="row-actions"><StatusBadge value={document.document_category === 'thesis_residency' ? 'residencias' : 'tesis'} /><StatusBadge value={document.visibility === 'public' ? 'publicado' : 'privado'} /></div><h3>{document.nombre}</h3><p>{document.descripcion}</p><small>{fullName(document.uploader)} · {formatDate(document.created_at)}</small></div><div className="row-actions"><button onClick={() => download(document)}><FiDownload /> Descargar</button>{role === 'admin' && <button onClick={() => publish(document.id, document.visibility !== 'public')}><FiGlobe /> {document.visibility === 'public' ? 'Hacer privado' : 'Publicar'}</button>}</div></article>)}
  </section>
}
