import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheck, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { Badge, Button, Card, Chips, DataTable, Empty, ErrorState, Loading, Page, promptText, SearchInput, useDebounced } from '../components/ui'

const TONES = { pendiente: 'warning', aprobada: 'success', rechazada: 'danger' }

/** Directorio de empresas propuestas en los proyectos: la coordinación valida antes de incorporarlas al catálogo. */
export default function Companies() {
  const client = useQueryClient()
  const [status, setStatus] = useState('pendiente')
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const query = useQuery({ queryKey: ['companies', status, debounced], queryFn: () => api.get('/companies', { params: { status, q: debounced.trim() || undefined } }).then((response) => (Array.isArray(response.data) ? response.data : response.data.data || [])) })
  const review = async (company, next) => {
    const comment = next === 'rechazada' ? await promptText({ title: 'Motivo del rechazo', placeholder: 'Qué debe corregirse', required: false, confirmText: 'Rechazar' }) : ''
    if (comment === null) return
    try {
      const { data } = await api.put(`/companies/${company.id}/review`, { status: next, comment: comment || null })
      toast.success(data.message || 'Empresa revisada.')
      client.invalidateQueries({ queryKey: ['companies'] })
    } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Vinculación" title="Directorio de empresas" subtitle="Valida los datos propuestos antes de incorporarlos al catálogo institucional.">
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Nombre o RFC" />
        <Chips options={[{ value: 'pendiente', label: 'Pendientes' }, { value: 'aprobada', label: 'Aprobadas' }, { value: 'rechazada', label: 'Rechazadas' }]} value={status} onChange={setStatus} />
      </div>
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable rows={query.data} empty={<Empty title="Sin empresas" message="No hay empresas en este estado." />}
            columns={[
              { key: 'nombre', label: 'Empresa', primary: true, render: (company) => <span className="cell-main"><strong>{company.nombre}</strong><small>{company.projects_count} proyecto(s) · {company.rfc || 'Histórico sin RFC'}</small></span> },
              { key: 'giro', label: 'Giro', render: (company) => company.giro || '—' },
              { key: 'contacto', label: 'Contacto', render: (company) => <span className="cell-main"><strong>{company.contacto_nombre || '—'}</strong><small>{company.contacto_cargo}</small></span> },
              { key: 'direccion', label: 'Dirección', hideOnMobile: true, render: (company) => <small>{company.direccion || '—'}</small> },
              { key: 'estado', label: 'Estado', render: (company) => <Badge tone={TONES[company.estado_validacion]}>{company.estado_validacion}</Badge> },
            ]}
            actions={status === 'pendiente' ? (company) => <><Button size="sm" variant="success" icon={FiCheck} onClick={() => review(company, 'aprobada')}>Aprobar</Button><Button size="sm" variant="ghost-danger" icon={FiX} onClick={() => review(company, 'rechazada')}>Rechazar</Button></> : undefined} />
        )}
      </Card>
    </Page>
  )
}
