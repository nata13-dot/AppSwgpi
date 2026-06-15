import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiExternalLink, FiPlus } from 'react-icons/fi'
import api, { apiError } from '../services/api'
import { formatDate, fullName } from '../utils/formatters'
import { Empty, ErrorState, Loading, PageHeader, Pagination, SearchField, StatusBadge, useDebounced } from '../components/common/Ui'

const configs = {
  users: {
    endpoint: '/users', title: 'Usuarios', eyebrow: 'Administración', description: 'Consulta y filtra las cuentas del sistema.',
    columns: [['ID', 'id'], ['Nombre', (item) => fullName(item)], ['Correo', (item) => item.email || 'Sin correo'], ['Perfil', (item) => ({ 1: 'Administrador', 2: 'Docente', 3: 'Estudiante' })[item.perfil_id]], ['Estado', (item) => <StatusBadge value={item.activo ? 'activo' : 'inactivo'} />]],
  },
  projects: {
    endpoint: '/projects', title: 'Proyectos y tesis', eyebrow: 'Gestión académica', description: 'Seguimiento de proyectos integradores, propuestas y tesis.',
    columns: [['Proyecto', 'title'], ['Autores', (item) => item.authors || item.students?.map(fullName).join(', ') || 'Sin asignar'], ['Semestre', (item) => item.semestre || item.subject_group?.semestre || '—'], ['Registro', (item) => formatDate(item.created_at)], ['Estado', (item) => <StatusBadge value={item.proposal_status || (item.activo ? 'activo' : 'inactivo')} />]],
  },
  evaluations: {
    endpoint: '/evaluations', title: 'Evaluaciones', eyebrow: 'Evaluación', description: 'Salas, rúbricas y resultados de evaluación.',
    columns: [['Evaluación', (item) => item.title || item.nombre || `Evaluación #${item.id}`], ['Proyecto', (item) => item.project?.title || item.project_title || '—'], ['Fecha', (item) => formatDate(item.scheduled_at || item.fecha || item.created_at)], ['Estado', (item) => <StatusBadge value={item.status || item.estado} />]],
  },
  academics: {
    endpoint: '/asignaturas', title: 'Gestión académica', eyebrow: 'Asignaturas', description: 'Catálogo de asignaturas y competencias.',
    columns: [['Clave', (item) => item.clave || item.codigo || item.id], ['Asignatura', (item) => item.nombre || item.name], ['Semestre', (item) => item.semestre || '—'], ['Estado', (item) => <StatusBadge value={item.activo === false ? 'inactivo' : 'activo'} />]],
  },
}

export default function ResourceList({ type }) {
  const config = configs[type]
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search)
  const query = useQuery({
    queryKey: [type, page, q],
    queryFn: () => api.get(config.endpoint, { params: { page, q, per_page: 12 } }).then((r) => r.data),
  })
  const payload = query.data
  const rows = Array.isArray(payload) ? payload : payload?.data || []
  return (
    <>
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actions={<button className="btn-primary-app compact"><FiPlus /> Nuevo registro</button>} />
      <section className="panel">
        <div className="table-toolbar"><SearchField value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder={`Buscar en ${config.title.toLowerCase()}...`} /></div>
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : rows.length === 0 ? <Empty /> : (
          <div className="table-responsive">
            <table className="data-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{label}</th>)}<th aria-label="Acciones" /></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id}>{config.columns.map(([label, accessor]) => <td key={label} data-label={label}>{typeof accessor === 'function' ? accessor(row) : row[accessor]}</td>)}<td><button className="icon-action" aria-label="Ver detalle"><FiExternalLink /></button></td></tr>)}</tbody>
            </table>
          </div>
        )}
        <Pagination meta={payload} onPage={setPage} />
      </section>
    </>
  )
}
