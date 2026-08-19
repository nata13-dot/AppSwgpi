import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiEdit2, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { confirmAction, ErrorState, Loading, Modal, PageHeader, StatusBadge } from '../components/common/Ui'
import { formatDate } from '../utils/formatters'

export default function Semesters() {
  const client = useQueryClient()
  const [view, setView] = useState('periods')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(null)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState(null)
  const [exception, setException] = useState({ period_id: '', presentation_semester: 5, reason: '' })
  const [form, setForm] = useState({ name: '', starts_at: '', ends_at: '', automatic_promotion: true })
  const query = useQuery({ queryKey: ['semester-management'], queryFn: () => api.get('/semester-management').then((response) => response.data) })
  const searchQuery = useQuery({ queryKey: ['semester-search', search], queryFn: () => api.get('/semester-management/search', { params: { q: search } }).then((response) => response.data), enabled: search.trim().length >= 2 })
  const create = useMutation({
    mutationFn: () => editing ? api.put(`/semester-management/periods/${editing.id}`, form) : api.post('/semester-management/periods', form),
    onSuccess: () => { toast.success(editing ? 'Periodo actualizado.' : 'Periodo creado.'); setOpen(false); setEditing(null); client.invalidateQueries({ queryKey: ['semester-management'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const action = useMutation({
    mutationFn: ({ id, type }) => api.post(`/semester-management/periods/${id}/${type}`),
    onSuccess: () => { toast.success('Operación completada.'); client.invalidateQueries({ queryKey: ['semester-management'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const exceptionMutation = useMutation({
    mutationFn: ({ method = 'post', endpoint, body }) => api[method](endpoint, body),
    onSuccess: ({ data }) => { toast.success(data.message || 'Excepción actualizada.'); setTarget(null); setSearch(''); client.invalidateQueries({ queryKey: ['semester-management'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const data = query.data
  const promote = async (period) => {
    try { setPreview((await api.get(`/semester-management/periods/${period.id}/promotion-preview`)).data) } catch (error) { toast.error(apiError(error)) }
  }
  const edit = (period) => { setEditing(period); setForm({ name: period.nombre, starts_at: String(period.fecha_inicio || '').slice(0, 10), ends_at: String(period.fecha_fin || '').slice(0, 10), automatic_promotion: Boolean(period.promocion_automatica) }); setOpen(true) }
  const newPeriod = () => { setEditing(null); setForm({ name: '', starts_at: '', ends_at: '', automatic_promotion: true }); setOpen(true) }
  const saveException = (event) => { event.preventDefault(); if (!target) return toast.warning('Selecciona un alumno o proyecto.'); exceptionMutation.mutate({ endpoint: '/semester-management/exceptions', body: { ...exception, period_id: Number(exception.period_id), presentation_semester: Number(exception.presentation_semester), project_id: target.type === 'project' ? target.id : null, student_id: target.type === 'student' ? target.id : null } }) }
  return <>
    <PageHeader eyebrow="Académico" title="Semestres y periodos" description="Controla vigencias académicas, promoción y presentaciones especiales." actions={<button className="btn-primary-app compact" onClick={newPeriod}><FiPlus /> Nuevo periodo</button>} />
    <section className="stats-grid">
      {Object.entries(data.stats || {}).map(([key, value]) => <article className="stat-card" key={key}><div><small>{({ students: 'Estudiantes', projects: 'Proyectos', groups: 'Grupos', exceptions: 'Excepciones' })[key]}</small><strong>{value}</strong></div></article>)}
    </section>
    <div className="module-tabs"><button className={view === 'periods' ? 'active' : ''} onClick={() => setView('periods')}>Periodos</button><button className={view === 'exceptions' ? 'active' : ''} onClick={() => setView('exceptions')}>Presentaciones especiales</button></div>
    {view === 'periods' ? <section className="panel"><div className="table-responsive"><table className="data-table"><thead><tr><th>Periodo</th><th>Inicio</th><th>Fin</th><th>Grupos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {data.periods.map((period) => <tr key={period.id}><td className="mobile-primary-cell" data-label="Periodo"><strong>{period.nombre}</strong></td><td data-label="Inicio">{formatDate(period.fecha_inicio)}</td><td data-label="Fin">{formatDate(period.fecha_fin)}</td><td data-label="Grupos">{period.subject_groups_count}</td><td data-label="Estado"><StatusBadge value={period.id === data.active_period_id ? 'activo' : 'inactivo'} /></td><td className="row-actions" data-label="Acciones"><button onClick={() => edit(period)}><FiEdit2 /> Editar</button>{period.id !== data.active_period_id && <button onClick={() => action.mutate({ id: period.id, type: 'activate' })}><FiCheckCircle /> Activar</button>}<button onClick={() => promote(period)}><FiRefreshCw /> Promover</button></td></tr>)}
    </tbody></table></div></section> : <section className="semester-exception-layout"><form className="panel proposal-form" onSubmit={saveException}><h2>Autorizar presentación especial</h2><label>Periodo<select required value={exception.period_id} onChange={(event) => setException({ ...exception, period_id: event.target.value })}><option value="">Selecciona</option>{data.periods.map((period) => <option key={period.id} value={period.id}>{period.nombre}</option>)}</select></label><label>Alumno o proyecto<div className="search-input-row"><FiSearch /><input value={search} onChange={(event) => { setSearch(event.target.value); setTarget(null) }} placeholder="Nombre, matrícula o proyecto" /></div></label>{searchQuery.data && !target && <div className="semester-search-results">{searchQuery.data.students?.map((student) => <button type="button" key={`s-${student.id}`} onClick={() => { setTarget({ type: 'student', id: student.id, label: `${student.id} · ${student.nombres}` }); setSearch(`${student.id} · ${student.nombres}`) }}>Alumno · {student.id} · {student.nombres} {student.apellido_paterno}</button>)}{searchQuery.data.projects?.map((project) => <button type="button" key={`p-${project.id}`} onClick={() => { setTarget({ type: 'project', id: project.id, label: project.titulo }); setSearch(project.titulo) }}>Proyecto · {project.titulo}</button>)}</div>}<label>Semestre de presentación<select value={exception.presentation_semester} onChange={(event) => setException({ ...exception, presentation_semester: event.target.value })}>{[5, 6, 7, 8, 9].map((semester) => <option key={semester}>{semester}</option>)}</select></label><label>Motivo<textarea rows="3" maxLength="500" value={exception.reason} onChange={(event) => setException({ ...exception, reason: event.target.value })} /></label><button className="btn-primary-app compact" disabled={!target || exceptionMutation.isPending}><FiPlus /> Guardar excepción</button></form><section className="panel"><h2>Excepciones vigentes</h2>{data.exceptions.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Periodo</th><th>Alumno o proyecto</th><th>Presenta en</th><th>Acción</th></tr></thead><tbody>{data.exceptions.map((item) => <tr key={item.id}><td data-label="Periodo">{item.period?.nombre || '—'}</td><td data-label="Alumno o proyecto" className="mobile-primary-cell">{item.student ? `${item.student.id} · ${item.student.nombres} ${item.student.apellido_paterno || ''}` : item.project?.titulo || '—'}</td><td data-label="Presenta en">{item.semestre_presentacion}° semestre</td><td data-label="Acción" className="row-actions"><button className="danger" onClick={async () => { if (await confirmAction({ title: 'Eliminar excepción' })) exceptionMutation.mutate({ method: 'delete', endpoint: `/semester-management/exceptions/${item.id}` }) }}><FiTrash2 /> Quitar</button></td></tr>)}</tbody></table></div> : <p className="text-muted">No existen presentaciones especiales.</p>}</section></section>}
    <Modal open={open} title={editing ? 'Editar periodo académico' : 'Nuevo periodo académico'} onClose={() => { setOpen(false); setEditing(null) }}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><div className="form-grid">
      <label>Nombre<input required placeholder="2026-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Inicio<input required type="date" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
      <label>Fin<input required type="date" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
      <label className="switch-field"><input type="checkbox" checked={form.automatic_promotion} onChange={(event) => setForm({ ...form, automatic_promotion: event.target.checked })} /><span>Promoción automática</span></label>
    </div><div className="modal-actions"><button type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary-app compact">{editing ? 'Guardar cambios' : 'Crear periodo'}</button></div></form></Modal>
    <Modal open={Boolean(preview)} title="Vista previa de promoción" onClose={() => setPreview(null)}>{preview && <div className="promotion-preview"><p>Periodo <strong>{preview.period?.nombre}</strong>. Solo se moverán estudiantes a semestres válidos para este periodo.</p>{preview.movements?.length ? preview.movements.map((movement) => <article key={`${movement.from}-${movement.to}`}><span>{movement.from}° → {movement.to}°</span><strong>{movement.students} estudiante(s)</strong></article>) : <p>No hay movimientos elegibles.</p>}<div className="modal-actions"><button onClick={() => setPreview(null)}>Cancelar</button><button className="btn-primary-app compact" disabled={!preview.movements?.length} onClick={() => { action.mutate({ id: preview.period.id, type: 'promote' }); setPreview(null) }}>Aplicar promoción</button></div></div>}</Modal>
  </>
}
