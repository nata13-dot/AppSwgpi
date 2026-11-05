import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiDownload, FiEdit2, FiPlus, FiRefreshCw, FiSave, FiStar, FiTrash2, FiUploadCloud, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { isStudent, isTeacher } from '../lib/permissions'
import { downloadApiFile } from '../utils/downloads'
import { nextMinute } from './rooms/roomShared'
import { formatDate, fullName } from '../utils/formatters'
import { Badge, Button, Card, confirmAction, DataTable, Empty, ErrorState, Field, FileDrop, IconButton, Loading, Page, Pager, SearchInput, Sheet, useDebounced } from '../components/ui'

export default function DeliverablesPage() {
  const { user } = useAuth()
  if (isStudent(user)) return <StudentDeliverables />
  if (isTeacher(user)) return <TeacherDeliverables />
  return <ManageDeliverables />
}

const gradeTone = (grade) => (grade >= 70 ? 'success' : grade >= 50 ? 'warning' : 'danger')
const GradeBadge = ({ grade }) => (grade === null || grade === undefined ? <span className="muted small-text">Sin calificar</span> : <Badge tone={gradeTone(Number(grade))}>{grade}%</Badge>)
const download = async (deliverable) => {
  try { await downloadApiFile(`/deliverables/${deliverable.id}/download${deliverable.project_id ? `?project_id=${deliverable.project_id}` : ''}`, deliverable.nombre || 'entregable') } catch (error) { toast.error(error.message) }
}

/** Subida de archivo de un entregable con las reglas de los ajustes públicos (tipos y tamaño máximo). */
function UploadSheet({ deliverable, onClose, onSaved }) {
  const settings = useQuery({ queryKey: ['public-settings'], queryFn: () => api.get('/settings/public').then((response) => response.data), staleTime: 300_000 })
  const allowed = settings.data?.allowed_file_types || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip']
  const maxMb = Number(settings.data?.max_file_size_mb || 50)
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const upload = async () => {
    if (!allowed.includes(file.name.split('.').pop().toLowerCase())) return toast.error(`Tipo de archivo no permitido. Permitidos: ${allowed.join(', ').toUpperCase()}`)
    if (file.size > maxMb * 1048576) return toast.error(`Archivo muy grande. Máximo ${maxMb} MB; tu archivo pesa ${(file.size / 1048576).toFixed(1)} MB.`)
    const body = new FormData()
    body.append('archivo', file)
    body.append('project_id', deliverable.project_id)
    setProgress(0)
    try {
      await api.post(`/deliverables/${deliverable.id}/upload`, body, { timeout: 120_000, onUploadProgress: (event) => event.total && setProgress(Math.round((event.loaded / event.total) * 100)) })
      toast.success('Archivo subido exitosamente.')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setProgress(null) }
    return undefined
  }
  return (
    <Sheet open title="Subir archivo" subtitle={deliverable.nombre} onClose={onClose} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon={FiUploadCloud} disabled={!file} loading={progress !== null} onClick={upload}>{progress !== null ? `Subiendo ${progress}%` : 'Subir archivo'}</Button></>}>
      <FileDrop accept={allowed.map((extension) => `.${extension}`).join(',')} file={file} onFile={setFile} hint={`Máximo ${maxMb} MB. ${allowed.join(', ').toUpperCase()}`} />
    </Sheet>
  )
}

function GradeSheet({ deliverable, current, onClose, onSaved }) {
  const [grade, setGrade] = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const save = async (event) => {
    event.preventDefault()
    const value = Number(grade)
    if (grade === '' || Number.isNaN(value) || value < 0 || value > 100) return toast.warning('La calificación debe estar entre 0 y 100.')
    setSaving(true)
    try {
      await api.post(`/deliverables/${deliverable.id}/calificar`, { project_id: Number(deliverable.project_id), calificacion: value })
      toast.success('Calificación guardada.')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
    return undefined
  }
  return (
    <Sheet open title="Calificar entregable" subtitle={deliverable.nombre} onClose={onClose} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="grade-form" icon={FiSave} loading={saving}>Guardar calificación</Button></>}>
      <form id="grade-form" onSubmit={save}>
        <Field label="Calificación (0-100)"><input className="control big-number" type="number" inputMode="decimal" min={0} max={100} step="0.01" required autoFocus value={grade} onChange={(event) => setGrade(event.target.value)} /></Field>
      </form>
    </Sheet>
  )
}

/** Gestión de entregables por materia y competencia (Frontend_Swgpi/pages/admin/deliverables.php). */
function ManageDeliverables() {
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const competencyFilter = params.get('competencia_id')
  const [subject, setSubject] = useState('')
  const [competency, setCompetency] = useState('')
  const [search, setSearch] = useState(params.get('q') || '')
  const debounced = useDebounced(search)
  const [page, setPage] = useState(1)
  const [sheet, setSheet] = useState(null)
  const catalogs = useQuery({
    queryKey: ['deliverable-catalogs'],
    queryFn: async () => {
      const [projects, competencies] = await Promise.all([
        api.get('/projects', { params: { compact: 1, per_page: 500 } }).then((response) => response.data.data || []),
        api.get('/competencias', { params: { per_page: 100 } }).then((response) => response.data.data || []),
      ])
      const subjects = [...new Map(competencies.filter((item) => item.asignatura).map((item) => [item.asignatura.id, item.asignatura])).values()]
      return { projects, competencies, subjects }
    },
    staleTime: 60_000,
  })
  const filters = { ...(debounced.trim() ? { q: debounced.trim() } : {}), ...(subject ? { asignatura_id: subject } : {}), ...(competency ? { competencia_id: competency } : {}), ...(competencyFilter ? { competencia_id: competencyFilter } : {}) }
  const query = useQuery({ queryKey: ['deliverables', filters, page], queryFn: () => api.get('/deliverables', { params: { ...filters, page } }).then((response) => response.data) })
  const refresh = () => client.invalidateQueries({ queryKey: ['deliverables'] })
  const competencies = (catalogs.data?.competencies || []).filter((item) => !subject || Number(item.asignatura_id) === Number(subject))
  const filtered = competencyFilter ? (catalogs.data?.competencies || []).find((item) => Number(item.id) === Number(competencyFilter)) : null
  const remove = async (deliverable) => {
    if (!(await confirmAction({ title: 'Eliminar entregable', text: '¿Eliminar este entregable?', confirmText: 'Sí, eliminar', danger: true }))) return
    try { await api.delete(`/deliverables/${deliverable.id}`); toast.success('Entregable eliminado'); refresh() } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <Page title="Gestión de entregables" subtitle={competencyFilter ? (filtered ? `Mostrando entregables de la competencia ${filtered.nombre}` : 'Mostrando entregables filtrados por competencia') : 'Entregables por proyecto, materia y competencia.'}
      actions={<>
        {competencyFilter && <Button variant="ghost" icon={FiX} onClick={() => setParams({})}>Quitar filtro</Button>}
        <Button icon={FiPlus} onClick={() => setSheet({ type: 'form', deliverable: null })}>Nuevo entregable</Button>
      </>}>
      {!competencyFilter && (
        <div className="toolbar">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Nombre del entregable" />
          <select className="control grow" aria-label="Materia" value={subject} onChange={(event) => { setSubject(event.target.value); setCompetency(''); setPage(1) }}>
            <option value="">Todas las materias</option>
            {(catalogs.data?.subjects || []).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <select className="control grow" aria-label="Competencia" value={competency} onChange={(event) => { setCompetency(event.target.value); setPage(1) }}>
            <option value="">Todas las competencias</option>
            {competencies.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </div>
      )}
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable rows={query.data?.data || []} empty={<Empty title="Sin entregables" message="No hay entregables con estos filtros." />}
            columns={[
              { key: 'nombre', label: 'Entregable', primary: true, render: (item) => <span className="cell-main"><strong>{item.nombre}</strong><small>{item.project?.title || item.project_title || 'Sin proyecto'}</small></span> },
              { key: 'competencia', label: 'Competencia', render: (item) => item.competencia?.nombre || item.asignatura?.nombre || '—' },
              { key: 'calificacion', label: 'Calificación', render: (item) => <GradeBadge grade={item.calificacion} /> },
              { key: 'archivo', label: 'Archivo', render: (item) => (item.archivo_path ? <Badge tone="info">Con archivo</Badge> : '—') },
              { key: 'estado', label: 'Estado', render: (item) => <Badge>{item.estado || 'pendiente'}</Badge> },
            ]}
            actions={(item) => <>
              <IconButton icon={FiEdit2} label="Editar" onClick={() => setSheet({ type: 'form', deliverable: item })} />
              <IconButton icon={FiStar} label="Calificar" onClick={() => setSheet({ type: 'grade', deliverable: item })} />
              {item.archivo_path && <IconButton icon={FiDownload} label="Descargar" onClick={() => download(item)} />}
              <IconButton icon={FiUploadCloud} label="Subir archivo" onClick={() => setSheet({ type: 'upload', deliverable: item })} />
              <IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={() => remove(item)} />
            </>} />
        )}
        <Pager meta={query.data} onPage={setPage} />
      </Card>
      {sheet?.type === 'form' && <DeliverableForm deliverable={sheet.deliverable} catalogs={catalogs.data} defaultSubject={competencyFilter} onClose={() => setSheet(null)} onSaved={refresh} />}
      {sheet?.type === 'grade' && <GradeSheet deliverable={sheet.deliverable} current={sheet.deliverable.calificacion} onClose={() => setSheet(null)} onSaved={refresh} />}
      {sheet?.type === 'upload' && <UploadSheet deliverable={sheet.deliverable} onClose={() => setSheet(null)} onSaved={refresh} />}
    </Page>
  )
}

function DeliverableForm({ deliverable, catalogs, defaultSubject, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_id: deliverable?.project_id || '', asignatura_id: deliverable?.asignatura_id || defaultSubject || '', nombre: deliverable?.nombre || '',
    descripcion: deliverable?.descripcion || '', tipo_documento: deliverable?.tipo_documento || 'documento', estado: deliverable?.estado || 'pendiente',
    rama_asociada: deliverable?.rama_asociada || '', autores: deliverable?.autores || '',
    fecha_limite: String(deliverable?.fecha_limite || '').replace(' ', 'T').slice(0, 16),
  })
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => {
    event.preventDefault()
    const data = { ...form, fecha_limite: form.fecha_limite || null, project_id: form.project_id || null, asignatura_id: form.asignatura_id || null, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, rama_asociada: form.rama_asociada.trim() || null, autores: form.autores.trim() || null }
    setSaving(true)
    try {
      if (deliverable) await api.put(`/deliverables/${deliverable.id}`, data)
      else await api.post('/deliverables', data)
      toast.success('Entregable guardado correctamente')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  return (
    <Sheet open title={deliverable ? 'Editar entregable' : 'Nuevo entregable'} onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="deliverable-form" icon={FiSave} loading={saving}>Guardar</Button></>}>
      <form id="deliverable-form" className="form-grid" onSubmit={submit}>
        <Field label="Proyecto" full><select className="control" value={form.project_id} onChange={set('project_id')}><option value="">Selecciona un proyecto</option>{(catalogs?.projects || []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></Field>
        <Field label="Asignatura" full><select className="control" required value={form.asignatura_id} onChange={set('asignatura_id')}><option value="">Selecciona una asignatura</option>{(catalogs?.subjects || []).map((subject) => <option key={subject.id} value={subject.id}>{subject.nombre}</option>)}</select></Field>
        <Field label="Nombre" full><input className="control" required value={form.nombre} onChange={set('nombre')} /></Field>
        <Field label="Descripción" full><textarea className="control" rows={3} value={form.descripcion} onChange={set('descripcion')} /></Field>
        <Field label="Tipo"><select className="control" value={form.tipo_documento} onChange={set('tipo_documento')}>{[['documento', 'Documento'], ['reporte', 'Reporte'], ['video', 'Video'], ['presentacion', 'Presentación'], ['codigo', 'Código'], ['otro', 'Otro']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Estado"><select className="control" value={form.estado} onChange={set('estado')}>{[['pendiente', 'Pendiente'], ['enviado', 'Enviado'], ['revisado', 'Revisado'], ['aprobado', 'Aprobado']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Fecha límite" hint="Los alumnos inscritos reciben recordatorios 7, 3 y 1 día antes." full><input className="control" type="datetime-local" min={String(deliverable?.fecha_limite || '').replace(' ', 'T').slice(0, 16) === form.fecha_limite ? undefined : nextMinute()} value={form.fecha_limite} onChange={set('fecha_limite')} /></Field>
        <Field label="Rama asociada"><input className="control" value={form.rama_asociada} onChange={set('rama_asociada')} /></Field>
        <Field label="Autores"><input className="control" value={form.autores} onChange={set('autores')} /></Field>
      </form>
    </Sheet>
  )
}

/** Entregables de los proyectos que asesora el docente, por alumno (Frontend_Swgpi/pages/teacher/my-deliverables.php). */
function TeacherDeliverables() {
  const client = useQueryClient()
  const [student, setStudent] = useState('')
  const [subject, setSubject] = useState('')
  const [grading, setGrading] = useState(null)
  const debounced = useDebounced(student)
  const params = { ...(debounced.trim() ? { student: debounced.trim() } : {}), ...(subject ? { asignatura_id: subject } : {}) }
  const query = useQuery({ queryKey: ['deliverables-matrix', params], queryFn: () => api.get('/teacher/deliverables-matrix', { params }).then((response) => response.data.data || []), placeholderData: (previous) => previous })
  const subjects = [...new Map((query.data || []).flatMap((project) => project.subjects || []).map((item) => [String(item.id), item])).values()].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'))
  return (
    <Page title="Entregables de mis proyectos" subtitle="Entregas realizadas y faltantes por alumno, materia y competencia." actions={<Button variant="ghost" icon={FiRefreshCw} onClick={() => query.refetch()}>Actualizar</Button>}>
      <div className="toolbar">
        <SearchInput value={student} onChange={setStudent} placeholder="No. de control, nombre o apellido" />
        <select className="control grow" aria-label="Materia" value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="">Todas las materias</option>
          {subjects.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.clave ? ` - ${item.clave}` : ''}</option>)}
        </select>
      </div>
      {query.isLoading ? <Loading rows={4} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !(query.data || []).length ? <Empty message="No hay proyectos asesorados con alumnos para los filtros seleccionados." /> : query.data.map((block) => (
        <section key={block.project.id} className="stack">
          <h2 className="section-title">{block.project.title} <small className="muted">· Semestre {block.project.semestre || '–'} · {block.project.year || '–'}</small></h2>
          {(block.students || []).map((studentBlock, index) => (
            <details key={studentBlock.student.id} className="card-app student-block" open={index === 0}>
              <summary>
                <strong>{studentBlock.student.id} - {fullName(studentBlock.student)}</strong>
                <span className="row-wrap">
                  <Badge>{studentBlock.student.semestre || '–'} {studentBlock.student.grupo || ''}</Badge>
                  <Badge tone="success">{studentBlock.summary?.entregados || 0} entregados</Badge>
                  <Badge>{studentBlock.summary?.faltantes || 0} faltantes</Badge>
                  <Badge tone="info">Promedio válido: {studentBlock.summary?.promedio == null ? '–' : `${studentBlock.summary.promedio}%`}</Badge>
                </span>
              </summary>
              <DataTable rowKey="key" rows={(studentBlock.items || []).map((item, itemIndex) => ({ ...item, key: `${item.deliverable?.id || 'f'}-${itemIndex}` }))}
                columns={[
                  { key: 'materia', label: 'Materia', primary: true, render: (item) => <span className="cell-main"><strong>{item.asignatura?.nombre || '—'}</strong><small>{item.competencia?.nombre || item.asignatura?.clave || ''}</small></span> },
                  { key: 'estado', label: 'Estado', render: (item) => (item.status === 'faltante' ? <Badge>Faltante</Badge> : item.approved ? <Badge tone="success">Entregado aprobado</Badge> : item.calificacion == null ? <Badge tone="info">Entregado sin calificar</Badge> : <Badge tone="danger">Reprobatorio</Badge>) },
                  { key: 'calificacion', label: 'Calificación', render: (item) => (item.calificacion == null ? <span className="muted">Sin calificar</span> : <span className="cell-main"><strong>{Number(item.calificacion).toFixed(2)}%</strong><small>Efectiva: {Number(item.calificacion_efectiva || 0).toFixed(2)}%</small></span>) },
                ]}
                actions={(item) => (item.deliverable ? <>
                  {item.deliverable.archivo_path && <IconButton icon={FiDownload} label="Descargar" onClick={() => download(item.deliverable)} />}
                  <IconButton icon={FiStar} label="Calificar" onClick={() => setGrading({ deliverable: item.deliverable, current: item.calificacion })} />
                </> : <small className="muted">No entregado</small>)} />
            </details>
          ))}
        </section>
      ))}
      {grading && <GradeSheet deliverable={grading.deliverable} current={grading.current} onClose={() => setGrading(null)} onSaved={() => client.invalidateQueries({ queryKey: ['deliverables-matrix'] })} />}
    </Page>
  )
}

/** Entregables del alumno (Frontend_Swgpi/pages/student/my-deliverables.php). */
function StudentDeliverables() {
  const client = useQueryClient()
  const [uploading, setUploading] = useState(null)
  const query = useQuery({ queryKey: ['my-deliverables'], queryFn: () => api.get('/my-deliverables').then((response) => response.data.data || []) })
  return (
    <Page title="Mis entregables" subtitle="Sube tus archivos y consulta tus calificaciones.">
      {query.isLoading ? <Loading rows={4} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !(query.data || []).length ? <Empty message="No hay entregables asignados." /> : (
        <div className="grid-2">
          {query.data.map((item) => {
            const grader = item.calificadoPor || item.calificado_por
            return (
              <Card key={item.id} title={item.nombre} subtitle={item.project?.title || 'N/A'} actions={<Badge tone={item.estado === 'completado' ? 'success' : 'warning'}>{item.estado === 'completado' ? 'Completado' : 'Pendiente'}</Badge>}>
                <p className="muted small-text">{item.descripcion || 'Sin descripción'}</p>
                <dl className="meta-grid">
                  <div><dt>Calificación</dt><dd><GradeBadge grade={item.calificacion} /></dd></div>
                  <div><dt>Archivo</dt><dd>{item.file_path ? 'Presente' : '—'}</dd></div>
                </dl>
                {item.fecha_calificacion && <p className="small-text text-success"><FiCheckCircle /> Calificado el {formatDate(item.fecha_calificacion)} por {grader && typeof grader === 'object' ? fullName(grader) : 'Sistema'}</p>}
                <small className="muted">Creado: {formatDate(item.created_at)}</small>
                <div className="row-wrap mt-2">
                  {item.file_path && <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => download(item)}>Descargar</Button>}
                  <Button size="sm" icon={FiUploadCloud} className="grow-btn" onClick={() => setUploading(item)}>Subir o actualizar archivo</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {uploading && <UploadSheet deliverable={uploading} onClose={() => setUploading(null)} onSaved={() => client.invalidateQueries({ queryKey: ['my-deliverables'] })} />}
    </Page>
  )
}
