import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiPlus, FiSearch } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { API_URL, apiError } from '../services/api'
import { formatDate } from '../utils/formatters'
import { Empty, ErrorState, Loading, Modal, PageHeader, Pagination, StatusBadge, useDebounced } from '../components/common/Ui'
import { roleFromUser, useAuth } from '../hooks/useAuth'

export default function Repository({ publicView = false }) {
  const { user, isAuthenticated } = useAuth()
  const role = roleFromUser(user)
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', descripcion: '', autores: '', project_id: '', visibility: 'public', archivo: null })
  const q = useDebounced(search)
  const listEndpoint = publicView || !isAuthenticated ? (q ? '/repositorio/buscar' : '/repositorio') : role === 'admin' ? '/repositorio/admin/list' : role === 'student' ? '/repositorio/student/list' : '/repositorio'
  const query = useQuery({
    queryKey: ['repository', role, publicView, page, q],
    queryFn: () => api.get(listEndpoint, { params: { page, q } }).then((r) => r.data),
  })
  const projectOptions = useQuery({
    queryKey: ['repository-project-options', role],
    queryFn: () => api.get(role === 'student' ? '/my-projects' : '/projects', { params: { per_page: 100 } }).then((response) => response.data.data || []),
    enabled: uploadOpen && isAuthenticated && ['admin', 'student'].includes(role),
  })
  const upload = useMutation({
    mutationFn: () => {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => { if (value !== '' && value !== null) body.append(key, value) })
      return api.post('/repositorio', body)
    },
    onSuccess: () => { toast.success('Documento agregado al repositorio.'); setUploadOpen(false); client.invalidateQueries({ queryKey: ['repository'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const download = async (document) => {
    if (publicView || !isAuthenticated) {
      window.location.assign(`${API_URL}/repositorio/${document.id}/download`)
      return
    }
    try {
      const response = await api.get(`/repositorio/${document.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = document.nombre || document.title || `documento-${document.id}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { toast.error(apiError(error)) }
  }
  const payload = query.data
  const pagination = payload?.data?.data ? payload.data : payload
  const documents = pagination?.data || []
  return (
    <main className={publicView ? 'public-repository' : ''}>
      {publicView && <header className="public-nav"><a href="/"><img src="/images/itssmt.webp" alt="ITSSMT" /><strong>SGPI ITSSMT</strong></a><a href="/login">Iniciar sesión</a></header>}
      <div className={publicView ? 'public-content' : ''}>
        <PageHeader eyebrow="Acervo digital" title="Repositorio institucional" description="Consulta proyectos, tesis y documentos publicados por la comunidad tecnológica." actions={!publicView && ['admin', 'student'].includes(role) && <button className="btn-primary-app compact" onClick={() => setUploadOpen(true)}><FiPlus /> Subir documento</button>} />
        <section className="repository-search"><FiSearch /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por título, autor, proyecto o palabra clave..." /></section>
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : documents.length === 0 ? <Empty title="No encontramos documentos" message="Prueba con otros términos de búsqueda." /> : (
          <section className="document-grid">{documents.map((document) => <article className="document-card" key={document.id}>
            <div className="document-cover"><FiFileText /><span>PDF</span></div>
            <div><StatusBadge value={document.status || 'publicado'} /><h2>{document.title || document.titulo || document.nombre}</h2><p>{document.description || document.descripcion || 'Documento del repositorio institucional.'}</p><small>{document.project?.title || document.project_title || 'ITSSMT'} · {formatDate(document.created_at)}</small>
              <button className="document-download" onClick={() => download(document)}><FiDownload /> Descargar documento</button>
            </div>
          </article>)}</section>
        )}
        <Pagination meta={pagination} onPage={setPage} />
      </div>
      <Modal open={uploadOpen} title="Subir documento" onClose={() => setUploadOpen(false)}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); upload.mutate() }}><div className="form-grid">
          <label className="full-field">Nombre<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
          <label className="full-field">Descripción<textarea required rows="4" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label>
          <label>Autores<input required value={form.autores} onChange={(event) => setForm({ ...form, autores: event.target.value })} /></label>
          <label>Proyecto<select value={form.project_id} required={role === 'student'} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Sin proyecto</option>{projectOptions.data?.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
          {role === 'admin' && <label>Visibilidad<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="public">Público</option><option value="private">Privado</option></select></label>}
          <label className="full-field">Archivo<input required type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.jpg,.jpeg,.png,.webp" onChange={(event) => setForm({ ...form, archivo: event.target.files[0] })} /></label>
        </div><div className="modal-actions"><button type="button" onClick={() => setUploadOpen(false)}>Cancelar</button><button className="btn-primary-app compact">Subir documento</button></div></form>
      </Modal>
    </main>
  )
}
