import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheck, FiCheckCircle, FiClock, FiSlash, FiUnlock, FiDownload, FiExternalLink, FiFileText, FiLink, FiMessageSquare, FiRefreshCw, FiSave, FiUploadCloud, FiUserCheck } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { isAdmin } from '../lib/permissions'
import { downloadApiFile } from '../utils/downloads'
import { formatDate, formatDateTime, fullName } from '../utils/formatters'
import { Badge, Button, Card, confirmAction, Empty, ErrorState, Field, FileDrop, Loading, Page, Progress, promptText, Switch, Tabs } from '../components/ui'

const STAGES = { 5: 'Propuesta', 6: 'Avance', 7: 'Avance', 8: 'Titulación', 9: 'Residencia o tesis' }
const REVIEW = { faltante: ['danger', 'Pendiente de entregar'], pendiente: ['info', 'En revisión'], con_observaciones: ['warning', 'Con observaciones'], aprobada: ['success', 'Aprobada'] }
const NAMES = { release_sheet: 'Hoja de liberación', presentation: 'Presentación', report: 'Documento de reporte' }
const semesterOf = (item) => Number(item?.evaluation_semester ?? item?.project?.semestre)
const members = (list) => (list || []).map(fullName).filter(Boolean).join(', ') || 'Sin integrantes'
const reviewOf = (project, type) => project.readiness?.deliveries?.[type] || { state: 'faltante' }
const download = async (document) => {
  try { await downloadApiFile(`/repositorio/${document.id}/download`, document.nombre || 'documento') } catch (error) { toast.error(error.message) }
}

/** Entregas para evaluación y avances de tesis (Frontend_Swgpi/pages/evaluation-documents.php). */
export default function EvaluationDocuments() {
  const { user } = useAuth()
  const [section, setSection] = useState('evaluations')
  const client = useQueryClient()
  const evaluations = useQuery({ queryKey: ['evaluation-documents'], queryFn: () => api.get('/repositorio/evaluation-documents').then((response) => response.data) })
  const thesis = useQuery({ queryKey: ['thesis-documents'], queryFn: () => api.get('/repositorio/thesis-documents').then((response) => response.data.data?.data || response.data.data || []) })
  const refresh = () => { client.invalidateQueries({ queryKey: ['evaluation-documents'] }); client.invalidateQueries({ queryKey: ['thesis-documents'] }) }
  // Se agrupa por la etapa que presentará el proyecto este periodo (incluye casos especiales).
  const projects = (evaluations.data?.data || []).filter((item) => Number.isInteger(semesterOf(item)) && semesterOf(item) >= 5 && semesterOf(item) <= 9)
  const semesters = [...new Set(projects.map(semesterOf))].sort((a, b) => a - b)
  const maxMb = Number(evaluations.data?.presentation_max_mb || 100)
  const canUploadThesis = Number(user?.perfil_id) === 3 && Number(user?.semestre) === 9

  return (
    <Page title="Documentos de evaluación" subtitle="Entregas para presentar en sala, tesis y residencias." actions={<Button variant="ghost" icon={FiRefreshCw} onClick={refresh}>Actualizar</Button>}>
      <Tabs value={section} onChange={setSection} items={[{ key: 'evaluations', label: 'Entregas de evaluación', count: projects.length || null }, { key: 'thesis', label: 'Tesis y residencias' }]} />
      {section === 'evaluations' ? (
        <>
          <p className="muted small-text">Lo que cada proyecto necesita para presentar: hoja de liberación y presentación; desde 6° también el enlace de Drive y el documento de reporte. Sólo presentan los alumnos liberados.</p>
          {evaluations.isLoading ? <Loading rows={4} /> : evaluations.isError ? <ErrorState error={evaluations.error} onRetry={evaluations.refetch} /> : !semesters.length ? <Empty title="Sin proyectos disponibles" message="Aquí aparecerán los proyectos que presentan en este periodo." /> : semesters.map((semester) => (
            <section key={semester} className="stack">
              <h2 className="section-title">{semester}° · {STAGES[semester] || 'Evaluación'}</h2>
              {projects.filter((item) => semesterOf(item) === semester).map((item) => <ProjectDeliveries key={item.project.id} item={item} maxMb={maxMb} onChanged={refresh} />)}
            </section>
          ))}
        </>
      ) : (
        <>
          <p className="muted small-text">Avances privados de 9° que los docentes revisan y la administración puede publicar.</p>
          {canUploadThesis && <ThesisUpload user={user} onUploaded={refresh} />}
          {thesis.isLoading ? <Loading /> : thesis.isError ? <ErrorState error={thesis.error} onRetry={thesis.refetch} /> : !(thesis.data || []).length ? <Empty title="Sin documentos" message="No hay avances de tesis o residencias registrados." /> : (
            <div className="stack">{thesis.data.map((document) => <ThesisDocument key={document.id} document={document} canPublish={isAdmin(user)} onChanged={refresh} />)}</div>
          )}
        </>
      )}
    </Page>
  )
}

function ProjectDeliveries({ item, maxMb, onChanged }) {
  const readiness = item.readiness || {}
  const requirements = readiness.requirements || {}
  const students = readiness.students || []
  return (
    <Card className="delivery-card">
      <header className="card-head">
        <div><h2>{item.project.title}</h2><p>{members(item.integrantes)}</p></div>
        <div className="row-wrap">
          {readiness.ready ? <Badge tone="success" icon={FiCheckCircle}>Listo para evaluar</Badge> : <Badge tone="warning" icon={FiClock}>Incompleto</Badge>}
          <Badge>Se evalúa en {semesterOf(item)}° · {STAGES[semesterOf(item)]}</Badge>
          {readiness.release_sheet_uploaded && <Badge icon={FiUserCheck}>{Number(readiness.released_count || 0)} de {students.length} liberados</Badge>}
        </div>
      </header>
      {!readiness.ready && (readiness.missing || []).length > 0 && <p className="muted small-text">Falta: {readiness.missing.join(', ')}.</p>}
      <PresentationDecision item={item} onChanged={onChanged} />
      <div className="delivery-grid">
        <DeliverySlot item={item} type="release_sheet" number={1} maxMb={maxMb} onChanged={onChanged} />
        <DeliverySlot item={item} type="presentation" number={2} maxMb={maxMb} onChanged={onChanged} />
        {requirements.link && <LinkSlot item={item} onChanged={onChanged} />}
        {requirements.report && <DeliverySlot item={item} type="report" number={4} maxMb={maxMb} onChanged={onChanged} />}
      </div>
    </Card>
  )
}

function DeliverySlot({ item, type, number, maxMb, onChanged }) {
  const delivery = (type === 'release_sheet' ? item.release_sheet : type === 'presentation' ? item.presentation : item.report) || { allowed_extensions: [] }
  const reviewed = type !== 'release_sheet'
  const review = reviewOf(item, type)
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const limit = Number(delivery.max_mb || (type === 'presentation' ? maxMb : type === 'report' ? 25 : 50))
  const allowed = delivery.allowed_extensions || []
  const title = type === 'report' ? `Documento de reporte (${item.readiness?.requirements?.report === 'final' ? 'final' : 'avance'})` : NAMES[type]
  const hint = { release_sheet: 'Formatos: PDF, DOC o DOCX.', presentation: `Sólo PPTX, hasta ${limit} MB y sin video; el video va en el enlace de Drive.`, report: `Formatos: PDF, DOC o DOCX, hasta ${limit} MB.` }[type]
  const done = reviewed ? review.state === 'aprobada' : delivery.uploaded

  const upload = async () => {
    const extension = file.name.split('.').pop().toLowerCase()
    if (allowed.length && !allowed.includes(extension)) return toast.error(`Formato no permitido. Usa: ${allowed.join(', ').toUpperCase()}`)
    if (file.size > limit * 1048576) return toast.error(`El archivo pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es ${limit} MB.`)
    const body = new FormData()
    body.append('project_id', item.project.id)
    body.append('document_type', type)
    body.append('nombre', NAMES[type])
    body.append('descripcion', `Entrega de evaluación: ${NAMES[type].toLowerCase()}.`)
    body.append('autores', members(item.integrantes))
    body.append('archivo', file)
    setProgress(0)
    try {
      // Una presentación de hasta 100 MB puede tardar en subir desde el teléfono.
      await api.post('/repositorio/evaluation-documents', body, { timeout: 600_000, onUploadProgress: (event) => event.total && setProgress(Math.round((event.loaded / event.total) * 100)) })
      toast.success('Entrega guardada correctamente.')
      setFile(null)
      onChanged()
    } catch (error) { toast.error(apiError(error)) } finally { setProgress(null) }
    return undefined
  }

  return (
    <section className={`delivery-slot ${done ? 'done' : ''}`}>
      <header><h3><span className="slot-number">{number}</span>{title}</h3>{reviewed ? <ReviewBadge state={review.state} /> : <Badge tone={delivery.uploaded ? 'success' : 'danger'}>{delivery.uploaded ? 'Archivo cargado' : 'Archivo pendiente'}</Badge>}</header>
      {delivery.document && (
        <button type="button" className="file-chip" onClick={() => download(delivery.document)}>
          <FiFileText /><span><strong>{delivery.document.nombre}</strong><small>{delivery.document.created_at ? formatDateTime(delivery.document.created_at) : ''}</small></span><FiDownload />
        </button>
      )}
      {item.puede_subir && (
        <div className="stack-tight">
          <FileDrop accept={allowed.map((extension) => `.${extension}`).join(',')} file={file} onFile={setFile} hint={hint} label={delivery.uploaded ? 'Elige un archivo para reemplazar' : 'Toca para elegir el archivo'} disabled={progress !== null} />
          {progress !== null && <Progress value={progress} label="Progreso de subida" />}
          {file && <Button size="sm" icon={FiUploadCloud} loading={progress !== null} onClick={upload}>{progress !== null ? `Subiendo ${progress}%` : delivery.uploaded ? 'Reemplazar archivo' : 'Subir archivo'}</Button>}
        </div>
      )}
      {type === 'release_sheet' ? <ReleaseReview item={item} delivery={delivery} onChanged={onChanged} /> : <ReviewBox item={item} type={type} onChanged={onChanged} />}
    </section>
  )
}

function LinkSlot({ item, onChanged }) {
  const current = item.readiness?.link || ''
  const [url, setUrl] = useState(current)
  const [saving, setSaving] = useState(false)
  const [syncedLink, setSyncedLink] = useState(current)
  if (syncedLink !== current) { setSyncedLink(current); setUrl(current) }
  const save = async () => {
    if (!/^https:\/\/(drive|docs)\.google\.com\//i.test(url.trim())) return toast.warning('Pega un enlace de Google Drive que empiece con https://drive.google.com o https://docs.google.com.')
    setSaving(true)
    try { await api.post('/repositorio/evaluation-documents/link', { project_id: item.project.id, url: url.trim() }); toast.success('Enlace guardado.'); onChanged() } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
    return undefined
  }
  return (
    <section className={`delivery-slot ${reviewOf(item, 'link').state === 'aprobada' ? 'done' : ''}`}>
      <header><h3><span className="slot-number">3</span>Enlace de Drive</h3><ReviewBadge state={reviewOf(item, 'link').state} /></header>
      <p className="muted small-text">Carpeta de Google Drive con el video de la presentación y la presentación con el video agregado. Compártela para que la vean los evaluadores.</p>
      {current && <a className="file-chip" href={current} target="_blank" rel="noopener noreferrer"><FiLink /><span><strong className="break">{current}</strong></span><FiExternalLink /></a>}
      {item.puede_subir && (
        <div className="inline-add">
          <input className="control" type="url" inputMode="url" maxLength={500} placeholder="https://drive.google.com/..." value={url} onChange={(event) => setUrl(event.target.value)} />
          <Button icon={FiSave} loading={saving} onClick={save}>Guardar</Button>
        </div>
      )}
      <ReviewBox item={item} type="link" onChanged={onChanged} />
    </section>
  )
}

const ReviewBadge = ({ state }) => { const [tone, label] = REVIEW[state] || REVIEW.faltante; return <Badge tone={tone}>{label}</Badge> }

/** Comentario del encargado y, para quien revisa, aprobar o devolver con observaciones. */
function ReviewBox({ item, type, onChanged }) {
  const review = reviewOf(item, type)
  const send = async (status) => {
    let comment = null
    if (status === 'con_observaciones') {
      comment = await promptText({ title: 'Observaciones para el equipo', placeholder: 'Qué deben corregir antes de presentar', confirmText: 'Enviar observaciones' })
      if (comment === null) return
      if (comment.length < 5) { toast.warning('Escribe qué deben corregir.'); return }
    }
    try {
      const { data } = await api.put('/repositorio/evaluation-documents/review', { project_id: item.project.id, delivery: type, status, comment })
      toast.success(data.message || 'Revisión guardada.')
      onChanged()
    } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <>
      {review.comment && <div className={`alert-app ${review.state === 'con_observaciones' ? 'warning' : ''}`}><strong>{review.state === 'con_observaciones' ? 'Observaciones' : 'Comentario'}{review.reviewed_by ? ` de ${review.reviewed_by}` : ''}:</strong> {review.comment}</div>}
      {item.puede_revisar && review.state !== 'faltante' && (
        <div className="row-wrap">
          <Button size="sm" variant="success" icon={FiCheck} disabled={review.state === 'aprobada'} onClick={() => send('aprobada')}>Aprobar</Button>
          <Button size="sm" variant="ghost" icon={FiMessageSquare} onClick={() => send('con_observaciones')}>Con observaciones</Button>
        </div>
      )}
    </>
  )
}

const DEFAULT_DENIAL = 'Se te impide continuar por una decisión administrativa.'

/**
 * Negar la presentación por decisión administrativa (PresentationDenialService en la API): a todo el equipo o a un
 * alumno, con motivo opcional. Quien revisa puede permitirla de nuevo; el alumno ve el aviso con el motivo.
 */
function PresentationDecision({ item, onChanged }) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(null)
  const team = item.readiness?.denial
  const students = item.readiness?.students || []
  const deniedStudents = students.filter((student) => student.denial)
  const deny = async (student) => {
    const reason = await promptText({
      title: student ? `Negar la presentación de ${student.name}` : 'Negar la presentación del equipo',
      text: `${student ? 'El alumno no podrá ser liberado ni presentar; el resto del equipo sí presenta.' : 'El equipo no podrá ponerse en sala ni ser evaluado en este periodo.'} El motivo es opcional: si lo dejas vacío verán «${DEFAULT_DENIAL}»`,
      placeholder: 'Motivo (opcional)', confirmText: 'Negar presentación', required: false, danger: true,
    })
    if (reason === null) return
    setBusy(student?.id || 'team')
    try {
      const response = await api.post('/repositorio/evaluation-documents/denials', { project_id: item.project.id, student_id: student?.id || null, reason: reason || null })
      toast.success(response.data.message)
      onChanged()
    } catch (error) { toast.error(apiError(error)) } finally { setBusy(null) }
  }
  const allow = async (denial, who) => {
    if (!await confirmAction({ title: 'Permitir de nuevo', text: `La presentación ${who} vuelve a estar permitida y se le avisará en la app y por correo.`, confirmText: 'Sí, permitir', icon: 'question' })) return
    setBusy(denial.id)
    try {
      const response = await api.delete(`/repositorio/evaluation-documents/denials/${denial.id}`)
      toast.success(response.data.message)
      onChanged()
    } catch (error) { toast.error(apiError(error)) } finally { setBusy(null) }
  }
  const mine = team || students.find((student) => String(student.id) === String(user?.id))?.denial
  if (!item.puede_revisar) {
    return mine ? <div className="alert-app danger"><strong>{team ? 'La presentación de tu equipo fue negada.' : 'Tu presentación fue negada.'}</strong> Motivo: {mine.reason}</div> : null
  }
  return (
    <div className="denial-box">
      {team ? (
        <div className="alert-app danger row-between">
          <span><strong>Presentación del equipo negada.</strong> Motivo: {team.reason}{team.denied_by && <small> · {team.denied_by}, {formatDateTime(team.denied_at)}</small>}</span>
          <Button size="sm" variant="ghost" icon={FiUnlock} loading={busy === team.id} onClick={() => allow(team, 'del equipo')}>Permitir de nuevo</Button>
        </div>
      ) : (
        <div className="row-wrap">
          <span className="muted small-text grow">Decisión administrativa</span>
          <Button size="sm" variant="ghost-danger" icon={FiSlash} loading={busy === 'team'} onClick={() => deny(null)}>Negar al equipo</Button>
        </div>
      )}
      {deniedStudents.map((student) => (
        <div key={student.id} className="alert-app danger row-between">
          <span><strong>{student.name}:</strong> presentación negada. Motivo: {student.denial.reason}</span>
          <Button size="sm" variant="ghost" icon={FiUnlock} loading={busy === student.denial.id} onClick={() => allow(student.denial, `de ${student.name}`)}>Permitir de nuevo</Button>
        </div>
      ))}
      {!team && students.length > 1 && (
        <div className="row-wrap">
          {students.filter((student) => !student.denial).map((student) => (
            <Button key={student.id} size="sm" variant="link" icon={FiSlash} loading={busy === student.id} onClick={() => deny(student)}>Negar a {student.name.split(' ')[0]}</Button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReleaseReview({ item, delivery, onChanged }) {
  const [released, setReleased] = useState(() => Object.fromEntries((delivery.students || []).map((student) => [student.id, Boolean(student.released)])))
  const [saving, setSaving] = useState(false)
  const [syncedStudents, setSyncedStudents] = useState(delivery.students)
  if (syncedStudents !== delivery.students) { setSyncedStudents(delivery.students); setReleased(Object.fromEntries((delivery.students || []).map((student) => [student.id, Boolean(student.released)]))) }
  if (!delivery.uploaded) return <p className="muted small-text">La revisión por alumno estará disponible cuando se cargue la hoja.</p>
  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/repositorio/evaluation-documents/${delivery.document.id}/release-status`, { students: Object.entries(released).map(([id, value]) => ({ student_id: id, released: value && !(item.readiness?.students || []).some((entry) => String(entry.id) === String(id) && entry.denial) })) })
      toast.success('Liberación actualizada.')
      onChanged()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  return (
    <div className="stack-tight">
      <h4 className="card-title-sm">Alumnos liberados</h4>
      {!item.puede_revisar && <p className="muted small-text">La liberación la deciden la jefatura, la asistencia o la coordinación de proyectos.</p>}
      {(delivery.students || []).map((student) => {
        const denied = (item.readiness?.students || []).some((entry) => String(entry.id) === String(student.id) && entry.denial)
        return <Switch key={student.id} checked={!denied && released[student.id]} disabled={!item.puede_revisar || denied} onChange={(value) => setReleased({ ...released, [student.id]: value })} label={denied ? `${fullName(student)} (presentación negada)` : fullName(student)} />
      })}
      {item.puede_revisar && <Button size="sm" variant="success" icon={FiUserCheck} loading={saving} onClick={save}>Guardar liberación</Button>}
    </div>
  )
}

function ThesisUpload({ user, onUploaded }) {
  const [form, setForm] = useState({ nombre: '', descripcion: '', autores: '' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async () => {
    if (!file) return toast.warning('Selecciona un archivo antes de guardar.')
    if (!['pdf', 'doc', 'docx'].includes(file.name.split('.').pop().toLowerCase())) return toast.error('Formato no permitido. Usa: PDF, DOC, DOCX')
    const body = new FormData()
    body.append('tipo', 'tesis')
    body.append('nombre', form.nombre.trim() || 'Avance de tesis o residencias')
    body.append('descripcion', form.descripcion.trim() || 'Avance privado para revisión.')
    body.append('autores', form.autores.trim() || fullName(user))
    body.append('archivo', file)
    setSaving(true)
    try { await api.post('/repositorio/thesis-documents', body, { timeout: 120_000 }); toast.success('Avance guardado en repositorio privado.'); setFile(null); setForm({ nombre: '', descripcion: '', autores: '' }); onUploaded() } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
    return undefined
  }
  return (
    <Card title="Subir avance de tesis de 9°" subtitle="¿Haces residencia? Sube tus documentos en Seguimiento académico → Residencias.">
      <div className="form-grid">
        <Field label="Nombre del avance"><input className="control" maxLength={255} value={form.nombre} onChange={set('nombre')} /></Field>
        <Field label="Autores"><input className="control" maxLength={1000} value={form.autores} onChange={set('autores')} placeholder={fullName(user)} /></Field>
        <Field label="Descripción breve" full><input className="control" maxLength={5000} value={form.descripcion} onChange={set('descripcion')} /></Field>
        <div className="full"><FileDrop accept=".pdf,.doc,.docx" file={file} onFile={setFile} hint="PDF, DOC o DOCX. Se guarda privado hasta que la administración lo publique." /></div>
        <div className="form-actions full"><Button icon={FiUploadCloud} loading={saving} onClick={submit}>Guardar avance</Button></div>
      </div>
    </Card>
  )
}

function ThesisDocument({ document, canPublish, onChanged }) {
  const isPublic = document.visibility === 'public'
  const toggle = async () => {
    const ok = await confirmAction({ title: isPublic ? 'Marcar como privado' : 'Publicar documento', text: isPublic ? 'El documento dejará de ser visible para visitantes del repositorio.' : 'El documento será visible en el repositorio público.', confirmText: isPublic ? 'Hacer privado' : 'Publicar' })
    if (!ok) return
    try { await api.post(`/repositorio/${document.id}/publish`, { public: !isPublic }); toast.success(isPublic ? 'Documento marcado como privado.' : 'Documento publicado.'); onChanged() } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Card title={document.nombre} subtitle={document.descripcion} actions={<div className="row-wrap"><Badge tone={document.document_category === 'thesis_residency' ? 'info' : 'primary'}>{document.document_category === 'thesis_residency' ? 'Residencias' : 'Tesis'}</Badge><Badge tone={isPublic ? 'success' : 'warning'}>{isPublic ? 'Publicado' : 'Privado'}</Badge></div>}>
      <div className="row-wrap">
        <small className="muted">{document.uploader ? fullName(document.uploader) : 'Sin carga'} · {formatDate(document.created_at)}</small>
        <span className="spacer" />
        <Button size="sm" variant="ghost" icon={FiDownload} onClick={() => download(document)}>Descargar</Button>
        {canPublish && <Button size="sm" variant={isPublic ? 'ghost' : 'success'} onClick={toggle}>{isPublic ? 'Hacer privado' : 'Publicar'}</Button>}
      </div>
    </Card>
  )
}
