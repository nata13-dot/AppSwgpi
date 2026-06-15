import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDownload, FiFile, FiUpload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { formatDate } from '../utils/formatters'
import { Empty, ErrorState, Loading, Modal, PageHeader, StatusBadge } from '../components/common/Ui'

export default function Deliverables() {
  const { user } = useAuth()
  const role = roleFromUser(user)
  const endpoint = role === 'student' ? '/my-deliverables' : role === 'teacher' ? '/teacher/deliverables-matrix' : '/deliverables'
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [grade, setGrade] = useState({ calificacion: '', comentario: '' })
  const fileInput = useRef()
  const query = useQuery({ queryKey: ['deliverables', role], queryFn: () => api.get(endpoint).then((r) => r.data) })
  const raw = query.data
  const rows = Array.isArray(raw) ? raw : raw?.data || []

  const upload = useMutation({
    mutationFn: ({ id, file }) => {
      const body = new FormData()
      body.append('file', file)
      return api.post(`/deliverables/${id}/upload`, body)
    },
    onSuccess: () => { toast.success('Archivo enviado correctamente.'); queryClient.invalidateQueries({ queryKey: ['deliverables'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const grading = useMutation({
    mutationFn: () => api.post(`/deliverables/${selected.id}/calificar`, { calificacion: Number(grade.calificacion), comentario: grade.comentario }),
    onSuccess: () => { toast.success('Calificación guardada.'); setSelected(null); queryClient.invalidateQueries({ queryKey: ['deliverables'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const download = async (item) => {
    try {
      const response = await api.get(`/deliverables/${item.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = item.file_name || item.nombre_archivo || `entregable-${item.id}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <>
      <PageHeader eyebrow="Seguimiento" title={role === 'student' ? 'Mis entregables' : 'Entregables'} description={role === 'student' ? 'Sube tus avances y consulta la retroalimentación.' : 'Revisa archivos, estados y calificaciones de los proyectos.'} />
      <section className="panel">
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : rows.length === 0 ? <Empty title="Sin entregables" message="Todavía no hay entregables asignados." /> : (
          <div className="deliverable-grid">{rows.map((item) => {
            const deliverable = item.deliverable || item
            return <article className="deliverable-card" key={deliverable.id}>
              <div className="file-mark"><FiFile /></div>
              <div className="deliverable-body">
                <div className="deliverable-title"><div><small>{deliverable.project?.title || item.project?.title || 'Proyecto'}</small><h3>{deliverable.title || deliverable.nombre || `Entregable #${deliverable.id}`}</h3></div><StatusBadge value={deliverable.estado} /></div>
                <p>{deliverable.description || deliverable.descripcion || 'Sin descripción adicional.'}</p>
                <div className="deliverable-meta"><span>Fecha límite: <strong>{formatDate(deliverable.due_date || deliverable.fecha_limite)}</strong></span>{deliverable.calificacion != null && <span>Calificación: <strong>{deliverable.calificacion}/100</strong></span>}</div>
                <div className="card-actions">
                  {(deliverable.file_path || deliverable.archivo || deliverable.submitted_at) && <button onClick={() => download(deliverable)}><FiDownload /> Descargar</button>}
                  {role === 'student' && <><input ref={fileInput} hidden type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files[0] && upload.mutate({ id: deliverable.id, file: e.target.files[0] })} /><button className="primary" onClick={() => fileInput.current?.click()}><FiUpload /> Subir archivo</button></>}
                  {role !== 'student' && <button className="primary" onClick={() => setSelected(deliverable)}>Calificar</button>}
                </div>
              </div>
            </article>
          })}</div>
        )}
      </section>
      <Modal open={Boolean(selected)} title="Calificar entregable" onClose={() => setSelected(null)}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); grading.mutate() }}>
          <label>Calificación (0-100)<input required type="number" min="0" max="100" value={grade.calificacion} onChange={(e) => setGrade({ ...grade, calificacion: e.target.value })} /></label>
          <label>Retroalimentación<textarea rows="4" value={grade.comentario} onChange={(e) => setGrade({ ...grade, comentario: e.target.value })} /></label>
          <div className="modal-actions"><button type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="btn-primary-app compact" disabled={grading.isPending}>Guardar calificación</button></div>
        </form>
      </Modal>
    </>
  )
}
