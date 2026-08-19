import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiActivity, FiAlertTriangle, FiCheckCircle, FiDatabase, FiDownload, FiEdit3,
  FiFileText, FiPlus, FiRefreshCw, FiSave, FiSearch, FiShield, FiTrash2,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, API_URL, unwrapCollection } from '../services/api'
import { confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, Pagination } from '../components/common/Ui'

const roleNames = { 1: 'Administrador', 2: 'Docente', 3: 'Estudiante', 5: 'Jefe de Carrera', 6: 'Asistente de Jefe de Carrera', 7: 'Coordinador de Proyectos' }
const readinessLabels = { identity: 'Identidad', career_management: 'Administrador o Jefe de Carrera', subjects: 'Asignaturas', groups: 'Grupos', students: 'Estudiantes', configuration: 'Configuración', rubrics: 'Rúbricas' }
const dateTime = (value) => value ? new Date(value).toLocaleString('es-MX') : '—'
const bytes = (value) => {
  const size = Number(value || 0)
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unit = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1)
  return `${(size / (1024 ** unit)).toFixed(unit ? 1 : 0)} ${units[unit]}`
}
const token = () => localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || ''

async function downloadApi(path, filename, accept = 'application/octet-stream') {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}`, Accept: accept } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || body.error || 'No fue posible descargar el archivo.')
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function OperationsPage() {
  const client = useQueryClient()
  const [policyOpen, setPolicyOpen] = useState(false)
  const alerts = useQuery({ queryKey: ['institutional-alerts'], queryFn: () => api.get('/admin/operational-alerts').then((r) => r.data) })
  const history = useQuery({ queryKey: ['continuity-history'], queryFn: () => api.get('/admin/continuity-history', { params: { limit: 30 } }).then((r) => r.data) })
  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: ['institutional-alerts'] }),
    client.invalidateQueries({ queryKey: ['continuity-history'] }),
  ])
  const scan = useMutation({ mutationFn: () => api.post('/admin/operational-alerts/scan', {}, { timeout: 300_000 }), onSuccess: () => { toast.success('Análisis institucional completado.'); invalidate() }, onError: (e) => toast.error(apiError(e)) })
  const measure = useMutation({ mutationFn: () => api.post('/admin/continuity-history', {}, { timeout: 300_000 }), onSuccess: () => { toast.success('Medición de continuidad guardada.'); invalidate() }, onError: (e) => toast.error(apiError(e)) })
  const acknowledge = useMutation({ mutationFn: (id) => api.put(`/admin/operational-alerts/${id}/acknowledge`), onSuccess: () => { toast.success('Alerta marcada como atendida.'); invalidate() }, onError: (e) => toast.error(apiError(e)) })
  if (alerts.isLoading || history.isLoading) return <Loading />
  if (alerts.isError || history.isError) return <ErrorState message={apiError(alerts.error || history.error)} onRetry={() => { alerts.refetch(); history.refetch() }} />
  const summary = alerts.data || {}
  const rows = summary.data || []
  const measurements = history.data?.data || []
  const trend = history.data?.trend || {}
  return <>
    <PageHeader eyebrow="Supervisión institucional" title="Centro de operaciones" description="Alertas de aislamiento multicarrera, respaldos y capacidad de recuperación." actions={<div className="page-button-row"><button className="icon-text-button" onClick={() => setPolicyOpen(true)}><FiEdit3 /> Política</button><button className="icon-text-button" disabled={measure.isPending} onClick={() => measure.mutate()}><FiActivity /> Guardar medición</button><button className="icon-text-button" onClick={() => downloadApi('/admin/continuity-report.pdf', `continuidad_${new Date().toISOString().slice(0, 10)}.pdf`, 'application/pdf').catch((e) => toast.error(e.message))}><FiFileText /> Reporte</button><button className="btn-primary-app compact" disabled={scan.isPending} onClick={() => scan.mutate()}><FiRefreshCw /> Analizar ahora</button></div>} />
    <section className="stats-grid"><Metric icon={FiAlertTriangle} label="Alertas abiertas" value={summary.open || 0} /><Metric icon={FiCheckCircle} label="Atendidas" value={summary.acknowledged || 0} /><Metric icon={FiShield} label="Críticas activas" value={summary.critical || 0} /><Metric icon={FiActivity} label="Índice actual" value={trend.current == null ? 'Sin medir' : `${trend.current}%`} /></section>
    <section className="panel section-stack"><header className="panel-heading"><div><span className="eyebrow">Continuidad</span><h2>Tendencia de continuidad</h2></div><span className={`status-badge ${trend.direction === 'down' ? 'danger' : 'success'}`}>{trend.delta == null ? 'Sin comparación' : `${trend.delta >= 0 ? '+' : ''}${trend.delta} puntos`}</span></header><Table headers={['Fecha', 'Origen', 'Índice', 'Controles', 'Respaldos', 'Alertas', 'Medido por']} rows={measurements.map((item) => [dateTime(item.creado_en), item.origen, `${item.indice_preparacion}%`, `${item.controles_correctos}/${item.controles_totales}`, `${item.respaldos_disponibles} disponibles · ${item.respaldos_verificados} verificados`, `${item.alertas_activas} activas · ${item.alertas_criticas} críticas`, [item.actor_nombres, item.actor_apellido].filter(Boolean).join(' ') || item.medido_por || 'Sistema'])} /></section>
    <section className="panel section-stack"><header className="panel-heading"><div><span className="eyebrow">Seguimiento</span><h2>Historial de alertas</h2></div></header><Table headers={['Severidad', 'Alerta', 'Estado', 'Detección', 'Atendida por', 'Acción']} rows={rows.map((item) => [<span className={`status-badge ${item.severidad === 'critica' ? 'danger' : item.severidad === 'advertencia' ? 'warning' : ''}`} key="severity">{item.severidad}</span>, <span className="table-primary" key="alert"><strong>{item.titulo}</strong><small>{item.detalle}</small></span>, item.estado, dateTime(item.detectada_en), [item.actor_nombres, item.actor_apellido].filter(Boolean).join(' ') || '—', item.estado === 'abierta' ? <button className="icon-text-button" key="ack" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(item.id)}><FiCheckCircle /> Atender</button> : '—'])} /></section>
    <ContinuityPolicy open={policyOpen} onClose={() => setPolicyOpen(false)} onSaved={invalidate} />
  </>
}

function ContinuityPolicy({ open, onClose, onSaved }) {
  const query = useQuery({ queryKey: ['continuity-policy'], queryFn: () => api.get('/admin/continuity-policy').then((r) => r.data), enabled: open })
  if (!open) return null
  return <Modal open title="Política de continuidad" onClose={onClose}>{query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} /> : <PolicyForm initial={query.data} onClose={onClose} onSaved={onSaved} />}</Modal>
}

function PolicyForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial)
  const mutation = useMutation({ mutationFn: () => api.put('/admin/continuity-policy', form), onSuccess: async () => { toast.success('Política actualizada.'); await onSaved(); onClose() }, onError: (e) => toast.error(apiError(e)) })
  return <form className="modal-form settings-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}><div className="form-grid"><NumberField label="Objetivo de preparación (%)" value={form.target_readiness} onChange={(value) => setForm({ ...form, target_readiness: value })} /><NumberField label="Umbral crítico (%)" value={form.critical_readiness} onChange={(value) => setForm({ ...form, critical_readiness: value })} /><NumberField label="Vigencia máxima de respaldo (h)" value={form.max_backup_age_hours} onChange={(value) => setForm({ ...form, max_backup_age_hours: value })} /><NumberField label="Retención de respaldos (días)" value={form.backup_retention_days} onChange={(value) => setForm({ ...form, backup_retention_days: value })} /></div><footer><button type="button" className="icon-text-button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={mutation.isPending}><FiSave /> Guardar</button></footer></form>
}

export function CareersPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['institutional-careers'], queryFn: () => api.get('/admin/careers').then((r) => r.data.careers || []) })
  const [selectedId, setSelectedId] = useState(null)
  const selected = query.data?.find((item) => item.id === (selectedId || query.data?.[0]?.id))
  const reload = () => client.invalidateQueries({ queryKey: ['institutional-careers'] })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  return <>
    <PageHeader eyebrow="Administración institucional" title="Carreras y accesos" description="Configura la identidad, preparación y personas autorizadas de cada carrera." actions={<button className="icon-text-button" onClick={() => downloadApi('/admin/careers/export', `resumen_carreras_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv').catch((e) => toast.error(e.message))}><FiDownload /> Exportar resumen</button>} />
    <div className="career-card-grid">{query.data.map((career) => <button key={career.id} className={`career-choice ${selected?.id === career.id ? 'active' : ''}`} style={{ '--career-primary': career.color_primario || '#1B396A', '--career-secondary': career.color_secundario || '#2D5A96' }} onClick={() => setSelectedId(career.id)}><span>{career.clave}</span><strong>{career.nombre_corto}</strong><small>{career.members_count} integrantes · {career.readiness?.percentage || 0}% preparada</small></button>)}</div>
    <section className="panel section-stack"><header className="panel-heading"><div><span className="eyebrow">Datos reales</span><h2>Puesta en marcha</h2></div></header><CareerOverview careers={query.data} /></section>
    {selected && <div className="institutional-columns"><CareerIdentity key={`identity-${selected.id}`} career={selected} onSaved={reload} /><Memberships key={`members-${selected.id}`} career={selected} onChanged={reload} /></div>}
  </>
}

function CareerOverview({ careers }) {
  return <Table headers={['Carrera', 'Personas', 'Académico', 'Operación', 'Preparación']} rows={careers.map((career) => {
    const roles = career.role_counts || {}
    const readiness = career.readiness || {}
    const missing = Object.entries(readiness.checklist || {}).filter(([, complete]) => !complete).map(([key]) => readinessLabels[key] || key)
    return [<span className="table-primary" key="career"><strong>{career.nombre_corto}</strong><small>{career.clave}</small></span>, <span className="table-primary" key="people"><strong>{career.members_count}</strong><small>{roles.administrators || 0} admin · {roles.career_heads || 0} jefatura · {roles.career_head_assistants || 0} asistencia · {roles.project_coordinators || 0} coordinación · {roles.teachers || 0} docentes · {roles.students || 0} estudiantes</small></span>, `${career.subjects_count} asignaturas · ${career.groups_count} grupos`, `${career.projects_count} proyectos · ${career.evaluations_count} evaluaciones · ${career.documents_count} documentos`, <div className="readiness-cell" key="ready"><span><b>{readiness.percentage || 0}%</b><small>{readiness.completed || 0}/{readiness.total || 7}</small></span><i><b style={{ width: `${readiness.percentage || 0}%` }} /></i><small>{missing.length ? `Falta: ${missing.join(', ')}` : 'Lista para operar'}</small></div>]
  })} />
}

function CareerIdentity({ career, onSaved }) {
  const [form, setForm] = useState(() => ({ nombre: career.nombre || '', nombre_corto: career.nombre_corto || '', color_primario: career.color_primario || '#1B396A', color_secundario: career.color_secundario || '#2D5A96', color_acento: career.color_acento || '#00A6D6', lema: career.lema || '' }))
  const mutation = useMutation({ mutationFn: () => api.put(`/admin/careers/${career.id}`, form), onSuccess: () => { toast.success('Identidad actualizada.'); onSaved() }, onError: (e) => toast.error(apiError(e)) })
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="panel settings-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}><header className="panel-heading"><h2>Identidad de carrera</h2></header><label>Nombre<input value={form.nombre} onChange={(e) => field('nombre', e.target.value)} /></label><label>Nombre corto<input value={form.nombre_corto} onChange={(e) => field('nombre_corto', e.target.value)} /></label><div className="color-fields"><label>Principal<input type="color" value={form.color_primario} onChange={(e) => field('color_primario', e.target.value)} /></label><label>Secundario<input type="color" value={form.color_secundario} onChange={(e) => field('color_secundario', e.target.value)} /></label><label>Acento<input type="color" value={form.color_acento} onChange={(e) => field('color_acento', e.target.value)} /></label></div><label>Lema<textarea rows="3" value={form.lema} onChange={(e) => field('lema', e.target.value)} /></label><button className="btn-primary-app" disabled={mutation.isPending}><FiSave /> Guardar identidad</button></form>
}

function Memberships({ career, onChanged }) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState({ usuario_id: '', perfil_id: 1, es_principal: false })
  const query = useQuery({ queryKey: ['career-memberships', career.id, search], queryFn: () => api.get('/admin/career-memberships', { params: { carrera_id: career.id, search } }).then((r) => r.data) })
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['career-memberships', career.id] }); onChanged() }
  const create = useMutation({ mutationFn: () => api.post('/admin/career-memberships', { ...draft, carrera_id: career.id, perfil_id: Number(draft.perfil_id), activo: true }), onSuccess: () => { toast.success('Membresía guardada.'); setDraft({ usuario_id: '', perfil_id: 1, es_principal: false }); refresh() }, onError: (e) => toast.error(apiError(e)) })
  const change = useMutation({ mutationFn: ({ id, data }) => api.put(`/admin/career-memberships/${id}`, data), onSuccess: refresh, onError: (e) => toast.error(apiError(e)) })
  const remove = async (id) => { if (await confirmAction({ title: 'Eliminar membresía', text: 'La persona perderá este acceso a la carrera.' })) api.delete(`/admin/career-memberships/${id}`).then(() => { toast.success('Membresía eliminada.'); refresh() }).catch((e) => toast.error(apiError(e))) }
  return <section className="panel membership-panel"><header className="panel-heading"><div><h2>Membresías</h2><small>{career.nombre}</small></div><label className="compact-search"><FiSearch /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar persona..." /></label></header><form className="membership-form" onSubmit={(e) => { e.preventDefault(); create.mutate() }}><label>No. de control o empleado<input required value={draft.usuario_id} onChange={(e) => setDraft({ ...draft, usuario_id: e.target.value })} /></label><label>Rol en esta carrera<select value={draft.perfil_id} onChange={(e) => setDraft({ ...draft, perfil_id: Number(e.target.value) })}>{Object.entries(roleNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="inline-check"><input type="checkbox" checked={draft.es_principal} onChange={(e) => setDraft({ ...draft, es_principal: e.target.checked })} /> Carrera principal</label><button className="btn-primary-app compact" disabled={create.isPending}><FiPlus /> Asignar</button></form>{query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} /> : <Table headers={['Persona', 'Rol', 'Estado', 'Acciones']} rows={unwrapCollection(query.data).map((item) => { const user = item.user || {}; return [<span className="table-primary" key="user"><strong>{[user.nombres, user.apellido_paterno, user.apellido_materno].filter(Boolean).join(' ') || user.id}</strong><small>{user.id}{item.es_principal ? ' · Principal' : ''}</small></span>, roleNames[item.perfil_id] || 'Sin rol', <span className={`status-badge ${item.activo ? 'success' : 'danger'}`} key="status">{item.activo ? 'Activo' : 'Inactivo'}</span>, <span className="row-actions" key="actions"><button title="Cambiar estado" onClick={() => change.mutate({ id: item.id, data: { activo: !item.activo } })}>{item.activo ? 'Desactivar' : 'Activar'}</button><button className="danger" title="Eliminar" onClick={() => remove(item.id)}><FiTrash2 /></button></span>] })} />}</section>
}

export function AuditPage() {
  const [filters, setFilters] = useState({ page: 1, per_page: 25, career_id: '', actor_id: '', method: '', status: '', date_from: '', date_to: '' })
  const [draft, setDraft] = useState(filters)
  const careers = useQuery({ queryKey: ['institutional-careers'], queryFn: () => api.get('/admin/careers').then((r) => r.data.careers || []) })
  const query = useQuery({ queryKey: ['institutional-audit', filters], queryFn: () => api.get('/admin/audit', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')) }).then((r) => r.data) })
  const field = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  return <><PageHeader eyebrow="Administración institucional" title="Auditoría multicarrera" description="Consulta operaciones de escritura sin exponer contraseñas ni contenido sensible." /><form className="panel audit-filters" onSubmit={(e) => { e.preventDefault(); setFilters({ ...draft, page: 1 }) }}><label>Carrera<select value={draft.career_id} onChange={(e) => field('career_id', e.target.value)}><option value="">Todas</option>{careers.data?.map((career) => <option key={career.id} value={career.id}>{career.clave} · {career.nombre_corto}</option>)}</select></label><label>Actor<input value={draft.actor_id} onChange={(e) => field('actor_id', e.target.value)} placeholder="ID de usuario" /></label><label>Método<select value={draft.method} onChange={(e) => field('method', e.target.value)}><option value="">Todos</option>{['POST', 'PUT', 'PATCH', 'DELETE'].map((method) => <option key={method}>{method}</option>)}</select></label><label>Estado HTTP<input type="number" min="100" max="599" value={draft.status} onChange={(e) => field('status', e.target.value)} /></label><label>Desde<input type="date" value={draft.date_from} onChange={(e) => field('date_from', e.target.value)} /></label><label>Hasta<input type="date" value={draft.date_to} onChange={(e) => field('date_to', e.target.value)} /></label><button className="btn-primary-app compact"><FiSearch /> Aplicar filtros</button></form>{query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : <section className="panel section-stack"><Table headers={['Fecha', 'Carrera', 'Actor', 'Operación', 'Ruta', 'Resultado', 'IP']} rows={(query.data.data || []).map((item) => [dateTime(item.creado_en), item.carrera_clave || 'Institucional', <span className="table-primary" key="actor"><strong>{[item.actor_nombres, item.actor_apellido].filter(Boolean).join(' ') || item.actor_id || 'Sistema'}</strong><small>{item.actor_id}</small></span>, item.metodo, <code key="route">{item.ruta}</code>, <span className={`status-badge ${Number(item.estado_http) < 400 ? 'success' : 'danger'}`} key="result">{item.estado_http}</span>, item.direccion_ip || '—'])} /><Pagination meta={query.data} onPage={(page) => setFilters((current) => ({ ...current, page }))} /></section>}</>
}

export function IntegrityPage() {
  const client = useQueryClient()
  const report = useQuery({ queryKey: ['institutional-integrity'], queryFn: () => api.get('/admin/integrity').then((r) => r.data) })
  const history = useQuery({ queryKey: ['institutional-integrity-history'], queryFn: () => api.get('/admin/integrity/history').then((r) => r.data.data || []) })
  const run = useMutation({ mutationFn: () => api.post('/admin/integrity/run'), onSuccess: () => { toast.success('Diagnóstico guardado.'); client.invalidateQueries({ queryKey: ['institutional-integrity'] }); client.invalidateQueries({ queryKey: ['institutional-integrity-history'] }) }, onError: (e) => toast.error(apiError(e)) })
  if (report.isLoading || history.isLoading) return <Loading />
  if (report.isError || history.isError) return <ErrorState message={apiError(report.error || history.error)} />
  const data = report.data
  return <><PageHeader eyebrow="Diagnóstico institucional" title="Integridad multicarrera" description="Detecta relaciones que atraviesan carreras y configuraciones incompletas." actions={<button className="btn-primary-app compact" disabled={run.isPending} onClick={() => run.mutate()}><FiRefreshCw /> Ejecutar diagnóstico</button>} /><section className={`panel integrity-summary ${data.healthy ? 'healthy' : 'unhealthy'}`}><FiShield /><div><h2>{data.healthy ? 'Integridad correcta' : 'Se requiere revisión'}</h2><p>{data.checks_passed} de {data.checks_total} verificaciones correctas · {data.violations} incidencias.</p></div><small>{dateTime(data.generated_at)}</small></section><section className="check-card-grid">{data.checks.map((check) => <article className="panel check-card" key={check.key}><span className={`status-badge ${check.count ? 'danger' : 'success'}`}>{check.count ? `${check.count} incidencia(s)` : 'Correcto'}</span><h2>{check.name}</h2><p>{check.description}</p></article>)}</section><section className="panel section-stack"><header className="panel-heading"><h2>Historial de ejecuciones</h2></header><Table headers={['Fecha', 'Origen', 'Ejecutado por', 'Verificaciones', 'Incidencias', 'Estado']} rows={history.data.map((item) => [dateTime(item.creado_en), item.origen, [item.actor_nombres, item.actor_apellido].filter(Boolean).join(' ') || item.ejecutado_por || 'Sistema', `${item.verificaciones_correctas}/${item.verificaciones_totales}`, item.incidencias, <span className={`status-badge ${item.saludable ? 'success' : 'danger'}`} key="health">{item.saludable ? 'Correcto' : 'Revisión'}</span>])} /></section></>
}

export function BackupsPage() {
  const client = useQueryClient()
  const backups = useQuery({ queryKey: ['database-backups'], queryFn: () => api.get('/admin/database-backups').then((r) => r.data.data || []) })
  const health = useQuery({ queryKey: ['database-backup-health'], queryFn: () => api.get('/admin/database-backups-health').then((r) => r.data) })
  const reload = () => Promise.all([client.invalidateQueries({ queryKey: ['database-backups'] }), client.invalidateQueries({ queryKey: ['database-backup-health'] })])
  const create = useMutation({ mutationFn: () => api.post('/admin/database-backups', {}, { timeout: 300_000 }), onSuccess: () => { toast.success('Respaldo generado.'); reload() }, onError: (e) => toast.error(apiError(e)) })
  const verify = useMutation({ mutationFn: (id) => api.post(`/admin/database-backups/${id}/verify`, {}, { timeout: 300_000 }), onSuccess: () => { toast.success('Respaldo restaurable.'); reload() }, onError: (e) => toast.error(apiError(e)) })
  const cleanup = async () => {
    const days = Number(health.data?.retention_days || 30)
    const phrase = `DEPURAR RESPALDOS ANTERIORES A ${days} DIAS`
    const confirmation = window.prompt(`Escribe exactamente:\n${phrase}`)
    if (confirmation == null) return
    api.post('/admin/database-backups-cleanup', { retention_days: days, confirmation }).then(() => { toast.success('Retención aplicada.'); reload() }).catch((e) => toast.error(apiError(e)))
  }
  if (backups.isLoading || health.isLoading) return <Loading />
  if (backups.isError || health.isError) return <ErrorState message={apiError(backups.error || health.error)} />
  const storage = health.data
  return <><PageHeader eyebrow="Continuidad operativa" title="Respaldos de base de datos" description="Genera, verifica, conserva y descarga copias institucionales." actions={<button className="btn-primary-app compact" disabled={create.isPending} onClick={() => create.mutate()}><FiDatabase /> Crear respaldo ahora</button>} /><section className={`panel integrity-summary ${storage.healthy ? 'healthy' : 'unhealthy'}`}><FiDatabase /><div><h2>Almacenamiento {storage.healthy ? 'saludable' : 'requiere revisión'}</h2><p>{storage.available} disponibles · {storage.verified} restaurables · {storage.missing} faltantes · {storage.altered} alterados · {bytes(storage.total_bytes)} usados · {bytes(storage.disk_free_bytes)} libres</p></div><button className="danger-button" disabled={!Number(storage.eligible_count)} onClick={cleanup}><FiTrash2 /> Aplicar retención ({storage.retention_days} días)</button></section><section className="panel section-stack"><Table headers={['Fecha', 'Origen', 'Creado por', 'Tamaño', 'Checksum', 'Verificación', 'Estado', 'Acciones']} rows={backups.data.map((backup) => { const completed = backup.estado === 'completado'; return [dateTime(backup.creado_en), backup.origen, [backup.actor_nombres, backup.actor_apellido].filter(Boolean).join(' ') || backup.creado_por || 'Sistema', bytes(backup.tamano_bytes), <code key="hash" title={backup.checksum_sha256}>{backup.checksum_sha256 ? `${backup.checksum_sha256.slice(0, 12)}…` : '—'}</code>, backup.estado_verificacion === 'correcto' ? 'Restaurable' : backup.estado_verificacion === 'fallido' ? 'Falló prueba' : 'Sin verificar', <span className={`status-badge ${completed ? 'success' : 'danger'}`} key="state">{backup.estado}</span>, completed ? <span className="row-actions" key="actions"><button disabled={verify.isPending} onClick={() => verify.mutate(backup.id)}><FiShield /> Verificar</button><button onClick={() => downloadApi(`/admin/database-backups/${backup.id}/download`, backup.nombre_archivo || `respaldo_${backup.id}.sql.gz`, 'application/gzip').catch((e) => toast.error(e.message))}><FiDownload /> Descargar</button></span> : <span className="status-badge danger" key="error" title={backup.mensaje_error}>Ver error</span>] })} /></section></>
}

function Metric({ icon, label, value }) {
  const Icon = icon
  return <article className="stat-card"><span className="stat-icon"><Icon /></span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function Table({ headers, rows }) {
  if (!rows.length) return <Empty message="No hay registros para mostrar." />
  return <div className="table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((cells, row) => <tr key={row}>{cells.map((cell, column) => <td data-label={headers[column]} key={column}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function NumberField({ label, value, onChange }) {
  return <label>{label}<input type="number" required value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>
}
