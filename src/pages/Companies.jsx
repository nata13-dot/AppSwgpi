import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { Empty, ErrorState, Loading, PageHeader, StatusBadge } from '../components/common/Ui'

export default function Companies() {
  const [status, setStatus] = useState('pendiente')
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['companies', status], queryFn: () => api.get('/companies', { params: { status } }).then((response) => response.data) })
  const review = useMutation({ mutationFn: ({ company, next }) => api.put(`/companies/${company.id}/review`, { status: next }), onSuccess: ({ data }) => { toast.success(data.message); client.invalidateQueries({ queryKey: ['companies'] }) }, onError: (error) => toast.error(apiError(error)) })
  return <><PageHeader eyebrow="Vinculación" title="Directorio de empresas" description="Valida los datos propuestos antes de incorporarlos al catálogo institucional." />
    <section className="panel"><div className="module-tabs compact-tabs">{['pendiente', 'aprobada', 'rechazada'].map((item) => <button key={item} className={status === item ? 'active' : ''} onClick={() => setStatus(item)}>{item}</button>)}</div>
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : !query.data?.length ? <Empty title="Sin empresas" /> : <div className="table-responsive"><table className="data-table"><thead><tr><th>Empresa</th><th>RFC</th><th>Giro</th><th>Contacto</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{query.data.map((company) => <tr key={company.id}><td><strong>{company.nombre}</strong><small>{company.projects_count} proyecto(s)</small></td><td>{company.rfc || 'Histórico sin RFC'}</td><td>{company.giro}</td><td>{company.contacto_nombre}<small>{company.contacto_cargo}</small></td><td>{company.direccion}</td><td><StatusBadge value={company.estado_validacion} /></td><td>{status === 'pendiente' && <><button onClick={() => review.mutate({ company, next: 'aprobada' })}>Aprobar</button><button className="danger" onClick={() => review.mutate({ company, next: 'rechazada' })}>Rechazar</button></>}</td></tr>)}</tbody></table></div>}
    </section></>
}
