import { createElement, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiBarChart2, FiBookOpen, FiClipboard, FiDownload, FiFileText, FiGitBranch, FiGrid, FiPlus, FiPlusCircle, FiSave, FiSliders, FiTool, FiTrash2, FiUploadCloud, FiUsers } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { downloadApiFile, saveBlob } from '../../utils/downloads'
import { Badge, Button, Card, confirmAction, Empty, ErrorState, Field, FileDrop, IconButton, Loading, Page, Switch } from '../../components/ui'

/* Módulos de carrera y carga inicial (Frontend_Swgpi/pages/admin/career-modules.php y career-setup.php). */

const CORE_MODULES = ['usuarios', 'proyectos', 'academico', 'entregables', 'evaluaciones', 'repositorio', 'reportes', 'configuracion']
// Los módulos traen un ícono de Bootstrap Icons (bi-…); se usa uno equivalente de Feather.
const ICONS = { 'bi-people': FiUsers, 'bi-diagram-3': FiGitBranch, 'bi-book': FiBookOpen, 'bi-file-earmark-check': FiFileText, 'bi-clipboard-check': FiClipboard, 'bi-archive': FiArchive, 'bi-bar-chart': FiBarChart2, 'bi-sliders': FiSliders, 'bi-tools': FiTool, 'bi-file-earmark-bar-graph': FiBarChart2 }
const iconFor = (name) => ICONS[name] || FiGrid

export function CareerModulesPage() {
  const client = useQueryClient()
  const { user } = useAuth()
  const query = useQuery({ queryKey: ['career-modules', user?.active_career?.id, 'admin'], queryFn: () => api.get('/career/modules').then((response) => response.data) })
  const modules = query.data?.modules || []
  const [selectedKey, setSelectedKey] = useState(null)
  const selected = modules.find((item) => item.modulo === selectedKey) || modules.find((item) => item.habilitado && !CORE_MODULES.includes(item.modulo)) || modules[0]
  const refresh = () => client.invalidateQueries({ queryKey: ['career-modules'] })
  const toggle = async (module, value) => {
    try { await api.put(`/career/modules/${module.id}`, { habilitado: value }); refresh() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Sistema" title="Módulos de carrera" subtitle="Habilita los módulos que usa la carrera activa y captura sus registros e indicadores.">
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <>
          <div className="module-grid">
            {modules.map((module) => (
              <article key={module.id} className={`module-card ${selected?.modulo === module.modulo ? 'active' : ''} ${module.habilitado ? '' : 'off'}`}>
                <button type="button" onClick={() => setSelectedKey(module.modulo)}>{createElement(iconFor(module.icon))}<span><strong>{module.label}</strong><small>{Number(module.records_count || 0)} registros</small></span></button>
                <Switch checked={module.habilitado} onChange={(value) => toggle(module, value)} label={<span className="visually-hidden">Habilitar {module.label}</span>} />
              </article>
            ))}
          </div>
          <div className="split-layout">
            {selected && <ModuleRecords module={selected} onChanged={refresh} />}
            <Indicators indicators={query.data?.indicators || []} onChanged={refresh} />
          </div>
        </>
      )}
    </Page>
  )
}

function ModuleRecords({ module, onChanged }) {
  const client = useQueryClient()
  const [form, setForm] = useState({ clave: '', titulo: '', descripcion: '', estado: 'activo' })
  const records = useQuery({ queryKey: ['career-module-records', module.modulo], queryFn: () => api.get('/career/module-records', { params: { modulo: module.modulo } }).then((response) => response.data.data || []) })
  const refresh = () => { client.invalidateQueries({ queryKey: ['career-module-records', module.modulo] }); onChanged() }
  const submit = async (event) => {
    event.preventDefault()
    if (!module.habilitado) return toast.warning('Habilita el módulo antes de registrar información.')
    try {
      await api.post('/career/module-records', { modulo: module.modulo, clave: form.clave.trim() || null, titulo: form.titulo.trim(), descripcion: form.descripcion.trim() || null, estado: form.estado, activo: true })
      toast.success('Registro guardado correctamente.')
      setForm({ clave: '', titulo: '', descripcion: '', estado: 'activo' })
      refresh()
    } catch (error) { toast.error(apiError(error)) }
    return undefined
  }
  const remove = async (record) => {
    if (!(await confirmAction({ title: 'Desactivar registro', text: '¿Desactivar este registro?', confirmText: 'Sí, desactivar' }))) return
    try { await api.delete(`/career/module-records/${record.id}`); refresh() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Card title={`Registros · ${module.label}`}>
      <form className="form-grid tinted-box" onSubmit={submit}>
        <Field label="Clave"><input className="control" value={form.clave} onChange={(event) => setForm({ ...form, clave: event.target.value })} /></Field>
        <Field label="Estado"><select className="control" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })}>{[['activo', 'Activo'], ['planeado', 'Planeado'], ['en_proceso', 'En proceso'], ['completado', 'Completado']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="Título" full><input className="control" required value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} /></Field>
        <Field label="Descripción" full><textarea className="control" rows={2} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
        <div className="form-actions full"><Button type="submit" icon={FiPlus}>Guardar registro</Button></div>
      </form>
      {records.isLoading ? <Loading /> : (
        <ul className="list-app">
          {(records.data || []).map((record) => <li key={record.id} className="list-row"><div><strong>{record.titulo}</strong><small>{record.clave || record.descripcion || 'Sin descripción'}</small></div><Badge>{record.estado}</Badge><IconButton icon={FiTrash2} className="danger" label="Desactivar" onClick={() => remove(record)} /></li>)}
          {!(records.data || []).length && <li className="muted small-text">Todavía no hay registros reales en este módulo.</li>}
        </ul>
      )}
    </Card>
  )
}

function Indicators({ indicators, onChanged }) {
  return (
    <Card title="Indicadores de carrera">
      {!indicators.length ? <Empty message="No hay indicadores configurados." /> : <div className="stack">{indicators.map((indicator) => <IndicatorEditor key={indicator.id} indicator={indicator} onChanged={onChanged} />)}</div>}
    </Card>
  )
}

function IndicatorEditor({ indicator, onChanged }) {
  const [current, setCurrent] = useState(indicator.valor_actual ?? '')
  const [target, setTarget] = useState(indicator.valor_meta ?? '')
  const save = async (event) => {
    event.preventDefault()
    try { await api.put(`/career/indicators/${indicator.id}`, { valor_actual: current === '' ? null : Number(current), valor_meta: target === '' ? null : Number(target) }); toast.success('Indicador actualizado.'); onChanged() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <form className="indicator-row" style={{ '--indicator': indicator.color || '#1B396A' }} onSubmit={save}>
      <div className="cell-main"><strong>{indicator.nombre}</strong><small>{indicator.modulo}</small></div>
      <Field label="Actual"><input className="control" type="number" step="0.01" placeholder="Sin captura" value={current} onChange={(event) => setCurrent(event.target.value)} /></Field>
      <Field label="Meta"><input className="control" type="number" step="0.01" value={target} onChange={(event) => setTarget(event.target.value)} /></Field>
      <Button type="submit" size="sm" variant="soft" icon={FiSave}>Guardar</Button>
    </form>
  )
}

/** CSV con comillas, comas y saltos de línea; la primera fila son los encabezados. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++ } else quoted = !quoted
    } else if (character === ',' && !quoted) { row.push(field.trim()); field = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++
      row.push(field.trim()); field = ''
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
    } else field += character
  }
  row.push(field.trim())
  if (row.some((value) => value !== '')) rows.push(row)
  if (rows.length < 2) return []
  const headers = rows.shift().map((value) => value.toLowerCase().replace(/^\uFEFF/, ''))
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}
const csvTemplate = (type) => {
  const content = type === 'subjects' ? 'clave,nombre,descripcion\nCLAVE-01,Nombre de la asignatura,Descripción opcional\n' : 'nombre,semestre,grupo,periodo,asignaturas\nGrupo 5A,5,A,2026-2,CLAVE-01|CLAVE-02\n'
  saveBlob(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }), type === 'subjects' ? 'plantilla_asignaturas.csv' : 'plantilla_grupos.csv').catch((error) => toast.error(error.message))
}

export function CareerSetupPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [data, setData] = useState({ subjects: [], groups: [] })
  const [files, setFiles] = useState({ subjects: null, groups: null })
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)
  const read = async (type, file) => {
    const rows = parseCsv(await file.text())
    setFiles((current) => ({ ...current, [type]: file }))
    setData((current) => ({
      ...current,
      [type]: type === 'subjects'
        ? rows.map((row) => ({ code: row.clave, name: row.nombre, description: row.descripcion || null }))
        : rows.map((row) => ({ name: row.nombre, semester: Number(row.semestre), group: row.grupo, period: row.periodo, subject_codes: String(row.asignaturas || '').split('|').map((value) => value.trim()).filter(Boolean) })),
    }))
    if (!rows.length) toast.error('El archivo no contiene filas válidas.')
  }
  const run = async (key, action) => {
    setBusy(key)
    try { setResult({ ok: true, text: await action() }) } catch (error) { setResult({ ok: false, text: apiError(error) }) } finally { setBusy(null) }
  }
  const importCatalog = () => run('import', async () => {
    const { data: response } = await api.post('/career/setup/catalog', data)
    const summary = response.summary || {}
    client.invalidateQueries({ queryKey: ['asignaturas'] })
    return `${response.message} Creadas: ${Number(summary.subjects_created || 0)} asignaturas y ${Number(summary.groups_created || 0)} grupos. Actualizadas: ${Number(summary.subjects_updated || 0)} asignaturas y ${Number(summary.groups_updated || 0)} grupos.`
  })
  const initRubrics = () => run('rubrics', async () => {
    const { data: response } = await api.post('/evaluations/rubrics/initialize', {})
    return `${response.message} Se crearon ${Number(response.created || 0)} contenedores.`
  })
  const exportCareer = () => downloadApiFile('/career/export', `sgpi_${user?.active_career?.clave || 'carrera'}_${new Date().toISOString().slice(0, 10)}.zip`).catch((error) => toast.error(error.message))

  return (
    <Page eyebrow="Puesta en marcha" title={`Carga académica de ${user?.active_career?.nombre_corto || 'la carrera'}`} subtitle="Importa el plan real de asignaturas y sus grupos. La información se guarda sólo en la carrera activa."
      actions={<><Button variant="ghost" icon={FiDownload} onClick={exportCareer}>Exportar carrera</Button><Button variant="ghost" icon={FiBookOpen} onClick={() => navigate('/subjects')}>Ver catálogo</Button></>}>
      {result && <div className={`alert-app ${result.ok ? 'success' : 'danger'}`}>{result.text}</div>}
      <div className="grid-2">
        <Card title="1. Asignaturas" subtitle="Columnas: clave, nombre, descripcion.">
          <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => csvTemplate('subjects')}>Descargar plantilla</Button>
          <div className="mt-2"><FileDrop accept=".csv,text/csv" file={files.subjects} onFile={(file) => read('subjects', file)} hint={data.subjects.length ? `${data.subjects.length} fila(s) preparadas` : 'Archivo CSV'} /></div>
        </Card>
        <Card title="2. Grupos y cargas" subtitle="Columnas: nombre, semestre, grupo, periodo, asignaturas (claves separadas con |).">
          <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => csvTemplate('groups')}>Descargar plantilla</Button>
          <div className="mt-2"><FileDrop accept=".csv,text/csv" file={files.groups} onFile={(file) => read('groups', file)} hint={data.groups.length ? `${data.groups.length} fila(s) preparadas` : 'Archivo CSV (opcional)'} /></div>
        </Card>
      </div>
      <Card>
        <div className="row-wrap"><span className="muted small-text grow">{data.subjects.length ? `${data.subjects.length} asignaturas y ${data.groups.length} grupos listos para importar.` : 'Selecciona al menos el archivo de asignaturas.'}</span><Button icon={FiUploadCloud} disabled={!data.subjects.length} loading={busy === 'import'} onClick={importCatalog}>Importar catálogo</Button></div>
      </Card>
      <Card title="3. Rúbricas de evaluación" subtitle="Crea los contenedores vacíos de 5.º a 8.º semestre. Las preguntas se configuran después desde Evaluaciones." actions={<Button variant="soft" icon={FiPlusCircle} loading={busy === 'rubrics'} onClick={initRubrics}>Inicializar rúbricas</Button>} />
    </Page>
  )
}
