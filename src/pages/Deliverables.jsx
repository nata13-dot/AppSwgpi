import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDownload, FiFile, FiPlus, FiUpload } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { isProjectManagementRole, roleFromUser, useAuth } from '../hooks/useAuth'
import { formatDate } from '../utils/formatters'
import { downloadApiFile } from '../utils/downloads'
import { Empty, ErrorState, Loading, Modal, PageHeader, StatusBadge } from '../components/common/Ui'

export default function Deliverables() {
  const { user } = useAuth()
  const role = roleFromUser(user)
  const canManage = isProjectManagementRole(role)
  const endpoint = role === 'student' ? '/my-deliverables' : role === 'teacher' ? '/teacher/deliverables-matrix' : '/deliverables'
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newItem, setNewItem] = useState({ project_id: '', asignatura_id: '', nombre: '', descripcion: '', tipo_documento: 'documento', autores: '' })
  const [grade, setGrade] = useState({ calificacion: '', comentario: '' })
  const fileInput = useRef()
  const query = useQuery({ queryKey: ['deliverables', role], queryFn: () => api.get(endpoint).then((r) => r.data) })
  const raw = query.data
  const rows = role === 'teacher'
    ? (raw?.data || []).flatMap((projectRow) => projectRow.students.flatMap((studentRow) => studentRow.items.map((item) => ({
      ...item.deliverable,
      id: item.deliverable?.id,
      rowKey: `${item.deliverable?.id || 'missing'}-${projectRow.project.id}-${studentRow.student.id}`,
      project_id: projectRow.project.id,
      project: projectRow.project,
      student: studentRow.student,
      competencia: item.competencia,
      asignatura: item.asignatura,
      estado: item.deliverable?.estado || 'faltante',
      calificacion: item.calificacion,
      missing: !item.deliverable,
    }))))
    : Array.isArray(raw) ? raw : raw?.data || []
  const formOptions = useQuery({
    queryKey: ['deliverable-form-options'],
    queryFn: async () => {
      const [projects, subjects] = await Promise.all([api.get('/projects', { params: { per_page: 100 } }), api.get('/asignaturas', { params: { per_page: 100 } })])
      return { projects: projects.data.data || [], subjects: subjects.data.data || [] }
    },
    enabled: canManage && creating,
  })

  const upload = useMutation({
    mutationFn: ({ id, projectId, file }) => {
      const body = new FormData()
      body.append('archivo', file)
      body.append('project_id', projectId)
      return api.post(`/deliverables/${id}/upload`, body)
    },
    onSuccess: () => { toast.success('Archivo enviado correctamente.'); queryClient.invalidateQueries({ queryKey: ['deliverables'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const grading = useMutation({
    mutationFn: () => api.post(`/deliverables/${selected.id}/calificar`, { project_id: selected.project_id, calificacion: Number(grade.calificacion), comentario: grade.comentario }),
    onSuccess: () => { toast.success('Calificación guardada.'); setSelected(null); queryClient.invalidateQueries({ queryKey: ['deliverables'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const create = useMutation({
    mutationFn: () => api.post('/deliverables', { ...newItem, project_id: Number(newItem.project_id), asignatura_id: Number(newItem.asignatura_id) }),
    onSuccess: () => { toast.success('Entregable creado.'); setCreating(false); queryClient.invalidateQueries({ queryKey: ['deliverables'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const download = async (item) => {
    try {
      await downloadApiFile(`/deliverables/${item.id}/download`, item.file_name || item.nombre_archivo || `entregable-${item.id}`, { params: { project_id: item.project_id } })
    } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <>
      <PageHeader eyebrow="Seguimiento" title={role === 'student' ? 'Mis entregables' : 'Entregables'} description={role === 'student' ? 'Sube tus avances y consulta la retroalimentación.' : 'Revisa archivos, estados y calificaciones de los proyectos.'} actions={canManage && <button className="btn-primary-app compact" onClick={() => setCreating(true)}><FiPlus /> Nuevo entregable</button>} />
      <section className="panel">
        {role === 'student' && <input ref={fileInput} hidden type="file" accept=".pdf,.doc,.docx" onChange={(event) => {
          const file = event.target.files[0]
          if (file && uploadTarget) upload.mutate({ id: uploadTarget.id, projectId: uploadTarget.project_id, file })
          event.target.value = ''
        }} />}
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : rows.length === 0 ? <Empty title="Sin entregables" message="Todavía no hay entregables asignados." /> : (
          <div className="deliverable-grid">{rows.map((item) => {
            const deliverable = item.deliverable || item
            const rowKey = item.rowKey || `${deliverable.id}-${deliverable.project_id}`
            const academicContext = item.asignatura || deliverable.asignatura || deliverable.competencia?.asignatura || deliverable.competencia
            return <article className="deliverable-card" key={rowKey}>
              <div className="file-mark"><FiFile /></div>
              <div className="deliverable-body">
                <div className="deliverable-title"><div><small>{academicContext?.nombre || 'Curso'} · {deliverable.project?.title || item.project?.title || 'Proyecto'}</small><h3>{deliverable.title || deliverable.nombre || `Entregable #${deliverable.id}`}</h3></div><StatusBadge value={deliverable.estado} /></div>
                <p>{deliverable.description || deliverable.descripcion || (deliverable.missing ? `Pendiente: ${deliverable.competencia?.nombre}` : 'Sin descripción adicional.')}</p>
                <div className="deliverable-meta"><span>Fecha límite: <strong>{formatDate(deliverable.due_date || deliverable.fecha_limite)}</strong></span>{deliverable.calificacion != null && <span>Calificación: <strong>{deliverable.calificacion}/100</strong></span>}</div>
                <div className="card-actions">
                  {(deliverable.file_path || deliverable.archivo_path || deliverable.archivo || deliverable.submitted_at) && <button onClick={() => download(deliverable)}><FiDownload /> Descargar</button>}
                  {role === 'student' && <button className="primary" onClick={() => { setUploadTarget({ id: deliverable.id, project_id: deliverable.project_id }); fileInput.current?.click() }}><FiUpload /> Subir archivo</button>}
                  {role !== 'student' && !deliverable.missing && <button className="primary" onClick={() => setSelected(deliverable)}>Calificar</button>}
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
      <Modal open={creating} title="Nuevo entregable" onClose={() => setCreating(false)}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><div className="form-grid">
          <label>Proyecto<select required value={newItem.project_id} onChange={(event) => setNewItem({ ...newItem, project_id: event.target.value })}><option value="">Selecciona</option>{formOptions.data?.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
          <label>Asignatura<select required value={newItem.asignatura_id} onChange={(event) => setNewItem({ ...newItem, asignatura_id: event.target.value })}><option value="">Selecciona</option>{formOptions.data?.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.nombre}</option>)}</select></label>
          <label className="full-field">Nombre<input required value={newItem.nombre} onChange={(event) => setNewItem({ ...newItem, nombre: event.target.value })} /></label>
          <label className="full-field">Descripción<textarea rows="4" value={newItem.descripcion} onChange={(event) => setNewItem({ ...newItem, descripcion: event.target.value })} /></label>
          <label>Tipo<select value={newItem.tipo_documento} onChange={(event) => setNewItem({ ...newItem, tipo_documento: event.target.value })}><option value="documento">Documento</option><option value="reporte">Reporte</option><option value="presentacion">Presentación</option><option value="codigo">Código</option><option value="video">Video</option><option value="otro">Otro</option></select></label>
          <label>Autores<input value={newItem.autores} onChange={(event) => setNewItem({ ...newItem, autores: event.target.value })} /></label>
        </div><div className="modal-actions"><button type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="btn-primary-app compact">Crear</button></div></form>
      </Modal>
    </>
  )
}
