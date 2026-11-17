import { useState } from 'react'
import { FiCheckCircle } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Badge, Button, Chips, Field, Sheet } from '../../components/ui'
import { VIABILITY } from './evaluationShared'


const tomorrowPlus = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Confirmar el dictamen de viabilidad de 5° (POST /evaluations/{id}/viability) con los votos de los evaluadores. */
export default function ViabilitySheet({ evaluation, title, onClose, onSaved }) {
  const summary = evaluation.viability || {}
  const [decision, setDecision] = useState(summary.suggested || 'viable')
  const [reason, setReason] = useState('')
  const [deadline, setDeadline] = useState(tomorrowPlus(7))
  const [saving, setSaving] = useState(false)
  const differs = decision !== summary.suggested

  const submit = async (event) => {
    event.preventDefault()
    if (differs && !reason.trim()) { toast.warning('Escribe el motivo: tu dictamen es distinto al que votó la mayoría.'); return }
    setSaving(true)
    try {
      const { data } = await api.post(`/evaluations/${evaluation.id}/viability`, {
        decision, reason: reason.trim() || null, deadline: decision === 'correcciones' ? `${deadline} 23:59:59` : null,
      })
      toast.success(data.message)
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }

  return (
    <Sheet open title="Confirmar dictamen de viabilidad" subtitle={title} onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="viability-form" variant={decision === 'no_viable' ? 'danger' : 'primary'} icon={FiCheckCircle} loading={saving}>Confirmar «{VIABILITY[decision].label}»</Button></>}>
      <form id="viability-form" className="stack" onSubmit={submit}>
        <div className="row-wrap">
          {Object.entries(VIABILITY).map(([key, option]) => <Badge key={key} tone={option.tone}>{option.label}: {summary.votes?.[key] || 0}</Badge>)}
        </div>
        <p className="muted">Votaron {summary.total || 0} evaluador(es). Sugerido por mayoría: <strong>{summary.suggested_label || '—'}</strong>{' '}(en empate se sugiere el más estricto).</p>
        <Field label="Dictamen final">
          <Chips options={Object.entries(VIABILITY).map(([value, option]) => ({ value, label: option.label }))} value={decision} onChange={setDecision} />
        </Field>
        <div className={`alert-app ${VIABILITY[decision].tone}`}>{VIABILITY[decision].effect} Se notifica al equipo y no se puede deshacer.</div>
        {decision === 'correcciones' && (
          <Field label="Plazo para corregir" hint="Hasta el final de ese día podrán editar su propuesta.">
            <input className="control" type="date" min={tomorrowPlus(1)} required value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
        )}
        <Field label={differs ? 'Motivo (obligatorio)' : 'Motivo (opcional)'} hint={differs ? 'Tu dictamen es distinto al de la mayoría; el equipo verá este motivo.' : 'El equipo lo verá junto con los comentarios de los evaluadores.'}>
          <textarea className="control" rows={3} maxLength={2000} required={differs} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </form>
    </Sheet>
  )
}
