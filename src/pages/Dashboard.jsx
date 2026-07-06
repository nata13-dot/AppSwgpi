import { createElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCheckCircle, FiClock, FiFileText, FiFolder, FiTrendingUp, FiUsers } from 'react-icons/fi'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import api, { apiError } from '../services/api'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { formatDate, fullName, statusLabel } from '../utils/formatters'
import { ErrorState, Loading, PageHeader, StatusBadge } from '../components/common/Ui'

const colors = ['#1f6f5c', '#d9a62e', '#256d9b', '#b85c55', '#754f8f']

export default function Dashboard() {
  const { user } = useAuth()
  const role = roleFromUser(user)
  const endpoint = role === 'admin' ? '/dashboard/stats' : `/dashboard/${role}`
  const query = useQuery({ queryKey: ['dashboard', role], queryFn: () => api.get(endpoint).then((r) => r.data) })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const data = query.data
  const cards = role === 'admin'
    ? [['Usuarios activos', data.stats.active_users, FiUsers], ['Proyectos activos', data.stats.active_projects, FiFolder], ['Entregables pendientes', data.stats.pending_deliverables, FiClock], ['Avance de entregas', `${data.stats.deliverable_completion_rate}%`, FiTrendingUp]]
    : [['Mis proyectos', data.stats.my_projects, FiFolder], ['Entregables pendientes', data.stats.pending_deliverables, FiClock], ['Entregables aprobados', data.stats.approved_deliverables ?? data.stats.completed_deliverables, FiCheckCircle], ['Avance general', `${data.stats.deliverable_completion_rate}%`, FiTrendingUp]]
  const chartData = Object.entries(data.charts?.deliverables_by_status || {}).map(([name, value]) => ({ name: statusLabel(name), value }))

  return (
    <>
      <PageHeader eyebrow="Panel principal" title={`Hola, ${user?.nombres}`} description="Aquí tienes el estado más reciente de la actividad académica." />
      <section className="stats-grid">
        {cards.map(([label, value, Icon], index) => <article className="stat-card" key={label}><span className={`stat-icon color-${index}`}>{createElement(Icon)}</span><div><small>{label}</small><strong>{value ?? 0}</strong></div></article>)}
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Seguimiento</span><h2>Estado de entregables</h2></div></div>
          {chartData.some((item) => item.value > 0) ? <div className="chart-wrap">
            <div className="chart-canvas"><ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={190}
              initialDimension={{ width: 320, height: 230 }}
              debounce={80}
            ><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="72%" paddingAngle={3}>{chartData.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="chart-legend">{chartData.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}<strong>{item.value}</strong></span>)}</div>
          </div> : <div className="chart-empty"><FiFileText /> Aún no hay entregables registrados.</div>}
        </article>
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Actividad</span><h2>Proyectos recientes</h2></div></div>
          <div className="activity-list">
            {(data.recent_projects || data.projects || []).length ? (data.recent_projects || data.projects).map((project) => (
              <div className="activity-item" key={project.id}>
                <span className="activity-icon"><FiFolder /></span>
                <div><strong>{project.title}</strong><small>{project.creator ? `Por ${fullName(project.creator)} · ` : ''}{formatDate(project.created_at)}</small></div>
                {project.proposal_status && <StatusBadge value={project.proposal_status} />}
              </div>
            )) : <div className="chart-empty">No hay proyectos recientes.</div>}
          </div>
        </article>
      </section>
    </>
  )
}
