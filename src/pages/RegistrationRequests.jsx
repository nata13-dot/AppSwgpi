import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheck, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { Button, Card, Chips, confirmAction, DataTable, Empty, ErrorState, Loading, Page, promptText } from '../components/ui'
import { formatDateTime } from '../utils/formatters'

const STATUS = [{ value: 'por_aprobar', label: 'Por revisar' }, { value: 'rechazada', label: 'Rechazadas' }]
const fullName = (row) => [row.nombres, row.apa, row.ama].filter(Boolean).join(' ')

/** Solicitudes del autoregistro: la cuenta se crea sólo cuando alguien de la jefatura las aprueba. */
export default function RegistrationRequests() {
  const client = useQueryClient()
  const [status, setStatus] = useState('por_aprobar')
  const query = useQuery({ queryKey: ['registration-requests', status], queryFn: () => api.get('/self-registration/requests', { params: { status } }).then((response) => response.data), refetchInterval: 60_000 })
  const done = (response) => {
    toast.success(response.data.message)
    if (response.data.email_sent === false) toast.warning('No se pudo enviar el correo de aviso. Avísale al alumno por otra vía.')
    client.invalidateQueries({ queryKey: ['registration-requests'] })
  }
  const onError = (error) => toast.error(apiError(error), { autoClose: 10_000 })
  const review = useMutation({ mutationFn: ({ id, action, reason }) => api.put(`/self-registration/requests/${id}/${action}`, action === 'reject' ? { reason } : {}), onSuccess: done, onError })
  const approve = async (row) => {
    if (await confirmAction({ title: 'Aprobar cuenta', text: `Se creará la cuenta ${row.matricula} de ${fullName(row)} y quedará inscrita en su grupo.`, confirmText: 'Aprobar' })) review.mutate({ id: row.id, action: 'approve' })
  }
  const reject = async (row) => {
    const reason = await promptText({ title: `Rechazar a ${fullName(row)}`, text: 'El alumno recibirá este motivo por correo.', confirmText: 'Rechazar' })
    if (reason) review.mutate({ id: row.id, action: 'reject', reason })
  }
  const columns = [
    { key: 'name', label: 'Alumno', primary: true, render: (row) => <span className="cell-main"><strong>{fullName(row)}</strong><small>{row.matricula} · {row.correo}</small></span> },
    { key: 'career', label: 'Carrera', render: (row) => row.carrera || '—' },
    { key: 'group', label: 'Grupo', render: (row) => (row.grupo ? `${row.grupo.semestre ? `${row.grupo.semestre}° · ` : ''}${row.grupo.nombre}` : 'Ya no disponible') },
    { key: 'date', label: 'Correo confirmado', render: (row) => formatDateTime(row.verificado_en) },
    status === 'por_aprobar'
      ? { key: 'actions', label: 'Acciones', render: (row) => <span className="row-wrap"><Button size="sm" icon={FiCheck} loading={review.isPending && review.variables?.id === row.id} onClick={() => approve(row)}>Aprobar</Button><Button size="sm" variant="ghost-danger" icon={FiX} disabled={review.isPending} onClick={() => reject(row)}>Rechazar</Button></span> }
      : { key: 'reason', label: 'Motivo', render: (row) => <span className="wrap-anywhere">{row.motivo}</span> },
  ]
  return (
    <Page eyebrow="Personas" title="Solicitudes de cuenta" subtitle="Alumnos que confirmaron su correo institucional. La cuenta se crea al aprobar; hace falta un periodo abierto en la carrera.">
      <Chips options={STATUS} value={status} onChange={setStatus} />
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable rowKey="id" rows={query.data} columns={columns} empty={<Empty message={status === 'por_aprobar' ? 'No hay solicitudes por revisar.' : 'No hay solicitudes rechazadas.'} />} />
        )}
      </Card>
    </Page>
  )
}
