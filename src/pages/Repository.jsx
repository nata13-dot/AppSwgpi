import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiDownload, FiFileText, FiSearch } from 'react-icons/fi'
import api, { API_URL, apiError } from '../services/api'
import { formatDate } from '../utils/formatters'
import { Empty, ErrorState, Loading, PageHeader, Pagination, StatusBadge, useDebounced } from '../components/common/Ui'

export default function Repository({ publicView = false }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search)
  const query = useQuery({
    queryKey: ['repository', page, q],
    queryFn: () => api.get(q ? '/repositorio/buscar' : '/repositorio', { params: { page, q } }).then((r) => r.data),
  })
  const payload = query.data
  const documents = payload?.data || []
  return (
    <main className={publicView ? 'public-repository' : ''}>
      {publicView && <header className="public-nav"><a href="/"><img src="/images/itssmt.webp" alt="ITSSMT" /><strong>SGPI ITSSMT</strong></a><a href="/login">Iniciar sesión</a></header>}
      <div className={publicView ? 'public-content' : ''}>
        <PageHeader eyebrow="Acervo digital" title="Repositorio institucional" description="Consulta proyectos, tesis y documentos publicados por la comunidad tecnológica." />
        <section className="repository-search"><FiSearch /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Buscar por título, autor, proyecto o palabra clave..." /></section>
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : documents.length === 0 ? <Empty title="No encontramos documentos" message="Prueba con otros términos de búsqueda." /> : (
          <section className="document-grid">{documents.map((document) => <article className="document-card" key={document.id}>
            <div className="document-cover"><FiFileText /><span>PDF</span></div>
            <div><StatusBadge value={document.status || 'publicado'} /><h2>{document.title || document.titulo || document.nombre}</h2><p>{document.description || document.descripcion || 'Documento del repositorio institucional.'}</p><small>{document.project?.title || document.project_title || 'ITSSMT'} · {formatDate(document.created_at)}</small>
              <a href={`${API_URL}/repositorio/${document.id}/download`}><FiDownload /> Descargar documento</a>
            </div>
          </article>)}</section>
        )}
        <Pagination meta={payload} onPage={setPage} />
      </div>
    </main>
  )
}
