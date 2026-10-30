import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiCalendar, FiEye, FiUsers } from 'react-icons/fi'
import api from '../../services/api'
import { formatDate } from '../../utils/formatters'
import { Badge, Button, Card, Empty, ErrorState, Loading, Page, Tabs } from '../../components/ui'
import { authors, ProjectDetails } from './projectShared'

// Cada categoría se muestra por separado: no se mezclan tesis, dual, casos e integradores.
const CATEGORIES = [
  { key: 'proyecto_integrador', label: 'Proyectos integradores' }, { key: 'dual', label: 'Modalidad dual' },
  { key: 'caso_integrador', label: 'Casos integradores' }, { key: 'tesis', label: 'Tesis' },
]
const categoryOf = (project) => {
  if (project.tipo === 'tesis' || project.is_thesis) return 'tesis'
  return CATEGORIES.some((category) => category.key === project.modalidad) ? project.modalidad : 'proyecto_integrador'
}

/** Proyectos que asesora el docente (Frontend_Swgpi/pages/teacher/my-projects.php). */
export default function TeacherProjects() {
  const query = useQuery({ queryKey: ['my-projects'], queryFn: () => api.get('/my-projects').then((response) => response.data.data || []) })
  const [chosen, setCategory] = useState(null)
  const [details, setDetails] = useState(null)
  const projects = useMemo(() => query.data || [], [query.data])
  // Por omisión, la primera categoría que tenga proyectos.
  const category = chosen ?? CATEGORIES.find((item) => projects.some((project) => categoryOf(project) === item.key))?.key ?? null

  const visible = projects.filter((project) => categoryOf(project) === category)
  return (
    <Page title="Mis proyectos" subtitle="Proyectos y tesis que asesoras, separados por modalidad.">
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : !projects.length ? <Empty title="Sin proyectos" message="No tienes proyectos asignados aún." /> : (
        <>
          <Tabs value={category} onChange={setCategory} items={CATEGORIES.map((item) => ({ ...item, count: projects.filter((project) => categoryOf(project) === item.key).length }))} />
          {!visible.length ? <Empty message="No tienes proyectos en esta categoría." /> : (
            <div className="grid-2">
              {visible.map((project) => (
                <Card key={project.id} title={project.title} actions={<Badge tone="info">{project.year || '—'}</Badge>}>
                  <p className="muted small-text clamp-3">{project.descripcion || project.description || 'Sin descripción'}</p>
                  <div className="row-wrap muted small-text mt-2"><FiUsers /> {project.students_count || 0} estudiantes <FiCalendar /> Creado: {formatDate(project.created_at)}</div>
                  {authors(project, '') && <p className="small-text mt-2"><strong>Integrantes:</strong> {authors(project)}</p>}
                  <Button variant="soft" icon={FiEye} className="w-100 mt-3" onClick={() => setDetails(project.id)}>Ver {category === 'tesis' ? 'tesis' : 'proyecto'}</Button>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {details && <ProjectDetails projectId={details} onClose={() => setDetails(null)} />}
    </Page>
  )
}
