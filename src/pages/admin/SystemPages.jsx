import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { formatDate, formatDateTime } from '../../utils/formatters'
import { useAuth } from '../../hooks/useAuth'
import { isGeneralAdmin } from '../../lib/permissions'
import { Badge, Button, Card, confirmAction, DataTable, Empty, ErrorState, Field, IconButton, Loading, Page, Pager, SearchInput, Sheet, Switch, useDebounced } from '../../components/ui'

/* Ajustes, avisos y etiquetas (Frontend_Swgpi/pages/admin/settings.php, notices.php y document-tags.php). */

const FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'jpg', 'jpeg', 'png', 'webp']

export function SettingsPage() {
  const { user } = useAuth()
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((response) => response.data) })
  return (
    <Page eyebrow="Sistema" title="Ajustes generales" subtitle="Sesión, apariencia, archivos y reglas generales del SGPI.">
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : <SettingsForm initial={query.data} />}
      {isGeneralAdmin(user) && <SelfRegistrationRules />}
    </Page>
  )
}

/** Formato del número de control y del correo institucional que acepta el autoregistro de cada carrera. */
function SelfRegistrationRules() {
  const query = useQuery({ queryKey: ['self-registration-rules'], queryFn: () => api.get('/admin/self-registration-rules').then((response) => response.data) })
  return (
    <Card title="Autoregistro: formato del correo por carrera" subtitle="El número de control es generación (2) + clave de la carrera (2) + consecutivo (4). El correo siempre es «l» seguida del número completo, o «lb» si inicia con b.">
      {query.isLoading ? <Loading rows={2} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <div className="stack">{query.data.map((item) => <RuleEditor key={item.career.id} item={item} onSaved={query.refetch} />)}</div>
      )}
    </Card>
  )
}

function RuleEditor({ item, onSaved }) {
  const [rule, setRule] = useState(item.rule)
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setRule({ ...rule, [key]: event.target.value })
  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/admin/self-registration-rules/${item.career.id}`, { career_code: rule.career_code || '', domain: rule.domain })
      toast.success(`Regla de ${item.career.nombre_corto || item.career.nombre} guardada`)
      onSaved()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  // La «l» del correo es fija y todas las carreras aceptan números con b al inicio (correo «lb…»).
  const number = `AA${rule.career_code || 'CC'}NNNN`
  const sample = `l${number}@${rule.domain} · lb${number}@${rule.domain}`
  return (
    <section className="rule-editor">
      <header className="row-wrap"><strong>{item.career.nombre}</strong>{item.open_until && new Date(item.open_until) > new Date() && <Badge tone="success">Abierto hasta {formatDateTime(item.open_until)}</Badge>}</header>
      <div className="form-grid">
        <Field label="Clave de la carrera" hint="2 dígitos; vacío para no exigirla"><input className="control" inputMode="numeric" maxLength={2} value={rule.career_code || ''} onChange={set('career_code')} /></Field>
        <Field label="Dominio"><input className="control" value={rule.domain} onChange={set('domain')} /></Field>
      </div>
      <div className="row-wrap mt-2"><small className="muted">Formato: {sample}</small><span className="spacer" /><Button size="sm" icon={FiSave} loading={saving} onClick={save}>Guardar</Button></div>
    </section>
  )
}

function SettingsForm({ initial }) {
  const client = useQueryClient()
  const [form, setForm] = useState({ ...initial, allowed_file_types: initial.allowed_file_types || [] })
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        session_timeout_minutes: Number(form.session_timeout_minutes),
        max_file_size_mb: Number(form.max_file_size_mb), allowed_file_types: form.allowed_file_types, max_project_members: Number(form.max_project_members),
        global_notice: String(form.global_notice || '').trim(), grayscale_mode: Boolean(form.grayscale_mode),
      }
      if (!payload.allowed_file_types.length) throw new Error('Selecciona al menos un tipo de archivo permitido.')
      return api.put('/settings', payload).then((response) => response.data)
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Ajustes guardados')
      client.invalidateQueries({ queryKey: ['public-settings'] })
    },
    onError: (error) => toast.error(error.response ? apiError(error) : error.message),
  })
  const toggleType = (type) => set('allowed_file_types', form.allowed_file_types.includes(type) ? form.allowed_file_types.filter((item) => item !== type) : [...form.allowed_file_types, type])
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <Card title="Sesión y apariencia general" subtitle="El tema y el tamaño de letra los elige cada persona en Mi perfil.">
        <div className="form-grid">
          <Field label="Inactividad antes de cerrar sesión (min)"><input className="control" type="number" min={1} max={480} value={form.session_timeout_minutes ?? ''} onChange={(event) => set('session_timeout_minutes', event.target.value)} /></Field>
          <div className="full"><Switch checked={form.grayscale_mode} onChange={(value) => { set('grayscale_mode', value); document.documentElement.classList.toggle('grayscale-mode', value) }} label="Mostrar el sistema en escala de grises" /></div>
        </div>
      </Card>
      <Card title="Archivos y proyectos">
        <div className="form-grid">
          <Field label="Tamaño máximo de archivo (MB)"><input className="control" type="number" min={1} max={200} value={form.max_file_size_mb ?? ''} onChange={(event) => set('max_file_size_mb', event.target.value)} /></Field>
          <Field label="Máximo de integrantes por proyecto"><input className="control" type="number" min={1} max={10} value={form.max_project_members ?? ''} onChange={(event) => set('max_project_members', event.target.value)} /></Field>
          <div className="full"><span className="field-label">Tipos de archivo permitidos</span><div className="type-grid">{FILE_TYPES.map((type) => <label key={type} className={form.allowed_file_types.includes(type) ? 'active' : ''}><input type="checkbox" checked={form.allowed_file_types.includes(type)} onChange={() => toggleType(type)} />{type.toUpperCase()}</label>)}</div></div>
          <p className="full muted small-text">El registro de propuestas y el autoregistro de alumnos se abren por carrera, con fecha de cierre, en Propuestas → Ventanas y validadores.</p>
        </div>
      </Card>
      <Card title="Aviso global del sistema"><textarea className="control" rows={3} value={form.global_notice || ''} onChange={(event) => set('global_notice', event.target.value)} placeholder="Se muestra en una franja sobre todas las pantallas." /></Card>
      <div className="form-actions sticky-actions"><Button type="submit" icon={FiSave} loading={save.isPending}>Guardar ajustes</Button></div>
    </form>
  )
}

const AUDIENCES = { all: 'Todo el sistema', index: 'Sólo página pública', authenticated: 'Sólo con sesión iniciada', academic: 'Estudiantes y docentes', teacher: 'Sólo docentes', student: 'Sólo estudiantes', admin: 'Sólo administradores' }
const TYPES = { info: ['Informativo', 'info'], success: ['Éxito', 'success'], warning: ['Advertencia', 'warning'], danger: ['Importante', 'danger'] }

export function NoticesPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['notices'], queryFn: () => api.get('/notices').then((response) => response.data.data || response.data.notices || []) })
  const [editing, setEditing] = useState(null) // { index, notice }
  const notices = query.data || []
  const persist = async (next, message) => {
    try { await api.put('/notices', { notices: next }); toast.success(message); client.invalidateQueries({ queryKey: ['notices'] }); client.invalidateQueries({ queryKey: ['public-settings'] }) } catch (error) { toast.error(apiError(error)) }
  }
  const remove = async (index) => {
    if (await confirmAction({ title: 'Eliminar aviso', text: 'El aviso se quita de la publicación.', confirmText: 'Sí, eliminar', danger: true })) persist(notices.filter((_, itemIndex) => itemIndex !== index), 'Aviso eliminado')
  }
  const toggle = (index) => persist(notices.map((notice, itemIndex) => (itemIndex === index ? { ...notice, active: !notice.active } : notice)), 'Aviso actualizado')
  return (
    <Page eyebrow="Comunicación" title="Avisos del sistema" subtitle="Mensajes emergentes segmentados por audiencia y vigencia." actions={<Button icon={FiPlus} onClick={() => setEditing({ index: -1, notice: null })}>Nuevo aviso</Button>}>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !notices.length ? <Empty title="Sin avisos" message="Crea un aviso para mostrarlo a la audiencia elegida." /> : (
        <div className="stack">
          {notices.map((notice, index) => (
            <Card key={notice.id || index} className={`notice-card ${TYPES[notice.type]?.[1] || 'info'}`} title={notice.title || 'Aviso del sistema'}
              actions={<div className="row-wrap"><Badge tone={TYPES[notice.type]?.[1]}>{TYPES[notice.type]?.[0] || notice.type}</Badge><Badge>{AUDIENCES[notice.audience] || notice.audience}</Badge></div>}>
              <p>{notice.message}</p>
              <div className="row-wrap">
                <small className="muted">{notice.starts_at ? `Desde ${formatDate(notice.starts_at)}` : 'Sin inicio'} · {notice.ends_at ? `hasta ${formatDate(notice.ends_at)}` : 'sin fin'} · {notice.duration_seconds || 4} s</small>
                <span className="spacer" />
                <Switch checked={notice.active !== false} onChange={() => toggle(index)} label="Activo" />
                <IconButton icon={FiEdit2} label="Editar" onClick={() => setEditing({ index, notice })} />
                <IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={() => remove(index)} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <NoticeForm notice={editing.notice} onClose={() => setEditing(null)} onSave={(notice) => persist(editing.index < 0 ? [...notices, notice] : notices.map((item, itemIndex) => (itemIndex === editing.index ? notice : item)), 'Aviso guardado').then(() => setEditing(null))} />}
    </Page>
  )
}

function NoticeForm({ notice, onClose, onSave }) {
  const [form, setForm] = useState(() => notice || { id: `notice_${Date.now()}`, title: '', message: '', audience: 'all', type: 'info', duration_seconds: 4, starts_at: '', ends_at: '', active: true })
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const now = new Date().toISOString()
  return (
    <Sheet open title={notice ? 'Editar aviso' : 'Nuevo aviso'} onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="notice-form" icon={FiSave}>Guardar aviso</Button></>}>
      <form id="notice-form" className="form-grid" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, duration_seconds: Number(form.duration_seconds), created_at: form.created_at || now, updated_at: now }) }}>
        <Field label="Título" full><input className="control" maxLength={120} value={form.title} onChange={set('title')} /></Field>
        <Field label="Mensaje" full><textarea className="control" rows={3} required value={form.message} onChange={set('message')} /></Field>
        <Field label="Audiencia"><select className="control" value={form.audience} onChange={set('audience')}>{Object.entries(AUDIENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Tipo"><select className="control" value={form.type} onChange={set('type')}>{Object.entries(TYPES).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Inicia"><input className="control" type="date" min={form.starts_at && form.starts_at === notice?.starts_at ? undefined : new Date().toLocaleDateString('en-CA')} value={form.starts_at || ''} onChange={set('starts_at')} /></Field>
        <Field label="Finaliza"><input className="control" type="date" value={form.ends_at || ''} onChange={set('ends_at')} /></Field>
        <Field label="Duración en pantalla (segundos)"><input className="control" type="number" min={2} max={30} value={form.duration_seconds} onChange={set('duration_seconds')} /></Field>
        <div className="field align-end"><Switch checked={form.active} onChange={(value) => setForm({ ...form, active: value })} label="Activo" /></div>
      </form>
    </Sheet>
  )
}

const readableOn = (hex) => {
  const clean = String(hex || '').replace('#', '')
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(clean.substring(start, start + 2), 16) || 0)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111827' : '#ffffff'
}
const docsCount = (tag) => Number(tag.documents_count ?? ((tag.deliverables_count || 0) + (tag.repository_documents_count || 0)))

export function TagsPage() {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const debounced = useDebounced(search)
  const query = useQuery({ queryKey: ['document-tags', debounced, perPage, page], queryFn: () => api.get('/document-tags', { params: { page, per_page: perPage, q: debounced.trim() } }).then((response) => response.data), placeholderData: (previous) => previous })
  const tags = query.data?.data || []
  const refresh = () => client.invalidateQueries({ queryKey: ['document-tags'] })
  const remove = async (tag) => {
    if (!(await confirmAction({ title: 'Eliminar etiqueta', text: docsCount(tag) ? `La etiqueta se quitará de ${docsCount(tag)} documento(s).` : '¿Eliminar esta etiqueta?', confirmText: 'Sí, eliminar', danger: true }))) return
    try { await api.delete(`/document-tags/${tag.id}`); toast.success('Etiqueta eliminada'); refresh() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Repositorio" title="Etiquetas de documentos" subtitle="Clasifica los documentos del repositorio y los entregables." actions={<Button icon={FiPlus} onClick={() => setEditing({})}>Nueva etiqueta</Button>}>
      <div className="stats-row">
        <div className="kpi"><strong>{query.data?.total ?? tags.length}</strong><span>Etiquetas</span></div>
        <div className="kpi"><strong>{tags.filter((tag) => docsCount(tag) > 0).length}</strong><span>En uso (página)</span></div>
        <div className="kpi"><strong>{tags.reduce((total, tag) => total + docsCount(tag), 0)}</strong><span>Relaciones (página)</span></div>
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar etiqueta" />
        <select className="control" aria-label="Mostrar" value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }}>{[10, 25, 50].map((value) => <option key={value} value={value}>{value} por página</option>)}</select>
      </div>
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable rows={tags} empty={<Empty message="No hay etiquetas con esa búsqueda." />}
            columns={[
              { key: 'nombre', label: 'Etiqueta', primary: true, render: (tag) => <span className="tag-pill" style={{ background: tag.color, color: readableOn(tag.color) }}>{tag.nombre}</span> },
              { key: 'descripcion', label: 'Descripción', render: (tag) => <small>{tag.descripcion || '—'}</small> },
              { key: 'docs', label: 'Documentos', render: (tag) => <span className="cell-main"><strong>{docsCount(tag)}</strong><small>{Number(tag.repository_documents_count || 0)} repo · {Number(tag.deliverables_count || 0)} entregables</small></span> },
            ]}
            actions={(tag) => <><IconButton icon={FiEdit2} label="Editar" onClick={() => setEditing(tag)} /><IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={() => remove(tag)} /></>} />
        )}
        <Pager meta={query.data} onPage={setPage} />
      </Card>
      {editing && <TagForm tag={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={refresh} />}
    </Page>
  )
}

function TagForm({ tag, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: tag?.nombre || '', descripcion: tag?.descripcion || '', color: tag?.color || '#1B396A' })
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), color: form.color.trim() }
    if (!payload.nombre || !/^#[0-9A-Fa-f]{6}$/.test(payload.color)) return toast.warning('Nombre y color hexadecimal válido son obligatorios.')
    setSaving(true)
    try { await (tag ? api.put(`/document-tags/${tag.id}`, payload) : api.post('/document-tags', payload)); toast.success('Etiqueta guardada'); onSaved(); onClose() } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
    return undefined
  }
  return (
    <Sheet open title={tag ? 'Editar etiqueta' : 'Nueva etiqueta'} onClose={onClose} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="tag-form" icon={FiSave} loading={saving}>Guardar</Button></>}>
      <form id="tag-form" className="stack" onSubmit={submit}>
        <Field label="Nombre"><input className="control" required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
        <Field label="Descripción"><textarea className="control" rows={2} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
        <Field label="Color">
          <div className="inline-add"><input className="control color" type="color" value={/^#[0-9A-Fa-f]{6}$/.test(form.color) ? form.color : '#1B396A'} onChange={(event) => setForm({ ...form, color: event.target.value })} /><input className="control" value={form.color} maxLength={7} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div>
        </Field>
        <span className="tag-pill" style={{ background: form.color, color: readableOn(form.color), alignSelf: 'flex-start' }}>{form.nombre || 'Vista previa'}</span>
      </form>
    </Sheet>
  )
}
