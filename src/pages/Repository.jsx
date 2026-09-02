import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDownload, FiEdit2, FiEye, FiFileText, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { formatDate } from '../utils/formatters'
import { confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, Pagination, StatusBadge, useDebounced } from '../components/common/Ui'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { downloadApiFile } from '../utils/downloads'

export default function Repository({ publicView = false }) {
  const { user, isAuthenticated } = useAuth()
  const role = roleFromUser(user)
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const emptyForm = { nombre: '', descripcion: '', autores: '', project_id: '', visibility: 'public', tag_ids: [], archivo: null }
  const [form, setForm] = useState(emptyForm)
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
  const tagsQuery = useQuery({
    queryKey: ['repository-tags'],
    queryFn: () => api.get('/document-tags', { params: { status: 'active', per_page: 200 } }).then((response) => response.data.data || response.data || []),
    enabled: uploadOpen && role === 'admin',
  })
  const saveDocument = useMutation({
    mutationFn: () => {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'tag_ids') value.forEach((id) => body.append('tag_ids[]', id))
        else if (value !== '' && value !== null) body.append(key, value)
      })
      return api.post(editing ? `/repositorio/${editing.id}` : '/repositorio', body)
    },
    onSuccess: ({ data }) => { toast.success(data.message || 'Documento guardado.'); setUploadOpen(false); setEditing(null); setForm(emptyForm); client.invalidateQueries({ queryKey: ['repository'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const publish = useMutation({
    mutationFn: ({ id, makePublic }) => api.post(`/repositorio/${id}/publish`, { public: makePublic }),
    onSuccess: ({ data }) => { toast.success(data.message); client.invalidateQueries({ queryKey: ['repository'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const download = async (document) => {
    try {
      await downloadApiFile(`/repositorio/${document.id}/download`, document.nombre_archivo || document.nombre || document.title || `documento-${document.id}`)
    } catch (error) { toast.error(apiError(error)) }
  }
  const openCreate = () => { setEditing(null); setForm(emptyForm); setUploadOpen(true) }
  const openEdit = (document) => {
    setEditing(document)
    setForm({
      ...emptyForm,
      nombre: document.nombre || document.title || '',
      descripcion: document.descripcion || document.description || '',
      autores: document.autores || '',
      project_id: document.project_id || '',
      visibility: document.visibility || 'private',
      tag_ids: (document.tags || []).map((tag) => Number(tag.id)),
    })
    setUploadOpen(true)
  }
  const remove = async (document) => {
    if (!await confirmAction({ title: 'Eliminar documento', text: `Se eliminará “${document.nombre || document.title}” y su archivo.`, confirmText: 'Sí, eliminar' })) return
    try {
      const { data } = await api.delete(`/repositorio/${document.id}`)
      toast.success(data.message || 'Documento eliminado.')
      client.invalidateQueries({ queryKey: ['repository'] })
    } catch (error) { toast.error(apiError(error)) }
  }
  const payload = query.data
  const pagination = payload?.data?.data ? payload.data : payload
  const documents = pagination?.data || []
  return (
    <main className={publicView ? 'public-repository' : ''}>
      {publicView && <header className="public-nav"><a href="/"><img src="/images/itssmt.webp" alt="ITSSMT" /><strong>SGPI ITSSMT</strong></a><a href="/login">Iniciar sesión</a></header>}
      <div className={publicView ? 'public-content' : ''}>
        <PageHeader eyebrow="Acervo digital" title="Repositorio institucional" description="Consulta proyectos, tesis y documentos publicados por la comunidad tecnológica." actions={!publicView && ['admin', 'student'].includes(role) && <button className="btn-primary-app compact" onClick={openCreate}><FiPlus /> Subir documento</button>} />
        <section className="repository-search"><FiSearch /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por título, autor, proyecto o palabra clave..." /></section>
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : documents.length === 0 ? <Empty title="No encontramos documentos" message="Prueba con otros términos de búsqueda." /> : (
          <section className="document-grid">{documents.map((document) => <article className="document-card" key={document.id}>
            <div className="document-cover"><FiFileText /><span>PDF</span></div>
            <div><StatusBadge value={document.visibility || document.status || 'publicado'} /><h2>{document.title || document.titulo || document.nombre}</h2><p>{document.description || document.descripcion || 'Documento del repositorio institucional.'}</p><small>{document.project?.title || document.project_title || 'ITSSMT'} · {formatDate(document.created_at)}</small>
              {(document.tags || []).length > 0 && <div className="repository-card-tags">{document.tags.map((tag) => <span key={tag.id}>{tag.nombre}</span>)}</div>}
              <div className="repository-card-actions"><button className="document-download" onClick={() => setDetail(document)}><FiEye /> Detalles</button><button className="document-download" onClick={() => download(document)}><FiDownload /> Descargar</button>{!publicView && role === 'admin' && <><button className="document-download" onClick={() => openEdit(document)}><FiEdit2 /> Editar</button><button className="document-download" onClick={() => publish.mutate({ id: document.id, makePublic: document.visibility !== 'public' })}>{document.visibility === 'public' ? 'Hacer privado' : 'Publicar'}</button><button className="document-download danger" onClick={() => remove(document)}><FiTrash2 /> Eliminar</button></>}</div>
            </div>
          </article>)}</section>
        )}
        <Pagination meta={pagination} onPage={setPage} />
      </div>
      <Modal open={uploadOpen} title={editing ? 'Editar documento' : 'Subir documento'} onClose={() => { setUploadOpen(false); setEditing(null) }}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); saveDocument.mutate() }}><div className="form-grid">
          <label className="full-field">Nombre<input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></label>
          <label className="full-field">Descripción<textarea required rows="4" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></label>
          <label>Autores<input required value={form.autores} onChange={(event) => setForm({ ...form, autores: event.target.value })} /></label>
          <label>Proyecto<select value={form.project_id} required={role === 'student'} onChange={(event) => setForm({ ...form, project_id: event.target.value })}><option value="">Sin proyecto</option>{projectOptions.data?.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
          {role === 'admin' && <label>Visibilidad<select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="public">Público</option><option value="private">Privado</option></select></label>}
          {role === 'admin' && <fieldset className="full-field repository-tag-selector"><legend>Etiquetas</legend>{(tagsQuery.data || []).map((tag) => <label key={tag.id}><input type="checkbox" checked={form.tag_ids.includes(Number(tag.id))} onChange={() => setForm((current) => ({ ...current, tag_ids: current.tag_ids.includes(Number(tag.id)) ? current.tag_ids.filter((id) => id !== Number(tag.id)) : [...current.tag_ids, Number(tag.id)] }))} /><span>{tag.nombre}</span></label>)}</fieldset>}
          <label className="full-field">Archivo<input required={!editing} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.jpg,.jpeg,.png,.webp,.epub" onChange={(event) => setForm({ ...form, archivo: event.target.files[0] || null })} /><small>{editing ? 'Déjalo vacío para conservar el archivo actual.' : 'Selecciona el archivo que deseas publicar.'}</small></label>
        </div><div className="modal-actions"><button type="button" onClick={() => { setUploadOpen(false); setEditing(null) }}>Cancelar</button><button className="btn-primary-app compact" disabled={saveDocument.isPending}>{editing ? 'Guardar cambios' : 'Subir documento'}</button></div></form>
      </Modal>
      <Modal open={Boolean(detail)} title={detail?.nombre || detail?.title || 'Documento'} onClose={() => setDetail(null)}>
        {detail && <section className="repository-detail-modal"><StatusBadge value={detail.visibility || detail.status || 'publicado'} /><p>{detail.descripcion || detail.description || 'Sin descripción.'}</p><dl><dt>Autores</dt><dd>{detail.autores || 'Sin autores registrados'}</dd><dt>Fecha</dt><dd>{formatDate(detail.created_at)}</dd><dt>Archivo</dt><dd>{detail.archivo_tipo?.toUpperCase() || detail.nombre_archivo || 'Documento'}</dd><dt>Etiquetas</dt><dd>{(detail.tags || []).map((tag) => tag.nombre).join(', ') || 'Sin etiquetas'}</dd></dl><button className="btn-primary-app compact" onClick={() => download(detail)}><FiDownload /> Descargar</button></section>}
      </Modal>
    </main>
  )
}
