import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiDatabase, FiDownload, FiEdit3, FiFileText, FiImage, FiLogIn, FiMail, FiPlus, FiPower, FiRefreshCw, FiSave, FiSearch, FiShield, FiTrash2, FiUpload, FiUsers } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../../services/api'
import { profileLabel, SIMULABLE_PROFILES } from '../../lib/permissions'
import { downloadApiFile } from '../../utils/downloads'
import { formatDateTime, publicAssetUrl } from '../../utils/formatters'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Badge, Button, Card, confirmAction, DataTable, Empty, ErrorState, Field, IconButton, Loading, Page, Pager, Progress, promptText, SearchInput, Sheet, Stat, Switch, Tabs, useDebounced } from '../../components/ui'

/*
 * Administración institucional del administrador general: carreras y accesos, operaciones, auditoría,
 * integridad, respaldos y correos enviados (Frontend_Swgpi/pages/admin/careers.php, operations.php, career-audit.php,
 * career-integrity.php, database-backups.php y sent-emails.php).
 */
const actor = (item, fallback = 'Sistema') => [item.actor_nombres, item.actor_apellido].filter(Boolean).join(' ') || fallback
const bytes = (value) => {
  const size = Number(value || 0)
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unit = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return `${(size / (1024 ** unit)).toFixed(unit ? 1 : 0)} ${units[unit]}`
}
const today = () => new Date().toISOString().slice(0, 10)
const fileDownload = (path, name) => downloadApiFile(path, name).catch((error) => toast.error(error.message))
/** Tabla simple a partir de encabezados y celdas, con las mismas tarjetas móviles que DataTable. */
function Rows({ headers, rows, empty = 'No hay registros para mostrar.' }) {
  return <DataTable rowKey="__key" rows={rows.map((cells, index) => ({ __key: index, cells }))} empty={<Empty message={empty} />}
    columns={headers.map((label, column) => ({ key: String(column), label, primary: column === 0, render: (row) => row.cells[column] }))} />
}

const STAFF_ROLES = [2, 7, 6, 5]
const READINESS_STEPS = {
  identity: ['Identidad', 'Nombre y colores', 'identity'],
  career_management: ['Jefatura', 'Asigna un jefe de carrera', 'people'],
  subjects: ['Asignaturas', 'Entra y carga el plan de estudios', 'enter'],
  groups: ['Grupos', 'Entra y crea los grupos', 'enter'],
  students: ['Estudiantes', 'Entra y da de alta o abre el autorregistro', 'enter'],
  configuration: ['Configuración', 'Entra y revisa los ajustes', 'enter'],
  rubrics: ['Rúbricas', 'Entra y crea las rúbricas de evaluación', 'enter'],
}
const readStored = (key) => { try { return localStorage.getItem(key) } catch { return null } }
const store = (key, value) => { try { localStorage.setItem(key, value) } catch { /* opcional */ } }

/** Carreras y accesos: tarjetas de carreras y una ficha por carrera con Resumen · Identidad · Personal. */
export function CareersPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['institutional-careers'], queryFn: () => api.get('/admin/careers').then((response) => response.data.careers || []) })
  const [selectedId, setSelectedId] = useState(() => Number(readStored('sgpi-careers-selected')) || null)
  const [tab, setTab] = useState(() => readStored('sgpi-careers-tab') || 'summary')
  const [creating, setCreating] = useState(false)
  const { refreshUser, switchCareer } = useAuth()
  const navigate = useNavigate()
  const careers = query.data || []
  const selected = careers.find((item) => item.id === selectedId) || careers[0]
  // También se relee la sesión: la lista de carreras para entrar y sus colores salen de ahí.
  const reload = () => { client.invalidateQueries({ queryKey: ['institutional-careers'] }); client.invalidateQueries({ queryKey: ['admin-careers'] }); refreshUser().catch(() => {}) }
  const choose = (id) => { setSelectedId(id); store('sgpi-careers-selected', String(id)) }
  const changeTab = (key) => { setTab(key); store('sgpi-careers-tab', key) }
  const enter = async (careerId) => {
    try { await switchCareer(careerId); client.clear(); navigate('/dashboard', { replace: true }) } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Administración general" title="Carreras y accesos" subtitle="Elige una carrera para ver cómo va, cambiar su identidad o su personal. Para cargar datos dentro de ella, «Entrar»."
      actions={<>
        <Button icon={FiPlus} onClick={() => setCreating(true)}>Nueva carrera</Button>
        <Button variant="ghost" icon={FiDownload} onClick={() => fileDownload('/admin/careers/export', `resumen_carreras_${today()}.csv`)}>Exportar resumen</Button>
      </>}>
      <NewCareer open={creating} onClose={() => setCreating(false)} onCreated={(career) => { setCreating(false); if (career?.id) choose(career.id); changeTab('people'); reload() }} />
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <>
          <div className="career-picker">
            {careers.map((career) => (
              <button type="button" key={career.id} className={`${selected?.id === career.id ? 'active' : ''} ${career.activa ? '' : 'inactive'}`} style={{ '--c1': career.color_primario || '#1B396A', '--c2': career.color_secundario || '#2D5A96', '--c3': career.color_acento || '#fff' }} onClick={() => choose(career.id)}>
                <span>{career.clave}{career.activa ? '' : ' · Inactiva'}</span><strong>{career.nombre_corto}</strong>
                <i className="career-picker-meter"><b style={{ width: `${career.readiness?.percentage || 0}%` }} /></i>
                <small>{career.readiness?.percentage || 0}% lista · {career.members_count} personas</small>
              </button>
            ))}
            <button type="button" className="career-picker-new" onClick={() => setCreating(true)}><FiPlus /><strong>Nueva carrera</strong><small>Clave, nombre y colores</small></button>
          </div>
          {selected && (
            <Card className="career-sheet-app" title={selected.nombre} subtitle={`${selected.clave} · ${selected.activa ? 'Activa' : 'Inactiva'} · ${selected.period?.nombre ? `Periodo ${selected.period.nombre}` : 'Sin periodo abierto'}`}
              actions={selected.activa ? <Button icon={FiLogIn} onClick={() => enter(selected.id)}>Entrar</Button> : null}>
              <Tabs value={tab} onChange={changeTab} items={[
                { key: 'summary', label: 'Resumen', icon: FiActivity },
                { key: 'identity', label: 'Identidad', icon: FiEdit3 },
                { key: 'people', label: 'Personal', icon: FiUsers },
              ]} />
              <div className="mt-3">
                {tab === 'summary' && <CareerSummary career={selected} onGo={changeTab} onEnter={() => enter(selected.id)} />}
                {tab === 'identity' && <CareerIdentity key={`i-${selected.id}`} career={selected} onSaved={reload} />}
                {tab === 'people' && <Memberships key={`m-${selected.id}`} career={selected} onChanged={reload} />}
              </div>
            </Card>
          )}
        </>
      )}
    </Page>
  )
}

function CareerSummary({ career, onGo, onEnter }) {
  const roles = career.role_counts || {}
  const readiness = career.readiness || {}
  const checklist = readiness.checklist || {}
  return (
    <div className="split-layout">
      <div className="stat-grid">
        <Stat label="Jefatura" value={roles.career_heads || 0} onClick={() => onGo('people')} />
        <Stat label="Asistencia y coordinación" value={(roles.career_head_assistants || 0) + (roles.project_coordinators || 0)} onClick={() => onGo('people')} />
        <Stat label="Docentes" value={roles.teachers || 0} onClick={() => onGo('people')} />
        <Stat label="Estudiantes" value={roles.students || 0} />
        <Stat label="Asignaturas" value={career.subjects_count || 0} />
        <Stat label="Grupos" value={career.groups_count || 0} />
        <Stat label="Proyectos" value={career.projects_count || 0} />
        <Stat label="Evaluaciones" value={career.evaluations_count || 0} />
      </div>
      <div className="tinted-box">
        <div className="row-wrap"><strong>Puesta en marcha</strong><span className="spacer" /><strong>{readiness.percentage || 0}%</strong></div>
        <Progress value={readiness.percentage} tone={readiness.percentage >= 100 ? 'success' : 'primary'} />
        <ul className="ready-list">
          {Object.entries(READINESS_STEPS).map(([key, [label, hint, action]]) => (
            <li key={key} className={checklist[key] ? 'done' : ''}>
              {checklist[key] ? <FiCheckCircle aria-hidden="true" /> : <i className="ready-dot" aria-hidden="true" />}
              <span><strong>{label}</strong>{!checklist[key] && <small>{hint}</small>}</span>
              {!checklist[key] && (action === 'enter' ? (career.activa && <Button size="sm" variant="ghost" onClick={onEnter}>Entrar</Button>) : <Button size="sm" variant="ghost" onClick={() => onGo(action)}>Ir</Button>)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const COLORS = [['color_primario', 'Principal'], ['color_secundario', 'Secundario'], ['color_acento', 'Acento']]

/** Vista previa en vivo: portada propia o la del instituto con el tono de la carrera, como en los tableros. */
function CareerPreview({ form, career }) {
  const cover = career?.portada_ruta ? publicAssetUrl(career.portada_ruta) : '/images/campus.webp'
  const logo = career?.logo_ruta ? publicAssetUrl(career.logo_ruta) : null
  return (
    <section className="hero-app career-preview-app" style={{ backgroundImage: `url(${cover})`, '--hero-tint': form.color_primario, '--hero-tint-2': form.color_secundario, '--hero-accent': form.color_acento || form.color_primario }} aria-label="Vista previa">
      {logo && <img className="career-preview-logo" src={logo} alt="" />}
      <span className="career-preview-code">{(form.clave ?? career?.clave ?? '').toUpperCase() || 'CLAVE'}</span>
      <h2>{form.nombre_corto || 'Nombre corto'}</h2>
      <p>{form.nombre || 'Nombre de la carrera'}</p>
      {form.lema && <p className="career-preview-motto">{form.lema}</p>}
      <span className="career-preview-chip">Botón de muestra</span>
    </section>
  )
}

const BLANK = { clave: '', nombre: '', nombre_corto: '', color_primario: '#1B396A', color_secundario: '#2D5A96', color_acento: '#00A6D6', lema: '', jefe_id: '', asistente_id: '', activa: true }

function NewCareer({ open, onClose, onCreated }) {
  const [form, setForm] = useState(BLANK)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const create = useMutation({
    mutationFn: () => api.post('/admin/careers', { ...form, clave: form.clave.trim().toUpperCase(), nombre: form.nombre.trim(), nombre_corto: form.nombre_corto.trim(), lema: form.lema.trim() || null, jefe_id: form.jefe_id.trim() || null, asistente_id: form.asistente_id.trim() || null }),
    onSuccess: (response) => { toast.success(`Carrera ${form.clave.toUpperCase()} creada. Entra a ella para cargar asignaturas, grupos y alumnos.`); setForm(BLANK); onCreated(response.data?.career) },
    onError: (error) => toast.error(apiError(error)),
  })
  return (
    <Sheet open={open} title="Nueva carrera" subtitle="Se crea con sus módulos habilitados y sin datos." onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <CareerPreview form={form} />
        <div className="form-grid">
          <Field label="Clave" hint="Sólo letras y números"><input className="control" required maxLength={20} pattern="[A-Za-z0-9]+" value={form.clave} onChange={set('clave')} style={{ textTransform: 'uppercase' }} /></Field>
          <Field label="Nombre corto"><input className="control" required maxLength={100} value={form.nombre_corto} onChange={set('nombre_corto')} /></Field>
          <Field label="Nombre" className="full"><input className="control" required maxLength={180} value={form.nombre} onChange={set('nombre')} /></Field>
        </div>
        <div className="color-row">{COLORS.map(([key, label]) => <Field key={key} label={label}><input className="control color" type="color" value={form[key]} onChange={set(key)} /></Field>)}</div>
        <Field label="Lema"><input className="control" maxLength={255} value={form.lema} onChange={set('lema')} /></Field>
        <div className="form-grid">
          <Field label="Jefatura (No. de empleado)" hint="Opcional"><input className="control" maxLength={20} value={form.jefe_id} onChange={set('jefe_id')} /></Field>
          <Field label="Asistencia de jefatura" hint="Opcional"><input className="control" maxLength={20} value={form.asistente_id} onChange={set('asistente_id')} /></Field>
        </div>
        <Switch checked={form.activa} onChange={(value) => setForm({ ...form, activa: value })} label="Activa desde ahora" />
        <Button type="submit" icon={FiPlus} loading={create.isPending}>Crear carrera</Button>
      </form>
    </Sheet>
  )
}

function CareerIdentity({ career, onSaved }) {
  const [form, setForm] = useState({ nombre: career.nombre || '', nombre_corto: career.nombre_corto || '', color_primario: career.color_primario || '#1B396A', color_secundario: career.color_secundario || '#2D5A96', color_acento: career.color_acento || '#00A6D6', lema: career.lema || '', activa: Boolean(career.activa) })
  const save = useMutation({ mutationFn: () => api.put(`/admin/careers/${career.id}`, { ...form, nombre: form.nombre.trim(), nombre_corto: form.nombre_corto.trim(), lema: form.lema.trim() }), onSuccess: () => { toast.success('Identidad actualizada correctamente.'); onSaved() }, onError: (error) => toast.error(apiError(error)) })
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const [uploading, setUploading] = useState(null)
  const upload = async (tipo, file) => {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) { toast.error('La imagen supera 4 MB.'); return }
    const body = new FormData()
    body.append('tipo', tipo)
    body.append('imagen', file)
    setUploading(tipo)
    try { await api.post(`/admin/careers/${career.id}/image`, body); toast.success(tipo === 'logo' ? 'Logo actualizado.' : 'Portada actualizada.'); onSaved() } catch (error) { toast.error(apiError(error)) } finally { setUploading(null) }
  }
  const removeImage = async (tipo) => {
    if (!(await confirmAction({ title: tipo === 'logo' ? 'Quitar logo' : 'Quitar portada', text: tipo === 'logo' ? 'La carrera se mostrará sin logo.' : 'Se usará la foto del instituto con el color de la carrera.', confirmText: 'Quitar', danger: true }))) return
    try { await api.delete(`/admin/careers/${career.id}/image/${tipo}`); onSaved() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <div className="split-layout">
      <form className="stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <Field label="Nombre"><input className="control" value={form.nombre} onChange={set('nombre')} /></Field>
        <Field label="Nombre corto"><input className="control" value={form.nombre_corto} onChange={set('nombre_corto')} /></Field>
        <div className="color-row">{COLORS.map(([key, label]) => <Field key={key} label={label}><input className="control color" type="color" value={form[key]} onChange={set(key)} /></Field>)}</div>
        <Field label="Lema"><textarea className="control" rows={3} value={form.lema} onChange={set('lema')} /></Field>
        <Switch checked={form.activa} onChange={(value) => setForm({ ...form, activa: value })} label="Carrera activa (desactivada no aparece para entrar ni para el registro de alumnos)" />
        <Button type="submit" icon={FiSave} loading={save.isPending}>Guardar cambios</Button>
      </form>
      <div className="stack">
      <CareerPreview form={{ ...form, clave: career.clave }} career={career} />
      <div className="career-images">
        <strong><FiImage aria-hidden="true" /> Logo y portada</strong>
        <small className="muted">Sin portada propia se usa la foto del instituto con el color de la carrera. JPG, PNG o WebP de hasta 4 MB.</small>
        {[['logo', 'Logo', career.logo_ruta], ['portada', 'Portada', career.portada_ruta]].map(([tipo, label, path]) => (
          <div key={tipo} className="career-image-row">
            <div className={`career-image-thumb ${tipo}`}>{path ? <img src={publicAssetUrl(path)} alt="" /> : <small className="muted">Sin {label.toLowerCase()}</small>}</div>
            <label className="btn-app ghost sm">
              {uploading === tipo ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <FiUpload aria-hidden="true" />}<span>{path ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}</span>
              <input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={Boolean(uploading)} onChange={(event) => { upload(tipo, event.target.files[0]); event.target.value = '' }} />
            </label>
            {path && <IconButton icon={FiTrash2} className="danger" label={`Quitar ${label.toLowerCase()}`} onClick={() => removeImage(tipo)} />}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

function Memberships({ career, onChanged }) {
  const client = useQueryClient()
  const [filter, setFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [term, setTerm] = useState('')
  const search = useDebounced(term, 250)
  const [picked, setPicked] = useState(null)
  const [role, setRole] = useState(2)
  const query = useQuery({ queryKey: ['career-memberships', career.id], queryFn: () => api.get('/admin/career-memberships', { params: { carrera_id: career.id, per_page: 100 } }).then((response) => unwrapCollection(response.data)) })
  const candidates = useQuery({
    queryKey: ['career-candidates', career.id, search], enabled: search.trim().length >= 2 && !picked,
    queryFn: () => api.get('/admin/career-candidates', { params: { carrera_id: career.id, search: search.trim() } }).then((response) => response.data.data || []),
  })
  const refresh = () => { client.invalidateQueries({ queryKey: ['career-memberships', career.id] }); onChanged() }
  const name = (person) => [person?.nombres, person?.apellido_paterno, person?.apellido_materno].filter(Boolean).join(' ') || person?.id
  const add = useMutation({
    mutationFn: () => api.post('/admin/career-memberships', { usuario_id: picked.id, carrera_id: career.id, perfil_id: Number(role), activo: true }),
    onSuccess: () => { toast.success(`${picked.nombre} agregado como ${profileLabel(role)}.`); setPicked(null); setTerm(''); refresh() },
    onError: (error) => toast.error(apiError(error)),
  })
  const update = async (item, changes, message) => { try { await api.put(`/admin/career-memberships/${item.id}`, changes); if (message) toast.success(message); refresh() } catch (error) { toast.error(apiError(error)) } }
  const remove = async (item) => {
    if (!(await confirmAction({ title: 'Quitar de la carrera', text: `${name(item.user)} perderá el acceso a ${career.nombre_corto}.`, confirmText: 'Quitar', danger: true }))) return
    try { await api.delete(`/admin/career-memberships/${item.id}`); toast.success('Persona quitada de la carrera.'); refresh() } catch (error) { toast.error(apiError(error)) }
  }
  const members = query.data || []
  const counts = members.reduce((acc, item) => ({ ...acc, [item.perfil_id]: (acc[item.perfil_id] || 0) + 1 }), {})
  const shown = members.filter((item) => (roleFilter === 'all' || String(item.perfil_id) === roleFilter) && (!filter || `${name(item.user)} ${item.user?.id}`.toLowerCase().includes(filter.toLowerCase())))
  return (
    <div className="stack">
      <form className="tinted-box stack" onSubmit={(event) => { event.preventDefault(); if (picked) add.mutate() }}>
        <strong>Agregar persona</strong>
        {picked ? (
          <div className="list-row picked-person"><div><strong>{picked.nombre}</strong><small>{picked.id}</small></div><Button variant="ghost" size="sm" onClick={() => { setPicked(null); setTerm('') }}>Cambiar</Button></div>
        ) : (
          <div className="suggest-host">
            <SearchInput value={term} onChange={setTerm} placeholder="Escribe nombre o número de empleado…" />
            {search.trim().length >= 2 && (
              <div className="suggest-list" role="listbox">
                {candidates.isLoading ? <small className="muted">Buscando…</small> : (candidates.data || []).length ? candidates.data.map((person) => (
                  <button type="button" key={person.id} onClick={() => { setPicked(person); setRole(STAFF_ROLES.includes(person.perfil_aqui) ? person.perfil_aqui : 2) }}>
                    <strong>{person.nombre}</strong>
                    <small>{person.id}{person.carreras.length ? ` · ${person.carreras.map((c) => `${c.clave}: ${profileLabel(c.perfil_id)}`).join(', ')}` : ' · Sin carrera'}</small>
                    {person.perfil_aqui && <Badge>Ya está en esta carrera</Badge>}
                  </button>
                )) : <small className="muted">Sin coincidencias entre el personal. Si es nuevo, regístralo primero en Usuarios dentro de una carrera.</small>}
              </div>
            )}
          </div>
        )}
        <div className="row-wrap">
          <Field label="Como"><select className="control" value={role} onChange={(event) => setRole(Number(event.target.value))}>{STAFF_ROLES.map((id) => <option key={id} value={id}>{profileLabel(id)}</option>)}</select></Field>
          <span className="spacer" />
          <Button type="submit" icon={FiPlus} disabled={!picked} loading={add.isPending}>Agregar</Button>
        </div>
      </form>
      <div className="row-wrap">
        <div className="chips-app">
          {[['all', 'Todos', members.length], ...[5, 6, 7, 2].filter((id) => counts[id]).map((id) => [String(id), profileLabel(id), counts[id]])].map(([key, label, count]) => (
            <button type="button" key={key} className={roleFilter === key ? 'active' : ''} onClick={() => setRoleFilter(key)}>{label} <small>{count}</small></button>
          ))}
        </div>
        <span className="spacer" />
        <SearchInput value={filter} onChange={setFilter} placeholder="Filtrar personal…" />
      </div>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} /> : (
        <ul className="list-app">
          {shown.map((item) => (
            <li key={item.id} className={`list-row ${item.activo ? '' : 'muted-row'}`}>
              <div><strong>{name(item.user)}</strong><small>{item.user?.id}{item.es_principal ? ' · Carrera principal' : ''}{item.activo ? '' : ' · Sin acceso'}</small></div>
              <select className="control compact" aria-label="Rol" value={item.perfil_id} onChange={(event) => update(item, { perfil_id: Number(event.target.value) }, `${name(item.user)} ahora es ${profileLabel(event.target.value)}.`)}>
                {[...new Set([...STAFF_ROLES, item.perfil_id])].map((id) => <option key={id} value={id}>{profileLabel(id)}</option>)}
              </select>
              <Switch checked={Boolean(item.activo)} onChange={(value) => update(item, { activo: value })} label="" />
              <IconButton icon={FiTrash2} className="danger" label="Quitar de la carrera" onClick={() => remove(item)} />
            </li>
          ))}
          {!shown.length && <li className="muted small-text">{members.length ? 'Nadie coincide con el filtro.' : 'Esta carrera aún no tiene personal. Búscalo arriba para agregarlo.'}</li>}
        </ul>
      )}
      <small className="muted">Aquí sólo aparece el personal. Los alumnos se gestionan dentro de la carrera, en Personas › Usuarios.</small>
    </div>
  )
}

export function OperationsPage() {
  const client = useQueryClient()
  const [policyOpen, setPolicyOpen] = useState(false)
  const alerts = useQuery({ queryKey: ['institutional-alerts'], queryFn: () => api.get('/admin/operational-alerts').then((response) => response.data) })
  const history = useQuery({ queryKey: ['continuity-history'], queryFn: () => api.get('/admin/continuity-history', { params: { limit: 30 } }).then((response) => response.data) })
  const invalidate = () => ['institutional-alerts', 'continuity-history', 'operational-alerts-summary'].forEach((key) => client.invalidateQueries({ queryKey: [key] }))
  const onError = (error) => toast.error(apiError(error))
  const scan = useMutation({ mutationFn: () => api.post('/admin/operational-alerts/scan', {}, { timeout: 300_000 }), onSuccess: () => { toast.success('Análisis institucional completado.'); invalidate() }, onError })
  const measure = useMutation({ mutationFn: () => api.post('/admin/continuity-history', {}, { timeout: 300_000 }), onSuccess: () => { toast.success('Medición de continuidad guardada.'); invalidate() }, onError })
  const acknowledge = useMutation({ mutationFn: (id) => api.put(`/admin/operational-alerts/${id}/acknowledge`, {}), onSuccess: () => { toast.success('Alerta marcada como atendida.'); invalidate() }, onError })
  const summary = alerts.data || {}
  const trend = history.data?.trend || {}
  return (
    <Page eyebrow="Supervisión institucional" title="Centro de operaciones" subtitle="Alertas de aislamiento multicarrera, respaldos y capacidad de recuperación."
      actions={<>
        <Button icon={FiRefreshCw} loading={scan.isPending} onClick={() => scan.mutate()}>Analizar ahora</Button>
        <Button variant="ghost" icon={FiActivity} loading={measure.isPending} onClick={() => measure.mutate()}>Guardar medición</Button>
        <Button variant="ghost" icon={FiFileText} onClick={() => fileDownload('/admin/continuity-report.pdf', `continuidad_${today()}.pdf`)}>Reporte</Button>
        <Button variant="ghost" icon={FiEdit3} onClick={() => setPolicyOpen(true)}>Política</Button>
      </>}>
      {alerts.isLoading || history.isLoading ? <Loading /> : alerts.isError || history.isError ? <ErrorState error={alerts.error || history.error} onRetry={() => { alerts.refetch(); history.refetch() }} /> : (
        <>
          <div className="stats-row">
            <Stat icon={FiAlertTriangle} tone="warning" label="Alertas abiertas" value={summary.open || 0} />
            <Stat icon={FiCheckCircle} tone="success" label="Atendidas" value={summary.acknowledged || 0} />
            <Stat icon={FiShield} tone="danger" label="Críticas activas" value={summary.critical || 0} />
            <Stat icon={FiActivity} label="Índice actual" value={trend.current == null ? 'Sin medir' : `${trend.current}%`} />
          </div>
          <Card title="Tendencia de continuidad" flush actions={<Badge tone={trend.direction === 'down' ? 'danger' : 'success'}>{trend.delta == null ? 'Sin comparación' : `${trend.delta >= 0 ? '+' : ''}${trend.delta} puntos`}</Badge>}>
            <Rows headers={['Fecha', 'Origen', 'Índice', 'Controles', 'Respaldos', 'Alertas', 'Medido por']} rows={(history.data?.data || []).map((item) => [formatDateTime(item.creado_en), item.origen, `${item.indice_preparacion}%`, `${item.controles_correctos}/${item.controles_totales}`, `${item.respaldos_disponibles} disponibles · ${item.respaldos_verificados} verificados`, `${item.alertas_activas} activas · ${item.alertas_criticas} críticas`, actor(item, item.medido_por || 'Sistema')])} />
          </Card>
          <Card title="Historial de alertas" flush>
            <Rows headers={['Alerta', 'Severidad', 'Estado', 'Detección', 'Atendida por', 'Acción']} rows={(summary.data || []).map((item) => [
              <span className="cell-main" key="a"><strong>{item.titulo}</strong><small>{item.detalle}</small></span>,
              <Badge key="s" tone={item.severidad === 'critica' ? 'danger' : item.severidad === 'advertencia' ? 'warning' : 'neutral'}>{item.severidad}</Badge>,
              item.estado, formatDateTime(item.detectada_en), actor(item, '—'),
              item.estado === 'abierta' ? <Button key="b" size="sm" variant="ghost" icon={FiCheckCircle} loading={acknowledge.isPending} onClick={() => acknowledge.mutate(item.id)}>Atender</Button> : '—',
            ])} />
          </Card>
        </>
      )}
      {policyOpen && <ContinuityPolicy onClose={() => setPolicyOpen(false)} onSaved={invalidate} />}
    </Page>
  )
}

function ContinuityPolicy({ onClose, onSaved }) {
  const query = useQuery({ queryKey: ['continuity-policy'], queryFn: () => api.get('/admin/continuity-policy').then((response) => response.data) })
  return (
    <Sheet open title="Política de continuidad" onClose={onClose} size="sm">
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} /> : <PolicyForm initial={query.data} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  )
}

function PolicyForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial)
  const save = useMutation({ mutationFn: () => api.put('/admin/continuity-policy', form), onSuccess: () => { toast.success('Política actualizada.'); onSaved(); onClose() }, onError: (error) => toast.error(apiError(error)) })
  const fields = [['target_readiness', 'Objetivo de preparación (%)'], ['critical_readiness', 'Umbral crítico (%)'], ['max_backup_age_hours', 'Vigencia máxima de respaldo (h)'], ['backup_retention_days', 'Retención de respaldos (días)'], ['audit_retention_days', 'Retención de auditoría (días, 30 a 1825)']]
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      {fields.map(([key, label]) => <Field key={key} label={label}><input className="control" type="number" required value={form[key] ?? ''} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></Field>)}
      <div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" icon={FiSave} loading={save.isPending}>Guardar</Button></div>
    </form>
  )
}

export function AuditPage() {
  const empty = { page: 1, per_page: 25, q: '', nivel: '', career_id: '', actor_id: '', method: '', status: '', date_from: '', date_to: '' }
  const [person, setPerson] = useState(null)
  const [filters, setFilters] = useState(empty)
  const [draft, setDraft] = useState(empty)
  const careers = useQuery({ queryKey: ['institutional-careers'], queryFn: () => api.get('/admin/careers').then((response) => response.data.careers || []) })
  const query = useQuery({ queryKey: ['institutional-audit', filters], queryFn: () => api.get('/admin/audit', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')) }).then((response) => response.data), placeholderData: (previous) => previous })
  const set = (key) => (event) => setDraft({ ...draft, [key]: event.target.value })
  return (
    <Page eyebrow="Administración general" title="Auditoría multicarrera" subtitle="Operaciones de escritura sin exponer contraseñas ni contenido sensible.">
      <Card>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft, page: 1 }) }}>
          <Field label="Buscar" full><input className="control" type="search" maxLength={120} placeholder="Nombre, número de control, título o acción (por ejemplo: aprobó, eliminó)" value={draft.q} onChange={set('q')} /></Field>
          <Field label="Tipo"><select className="control" value={draft.nivel} onChange={set('nivel')}><option value="">Todas</option><option value="importante">Importantes</option><option value="edicion">Ediciones</option><option value="rutina">Rutina</option></select></Field>
          <Field label="Carrera"><select className="control" value={draft.career_id} onChange={set('career_id')}><option value="">Todas</option>{(careers.data || []).map((career) => <option key={career.id} value={career.id}>{career.clave} · {career.nombre_corto}</option>)}</select></Field>
          <Field label="Actor"><input className="control" placeholder="ID de usuario" value={draft.actor_id} onChange={set('actor_id')} /></Field>
          <Field label="Método"><select className="control" value={draft.method} onChange={set('method')}><option value="">Todos</option>{['POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}</select></Field>
          <Field label="Estado HTTP"><input className="control" type="number" min={100} max={599} value={draft.status} onChange={set('status')} /></Field>
          <Field label="Desde"><input className="control" type="date" value={draft.date_from} onChange={set('date_from')} /></Field>
          <Field label="Hasta"><input className="control" type="date" value={draft.date_to} onChange={set('date_to')} /></Field>
          <div className="form-actions full"><Button variant="ghost" onClick={() => { setDraft(empty); setFilters(empty) }}>Limpiar</Button><Button type="submit" icon={FiSearch}>Aplicar filtros</Button></div>
        </form>
      </Card>
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <Rows headers={['Qué hizo', 'Fecha', 'Carrera', 'Quién', 'Resultado', 'IP y dispositivo']} rows={(query.data?.data || []).map((item) => [
            <span className="cell-main audit-what" key="o">
              <LevelBadge level={item.nivel} />
              <strong>{item.descripcion || item.ruta}</strong>
              {item.detalles?.length > 0 && <ul className="audit-details">{item.detalles.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
              {item.afectados?.length > 0 && <span className="audit-people">{item.afectados.map((p) => <button type="button" key={p.id} className="audit-chip" onClick={() => setPerson(p.id)}>{p.nombre || p.id}</button>)}</span>}
              <small><code className="break">{item.metodo} {item.ruta}</code></small>
            </span>,
            formatDateTime(item.creado_en), item.carrera_clave || 'Institucional',
            <span className="cell-main" key="a">{item.actor_id ? <button type="button" className="audit-link" onClick={() => setPerson(item.actor_id)}>{actor(item, item.actor_id)}</button> : <strong>Sistema</strong>}<small>{item.actor_id}</small></span>,
            <Badge key="r" tone={Number(item.estado_http) < 400 ? 'success' : 'danger'}>{Number(item.estado_http) < 400 ? 'Hecho' : `No se completó · ${item.estado_http}`}</Badge>,
            <span className="cell-main" key="ip"><strong>{item.direccion_ip || '—'}</strong><small>{item.dispositivo || ''}</small></span>,
          ])} />
        )}
        <Pager meta={query.data} onPage={(page) => setFilters({ ...filters, page })} noun="operaciones" />
      </Card>
      <AuditRetention />
      {person && <PersonHistory id={person} onClose={() => setPerson(null)} />}
    </Page>
  )
}

const LEVELS = { importante: ['Importante', 'danger'], edicion: ['Edición', 'info'], rutina: ['Rutina', 'neutral'] }
function LevelBadge({ level }) {
  const [label, tone] = LEVELS[level] || LEVELS.edicion
  return <Badge tone={tone}>{label}</Badge>
}

/** Historial de una persona: lo que le hicieron (quién la aprobó, editó, desactivó…) y lo que hizo. */
function PersonHistory({ id, onClose }) {
  const [chosen, setTab] = useState(null)
  const query = useQuery({ queryKey: ['audit-person', id], queryFn: () => api.get(`/admin/audit/person/${encodeURIComponent(id)}`).then((response) => response.data.data) })
  const data = query.data
  // Abre en «Lo que le hicieron» salvo que esté vacío y sí haya «Lo que hizo».
  const tab = chosen || (data && !data.recibio.length && data.hizo.length ? 'hizo' : 'recibio')
  const rows = data ? data[tab] : []
  const total = (level) => (data ? (data.resumen.recibio[level] || 0) + (data.resumen.hizo[level] || 0) : 0)
  return (
    <Sheet open size="lg" title={data?.persona?.nombre ? `${data.persona.nombre} (${data.persona.id})` : `Historial de ${id}`} subtitle="Lo que le hicieron y lo que hizo en el periodo conservado." onClose={onClose}>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <div className="stack">
          <div className="row-wrap">
            <Badge tone={data.persona.activo === null ? 'neutral' : data.persona.activo ? 'success' : 'warning'}>{data.persona.activo === null ? 'Sin cuenta en el sistema' : data.persona.activo ? 'Cuenta activa' : 'Cuenta inactiva'}</Badge>
            <Badge tone="danger">{total('importante')} importantes</Badge><Badge tone="info">{total('edicion')} ediciones</Badge><Badge tone="neutral">{total('rutina')} de rutina</Badge>
          </div>
          <div className="tabs-app" role="tablist">
            <button type="button" className={tab === 'recibio' ? 'active' : ''} onClick={() => setTab('recibio')}>Lo que le hicieron ({data.recibio.length})</button>
            <button type="button" className={tab === 'hizo' ? 'active' : ''} onClick={() => setTab('hizo')}>Lo que hizo ({data.hizo.length})</button>
          </div>
          {!rows.length ? <Empty message={tab === 'recibio' ? 'Nadie ha realizado acciones sobre esta persona en el periodo conservado.' : 'No tiene acciones registradas en el periodo conservado.'} /> : (
            <ul className="audit-timeline">
              {rows.map((item) => (
                <li key={item.id} className="audit-entry">
                  <div className="row-wrap"><LevelBadge level={item.nivel} /><small className="muted">{formatDateTime(item.creado_en)}{tab === 'recibio' ? ` · por ${actor(item, item.actor_id || 'Sistema')}` : ''}{Number(item.estado_http) >= 400 ? ' · no se completó' : ''}</small></div>
                  <strong>{item.descripcion}</strong>
                  {item.detalles?.length > 0 && <ul className="audit-details">{item.detalles.map((detail, index) => <li key={index}>{detail}</li>)}</ul>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  )
}

/** Retención de la auditoría y comprobación de la IP detectada (GET /admin/audit/retention y /admin/audit/ip-check). */
function AuditRetention() {
  const client = useQueryClient()
  const retention = useQuery({ queryKey: ['audit-retention'], queryFn: () => api.get('/admin/audit/retention').then((response) => response.data) })
  const ip = useQuery({ queryKey: ['audit-ip-check'], queryFn: () => api.get('/admin/audit/ip-check').then((response) => response.data), staleTime: 60_000 })
  const prune = useMutation({
    mutationFn: () => api.post('/admin/audit/retention/run', {}, { timeout: 120_000 }).then((response) => response.data),
    onSuccess: (data) => { toast.success(data.message); client.setQueryData(['audit-retention'], (old) => ({ ...old, preview: data.preview, archives: data.archives })); client.invalidateQueries({ queryKey: ['institutional-audit'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const preview = retention.data?.preview
  const archives = retention.data?.archives || []
  const confirmPrune = async () => {
    if (await confirmAction({ title: 'Depurar auditoría ahora', text: `Se copiarán ${preview?.total || 0} registros vencidos (rutina de más de ${preview?.tiers?.rutina ?? 7} días, ediciones de más de ${preview?.tiers?.edicion ?? preview?.days} e importantes de más de ${preview?.tiers?.importante ?? 365}) a un archivo junto a los respaldos y después se borrarán de la auditoría. Requiere un respaldo completo de los últimos 2 días.`, confirmText: 'Copiar y depurar' })) prune.mutate()
  }
  return (
    <>
      <Card title="Retención de la auditoría" subtitle="Cada noche (01:40, después del respaldo) los registros vencidos se copian a un archivo comprimido junto a los respaldos y se borran de aquí. Rutina a los 7 días; ediciones al plazo de Política de continuidad; lo importante (aprobaciones, eliminaciones, cambios de acceso, calificaciones) al menos un año."
        actions={<Button size="sm" variant="soft" icon={FiTrash2} disabled={!preview?.total} loading={prune.isPending} onClick={confirmPrune}>Depurar ahora</Button>}>
        {retention.isLoading ? <Loading rows={2} /> : retention.isError ? <ErrorState error={retention.error} onRetry={retention.refetch} /> : (
          <div className="stack">
            <div className="row-wrap">
              <Badge tone="info">Rutina: {preview?.tiers?.rutina ?? 7} días</Badge>
              <Badge tone="info">Ediciones: {preview?.tiers?.edicion ?? preview?.days} días</Badge>
              <Badge tone="info">Importantes: {preview?.tiers?.importante ?? 365} días</Badge>
              <Badge tone={preview?.total ? 'warning' : 'success'}>{preview?.total ? `${preview.total} por depurar` : 'Nada por depurar'}</Badge>
            </div>
            {archives.length ? (
              <ul className="removal-skipped">
                {archives.map((archive) => (
                  <li key={archive.id}>
                    <strong>{archive.status === 'completada' ? `${archive.total} registros hasta ${formatDateTime(archive.cutoff)}` : archive.status === 'fallida' ? 'Depuración fallida' : 'En proceso'}</strong>
                    <span>{formatDateTime(archive.created_at)} · {archive.source}{archive.error ? ` · ${archive.error}` : ''}</span>
                    {archive.available && <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => fileDownload(`/admin/audit/archives/${archive.id}/download`, archive.file)}>Descargar copia</Button>}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Todavía no se ha depurado la auditoría.</p>}
          </div>
        )}
      </Card>
      {ip.data && (
        <Card title="Así te ve el sistema" subtitle="La IP con la que se registran tus cambios. Desde un teléfono con datos móviles es la IP pública que asigna la compañía; en Wi-Fi, la del módem de esa red.">
          <div className="row-wrap"><Badge tone="info">IP: {ip.data.ip || '—'}</Badge><Badge>{ip.data.device}</Badge></div>
        </Card>
      )}
    </>
  )
}

export function IntegrityPage() {
  const client = useQueryClient()
  const report = useQuery({ queryKey: ['institutional-integrity'], queryFn: () => api.get('/admin/integrity').then((response) => response.data) })
  const history = useQuery({ queryKey: ['integrity-history'], queryFn: () => api.get('/admin/integrity/history').then((response) => response.data) })
  const run = useMutation({ mutationFn: () => api.post('/admin/integrity/run', {}).then((response) => response.data), onSuccess: (data) => { toast.success('Diagnóstico guardado.'); client.setQueryData(['institutional-integrity'], data?.report || data); client.invalidateQueries({ queryKey: ['institutional-integrity'] }); client.invalidateQueries({ queryKey: ['integrity-history'] }) }, onError: (error) => toast.error(apiError(error)) })
  const data = report.data
  return (
    <Page eyebrow="Diagnóstico institucional" title="Integridad multicarrera" subtitle="Detecta relaciones que atraviesan carreras y configuraciones incompletas." actions={<Button icon={FiRefreshCw} loading={run.isPending} onClick={() => run.mutate()}>Ejecutar diagnóstico</Button>}>
      {report.isLoading ? <Loading /> : report.isError ? <ErrorState error={report.error} onRetry={report.refetch} /> : (
        <>
          <section className={`health-banner ${data.healthy ? 'ok' : 'bad'}`}><FiShield /><div><h2>{data.healthy ? 'Integridad correcta' : 'Se requiere revisión'}</h2><p>{data.checks_passed} de {data.checks_total} verificaciones correctas · {data.violations} incidencias.</p></div><small>{formatDateTime(data.generated_at)}</small></section>
          <div className="grid-3">{(data.checks || []).map((check) => <Card key={check.key} title={check.name} actions={<Badge tone={check.count ? 'danger' : 'success'}>{check.count ? `${check.count} incidencia(s)` : 'Correcto'}</Badge>}><p className="muted small-text">{check.description}</p></Card>)}</div>
        </>
      )}
      <Card title="Historial de ejecuciones" flush>
        {history.isLoading ? <div className="card-pad"><Loading /></div> : (
          <Rows headers={['Fecha', 'Origen', 'Ejecutado por', 'Verificaciones', 'Incidencias', 'Estado']} rows={(history.data?.data || []).map((item) => [formatDateTime(item.creado_en), item.origen, actor(item, item.ejecutado_por || 'Sistema'), `${item.verificaciones_correctas}/${item.verificaciones_totales}`, item.incidencias, <Badge key="h" tone={item.saludable ? 'success' : 'danger'}>{item.saludable ? 'Correcto' : 'Revisión'}</Badge>])} />
        )}
      </Card>
    </Page>
  )
}

export function BackupsPage() {
  const client = useQueryClient()
  // El respaldo y la prueba de restauración corren en segundo plano en la API: mientras algo siga "en_proceso" la lista
  // se consulta cada 3 s y, al terminar, se avisa el resultado.
  const backups = useQuery({
    queryKey: ['database-backups'], queryFn: () => api.get('/admin/database-backups').then((response) => response.data.data || []),
    refetchInterval: (query) => ((query.state.data || []).some((row) => row.estado === 'en_proceso' || row.estado_verificacion === 'en_proceso') ? 3_000 : false),
  })
  const health = useQuery({ queryKey: ['backups-health'], queryFn: () => api.get('/admin/database-backups-health').then((response) => response.data) })
  const reload = () => { client.invalidateQueries({ queryKey: ['database-backups'] }); client.invalidateQueries({ queryKey: ['backups-health'] }) }
  const running = useRef(new Map())
  useEffect(() => {
    for (const row of backups.data || []) {
      const key = `b${row.id}`
      const verifyKey = `v${row.id}`
      if (row.estado === 'en_proceso') running.current.set(key, true)
      else if (running.current.delete(key)) {
        if (row.estado === 'completado') toast.success(`Respaldo generado (${bytes(row.tamano_bytes)}). Verifícalo para comprobar que se puede restaurar.`)
        else toast.error(`El respaldo no se generó: ${row.mensaje_error || 'sin detalle'}`, { autoClose: 12_000 })
        client.invalidateQueries({ queryKey: ['backups-health'] })
      }
      if (row.estado_verificacion === 'en_proceso') running.current.set(verifyKey, true)
      else if (running.current.delete(verifyKey)) {
        if (row.estado_verificacion === 'correcto') toast.success(`Restaurable: ${row.tablas_encontradas} tablas esenciales y ${Number(row.filas_verificadas).toLocaleString('es-MX')} filas comprobadas.`)
        else toast.error(`La prueba de restauración falló: ${row.error_verificacion || 'sin detalle'}`, { autoClose: 12_000 })
        client.invalidateQueries({ queryKey: ['backups-health'] })
      }
    }
  }, [backups.data, client])
  const create = useMutation({ mutationFn: () => api.post('/admin/database-backups'), onSuccess: (response) => toast.info(response.data.message), onError: (error) => toast.error(apiError(error), { autoClose: 12_000 }), onSettled: reload })
  const verify = useMutation({ mutationFn: (id) => api.post(`/admin/database-backups/${id}/verify`), onSuccess: (response) => toast.info(response.data.message), onError: (error) => toast.error(apiError(error), { autoClose: 12_000 }), onSettled: reload })
  const storage = health.data
  // La depuración exige escribir la frase exacta, igual que en el front de PHP.
  const cleanup = async () => {
    const days = Number(storage?.retention_days || 30)
    const phrase = `DEPURAR RESPALDOS ANTERIORES A ${days} DIAS`
    const confirmation = await promptText({ title: 'Aplicar retención', text: `Escribe exactamente: ${phrase}`, multiline: false, confirmText: 'Depurar' })
    if (confirmation === null) return
    try {
      const response = await api.post('/admin/database-backups-cleanup', { retention_days: days, confirmation })
      const result = response.data.result || {}
      toast.success(`Retención aplicada: ${result.deleted || 0} copias vencidas, ${result.orphans_removed || 0} archivos huérfanos y ${result.databases_dropped || 0} bases temporales eliminadas; ${bytes(result.released_bytes)} liberados.`)
      reload()
    } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Continuidad operativa" title="Respaldos de base de datos" subtitle="Genera, verifica, conserva y descarga copias institucionales." actions={<Button icon={FiDatabase} loading={create.isPending || (backups.data || []).some((row) => row.estado === 'en_proceso')} onClick={() => create.mutate()}>Crear respaldo ahora</Button>}>
      {health.isLoading || backups.isLoading ? <Loading /> : health.isError || backups.isError ? <ErrorState error={health.error || backups.error} onRetry={reload} /> : (
        <>
          <section className={`health-banner ${storage.healthy ? 'ok' : 'bad'}`}>
            <FiDatabase />
            <div>
              <h2>Almacenamiento {storage.healthy ? 'saludable' : 'requiere revisión'}</h2>
              <p>{storage.available} disponibles · {storage.verified} restaurables · {storage.missing} faltantes · {storage.altered} alterados{Number(storage.unreadable) > 0 && ` · ${storage.unreadable} sin permiso de lectura`}{Number(storage.orphans) > 0 && ` · ${storage.orphans} huérfanos (${bytes(storage.orphan_bytes)})`}{Number(storage.leftover_databases) > 0 && ` · ${storage.leftover_databases} bases temporales sobrantes`} · {bytes(storage.total_bytes)} usados · {bytes(storage.disk_free_bytes)} libres</p>
              {storage.unreadable_hint && <div className="alert-app warning mt-2">{storage.unreadable_hint}</div>}
            </div>
            <Button variant="ghost-danger" icon={FiTrash2} disabled={!Number(storage.eligible_count) && !Number(storage.orphans) && !Number(storage.leftover_databases)} onClick={cleanup}>Aplicar retención ({storage.retention_days} días)</Button>
          </section>
          <Card flush>
            <Rows headers={['Respaldo', 'Origen', 'Creado por', 'Tamaño', 'Verificación', 'Estado', 'Acciones']} rows={backups.data.map((backup) => {
              const completed = backup.estado === 'completado'
              const working = backup.estado === 'en_proceso'
              const verifying = backup.estado_verificacion === 'en_proceso'
              return [
                <span className="cell-main" key="f"><strong>{formatDateTime(backup.creado_en)}</strong><code title={backup.checksum_sha256}>{backup.checksum_sha256 ? `${backup.checksum_sha256.slice(0, 12)}…` : '—'}</code></span>,
                backup.origen, actor(backup, backup.creado_por || 'Sistema'), completed ? bytes(backup.tamano_bytes) : '—',
                !completed ? '—' : <span className="cell-main" key="v">
                  <Badge tone={backup.estado_verificacion === 'correcto' ? 'success' : backup.estado_verificacion === 'fallido' ? 'danger' : verifying ? 'info' : 'neutral'}>{backup.estado_verificacion === 'correcto' ? 'Restaurable' : backup.estado_verificacion === 'fallido' ? 'Falló prueba' : verifying ? 'Probando restauración…' : 'Sin verificar'}</Badge>
                  {backup.estado_verificacion === 'correcto' && <small>{backup.tablas_encontradas} tablas · {Number(backup.filas_verificadas).toLocaleString('es-MX')} filas · {formatDateTime(backup.verificado_en)}</small>}
                  {backup.estado_verificacion === 'fallido' && <small className="text-danger wrap-anywhere">{backup.error_verificacion}</small>}
                </span>,
                <Badge key="e" tone={completed ? 'success' : working ? 'info' : 'danger'}>{completed ? 'Completado' : working ? 'Generando…' : 'Fallido'}</Badge>,
                completed ? <span className="row-wrap" key="a">
                  <Button size="sm" variant="ghost" icon={FiShield} loading={verifying || (verify.isPending && verify.variables === backup.id)} onClick={() => verify.mutate(backup.id)}>Verificar</Button>
                  <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => fileDownload(`/admin/database-backups/${backup.id}/download`, backup.nombre_archivo || `respaldo_${backup.id}.sql.gz`)}>Descargar</Button>
                </span> : working ? <small key="x" className="muted">Generando en el servidor…</small> : <small key="x" className="text-danger wrap-anywhere">{backup.mensaje_error || 'No se registró el detalle del error.'}</small>,
              ]
            })} />
          </Card>
        </>
      )}
    </Page>
  )
}

const EMAIL_CATEGORIES = { credenciales: 'Credenciales', codigo_registro: 'Código de registro', recuperacion: 'Recuperación de contraseña', resultado_registro: 'Resultado de solicitud', general: 'General' }
const EMAIL_STATUS = { queued: ['En cola', 'neutral'], sending: ['Enviando', 'neutral'], sent: ['Enviado', 'success'], failed: ['Falló', 'danger'] }
const SENT_COPY = { removed: ['Borrada', 'success'], pending: ['Por borrar', 'warning'], failed: ['No se pudo borrar', 'danger'] }

/** Registro de envíos: a quién y cuándo. El servicio de correo no conserva asunto ni contenido. */
export function SentEmailsPage() {
  const [filters, setFilters] = useState({ page: 1, search: '', status: '', category: '' })
  const query = useQuery({ queryKey: ['sent-emails', filters], queryFn: () => api.get('/admin/sent-emails', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')) }).then((response) => response.data), placeholderData: (previous) => previous, refetchInterval: 30_000 })
  const set = (key, value) => setFilters({ ...filters, [key]: value, page: 1 })
  const stats = query.data?.stats
  return (
    <Page eyebrow="Continuidad operativa" title="Correos enviados" subtitle="A quién se envió cada correo y si llegó al servidor de Gmail. El contenido y el asunto no se conservan; el registro dura 90 días.">
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <>
          <section className={`health-banner ${stats?.account_error || stats?.sent_copy_error ? 'bad' : 'ok'}`}>
            <FiMail />
            <div>
              <h2>{stats?.account || 'Cuenta sin configurar'}</h2>
              <p>{stats?.sent_last_24h ?? 0} de {stats?.max_per_day ?? 0} en las últimas 24 horas · {stats?.queued ?? 0} en cola · {stats?.failed ?? 0} {Number(stats?.failed) === 1 ? 'fallido' : 'fallidos'}</p>
              {stats?.account_error && <p className="text-danger wrap-anywhere">{stats.account_error}</p>}
              {stats?.sent_copy_error && <p className="text-danger wrap-anywhere">{stats.sent_copy_error}</p>}
            </div>
          </section>
          <Card>
            <div className="form-grid">
              <Field label="Destinatario"><SearchInput value={filters.search} onChange={(value) => set('search', value)} placeholder="Buscar por correo" /></Field>
              <Field label="Estado"><select className="control" value={filters.status} onChange={(event) => set('status', event.target.value)}><option value="">Todos</option>{Object.entries(EMAIL_STATUS).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}</select></Field>
              <Field label="Tipo"><select className="control" value={filters.category} onChange={(event) => set('category', event.target.value)}><option value="">Todos</option>{Object.entries(EMAIL_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            </div>
          </Card>
          <Card flush>
            <Rows empty="No hay correos con esos filtros." headers={['Destinatario', 'Tipo', 'Estado', 'Registrado', 'Enviado', 'Copia en Gmail']} rows={(query.data?.data || []).map((email) => {
              const [statusLabel, statusTone] = EMAIL_STATUS[email.status] || [email.status, 'neutral']
              const [copyLabel, copyTone] = SENT_COPY[email.sent_copy] || []
              return [
                <span className="cell-main" key="d"><strong className="wrap-anywhere">{email.to}</strong>{email.last_error && <small className="text-danger wrap-anywhere">{email.last_error}</small>}</span>,
                EMAIL_CATEGORIES[email.category] || email.category,
                <Badge key="s" tone={statusTone}>{statusLabel}</Badge>,
                formatDateTime(email.created_at), email.sent_at ? formatDateTime(email.sent_at) : '—',
                copyLabel ? <Badge key="c" tone={copyTone}>{copyLabel}</Badge> : '—',
              ]
            })} />
            <Pager meta={query.data} onPage={(page) => setFilters({ ...filters, page })} noun="correos" />
          </Card>
        </>
      )}
    </Page>
  )
}
