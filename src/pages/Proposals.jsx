import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCheck, FiClock, FiEdit3, FiLock, FiPlus, FiRefreshCw, FiSend, FiSettings, FiTrash2, FiUnlock, FiUserCheck, FiUserPlus, FiUsers, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { canManageProjects, isStudent, viewAs } from '../lib/permissions'
import { formatDateTime, fullName } from '../utils/formatters'
import { Badge, Button, Card, Chips, confirmAction, Empty, ErrorState, Field, IconButton, Loading, Page, promptText, Tabs } from '../components/ui'

export default function ProposalsPage() {
  const { user } = useAuth()
  if (isStudent(user)) return <StudentProposal />
  return <ProposalValidation manager={canManageProjects(user)} />
}

const STATUS = {
  pendiente: ['warning', 'Pendiente de validación'],
  requiere_cambios: ['info', 'Requiere cambios'],
  aprobado: ['success', 'Aprobada'],
  rechazado: ['danger', 'Rechazada'],
}
const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.[0] || 'neutral'}>{STATUS[status]?.[1] || status}</Badge>
const shortName = (person) => [String(person?.nombres || '').split(' ')[0], person?.apa || person?.apellido_paterno].filter(Boolean).join(' ')
const toLocalInput = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const COMPANY_FIELDS = [['company_name', 'Empresa o negocio'], ['company_giro', 'Giro'], ['company_contact_name', 'Persona a cargo'], ['company_contact_position', 'Puesto']]
const EMPTY_FORM = { title: '', description: '', objetivo_general: '', objetivos: [''], company_name: '', company_giro: '', company_contact_name: '', company_contact_position: '', company_address: '', company_contact_phone: '', company_contact_email: '' }
const formFrom = (project) => ({
  ...Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, project?.[key] || ''])),
  objetivos: project?.objetivos?.length ? [...project.objetivos] : [''],
})

/** Formulario de propuesta: datos del proyecto, objetivos y empresa (contacto opcional). */
function ProposalForm({ initial, submitLabel, onSubmit }) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const setObjective = (index, value) => setForm({ ...form, objetivos: form.objetivos.map((item, position) => (position === index ? value : item)) })

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try { await onSubmit({ ...form, objetivos: form.objetivos.map((item) => item.trim()).filter(Boolean) }) } finally { setSaving(false) }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Nombre del proyecto" full><input className="control" required maxLength={255} value={form.title} onChange={set('title')} /></Field>
      <Field label="Descripción" full><textarea className="control" rows={4} required value={form.description} onChange={set('description')} /></Field>
      <Field label="Objetivo general" full><textarea className="control" rows={3} required value={form.objetivo_general} onChange={set('objetivo_general')} /></Field>
      <div className="full stack-tight">
        <span className="field-label">Objetivos específicos</span>
        {form.objetivos.map((objective, index) => (
          <div key={index} className="row-wrap objective-row">
            <span className="muted small-text">{index + 1}.</span>
            <input className="control grow" required={index === 0} aria-label={`Objetivo específico ${index + 1}`} value={objective} onChange={(event) => setObjective(index, event.target.value)} />
            {form.objetivos.length > 1 && <IconButton icon={FiTrash2} className="danger" label="Quitar objetivo" onClick={() => setForm({ ...form, objetivos: form.objetivos.filter((_, position) => position !== index) })} />}
          </div>
        ))}
        {form.objetivos.length < 12 && <Button type="button" size="sm" variant="soft" icon={FiPlus} onClick={() => setForm({ ...form, objetivos: [...form.objetivos, ''] })}>Agregar objetivo</Button>}
      </div>
      <h3 className="full section-title">Empresa o beneficiario</h3>
      {COMPANY_FIELDS.map(([key, label]) => <Field key={key} label={label}><input className="control" required value={form[key]} onChange={set(key)} /></Field>)}
      <Field label="Dirección" hint="Separa calle, número, colonia y municipio con comas (,)." full><input className="control" required value={form.company_address} onChange={set('company_address')} /></Field>
      <Field label="Teléfono de contacto" hint="Opcional"><input className="control" type="tel" inputMode="tel" value={form.company_contact_phone} onChange={set('company_contact_phone')} /></Field>
      <Field label="Correo de contacto" hint="Opcional"><input className="control" type="email" value={form.company_contact_email} onChange={set('company_contact_email')} /></Field>
      <div className="form-actions full"><Button type="submit" icon={FiSend} loading={saving}>{submitLabel}</Button></div>
    </form>
  )
}

/** Detalle de una propuesta: objetivos, empresa e integrantes. */
function ProposalDetails({ project }) {
  return (
    <>
      {project.description && <p className="muted small-text">{project.description}</p>}
      <dl className="meta-grid">
        <div className="wide"><dt>Integrantes</dt><dd>{(project.students || []).map(fullName).join(', ') || '—'}</dd></div>
        {project.subject_group && <div><dt>Grupo</dt><dd>{project.subject_group.nombre}</dd></div>}
        <div><dt>Empresa</dt><dd>{project.company_name || '—'}<br /><small className="muted">{[project.company_giro, project.company_contact_name, project.company_contact_position].filter(Boolean).join(' · ')}</small>
          {(project.company_contact_phone || project.company_contact_email) && <><br /><small className="muted">{[project.company_contact_phone, project.company_contact_email].filter(Boolean).join(' · ')}</small></>}</dd></div>
        {project.objetivo_general && <div className="wide"><dt>Objetivo general</dt><dd>{project.objetivo_general}</dd></div>}
        {project.objetivos?.length > 0 && <div className="wide"><dt>Objetivos específicos</dt><dd><ol className="objective-list">{project.objetivos.map((item, index) => <li key={index}>{item}</li>)}</ol></dd></div>}
      </dl>
    </>
  )
}

/** Registro de la propuesta del alumno o solicitud para unirse a la de un compañero. */
function StudentProposal() {
  const { user } = useAuth()
  const client = useQueryClient()
  const status = useQuery({ queryKey: ['proposal-student-status'], queryFn: () => api.get('/proposal/student-status').then((response) => response.data) })
  const [withPartner, setWithPartner] = useState(null)
  const groupProjects = useQuery({ queryKey: ['proposal-group-projects'], queryFn: () => api.get('/proposal/group-projects').then((response) => response.data), enabled: withPartner === true })
  const refresh = () => { client.invalidateQueries({ queryKey: ['proposal-student-status'] }); client.invalidateQueries({ queryKey: ['proposal-group-projects'] }) }
  const readOnly = Boolean(viewAs(user))
  const data = status.data
  const project = data?.project

  const run = async (request, message) => {
    try { const response = await request(); toast.success(response.data?.message || message); refresh() } catch (error) { toast.error(apiError(error)) }
  }
  const register = (values) => run(() => api.post('/proposal/register', values), 'Propuesta registrada')
  const correct = (values) => run(() => api.put('/proposal/mine', values), 'Corrección enviada')
  const join = (target) => run(() => api.post(`/proposal/projects/${target.id}/join-requests`), 'Solicitud enviada')
  const cancel = async () => {
    if (await confirmAction({ title: 'Cancelar solicitud', text: `Ya no pedirás unirte a ${data.my_request.project_title}.`, confirmText: 'Sí, cancelar' })) run(() => api.delete(`/proposal/join-requests/${data.my_request.id}`), 'Solicitud cancelada')
  }
  const answer = (request, decision) => run(() => api.put(`/proposal/join-requests/${request.id}`, { decision }), decision === 'aceptada' ? 'Integrante agregado' : 'Solicitud rechazada')

  const body = () => {
    if (data.profile_required) return <div className="alert-app warning">Completa tu perfil antes de registrar una propuesta.</div>
    if (project) {
      const canFix = project.proposal_status === 'requiere_cambios' && project.revision_allowed_until && new Date(project.revision_allowed_until) > new Date()
      const slots = Math.max(0, (data.max_members || 4) - (project.students || []).length)
      return (
        <>
          <Card title={project.title} subtitle={project.subject_group?.nombre} actions={<StatusBadge status={project.proposal_status} />}>
            {project.proposal_review_comment && <div className={`alert-app ${canFix ? 'warning' : ''}`}><strong>Observaciones:</strong> {project.proposal_review_comment}{canFix && <><br />Puedes corregir hasta {formatDateTime(project.revision_allowed_until)}.</>}</div>}
            {project.proposal_status === 'pendiente' && <p className="muted small-text"><FiClock aria-hidden="true" /> Espera la validación de coordinación, jefatura o de un docente designado.</p>}
            <ProposalDetails project={project} />
          </Card>
          {project.is_proposal && (
            <Card title="Solicitudes para unirse" subtitle={slots ? `Quedan ${slots} lugar${slots === 1 ? '' : 'es'} en el equipo.` : 'El equipo está completo.'}>
              {!(project.join_requests || []).length ? <p className="muted small-text">Nadie ha pedido unirse a tu proyecto.</p> : (
                <ul className="list-app">
                  {project.join_requests.map((request) => (
                    <li key={request.id} className="list-row">
                      <div><strong>{shortName(request)}</strong><small>{request.estudiante_id} · {formatDateTime(request.creada_en)}</small></div>
                      {!readOnly && <div className="row-wrap">
                        <Button size="sm" variant="success" icon={FiUserCheck} disabled={!slots} onClick={() => answer(request, 'aceptada')}>Aceptar</Button>
                        <Button size="sm" variant="ghost-danger" icon={FiX} onClick={() => answer(request, 'rechazada')}>Rechazar</Button>
                      </div>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {canFix && !readOnly && <Card title="Corregir propuesta"><ProposalForm initial={formFrom(project)} submitLabel="Enviar corrección" onSubmit={correct} /></Card>}
        </>
      )
    }
    if (data.my_request) return (
      <Card title="Solicitud enviada" actions={<Badge tone="warning">En espera</Badge>}>
        <p>Pediste unirte a <strong>{data.my_request.project_title}</strong>. Un integrante del proyecto debe aceptarte.</p>
        <p className="muted small-text">Enviada: {formatDateTime(data.my_request.creada_en)}</p>
        {!readOnly && <Button variant="ghost-danger" icon={FiX} onClick={cancel}>Cancelar solicitud</Button>}
      </Card>
    )
    if (!data.subject_group) return <div className="alert-app">No tienes un grupo asignado en el periodo actual. Pide a la jefatura que te asigne uno.</div>
    if (!data.window?.open) return <div className="alert-app">El registro de propuestas de tu carrera está cerrado.{data.window?.closes_at && <> Cerró el {formatDateTime(data.window.closes_at)}.</>}</div>

    return (
      <>
        {data.last_rejected && <div className="alert-app danger"><strong>Tu propuesta anterior fue rechazada:</strong> {data.last_rejected.titulo}{data.last_rejected.comentario_revision && <><br />{data.last_rejected.comentario_revision}</>}</div>}
        <div className="alert-app success">Registro abierto hasta {formatDateTime(data.window.closes_at)} · {data.subject_group.nombre}</div>
        <Card title="¿Desarrollas tu proyecto junto con un compañero?" subtitle="Si un compañero ya registró la propuesta, pide unirte a ella en lugar de registrarla otra vez.">
          <Chips options={[{ value: true, label: 'Sí, con un compañero' }, { value: false, label: 'No' }]} value={withPartner} onChange={setWithPartner} />
        </Card>
        {withPartner === true && (
          <Card title="Propuestas de tu grupo" subtitle="Elige la de tu compañero; un integrante debe autorizar tu solicitud.">
            {groupProjects.isLoading ? <Loading /> : groupProjects.isError ? <ErrorState error={groupProjects.error} onRetry={groupProjects.refetch} /> : !(groupProjects.data?.projects || []).length
              ? <Empty title="Aún no hay propuestas" message="Ningún compañero de tu grupo ha registrado una propuesta. Si tu compañero aún no la registra, uno de los dos debe elegir «No» y registrarla." icon={FiUsers} />
              : (
                <ul className="list-app">
                  {groupProjects.data.projects.map((item) => (
                    <li key={item.id} className="list-row">
                      <div><strong>{item.title}</strong><small>{item.members.join(', ') || 'Sin integrantes'} · {item.slots ? `${item.slots} lugar${item.slots === 1 ? '' : 'es'}` : 'Equipo completo'}</small></div>
                      {!readOnly && <Button size="sm" icon={FiUserPlus} disabled={!item.slots} onClick={() => join(item)}>Solicitar unirme</Button>}
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        )}
        {withPartner === false && !readOnly && <Card title="Registrar propuesta"><ProposalForm initial={EMPTY_FORM} submitLabel="Registrar propuesta" onSubmit={register} /></Card>}
      </>
    )
  }

  return (
    <Page title="Propuesta de proyecto" subtitle="Registra la propuesta de tu proyecto integrador o únete a la de tu compañero." actions={<Button variant="ghost" icon={FiRefreshCw} onClick={refresh}>Actualizar</Button>}>
      {status.isLoading ? <Loading /> : status.isError ? <ErrorState error={status.error} onRetry={status.refetch} /> : body()}
    </Page>
  )
}

/** Validación de propuestas: coordinación, jefatura, asistencia y docentes designados. */
function ProposalValidation({ manager }) {
  const [tab, setTab] = useState('review')
  return (
    <Page title="Propuestas" subtitle="Valida las propuestas para que pasen al resto del sistema.">
      {manager && <Tabs items={[{ key: 'review', label: 'Validar', icon: FiCheck }, { key: 'settings', label: 'Ventanas y validadores', icon: FiSettings }]} value={tab} onChange={setTab} />}
      {tab === 'settings' && manager ? <ProposalSettings /> : <ProposalReview />}
    </Page>
  )
}

function ProposalReview() {
  const { user } = useAuth()
  const client = useQueryClient()
  const [filter, setFilter] = useState('pendiente')
  const query = useQuery({ queryKey: ['proposal-teacher-projects'], queryFn: () => api.get('/proposal/teacher-projects').then((response) => response.data) })
  const readOnly = Boolean(viewAs(user))
  const all = query.data?.projects || []
  const list = filter ? all.filter((project) => project.proposal_status === filter) : all
  const count = (status) => all.filter((project) => project.proposal_status === status).length

  const review = async (project, status) => {
    let comment = ''
    let until = null
    if (status === 'aprobado') {
      if (!(await confirmAction({ title: 'Aprobar propuesta', text: `${project.title} pasará a Proyectos.`, confirmText: 'Sí, aprobar', icon: 'question' }))) return
    } else {
      comment = await promptText({ title: status === 'rechazado' ? 'Motivo del rechazo' : 'Cambios solicitados', placeholder: 'Observaciones para el equipo', confirmText: 'Continuar' })
      if (comment === null) return
    }
    if (status === 'requiere_cambios') {
      until = await promptText({ title: 'Permitir corrección hasta', input: 'datetime-local', confirmText: 'Guardar' })
      if (!until) return
    }
    try {
      await api.post(`/proposal/projects/${project.id}/review`, { proposal_status: status, proposal_review_comment: comment || null, revision_allowed_until: until })
      toast.success('Revisión registrada')
      client.invalidateQueries({ queryKey: ['proposal-teacher-projects'] })
    } catch (error) { toast.error(apiError(error)) }
  }

  if (query.isLoading) return <Loading rows={4} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data?.is_validator) return <Empty title="No validas propuestas" message="La coordinación o la jefatura deben designarte como docente validador de la carrera." icon={FiLock} />

  return (
    <>
      <div className="toolbar">
        <Chips options={[...Object.entries(STATUS).map(([value, [, label]]) => ({ value, label, count: count(value) })), { value: '', label: 'Todas', count: all.length }]} value={filter} onChange={setFilter} />
        <span className="spacer" />
        <IconButton icon={FiRefreshCw} label="Actualizar" onClick={() => query.refetch()} />
      </div>
      {!list.length ? <Empty message={filter ? `No hay propuestas en estado «${STATUS[filter]?.[1]}».` : 'No hay propuestas registradas.'} /> : (
        <div className="grid-2">
          {list.map((project) => (
            <Card key={project.id} title={project.title} subtitle={project.subject_group?.nombre} actions={<StatusBadge status={project.proposal_status} />}>
              <ProposalDetails project={project} />
              {project.proposal_review_comment && <div className="alert-app">{project.proposal_review_comment}</div>}
              {project.proposal_reviewer && <p className="muted small-text">Revisó: {fullName(project.proposal_reviewer)} · {formatDateTime(project.proposal_reviewed_at)}</p>}
              {!readOnly && project.proposal_status !== 'aprobado' && (
                <div className="row-wrap mt-2">
                  <Button size="sm" variant="success" icon={FiCheck} onClick={() => review(project, 'aprobado')}>Aprobar</Button>
                  <Button size="sm" variant="warning" icon={FiEdit3} onClick={() => review(project, 'requiere_cambios')}>Solicitar cambios</Button>
                  {project.proposal_status !== 'rechazado' && <Button size="sm" variant="ghost-danger" icon={FiX} onClick={() => review(project, 'rechazado')}>Rechazar</Button>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

/** Abre o cierra una ventana con fecha de cierre (autoregistro o registro de propuestas). */
/** Grupos de 5° que elige un alumno nuevo al registrarse. */
function NewStudentGroups({ groups, disabled, onChanged }) {
  const [value, setValue] = useState((groups || []).join(', '))
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await api.put('/proposal/settings/new-student-groups', { groups: value.split(/[\s,]+/).filter(Boolean) })
      toast.success('Grupos guardados')
      onChanged()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  return (
    <div className="row-wrap">
      <Field label="Grupos de 5° para alumnos nuevos" hint="Separados por coma. El registro sólo se abre de julio a diciembre."><input className="control" disabled={disabled} value={value} onChange={(event) => setValue(event.target.value)} /></Field>
      {!disabled && <Button size="sm" variant="ghost" loading={saving} onClick={save}>Guardar grupos</Button>}
    </div>
  )
}

function WindowControl({ title, subtitle, state, endpoint, disabled, onChanged, children }) {
  const [until, setUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (value) => {
    if (value === undefined && !until) return toast.warning('Indica la fecha y hora de cierre.')
    setSaving(true)
    try { const response = await api.put(endpoint, { until: value === undefined ? until : value }); toast.success(response.data.message); setUntil(''); onChanged() } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
    return undefined
  }
  return (
    <Card title={title} subtitle={subtitle} actions={<Badge tone={state.open ? 'success' : 'neutral'} icon={state.open ? FiUnlock : FiLock}>{state.open ? 'Abierto' : 'Cerrado'}</Badge>}>
      {state.open && <p className="small-text">Cierra: <strong>{formatDateTime(state.until || state.closes_at)}</strong></p>}
      {children}
      {!disabled && (
        <div className="row-wrap mt-2">
          <Field label={state.open ? 'Cambiar cierre' : 'Abrir hasta'}><input className="control" type="datetime-local" min={toLocalInput(new Date().toISOString())} value={until} onChange={(event) => setUntil(event.target.value)} /></Field>
          <Button icon={FiUnlock} loading={saving} onClick={() => save()}>{state.open ? 'Actualizar' : 'Abrir'}</Button>
          {state.open && <Button variant="ghost-danger" icon={FiLock} disabled={saving} onClick={() => save(null)}>Cerrar ahora</Button>}
        </div>
      )}
    </Card>
  )
}

function ProposalSettings() {
  const { user } = useAuth()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['proposal-settings'], queryFn: () => api.get('/proposal/settings').then((response) => response.data) })
  const [validators, setValidators] = useState(null)
  const [saving, setSaving] = useState(false)
  const refresh = () => client.invalidateQueries({ queryKey: ['proposal-settings'] })
  const readOnly = Boolean(viewAs(user))
  if (query.isLoading) return <Loading rows={3} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  const data = query.data
  const selected = validators ?? data.validator_ids.map(String)

  const saveValidators = async () => {
    setSaving(true)
    try { await api.put('/proposal/settings/validators', { teacher_ids: selected }); toast.success('Docentes validadores guardados'); setValidators(null); refresh() } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }

  return (
    <div className="stack">
      {!data.period && <div className="alert-app warning">La carrera no tiene un periodo abierto. Ábrelo en Operación académica antes de habilitar el autoregistro.</div>}
      <div className="grid-2">
        <WindowControl title="Autoregistro de alumnos" subtitle="Mientras esté abierto, el inicio de sesión muestra «Crear cuenta»." state={data.self_registration}
          endpoint="/proposal/settings/self-registration" disabled={readOnly || !data.self_registration.can_manage} onChanged={refresh}>
          <p className="muted small-text">Correo esperado: <strong>{data.self_registration.rule.example}</strong>. {data.self_registration.rule.description}</p>
          {!data.self_registration.can_manage && <p className="muted small-text">Lo abre la administración general o la jefatura.</p>}
          <NewStudentGroups groups={data.self_registration.groups} disabled={readOnly || !data.self_registration.can_manage} onChanged={refresh} />
        </WindowControl>
        <WindowControl title="Registro de propuestas" subtitle={`Los alumnos registran su propuesta o piden unirse a la de un compañero (máximo ${data.max_project_members} integrantes).`}
          state={data.proposal_window} endpoint="/proposal/settings/proposal-window" disabled={readOnly} onChanged={refresh} />
      </div>
      <Card title="Docentes validadores" subtitle="Además de coordinación, jefatura y asistencia, estos docentes pueden validar las propuestas de la carrera.">
        {!data.teachers.length ? <p className="muted small-text">No hay docentes activos en la carrera.</p> : (
          <>
            <div className="chips-wrap"><Chips multiple options={data.teachers.map((teacher) => ({ value: String(teacher.id), label: fullName(teacher) }))} value={selected} onChange={readOnly ? () => {} : setValidators} /></div>
            {!readOnly && <Button className="mt-2" icon={FiCheck} loading={saving} disabled={validators === null} onClick={saveValidators}>Guardar validadores</Button>}
          </>
        )}
      </Card>
    </div>
  )
}
