import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiPlus, FiSave, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { confirmAction, Empty, ErrorState, Loading } from '../../components/common/Ui'

export default function RubricManager({ canManage, projects }) {
  const client = useQueryClient()
  const [semester, setSemester] = useState(5)
  const [projectId, setProjectId] = useState('')
  const [question, setQuestion] = useState('')
  const query = useQuery({ queryKey: ['evaluation-criteria'], queryFn: () => api.get('/evaluations/criteria').then((response) => response.data) })
  const mutation = useMutation({
    mutationFn: ({ method = 'post', endpoint, body }) => api[method](endpoint, body),
    onSuccess: ({ data }) => { toast.success(data.message || 'Rúbrica actualizada.'); setQuestion(''); client.invalidateQueries({ queryKey: ['evaluation-criteria'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const criteria = (query.data.criteria || []).filter((item) => Number(item.semestre) === Number(semester) && String(item.project_id || '') === String(projectId || ''))
  const mode = query.data.score_modes?.[String(semester)] || 'levels'
  const updateCriterion = (criterion, patch) => mutation.mutate({ method: 'put', endpoint: `/evaluations/rubric-criteria/${criterion.id}`, body: { pregunta: patch.label ?? criterion.label, orden: Number(patch.orden ?? criterion.orden) } })
  const remove = async (criterion) => {
    if (!await confirmAction({ title: 'Desactivar pregunta', text: criterion.label, confirmText: 'Sí, desactivar' })) return
    mutation.mutate({ method: 'delete', endpoint: `/evaluations/rubric-criteria/${criterion.id}` })
  }
  return <section className="panel rubric-manager">
    <div className="rubric-controls">
      <label>Semestre<select value={semester} onChange={(event) => { setSemester(Number(event.target.value)); setProjectId('') }}>{[5, 6, 7, 8].map((value) => <option key={value}>{value}</option>)}</select></label>
      {semester === 8 && <label>Alcance<select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Rúbrica general</option>{projects.filter((project) => Number(project.presentation_semester || project.semestre) === 8).map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>}
      {canManage && <label>Método<select value={mode} onChange={(event) => mutation.mutate({ method: 'put', endpoint: '/evaluations/rubric-score-modes', body: { semester, mode: event.target.value } })}><option value="levels">Niveles de acuerdo</option><option value="numeric">Puntaje de 1 a 5</option></select></label>}
    </div>
    {criteria.length === 0 ? <Empty title="Sin preguntas configuradas" /> : <div className="rubric-list">{criteria.map((criterion) => <RubricRow key={criterion.id} criterion={criterion} canManage={canManage} onSave={updateCriterion} onRemove={remove} />)}</div>}
    {canManage && <form className="rubric-add" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ endpoint: '/evaluations/rubric-criteria', body: { semestre: semester, project_id: projectId ? Number(projectId) : null, pregunta: question } }) }}><input required maxLength="255" placeholder="Nueva pregunta de rúbrica" value={question} onChange={(event) => setQuestion(event.target.value)} /><button className="btn-primary-app compact"><FiPlus /> Agregar pregunta</button></form>}
  </section>
}

function RubricRow({ criterion, canManage, onSave, onRemove }) {
  const [label, setLabel] = useState(criterion.label)
  const [order, setOrder] = useState(criterion.orden || 0)
  return <article><input disabled={!canManage} type="number" min="0" value={order} onChange={(event) => setOrder(event.target.value)} /><input disabled={!canManage} value={label} onChange={(event) => setLabel(event.target.value)} /><span>{criterion.project_id ? 'Proyecto' : 'General'}</span>{canManage && <div className="row-actions"><button onClick={() => onSave(criterion, { label, orden: order })}><FiSave /> Guardar</button><button className="danger" onClick={() => onRemove(criterion)}><FiTrash2 /> Desactivar</button></div>}</article>
}
