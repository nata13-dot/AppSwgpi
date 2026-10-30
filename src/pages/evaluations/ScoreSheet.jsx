import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSave, FiSend } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { fullName } from '../../utils/formatters'
import { Badge, Button, confirmAction, Empty, Field, Loading, Progress, Sheet } from '../../components/ui'
import { controlNumbers, SCALE_NAMES, scaleOf, scaleOptions, scalePercentage, Verdict, verdictFor } from './evaluationShared'

const draftKey = (id) => `sgpi-score-draft:${id}`
const readDraft = (id) => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}') } catch { return {} } }

/** Rúbrica de evaluación de un docente (scoreModal de evaluations.php). El progreso se guarda en el dispositivo. */
export default function ScoreSheet({ evaluation, project, onClose, onSaved }) {
  const criteriaQuery = useQuery({ queryKey: ['evaluation-criteria'], queryFn: () => api.get('/evaluations/criteria', { timeout: 30_000 }).then((response) => response.data), staleTime: 0 })
  const [draft] = useState(() => readDraft(evaluation.id))
  const restored = Object.keys(draft).length > 0
  const [answers, setAnswers] = useState(() => Object.fromEntries((draft.scores || []).map((score) => [score.criterio, { valor: score.valor || '', comentario: score.comentario || '' }])))
  const [comment, setComment] = useState(draft.general_comment || '')
  const [apt, setApt] = useState(() => draft.apto_titulacion ?? (evaluation.current_teacher_apto_titulacion === true ? '1' : evaluation.current_teacher_apto_titulacion === false ? '0' : ''))
  const [missing, setMissing] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const refs = useRef({})

  // Preguntas del semestre; en 8° también las personalizadas del proyecto.
  const criteria = useMemo(() => {
    if (Array.isArray(evaluation.criteria)) return evaluation.criteria
    return (criteriaQuery.data?.criteria || []).filter((criterion) => {
      if (String(criterion.semestre) !== String(evaluation.semestre)) return false
      const criterionProject = criterion.project_id == null ? '' : String(criterion.project_id)
      if (Number(evaluation.semestre) !== 8) return criterionProject === ''
      return criterionProject === '' || criterionProject === String(evaluation.project_id || evaluation.project?.id || '')
    })
  }, [criteriaQuery.data, evaluation])

  useEffect(() => {
    const payload = { general_comment: comment, apto_titulacion: apt, scores: Object.entries(answers).map(([criterio, value]) => ({ criterio, ...value })) }
    localStorage.setItem(draftKey(evaluation.id), JSON.stringify(payload))
  }, [answers, apt, comment, evaluation.id])

  const percentages = criteria.map((criterion) => (answers[criterion.key]?.valor ? scalePercentage(scaleOf(criterion), answers[criterion.key].valor) : null)).filter((value) => value !== null)
  const average = percentages.length ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 100) / 100 : null
  const exhausted = evaluation.current_teacher_has_scores && Number(evaluation.current_teacher_attempts) >= Number(evaluation.max_attempts)
  const setAnswer = (key, patch) => {
    setAnswers((current) => ({ ...current, [key]: { valor: '', comentario: '', ...current[key], ...patch } }))
    if (patch.valor) setMissing((current) => { const next = new Set(current); next.delete(key); return next })
  }

  const submit = async () => {
    const pending = criteria.filter((criterion) => !answers[criterion.key]?.valor).map((criterion) => criterion.key)
    if (pending.length) {
      setMissing(new Set(pending))
      refs.current[pending[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.warning(`Faltan ${pending.length} pregunta(s) por responder.`)
      return
    }
    if (evaluation.current_teacher_has_scores) { toast.error('Solicita un nuevo intento autorizado; el resultado registrado se conserva.'); return }
    if (!(await confirmAction({ title: 'Guardar evaluación', text: `Se guardará la rúbrica para ${project?.title || 'este proyecto'}.`, confirmText: 'Sí, guardar', icon: 'question' }))) return
    const payload = {
      scores: criteria.map((criterion) => ({ criterio: criterion.key, valor: answers[criterion.key].valor, comentario: answers[criterion.key].comentario?.trim() || null })),
      general_comment: comment.trim() || null,
    }
    if (apt !== '') payload.apto_titulacion = apt === '1'
    setSaving(true)
    try {
      await api.post(`/evaluations/${evaluation.id}/score`, payload)
      localStorage.removeItem(draftKey(evaluation.id))
      toast.success('Rúbrica guardada correctamente')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open title="Rúbrica de evaluación" subtitle={project?.title} onClose={onClose} size="lg"
      footer={<><Button variant="ghost" icon={FiSave} onClick={onClose}>Guardar y salir</Button><Button icon={FiSend} loading={saving} disabled={exhausted || !criteria.length} onClick={submit}>Enviar evaluación</Button></>}>
      <div className="score-context">
        <div><strong>{project?.title || 'N/A'}</strong><small>Integrantes: {(project?.students || []).map(fullName).join(', ') || '—'}</small>{controlNumbers(project) && <small>No. control: {controlNumbers(project)}</small>}</div>
        <Badge>Orden #{evaluation.presentation_order || '–'}</Badge>
      </div>
      {exhausted && <div className="alert-app danger">Ya alcanzaste el límite de {evaluation.max_attempts} oportunidad(es) para esta evaluación.</div>}
      {restored && <p className="muted small-text">Se restauró un progreso guardado en este dispositivo.</p>}
      {criteriaQuery.isLoading ? <Loading /> : !criteria.length ? <Empty title="Sin preguntas" message="Este semestre no tiene preguntas de rúbrica configuradas." /> : (
        <>
          <div className="score-summary" aria-live="polite">
            <div className="row-wrap"><span>Respondidas <strong>{percentages.length} de {criteria.length}</strong></span><span className="spacer" /><span>Promedio {percentages.length === criteria.length ? '' : 'parcial '}<strong>{average === null ? '—' : `${average.toFixed(2)} %`}</strong></span>{average !== null && <Verdict verdict={verdictFor(average)} />}</div>
            <Progress value={(percentages.length / criteria.length) * 100} tone={percentages.length === criteria.length ? 'success' : 'primary'} label="Preguntas respondidas" />
            <small className="muted">Aprobado desde 80 % · Apenas cumple de 70 a 79 %</small>
          </div>
          <ol className="score-questions">
            {criteria.map((criterion, index) => {
              const scale = scaleOf(criterion)
              const options = scaleOptions(scale)
              const value = answers[criterion.key]?.valor || ''
              return (
                <li key={criterion.key} ref={(element) => { refs.current[criterion.key] = element }} className={`score-question ${value ? 'answered' : ''} ${missing.has(criterion.key) ? 'missing' : ''}`}>
                  <div className="score-question-head"><span className="q-number">{index + 1}</span><span><strong>{criterion.label}</strong><small>{SCALE_NAMES[scale]}{criterion.project_id ? ' · Pregunta personalizada del proyecto' : ''}</small></span></div>
                  <div className={`scale-options scale-${scale}`} role="radiogroup" aria-label={criterion.label}>
                    {options.map((option) => (
                      <button type="button" key={option.value} role="radio" aria-checked={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => setAnswer(criterion.key, { valor: option.value })}>{option.label}</button>
                    ))}
                  </div>
                  {scale !== 'acuerdo' && <div className="scale-ends"><span>{options[0].label} = 0 %</span><span>{options.at(-1).label} = 100 %</span></div>}
                  <details open={Boolean(answers[criterion.key]?.comentario)}>
                    <summary>Comentario de esta pregunta (opcional, no afecta el puntaje)</summary>
                    <textarea className="control" rows={2} value={answers[criterion.key]?.comentario || ''} onChange={(event) => setAnswer(criterion.key, { comentario: event.target.value })} />
                  </details>
                </li>
              )
            })}
          </ol>
          <Field label="Comentarios o puntos de mejora" className="mt-3"><textarea className="control" rows={3} placeholder="Comentario final visible en el desglose" value={comment} onChange={(event) => setComment(event.target.value)} /></Field>
          {Number(evaluation.semestre) === 8 && (
            <Field label="¿Recomienda continuar el proyecto? (No acredita titulación)" hint="Esta respuesta no afecta el puntaje general." className="mt-3">
              <select className="control" value={apt} onChange={(event) => setApt(event.target.value)}><option value="">Sin respuesta</option><option value="1">Sí</option><option value="0">No</option></select>
            </Field>
          )}
        </>
      )}
    </Sheet>
  )
}
