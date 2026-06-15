import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { ErrorState, Loading } from '../../components/common/Ui'
import { fullName } from '../../utils/formatters'

export default function EvaluationManagers() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['evaluation-managers'], queryFn: () => api.get('/evaluations/managers').then((response) => response.data) })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  return <ManagerForm key={query.data.manager_ids.join('|')} data={query.data} client={client} />
}

function ManagerForm({ data, client }) {
  const [ids, setIds] = useState(data.manager_ids.map(String))
  const mutation = useMutation({
    mutationFn: () => api.put('/evaluations/managers', { teacher_ids: ids }),
    onSuccess: () => { toast.success('Gestores de evaluaciones actualizados.'); client.invalidateQueries({ queryKey: ['evaluation-managers'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  return <section className="panel manager-panel">
    <h2>Docentes gestores de evaluaciones</h2>
    <p>Estos docentes pueden crear salas, configurar rúbricas, gestionar secuencias y consultar reportes completos.</p>
    <div className="selection-grid">{data.teachers.map((teacher) => <label className="selection-card" key={teacher.id}><input type="checkbox" checked={ids.includes(String(teacher.id))} onChange={(event) => setIds(event.target.checked ? [...ids, String(teacher.id)] : ids.filter((id) => id !== String(teacher.id)))} /><span>{fullName(teacher)}<small>{teacher.email}</small></span></label>)}</div>
    <button className="btn-primary-app compact" disabled={mutation.isPending} onClick={() => mutation.mutate()}><FiSave /> Guardar gestores</button>
  </section>
}
