import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheckCircle, FiPlus, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { confirmAction, ErrorState, Loading, Modal, PageHeader, StatusBadge } from '../components/common/Ui'
import { formatDate } from '../utils/formatters'

export default function Semesters() {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', starts_at: '', ends_at: '', automatic_promotion: true })
  const query = useQuery({ queryKey: ['semester-management'], queryFn: () => api.get('/semester-management').then((response) => response.data) })
  const create = useMutation({
    mutationFn: () => api.post('/semester-management/periods', form),
    onSuccess: () => { toast.success('Periodo creado.'); setOpen(false); client.invalidateQueries({ queryKey: ['semester-management'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const action = useMutation({
    mutationFn: ({ id, type }) => api.post(`/semester-management/periods/${id}/${type}`),
    onSuccess: () => { toast.success('Operación completada.'); client.invalidateQueries({ queryKey: ['semester-management'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const data = query.data
  const promote = async (period) => {
    if (await confirmAction({ title: 'Promover estudiantes', text: `Se aplicará la promoción del periodo ${period.nombre}.`, confirmText: 'Aplicar promoción' })) action.mutate({ id: period.id, type: 'promote' })
  }
  return <>
    <PageHeader eyebrow="Académico" title="Semestres y periodos" description="Controla vigencias académicas, grupos y promoción de estudiantes." actions={<button className="btn-primary-app compact" onClick={() => setOpen(true)}><FiPlus /> Nuevo periodo</button>} />
    <section className="stats-grid">
      {Object.entries(data.stats || {}).map(([key, value]) => <article className="stat-card" key={key}><div><small>{({ students: 'Estudiantes', projects: 'Proyectos', groups: 'Grupos', exceptions: 'Excepciones' })[key]}</small><strong>{value}</strong></div></article>)}
    </section>
    <section className="panel"><div className="table-responsive"><table className="data-table"><thead><tr><th>Periodo</th><th>Inicio</th><th>Fin</th><th>Grupos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {data.periods.map((period) => <tr key={period.id}><td className="mobile-primary-cell" data-label="Periodo"><strong>{period.nombre}</strong></td><td data-label="Inicio">{formatDate(period.fecha_inicio)}</td><td data-label="Fin">{formatDate(period.fecha_fin)}</td><td data-label="Grupos">{period.subject_groups_count}</td><td data-label="Estado"><StatusBadge value={period.id === data.active_period_id ? 'activo' : 'inactivo'} /></td><td className="row-actions" data-label="Acciones">{period.id !== data.active_period_id && <button onClick={() => action.mutate({ id: period.id, type: 'activate' })}><FiCheckCircle /> Activar</button>}<button onClick={() => promote(period)}><FiRefreshCw /> Promover</button></td></tr>)}
    </tbody></table></div></section>
    <Modal open={open} title="Nuevo periodo académico" onClose={() => setOpen(false)}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><div className="form-grid">
      <label>Nombre<input required placeholder="2026-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Inicio<input required type="date" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
      <label>Fin<input required type="date" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
      <label className="switch-field"><input type="checkbox" checked={form.automatic_promotion} onChange={(event) => setForm({ ...form, automatic_promotion: event.target.checked })} /><span>Promoción automática</span></label>
    </div><div className="modal-actions"><button type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="btn-primary-app compact">Crear periodo</button></div></form></Modal>
  </>
}
