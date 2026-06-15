import { useQuery } from '@tanstack/react-query'
import { FiCalendar, FiClock, FiMapPin } from 'react-icons/fi'
import api, { apiError } from '../services/api'
import { Empty, ErrorState, Loading, PageHeader, StatusBadge } from '../components/common/Ui'
import { formatDate } from '../utils/formatters'

export default function StudentEvaluations() {
  const query = useQuery({
    queryKey: ['student-evaluation-schedule'],
    queryFn: () => api.get('/student/evaluation-schedule').then((response) => response.data),
  })
  return <>
    <PageHeader eyebrow="Evaluación" title="Mis evaluaciones" description="Consulta el horario, sala y duración programada para tu proyecto." />
    {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : !query.data?.length ? <section className="panel"><Empty title="Sin evaluaciones programadas" /></section> : <div className="student-evaluation-grid">{query.data.map((item, index) => <article className="panel student-evaluation-card" key={`${item.project_title}-${index}`}>
      <header><div><span className="eyebrow">Semestre {item.semester}</span><h2>{item.project_title}</h2></div><StatusBadge value={item.room_name ? 'programada' : 'pendiente'} /></header>
      <div className="student-schedule-facts">
        <span><FiCalendar /><strong>{formatDate(item.date)}</strong></span>
        <span><FiMapPin /><strong>{item.room_name || 'Sala pendiente'} · {item.classroom || 'Salón pendiente'}</strong></span>
        <span><FiClock /><strong>{item.presentation_minutes || '-'} min exposición · {item.evaluation_minutes || '-'} min evaluación</strong></span>
      </div>
    </article>)}</div>}
  </>
}
