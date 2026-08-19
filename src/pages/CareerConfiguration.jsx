import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiBookOpen, FiDownload, FiGrid, FiPlus, FiSave, FiTrash2, FiUpload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, API_URL, unwrapCollection } from '../services/api'
import { confirmAction, Empty, ErrorState, Loading, PageHeader } from '../components/common/Ui'

const coreModules = ['usuarios', 'proyectos', 'academico', 'entregables', 'evaluaciones', 'repositorio', 'reportes', 'configuracion']
const token = () => localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || ''

export function CareerModulesPage() {
  const client = useQueryClient()
  const [selectedName, setSelectedName] = useState('')
  const query = useQuery({ queryKey: ['career-modules'], queryFn: () => api.get('/career/modules').then((r) => r.data) })
  const selected = query.data?.modules?.find((item) => item.modulo === (selectedName || query.data?.modules?.find((module) => module.habilitado && !coreModules.includes(module.modulo))?.modulo || query.data?.modules?.[0]?.modulo))
  const records = useQuery({ queryKey: ['career-module-records', selected?.modulo], queryFn: () => api.get('/career/module-records', { params: { modulo: selected.modulo } }).then((r) => r.data), enabled: Boolean(selected) })
  const reload = () => Promise.all([client.invalidateQueries({ queryKey: ['career-modules'] }), client.invalidateQueries({ queryKey: ['career-module-records'] })])
  const toggle = useMutation({ mutationFn: ({ id, habilitado }) => api.put(`/career/modules/${id}`, { habilitado }), onSuccess: reload, onError: (e) => toast.error(apiError(e)) })
  const updateIndicator = useMutation({ mutationFn: ({ id, data }) => api.put(`/career/indicators/${id}`, data), onSuccess: () => { toast.success('Indicador actualizado.'); reload() }, onError: (e) => toast.error(apiError(e)) })
  const remove = async (id) => { if (await confirmAction({ title: 'Desactivar registro', text: 'El registro quedará inactivo dentro del módulo.' })) api.delete(`/career/module-records/${id}`).then(() => { toast.success('Registro desactivado.'); reload() }).catch((e) => toast.error(apiError(e))) }
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  return <>
    <PageHeader eyebrow="Configuración de carrera" title="Módulos e indicadores" description={`Habilita capacidades y administra registros de ${query.data.career?.nombre_corto || 'la carrera activa'}.`} />
    <section className="career-module-grid">{query.data.modules.map((module) => <article className={`career-module-tile ${selected?.modulo === module.modulo ? 'active' : ''} ${module.habilitado ? '' : 'disabled'}`} key={module.id}><button onClick={() => setSelectedName(module.modulo)}><FiGrid /><span><strong>{module.label}</strong><small>{module.records_count} registros</small></span></button><label className="toggle-control" title="Habilitar módulo"><input type="checkbox" checked={Boolean(module.habilitado)} disabled={toggle.isPending} onChange={(e) => toggle.mutate({ id: module.id, habilitado: e.target.checked })} /><span /></label></article>)}</section>
    {selected && <div className="institutional-columns module-workspace"><section className="panel section-stack"><header className="panel-heading"><div><span className="eyebrow">Registros</span><h2>{selected.label}</h2></div></header><RecordForm module={selected} onSaved={reload} />{records.isLoading ? <Loading /> : records.isError ? <ErrorState message={apiError(records.error)} /> : <RecordTable records={unwrapCollection(records.data)} onRemove={remove} />}</section><section className="panel section-stack"><header className="panel-heading"><div><span className="eyebrow">Medición</span><h2>Indicadores</h2></div></header>{query.data.indicators?.length ? query.data.indicators.map((indicator) => <IndicatorForm indicator={indicator} key={indicator.id} onSave={(data) => updateIndicator.mutate({ id: indicator.id, data })} pending={updateIndicator.isPending} />) : <Empty message="No hay indicadores configurados." />}</section></div>}
  </>
}

function RecordForm({ module, onSaved }) {
  const [form, setForm] = useState({ clave: '', titulo: '', descripcion: '', estado: 'activo' })
  const mutation = useMutation({ mutationFn: () => api.post('/career/module-records', { ...form, modulo: module.modulo, clave: form.clave || null, descripcion: form.descripcion || null, activo: true }), onSuccess: () => { toast.success('Registro guardado.'); setForm({ clave: '', titulo: '', descripcion: '', estado: 'activo' }); onSaved() }, onError: (e) => toast.error(apiError(e)) })
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return <form className="module-record-form settings-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}><div className="form-grid"><label>Clave<input value={form.clave} onChange={(e) => field('clave', e.target.value)} /></label><label>Estado<select value={form.estado} onChange={(e) => field('estado', e.target.value)}><option value="activo">Activo</option><option value="planeado">Planeado</option><option value="en_proceso">En proceso</option><option value="completado">Completado</option></select></label><label className="full-field">Título<input required value={form.titulo} onChange={(e) => field('titulo', e.target.value)} /></label><label className="full-field">Descripción<textarea rows="2" value={form.descripcion} onChange={(e) => field('descripcion', e.target.value)} /></label></div><button className="btn-primary-app compact" disabled={!module.habilitado || mutation.isPending}><FiPlus /> Agregar registro</button>{!module.habilitado && <small className="form-hint warning">Habilita el módulo para registrar información.</small>}</form>
}

function RecordTable({ records, onRemove }) {
  if (!records.length) return <Empty message="Todavía no hay registros reales en este módulo." />
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Registro</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td data-label="Registro" className="mobile-primary-cell"><strong>{record.titulo}</strong><small className="cell-subtitle">{record.clave || record.descripcion || 'Sin descripción'}</small></td><td data-label="Estado"><span className="status-badge">{record.estado}</span></td><td data-label="Acciones" className="row-actions"><button className="danger" onClick={() => onRemove(record.id)}><FiTrash2 /> Desactivar</button></td></tr>)}</tbody></table></div>
}

function IndicatorForm({ indicator, onSave, pending }) {
  const [actual, setActual] = useState(indicator.valor_actual ?? '')
  const [target, setTarget] = useState(indicator.valor_meta ?? '')
  return <form className="indicator-form" style={{ '--indicator': indicator.color || '#1B396A' }} onSubmit={(e) => { e.preventDefault(); onSave({ valor_actual: actual === '' ? null : Number(actual), valor_meta: target === '' ? null : Number(target) }) }}><div><i /><span><strong>{indicator.nombre}</strong><small>{indicator.modulo} · {indicator.unidad}</small></span></div><label>Actual<input type="number" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} /></label><label>Meta<input type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} /></label><button className="icon-text-button" disabled={pending}><FiSave /> Guardar</button></form>
}

export function CareerSetupPage() {
  const [state, setState] = useState({ subjects: [], groups: [] })
  const importCatalog = useMutation({ mutationFn: () => api.post('/career/setup/catalog', state), onSuccess: ({ data }) => { const summary = data.summary || {}; toast.success(`${data.message} Creadas: ${summary.subjects_created || 0} asignaturas y ${summary.groups_created || 0} grupos; actualizadas: ${summary.subjects_updated || 0} y ${summary.groups_updated || 0}.`) }, onError: (e) => toast.error(apiError(e)) })
  const rubrics = useMutation({ mutationFn: () => api.post('/evaluations/rubrics/initialize'), onSuccess: ({ data }) => toast.success(`${data.message} Se crearon ${data.created || 0} contenedores.`), onError: (e) => toast.error(apiError(e)) })
  const read = async (type, file) => {
    const rows = parseCsv(await file.text())
    const mapped = type === 'subjects' ? rows.map((row) => ({ code: row.clave, name: row.nombre, description: row.descripcion || null })) : rows.map((row) => ({ name: row.nombre, semester: Number(row.semestre), group: row.grupo, period: row.periodo, subject_codes: String(row.asignaturas || '').split('|').map((value) => value.trim()).filter(Boolean) }))
    setState((current) => ({ ...current, [type]: mapped }))
  }
  return <>
    <PageHeader eyebrow="Puesta en marcha" title="Carga académica" description="Importa el plan real de asignaturas y grupos únicamente en la carrera activa." actions={<button className="icon-text-button" onClick={() => downloadCareerPackage()}><FiArchive /> Exportar carrera</button>} />
    <div className="info-banner"><FiSave /><span><strong>Importación transaccional</strong> Si una fila falla, no se guardará ninguna parte del archivo.</span></div>
    <div className="setup-grid"><UploadCard icon={FiBookOpen} title="1. Asignaturas" help="Columnas: clave,nombre,descripcion" count={state.subjects.length} onTemplate={() => template('subjects')} onFile={(file) => read('subjects', file)} /><UploadCard icon={FiGrid} title="2. Grupos y cargas" help="Columnas: nombre,semestre,grupo,periodo,asignaturas. Separa claves con |." count={state.groups.length} onTemplate={() => template('groups')} onFile={(file) => read('groups', file)} /></div>
    <section className="panel setup-action"><div><strong>{state.subjects.length ? `${state.subjects.length} asignaturas y ${state.groups.length} grupos listos para importar.` : 'Selecciona al menos el archivo de asignaturas.'}</strong><small>Las claves existentes se actualizarán; no se eliminarán registros.</small></div><button className="btn-primary-app compact" disabled={!state.subjects.length || importCatalog.isPending} onClick={() => importCatalog.mutate()}><FiUpload /> Importar catálogo</button></section>
    <section className="panel setup-action"><div><strong>3. Rúbricas de evaluación</strong><small>Crea los contenedores de 5.º a 8.º semestre; después configura sus preguntas en Evaluaciones.</small></div><button className="icon-text-button" disabled={rubrics.isPending} onClick={() => rubrics.mutate()}><FiPlus /> Inicializar rúbricas</button></section>
  </>
}

function UploadCard({ icon, title, help, count, onTemplate, onFile }) {
  const Icon = icon
  return <section className="panel upload-card"><header><Icon /><div><h2>{title}</h2><p>{help}</p></div></header><button className="icon-text-button" onClick={onTemplate}><FiDownload /> Descargar plantilla</button><label className="file-drop"><FiUpload /><span>Seleccionar archivo CSV</span><input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} /></label><small className={count ? 'success-text' : ''}>{count ? `${count} fila(s) preparadas.` : 'No se ha seleccionado archivo.'}</small></section>
}

function parseCsv(text) {
  const rows = []
  let row = []; let field = ''; let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') { if (quoted && text[index + 1] === '"') { field += '"'; index += 1 } else quoted = !quoted }
    else if (character === ',' && !quoted) { row.push(field.trim()); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && text[index + 1] === '\n') index += 1; row.push(field.trim()); field = ''; if (row.some(Boolean)) rows.push(row); row = [] }
    else field += character
  }
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row)
  if (rows.length < 2) return []
  const headers = rows.shift().map((value) => value.toLowerCase().replace(/^\uFEFF/, ''))
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function template(type) {
  const content = type === 'subjects' ? 'clave,nombre,descripcion\nCLAVE-01,Nombre de la asignatura,Descripción opcional\n' : 'nombre,semestre,grupo,periodo,asignaturas\nGrupo 5A,5,A,2026-2,CLAVE-01|CLAVE-02\n'
  saveBlob(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }), type === 'subjects' ? 'plantilla_asignaturas.csv' : 'plantilla_grupos.csv')
}

async function downloadCareerPackage() {
  try {
    const response = await fetch(`${API_URL}/career/export`, { headers: { Authorization: `Bearer ${token()}`, Accept: 'application/zip' } })
    if (!response.ok) throw new Error('No se pudo generar el paquete de la carrera.')
    saveBlob(await response.blob(), `sgpi_carrera_${new Date().toISOString().slice(0, 10)}.zip`)
  } catch (error) { toast.error(error.message) }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
}
