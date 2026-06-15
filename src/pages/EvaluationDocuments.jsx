import { useQuery } from '@tanstack/react-query'
import { FiDownload, FiFileText } from 'react-icons/fi'
import api, { API_URL, apiError } from '../services/api'
import { Empty, ErrorState, Loading, PageHeader, StatusBadge } from '../components/common/Ui'
import { formatDate } from '../utils/formatters'

export default function EvaluationDocuments() {
  const query = useQuery({ queryKey: ['evaluation-documents'], queryFn: () => api.get('/repositorio/evaluation-documents').then((response) => response.data) })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const documents = query.data?.data?.data || query.data?.data || []
  return <>
    <PageHeader eyebrow="Evaluación" title="Documentos de evaluación" description="Consulta hojas de liberación, presentaciones y archivos vinculados a evaluaciones." />
    {documents.length === 0 ? <Empty title="Sin documentos" /> : <section className="document-grid">{documents.map((document) => <article className="document-card" key={document.id}><div className="document-cover"><FiFileText /><span>DOC</span></div><div><StatusBadge value={document.release_status || document.status || 'pendiente'} /><h2>{document.title || document.titulo || document.nombre}</h2><p>{document.project?.title || 'Documento de evaluación'}</p><small>{formatDate(document.created_at)}</small><a href={`${API_URL}/repositorio/${document.id}/download`}><FiDownload /> Descargar</a></div></article>)}</section>}
  </>
}
