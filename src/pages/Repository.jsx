import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiCalendar, FiDownload, FiEdit2, FiEye, FiGlobe, FiLock, FiTrash2, FiUploadCloud, FiUsers, FiAlertCircle, FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { isAdmin, isStudent } from '../lib/permissions'
import { downloadApiFile } from '../utils/downloads'
import { formatDate } from '../utils/formatters'
import { Badge, Button, Card, Chips, confirmAction, Empty, ErrorState, Field, FileDrop, Loading, Page, Pager, SearchInput, Sheet, useDebounced } from '../components/ui'

const CATEGORIES = { repository: 'General', repositorio: 'General', evaluation_document: 'Desarrollo de proyecto', evaluacion: 'Desarrollo de proyecto', thesis_general: 'Tesis', thesis_residency: 'Residencias', tesis: 'Tesis' }
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'epub']
const isPrivate = (doc) => ['private', 'privado'].includes(String(doc.visibility || doc.visibilidad || '').toLowerCase())
const download = (doc) => downloadApiFile(`/repositorio/${doc.id}/download`, doc.nombre || 'documento').catch((error) => toast.error(error.message))

/** Repositorio digital: público sin sesión; con sesión, la jefatura administra y el alumno sube (Frontend_Swgpi/pages/repositorio.php). */
export default function Repository() {
  const { user, isAuthenticated } = useAuth()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const manage = isAuthenticated && isAdmin(user)
  const student = isAuthenticated && isStudent(user)
  const [search, setSearch] = useState(params.get('q') || '')
  const [category, setCategory] = useState('')
  const [order, setOrder] = useState('reciente')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null) // {} nuevo | { id } edición
  const debounced = useDebounced(search, 280)
  const endpoint = manage ? '/repositorio/admin/list' : student ? '/repositorio/student/list' : '/repositorio'
  const filters = { buscar: debounced, categoria: category, ordenar: order, page }
  const query = useQuery({ queryKey: ['repository', endpoint, filters], queryFn: () => api.get(endpoint, { params: filters }).then((response) => response.data), placeholderData: (previous) => previous })
  const docs = query.data?.data || []
  const total = Number(query.data?.total ?? docs.length)
  const refresh = () => client.invalidateQueries({ queryKey: ['repository'] })
  const remove = async (doc) => {
    if (!(await confirmAction({ title: 'Eliminar documento', text: 'Esta acción quita el documento del repositorio.', confirmText: 'Eliminar', danger: true }))) return
    try { await api.delete(`/repositorio/${doc.id}`); toast.success('Documento eliminado'); refresh() } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <Page eyebrow="Biblioteca institucional" title="Repositorio digital" subtitle="Proyectos, tesis y documentos publicados por la comunidad del ITSSMT."
      actions={(manage || student) && <Button icon={FiUploadCloud} onClick={() => setEditing({})}>Agregar documento</Button>}>
      <Card>
        <div className="stack">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar por título, autor, descripción o etiqueta" />
          <Chips options={[{ value: '', label: 'Todas' }, { value: 'general', label: 'General' }, { value: 'desarrollo', label: 'Desarrollo de proyecto' }, { value: 'tesis', label: 'Tesis' }, { value: 'residencias', label: 'Residencias' }]} value={category} onChange={(value) => { setCategory(value); setPage(1) }} />
          <div className="row-wrap">
            <small className="muted grow">{query.isLoading ? 'Cargando…' : `${total} documento${total === 1 ? '' : 's'}`}</small>
            <select className="control compact" aria-label="Ordenar" value={order} onChange={(event) => { setOrder(event.target.value); setPage(1) }}>
              <option value="reciente">Más recientes</option><option value="antiguo">Más antiguos</option><option value="nombre_asc">Nombre A-Z</option><option value="nombre_desc">Nombre Z-A</option>
            </select>
          </div>
        </div>
      </Card>
      {query.isLoading ? <Loading rows={4} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !docs.length ? <Empty title="No encontramos documentos" message="Prueba con otra búsqueda o cambia los filtros seleccionados." /> : (
        <div className="grid-3">
          {docs.map((doc) => (
            <article key={doc.id} className="card-app repo-card">
              <div className="row-wrap"><Badge tone="info">{CATEGORIES[doc.document_category] || 'General'}</Badge>{(manage || student) && <Badge tone={isPrivate(doc) ? 'warning' : 'success'}>{isPrivate(doc) ? 'Privado' : 'Público'}</Badge>}</div>
              <h3>{doc.nombre || doc.titulo || 'Documento sin título'}</h3>
              <p className="muted small-text clamp-3">{doc.descripcion || 'Sin descripción disponible.'}</p>
              {(doc.tags || []).length > 0 && <div className="row-wrap">{doc.tags.map((tag) => <span key={tag.id} className="tag-dot" style={{ '--tag': tag.color || '#2d5a96' }}>{tag.nombre}</span>)}</div>}
              <small className="muted"><FiUsers /> {doc.autores || doc.autor_nombre || 'Autores no especificados'}</small>
              <small className="muted"><FiCalendar /> {formatDate(doc.created_at || doc.creado_en)}</small>
              {doc.file_available === false && <small className="text-warning"><FiAlertCircle /> Archivo pendiente de recuperación</small>}
              <div className="repo-actions">
                <Button icon={FiEye} className="grow-btn" onClick={() => navigate(`/repository/${doc.id}`)}>Ver detalles</Button>
                {manage && <><Button variant="ghost" icon={FiEdit2} aria-label="Editar" onClick={() => setEditing({ id: doc.id })} /><Button variant="ghost-danger" icon={FiTrash2} aria-label="Eliminar" onClick={() => remove(doc)} /></>}
              </div>
            </article>
          ))}
        </div>
      )}
      <Pager meta={query.data} onPage={setPage} />
      {editing && <RepositoryForm documentId={editing.id} manage={manage} student={student} onClose={() => setEditing(null)} onSaved={refresh} />}
    </Page>
  )
}

function RepositoryForm({ documentId, manage, student, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: '', descripcion: '', autores: '', project_id: '', visibility: 'public' })
  const [file, setFile] = useState(null)
  const [tags, setTags] = useState([])
  const [progress, setProgress] = useState(null)
  const doc = useQuery({ queryKey: ['repository-doc', documentId], queryFn: () => api.get(`/repositorio/${documentId}`).then((response) => response.data), enabled: Boolean(documentId), gcTime: 0 })
  const tagList = useQuery({ queryKey: ['document-tags', 'all'], queryFn: () => api.get('/document-tags', { params: { per_page: 100 } }).then((response) => response.data.data || []), enabled: manage })
  const projects = useQuery({ queryKey: ['my-projects', 'compact'], queryFn: () => api.get('/my-projects', { params: { compact: 1, per_page: 100 } }).then((response) => response.data.data || []), enabled: student })
  const loaded = doc.data
  const [syncedFrom, setSyncedFrom] = useState(null)
  if (loaded && syncedFrom !== loaded) {
    setSyncedFrom(loaded)
    setForm((current) => ({ ...current, nombre: loaded.nombre || '', descripcion: loaded.descripcion || '', autores: loaded.autores || '', visibility: loaded.visibility === 'private' ? 'private' : 'public' }))
    setTags((loaded.tags || []).map((tag) => String(tag.id)))
  }
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    if (!form.nombre.trim() || !form.descripcion.trim() || !form.autores.trim()) return toast.warning('Ningún campo del documento puede quedar vacío.')
    if (!documentId && !file) return toast.warning('Selecciona un archivo para subir.')
    if (file && !ALLOWED.includes(file.name.split('.').pop().toLowerCase())) return toast.error('Selecciona un archivo permitido: PDF, Word, Excel, ZIP, TXT, JPG, PNG, WebP o EPUB.')
    const body = new FormData()
    body.append('nombre', form.nombre.trim())
    body.append('descripcion', form.descripcion.trim())
    body.append('autores', form.autores.trim())
    if (student) body.append('project_id', form.project_id)
    body.append('visibility', manage ? form.visibility : 'private')
    if (file) body.append('archivo', file)
    tags.forEach((id) => body.append('tag_ids[]', id))
    setProgress(0)
    try {
      await api.post(documentId ? `/repositorio/${documentId}` : '/repositorio', body, { timeout: 300_000, onUploadProgress: (progressEvent) => progressEvent.total && setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100)) })
      toast.success(documentId ? 'Documento actualizado' : 'Documento agregado al repositorio')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setProgress(null) }
    return undefined
  }

  return (
    <Sheet open title={documentId ? 'Editar documento del repositorio' : 'Agregar documento al repositorio'} onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="repo-form" icon={documentId ? FiSave : FiUploadCloud} loading={progress !== null}>{progress !== null ? `${progress}%` : documentId ? 'Guardar cambios' : 'Subir documento'}</Button></>}>
      {documentId && doc.isLoading ? <Loading /> : (
        <form id="repo-form" className="form-grid" onSubmit={submit}>
          <Field label="Nombre del documento" full><input className="control" maxLength={255} required value={form.nombre} onChange={set('nombre')} /></Field>
          <Field label="Descripción" full><textarea className="control" rows={3} required value={form.descripcion} onChange={set('descripcion')} /></Field>
          <Field label="Autores" full><input className="control" maxLength={1000} required value={form.autores} onChange={set('autores')} /></Field>
          {student && (
            <Field label="Proyecto asignado" full>
              <select className="control" required value={form.project_id} onChange={set('project_id')}>
                <option value="">{(projects.data || []).length ? 'Selecciona un proyecto' : 'No tienes proyectos asignados'}</option>
                {(projects.data || []).map((project) => <option key={project.id} value={project.id}>{project.title || `Proyecto ${project.id}`}</option>)}
              </select>
            </Field>
          )}
          <div className="full"><FileDrop accept={ALLOWED.map((extension) => `.${extension}`).join(',')} file={file} onFile={setFile} hint={documentId ? 'Opcional: elige un archivo sólo si deseas reemplazar el actual.' : 'PDF, Word, Excel, ZIP, TXT, imágenes JPG/PNG/WebP y EPUB.'} /></div>
          {manage ? (
            <Field label="Visibilidad" full hint={form.visibility === 'public' ? 'Visible para visitantes, estudiantes, docentes y administradores.' : 'No aparece en el repositorio público; sólo docentes y administradores pueden consultarlo.'}>
              <select className="control" value={form.visibility} onChange={set('visibility')}><option value="public">Público: aparece para todos</option><option value="private">Privado: sólo docentes y administradores</option></select>
            </Field>
          ) : <div className="alert-app full"><FiLock /> Tu documento se guarda privado hasta que la jefatura lo revise y publique.</div>}
          {manage && (
            <div className="full"><span className="field-label">Etiquetas</span>
              <div className="type-grid">{(tagList.data || []).map((tag) => { const on = tags.includes(String(tag.id)); return <label key={tag.id} className={on ? 'active' : ''}><input type="checkbox" checked={on} onChange={() => setTags(on ? tags.filter((id) => id !== String(tag.id)) : [...tags, String(tag.id)])} />{tag.nombre}</label> })}</div>
              {!(tagList.data || []).length && <small className="muted">Sin etiquetas creadas.</small>}
            </div>
          )}
        </form>
      )}
    </Sheet>
  )
}

/** Detalle con vista previa del documento (Frontend_Swgpi/pages/repositorio-detail.php). */
export function RepositoryDetail() {
  const { id } = useParams()
  const query = useQuery({ queryKey: ['repository-doc', id], queryFn: () => api.get(`/repositorio/${id}`).then((response) => response.data) })
  const doc = query.data
  const type = String(doc?.archivo_tipo || '').toLowerCase()
  return (
    <Page title={doc?.nombre || doc?.titulo || 'Documento'} subtitle={doc?.descripcion} back="/repository"
      actions={doc && (doc.file_available === false ? <Badge tone="warning">Archivo no disponible</Badge> : <Button icon={FiDownload} onClick={() => download(doc)}>Descargar</Button>)}>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} /> : (
        <div className="split-layout reader-layout">
          <Card title="Vista previa" actions={<Badge tone="info">{type.toUpperCase() || 'DOCUMENTO'}</Badge>}>
            {doc.file_available === false ? <Empty title="Archivo no disponible" message="El registro está publicado, pero el archivo físico necesita recuperarse desde un respaldo." /> : <Preview doc={doc} type={type} />}
          </Card>
          <Card title="Detalles">
            <dl className="detail-list">
              <div><dt>Autores</dt><dd>{doc.autores || 'No especificados'}</dd></div>
              <div><dt>Tipo</dt><dd>{(doc.archivo_tipo || 'documento').toUpperCase()}</dd></div>
              <div><dt>Fecha</dt><dd>{formatDate(doc.created_at || doc.creado_en)}</dd></div>
              <div><dt>Subido por</dt><dd>{doc.uploader?.nombres || 'N/A'}</dd></div>
              <div><dt>Etiquetas</dt><dd className="row-wrap">{(doc.tags || []).length ? doc.tags.map((tag) => <span key={tag.id} className="tag-pill" style={{ background: tag.color, color: '#fff' }}>{tag.nombre}</span>) : 'Sin etiquetas'}</dd></div>
            </dl>
            <Link className="btn-app ghost w-100 mt-3" to="/repository"><FiArrowLeft /> Volver</Link>
          </Card>
        </div>
      )}
    </Page>
  )
}

function Preview({ doc, type }) {
  const [state, setState] = useState({ status: 'loading' })
  useEffect(() => {
    if (!['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt'].includes(type)) return undefined
    let url = null
    let cancelled = false
    api.get(`/repositorio/${doc.id}/view`, { responseType: 'blob', timeout: 60_000 })
      .then(async (response) => {
        if (cancelled) return
        if (type === 'txt') setState({ status: 'text', text: await response.data.text() })
        else { url = URL.createObjectURL(response.data); setState({ status: 'url', url }) }
      })
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [doc.id, type])
  const fallback = (message) => <Empty icon={FiGlobe} title="Sin vista previa" message={message} action={<Button icon={FiDownload} onClick={() => download(doc)}>Descargar para leer</Button>} />
  if (!['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt'].includes(type)) return fallback('La vista previa para este tipo de archivo no está disponible; descárgalo para leerlo.')
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return fallback('No fue posible cargar la vista previa.')
  if (state.status === 'text') return <pre className="text-preview">{state.text}</pre>
  if (type === 'pdf') return <iframe src={state.url} className="pdf-frame" title="Vista previa PDF" />
  return <img src={state.url} alt="Vista previa" className="image-preview" />
}

