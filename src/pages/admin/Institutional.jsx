import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiDatabase, FiDownload, FiEdit3, FiFileText, FiMail, FiPlus, FiPower, FiRefreshCw, FiSave, FiSearch, FiShield, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../../services/api'
import { profileLabel, SIMULABLE_PROFILES } from '../../lib/permissions'
import { downloadApiFile } from '../../utils/downloads'
import { formatDateTime } from '../../utils/formatters'
import { Badge, Button, Card, confirmAction, DataTable, Empty, ErrorState, Field, IconButton, Loading, Page, Pager, Progress, promptText, SearchInput, Sheet, Stat, Switch } from '../../components/ui'

/*
 * Administración institucional del administrador general: carreras y accesos, operaciones, auditoría,
 * integridad, respaldos y correos enviados (Frontend_Swgpi/pages/admin/careers.php, operations.php, career-audit.php,
 * career-integrity.php, database-backups.php y sent-emails.php).
 */
const READINESS = { identity: 'Identidad', career_management: 'Jefatura', subjects: 'Asignaturas', groups: 'Grupos', students: 'Estudiantes', configuration: 'Configuración', rubrics: 'Rúbricas' }
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

export function CareersPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['institutional-careers'], queryFn: () => api.get('/admin/careers').then((response) => response.data.careers || []) })
  const [selectedId, setSelectedId] = useState(null)
  const careers = query.data || []
  const selected = careers.find((item) => item.id === (selectedId || careers[0]?.id))
  const reload = () => { client.invalidateQueries({ queryKey: ['institutional-careers'] }); client.invalidateQueries({ queryKey: ['admin-careers'] }) }
  return (
    <Page eyebrow="Administración general" title="Carreras y accesos" subtitle="Identidad, preparación y personas autorizadas de cada carrera."
      actions={<Button variant="ghost" icon={FiDownload} onClick={() => fileDownload('/admin/careers/export', `resumen_carreras_${today()}.csv`)}>Exportar resumen</Button>}>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <>
          <div className="career-picker">
            {careers.map((career) => (
              <button type="button" key={career.id} className={selected?.id === career.id ? 'active' : ''} style={{ '--c1': career.color_primario || '#1B396A', '--c2': career.color_secundario || '#2D5A96' }} onClick={() => setSelectedId(career.id)}>
                <span>{career.clave}</span><strong>{career.nombre_corto}</strong><small>{career.members_count} integrantes · {career.readiness?.percentage || 0}% preparada</small>
              </button>
            ))}
          </div>
          <Card title="Puesta en marcha" flush>
            <Rows headers={['Carrera', 'Personas', 'Académico', 'Operación', 'Preparación']} rows={careers.map((career) => {
              const roles = career.role_counts || {}
              const readiness = career.readiness || {}
              const missing = Object.entries(readiness.checklist || {}).filter(([, done]) => !done).map(([key]) => READINESS[key] || key)
              return [
                <span className="cell-main" key="c"><strong>{career.nombre_corto}</strong><small>{career.clave}</small></span>,
                <span className="cell-main" key="p"><strong>{career.members_count}</strong><small>{roles.career_heads || 0} jefatura · {roles.career_head_assistants || 0} asistencia · {roles.project_coordinators || 0} coordinación · {roles.teachers || 0} docentes · {roles.students || 0} estudiantes</small></span>,
                `${career.subjects_count} asignaturas · ${career.groups_count} grupos`,
                `${career.projects_count} proyectos · ${career.evaluations_count} evaluaciones · ${career.documents_count} documentos`,
                <span className="readiness" key="r"><span className="row-wrap"><strong>{readiness.percentage || 0}%</strong><small className="muted">{readiness.completed || 0}/{readiness.total || 7}</small></span><Progress value={readiness.percentage} tone={readiness.percentage >= 100 ? 'success' : 'primary'} /><small className="muted">{missing.length ? `Falta: ${missing.join(', ')}` : 'Lista para operar'}</small></span>,
              ]
            })} />
          </Card>
          {selected && <div className="split-layout"><CareerIdentity key={`i-${selected.id}`} career={selected} onSaved={reload} /><Memberships key={`m-${selected.id}`} career={selected} onChanged={reload} /></div>}
        </>
      )}
    </Page>
  )
}

function CareerIdentity({ career, onSaved }) {
  const [form, setForm] = useState({ nombre: career.nombre || '', nombre_corto: career.nombre_corto || '', color_primario: career.color_primario || '#1B396A', color_secundario: career.color_secundario || '#2D5A96', color_acento: career.color_acento || '#00A6D6', lema: career.lema || '' })
  const save = useMutation({ mutationFn: () => api.put(`/admin/careers/${career.id}`, { ...form, nombre: form.nombre.trim(), nombre_corto: form.nombre_corto.trim(), lema: form.lema.trim() }), onSuccess: () => { toast.success('Identidad actualizada correctamente.'); onSaved() }, onError: (error) => toast.error(apiError(error)) })
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  return (
    <Card title="Identidad de carrera" subtitle={career.nombre}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <Field label="Nombre"><input className="control" value={form.nombre} onChange={set('nombre')} /></Field>
        <Field label="Nombre corto"><input className="control" value={form.nombre_corto} onChange={set('nombre_corto')} /></Field>
        <div className="color-row">{[['color_primario', 'Principal'], ['color_secundario', 'Secundario'], ['color_acento', 'Acento']].map(([key, label]) => <Field key={key} label={label}><input className="control color" type="color" value={form[key]} onChange={set(key)} /></Field>)}</div>
        <Field label="Lema"><textarea className="control" rows={3} value={form.lema} onChange={set('lema')} /></Field>
        <Button type="submit" icon={FiSave} loading={save.isPending}>Guardar identidad</Button>
      </form>
    </Card>
  )
}

function Memberships({ career, onChanged }) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState({ usuario_id: '', perfil_id: 5, es_principal: false })
  const query = useQuery({ queryKey: ['career-memberships', career.id, search], queryFn: () => api.get('/admin/career-memberships', { params: { carrera_id: career.id, search } }).then((response) => response.data) })
  const refresh = () => { client.invalidateQueries({ queryKey: ['career-memberships', career.id] }); onChanged() }
  const create = useMutation({ mutationFn: () => api.post('/admin/career-memberships', { ...draft, usuario_id: draft.usuario_id.trim(), carrera_id: career.id, perfil_id: Number(draft.perfil_id), activo: true }), onSuccess: () => { toast.success('Membresía guardada correctamente.'); setDraft({ usuario_id: '', perfil_id: 5, es_principal: false }); refresh() }, onError: (error) => toast.error(apiError(error)) })
  const toggle = async (item) => { try { await api.put(`/admin/career-memberships/${item.id}`, { activo: !item.activo }); refresh() } catch (error) { toast.error(apiError(error)) } }
  const remove = async (item) => {
    if (!(await confirmAction({ title: 'Eliminar membresía', text: 'La persona pierde este acceso a la carrera.', confirmText: 'Sí, eliminar', danger: true }))) return
    try { await api.delete(`/admin/career-memberships/${item.id}`); toast.success('Membresía eliminada.'); refresh() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Card title="Membresías" subtitle={career.nombre}>
      <form className="form-grid tinted-box" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <Field label="No. de control o empleado"><input className="control" required value={draft.usuario_id} onChange={(event) => setDraft({ ...draft, usuario_id: event.target.value })} /></Field>
        <Field label="Rol en esta carrera"><select className="control" value={draft.perfil_id} onChange={(event) => setDraft({ ...draft, perfil_id: Number(event.target.value) })}>{SIMULABLE_PROFILES.map((id) => <option key={id} value={id}>{profileLabel(id)}</option>)}</select></Field>
        <div className="full row-wrap"><Switch checked={draft.es_principal} onChange={(value) => setDraft({ ...draft, es_principal: value })} label="Carrera principal" /><span className="spacer" /><Button type="submit" icon={FiPlus} loading={create.isPending}>Asignar</Button></div>
      </form>
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar persona..." />
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} /> : (
        <ul className="list-app mt-2">
          {unwrapCollection(query.data).map((item) => {
            const person = item.user || {}
            return (
              <li key={item.id} className="list-row">
                <div><strong>{[person.nombres, person.apellido_paterno, person.apellido_materno].filter(Boolean).join(' ') || person.id}</strong><small>{person.id}{item.es_principal ? ' · Principal' : ''} · {profileLabel(item.perfil_id)}</small></div>
                <Badge tone={item.activo ? 'success' : 'neutral'}>{item.activo ? 'Activo' : 'Inactivo'}</Badge>
                <IconButton icon={FiPower} label={item.activo ? 'Desactivar' : 'Activar'} onClick={() => toggle(item)} />
                <IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={() => remove(item)} />
              </li>
            )
          })}
          {!unwrapCollection(query.data).length && <li className="muted small-text">No hay membresías para mostrar.</li>}
        </ul>
      )}
    </Card>
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
  const fields = [['target_readiness', 'Objetivo de preparación (%)'], ['critical_readiness', 'Umbral crítico (%)'], ['max_backup_age_hours', 'Vigencia máxima de respaldo (h)'], ['backup_retention_days', 'Retención de respaldos (días)']]
  return (
    <form className="stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      {fields.map(([key, label]) => <Field key={key} label={label}><input className="control" type="number" required value={form[key] ?? ''} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></Field>)}
      <div className="form-actions"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" icon={FiSave} loading={save.isPending}>Guardar</Button></div>
    </form>
  )
}

export function AuditPage() {
  const empty = { page: 1, per_page: 25, career_id: '', actor_id: '', method: '', status: '', date_from: '', date_to: '' }
  const [filters, setFilters] = useState(empty)
  const [draft, setDraft] = useState(empty)
  const careers = useQuery({ queryKey: ['institutional-careers'], queryFn: () => api.get('/admin/careers').then((response) => response.data.careers || []) })
  const query = useQuery({ queryKey: ['institutional-audit', filters], queryFn: () => api.get('/admin/audit', { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')) }).then((response) => response.data), placeholderData: (previous) => previous })
  const set = (key) => (event) => setDraft({ ...draft, [key]: event.target.value })
  return (
    <Page eyebrow="Administración general" title="Auditoría multicarrera" subtitle="Operaciones de escritura sin exponer contraseñas ni contenido sensible.">
      <Card>
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft, page: 1 }) }}>
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
          <Rows headers={['Operación', 'Fecha', 'Carrera', 'Actor', 'Resultado', 'IP']} rows={(query.data?.data || []).map((item) => [
            <span className="cell-main" key="o"><strong>{item.metodo}</strong><code className="break">{item.ruta}</code></span>,
            formatDateTime(item.creado_en), item.carrera_clave || 'Institucional',
            <span className="cell-main" key="a"><strong>{actor(item, item.actor_id || 'Sistema')}</strong><small>{item.actor_id}</small></span>,
            <Badge key="r" tone={Number(item.estado_http) < 400 ? 'success' : 'danger'}>{item.estado_http}</Badge>, item.direccion_ip || '—',
          ])} />
        )}
        <Pager meta={query.data} onPage={(page) => setFilters({ ...filters, page })} />
      </Card>
    </Page>
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
  const backups = useQuery({ queryKey: ['database-backups'], queryFn: () => api.get('/admin/database-backups').then((response) => response.data.data || []) })
  const health = useQuery({ queryKey: ['backups-health'], queryFn: () => api.get('/admin/database-backups-health').then((response) => response.data) })
  const reload = () => { client.invalidateQueries({ queryKey: ['database-backups'] }); client.invalidateQueries({ queryKey: ['backups-health'] }) }
  // Un intento fallido también queda en el historial, así que la tabla se recarga en ambos casos.
  const create = useMutation({ mutationFn: () => api.post('/admin/database-backups', {}, { timeout: 300_000 }), onSuccess: (response) => toast.success(`Respaldo generado (${bytes(response.data.backup?.tamano_bytes)}). Verifícalo para comprobar que se puede restaurar.`), onError: (error) => toast.error(apiError(error), { autoClose: 12_000 }), onSettled: reload })
  const verify = useMutation({ mutationFn: (id) => api.post(`/admin/database-backups/${id}/verify`, {}, { timeout: 300_000 }), onSuccess: (response) => { const result = response.data.verification || {}; toast.success(`Restaurable: ${result.tablas_encontradas} tablas esenciales y ${Number(result.filas_verificadas).toLocaleString('es-MX')} filas comprobadas.`) }, onError: (error) => toast.error(apiError(error), { autoClose: 12_000 }), onSettled: reload })
  const storage = health.data
  // La depuración exige escribir la frase exacta, igual que en el front de PHP.
  const cleanup = async () => {
    const days = Number(storage?.retention_days || 30)
    const phrase = `DEPURAR RESPALDOS ANTERIORES A ${days} DIAS`
    const confirmation = await promptText({ title: 'Aplicar retención', text: `Escribe exactamente: ${phrase}`, multiline: false, confirmText: 'Depurar' })
    if (confirmation === null) return
    try {
      const response = await api.post('/admin/database-backups-cleanup', { retention_days: days, confirmation })
      toast.success(`Retención aplicada: ${response.data.result?.deleted || 0} copias eliminadas, ${bytes(response.data.result?.released_bytes)} liberados.`)
      reload()
    } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Continuidad operativa" title="Respaldos de base de datos" subtitle="Genera, verifica, conserva y descarga copias institucionales." actions={<Button icon={FiDatabase} loading={create.isPending} onClick={() => create.mutate()}>Crear respaldo ahora</Button>}>
      {health.isLoading || backups.isLoading ? <Loading /> : health.isError || backups.isError ? <ErrorState error={health.error || backups.error} onRetry={reload} /> : (
        <>
          <section className={`health-banner ${storage.healthy ? 'ok' : 'bad'}`}>
            <FiDatabase />
            <div><h2>Almacenamiento {storage.healthy ? 'saludable' : 'requiere revisión'}</h2><p>{storage.available} disponibles · {storage.verified} restaurables · {storage.missing} faltantes · {storage.altered} alterados · {bytes(storage.total_bytes)} usados · {bytes(storage.disk_free_bytes)} libres</p></div>
            <Button variant="ghost-danger" icon={FiTrash2} disabled={!Number(storage.eligible_count)} onClick={cleanup}>Aplicar retención ({storage.retention_days} días)</Button>
          </section>
          <Card flush>
            <Rows headers={['Respaldo', 'Origen', 'Creado por', 'Tamaño', 'Verificación', 'Estado', 'Acciones']} rows={backups.data.map((backup) => {
              const completed = backup.estado === 'completado'
              return [
                <span className="cell-main" key="f"><strong>{formatDateTime(backup.creado_en)}</strong><code title={backup.checksum_sha256}>{backup.checksum_sha256 ? `${backup.checksum_sha256.slice(0, 12)}…` : '—'}</code></span>,
                backup.origen, actor(backup, backup.creado_por || 'Sistema'), completed ? bytes(backup.tamano_bytes) : '—',
                !completed ? '—' : <span className="cell-main" key="v">
                  <Badge tone={backup.estado_verificacion === 'correcto' ? 'success' : backup.estado_verificacion === 'fallido' ? 'danger' : 'neutral'}>{backup.estado_verificacion === 'correcto' ? 'Restaurable' : backup.estado_verificacion === 'fallido' ? 'Falló prueba' : 'Sin verificar'}</Badge>
                  {backup.estado_verificacion === 'correcto' && <small>{backup.tablas_encontradas} tablas · {Number(backup.filas_verificadas).toLocaleString('es-MX')} filas · {formatDateTime(backup.verificado_en)}</small>}
                  {backup.estado_verificacion === 'fallido' && <small className="text-danger wrap-anywhere">{backup.error_verificacion}</small>}
                </span>,
                <Badge key="e" tone={completed ? 'success' : 'danger'}>{completed ? 'Completado' : 'Fallido'}</Badge>,
                completed ? <span className="row-wrap" key="a">
                  <Button size="sm" variant="ghost" icon={FiShield} loading={verify.isPending && verify.variables === backup.id} onClick={() => verify.mutate(backup.id)}>Verificar</Button>
                  <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => fileDownload(`/admin/database-backups/${backup.id}/download`, backup.nombre_archivo || `respaldo_${backup.id}.sql.gz`)}>Descargar</Button>
                </span> : <small key="x" className="text-danger wrap-anywhere">{backup.mensaje_error || 'No se registró el detalle del error.'}</small>,
              ]
            })} />
          </Card>
        </>
      )}
    </Page>
  )
}

const EMAIL_CATEGORIES = { credenciales: 'Credenciales', codigo_registro: 'Código de registro', recuperacion: 'Recuperación de contraseña', general: 'General' }
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
            <Pager meta={query.data} onPage={(page) => setFilters({ ...filters, page })} />
          </Card>
        </>
      )}
    </Page>
  )
}
