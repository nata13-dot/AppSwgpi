import { useState } from 'react'
import { FiLock, FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Badge, Button, Empty, Field, Sheet } from '../../components/ui'
import { VERDICT_RULE, Verdict, verdictFor } from './evaluationShared'

const aptVote = (value) => (value === true ? 'Sí' : value === false ? 'No' : 'Sin respuesta')

/** Desglose por docente y retroalimentación de la sala (breakdownModal de evaluations.php). */
export default function BreakdownSheet({ evaluation, onClose, onSaved }) {
  const [feedback, setFeedback] = useState(evaluation.room_feedback || '')
  const [saving, setSaving] = useState(false)
  const apt = evaluation.titulation_apt_summary || {}
  const teachers = evaluation.teacher_breakdown || []
  const canFeedback = evaluation.can_manage_evaluations || evaluation.is_room_responsible

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/evaluations/${evaluation.id}/feedback`, { room_feedback: feedback.trim() })
      toast.success('Retroalimentación guardada')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }

  return (
    <Sheet open title="Desglose por docente" subtitle={evaluation.project?.title} onClose={onClose} size="lg">
      <div className="stack">
        {evaluation.evaluators_count > 0 && (
          <div className="result-box">
            <span>Resultado del proyecto</span><strong>{evaluation.global_average}%</strong><Verdict verdict={evaluation.verdict} average={evaluation.global_average} />
            <small className="muted">{VERDICT_RULE}</small>
          </div>
        )}
        {apt.applies && <div className="alert-app"><strong>Recomendación del proyecto (sin efecto de egreso):</strong> {apt.label || 'Sin votos'}</div>}
        {!teachers.length ? <Empty title="Sin calificaciones" message="Aún no hay evaluaciones registradas por docentes." /> : teachers.map((teacher, index) => (
          <section key={`${teacher.teacher_name}-${index}`} className="card-app">
            <header className="card-head"><h2>{teacher.teacher_name}</h2><div className="row-wrap"><Badge tone="info">{teacher.average}%</Badge><Verdict verdict={teacher.verdict || verdictFor(teacher.average)} /></div></header>
            {apt.applies && <p className="muted small-text"><strong>Recomendación:</strong> {aptVote(teacher.apto_titulacion)}</p>}
            {teacher.general_comment && <div className="quote"><strong>Comentario general</strong><p>{teacher.general_comment}</p></div>}
            {!teacher.can_view_score_detail ? (
              <div className="alert-app"><FiLock /> El desglose por criterio de este docente es privado. Sólo se muestra su comentario general y promedio.</div>
            ) : !(teacher.scores || []).length ? <p className="muted small-text">Sin respuestas detalladas registradas.</p> : (
              <ul className="score-breakdown">
                {teacher.scores.map((score, scoreIndex) => (
                  <li key={scoreIndex}>
                    <div className="row-wrap"><strong>{score.criterio_label}</strong><span className="spacer" /><Badge>{score.nivel_label || score.nivel}</Badge><small className="muted">{Number(score.porcentaje ?? 0).toFixed(0)} %</small></div>
                    <p className={score.comentario ? '' : 'muted'}>{score.comentario || 'Sin comentario para esta pregunta.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section className="card-app">
          <h2 className="card-title-sm">Retroalimentación de evaluación</h2>
          {canFeedback ? (
            <>
              <Field label="Retroalimentación visible para el equipo"><textarea className="control" rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></Field>
              <Button size="sm" icon={FiSave} loading={saving} className="mt-2" onClick={save}>Guardar retroalimentación</Button>
            </>
          ) : <p className="muted small-text">{evaluation.room_feedback || 'Sin retroalimentación registrada.'}</p>}
        </section>
      </div>
    </Sheet>
  )
}
