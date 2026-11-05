import { useState } from 'react'
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheckCircle, FiChevronDown, FiChevronUp, FiCircle, FiSave, FiStar } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useSemesters } from '../../lib/semesters'
import { matchesSearch } from '../../utils/formatters'
import { Badge, Button, Field, SearchInput, Sheet, Steps } from '../../components/ui'
import { roomName } from '../evaluations/evaluationShared'
import {
  academicSemester, addMinutes, apiToInput, authorsOf, busyFor, categoryOf, companyOf, EVALUATOR_PROFILES, nextMinute, normalizeRoomName,
  orderedProjects, parseDate, personName, projectSemester, ROOM_STAGES, suggestRoomName, toInput,
} from './roomShared'

const STEPS = ['Cuándo y dónde', 'Proyectos', 'Evaluadores']
const matches = matchesSearch

function initialState(room) {
  if (!room) return { name: '', nameAuto: true, classroom: '', semester: '', start: '', end: '', endAuto: true, teacherMinutes: 15, presentationMinutes: 20, attempts: 1, projects: [], special: {}, teachers: [], responsible: '' }
  const start = parseDate(room.fecha_evaluacion)
  return {
    name: room.nombre || '', nameAuto: false, classroom: room.salon_id ? String(room.salon_id) : '', semester: String(room.semestre || ''),
    start: apiToInput(room.fecha_evaluacion), end: room.fecha_fin_evaluacion ? apiToInput(room.fecha_fin_evaluacion) : start ? toInput(addMinutes(start, 60)) : '',
    endAuto: false, teacherMinutes: room.teacher_evaluation_minutes || 15, presentationMinutes: room.project_presentation_minutes || 20, attempts: room.max_attempts || 1,
    projects: orderedProjects(room).map((project) => Number(project.id)), special: {},
    teachers: (room.teachers || []).map((teacher) => String(teacher.id)), responsible: String(room.responsible_teacher_id || room.responsible_teacher?.id || ''),
  }
}

/**
 * Alta y edición de sala en tres pasos con un resumen que dice qué falta (roomFormModal de evaluation-rooms.php).
 * Bloquea lo que ya está ocupado en el horario: docentes, salón y proyectos de otras salas.
 */
export default function RoomWizard({ room, rooms, projects, teachers, classrooms, onClose, onSaved }) {
  const editing = Boolean(room)
  const { semesters } = useSemesters('period', { min: 5, max: 8 })
  const [form, setForm] = useState(() => initialState(room))
  const [step, setStep] = useState(editing ? 1 : 0)
  const [search, setSearch] = useState({ projects: '', special: '', teachers: '' })
  const [specialOpen, setSpecialOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const semester = form.semester || String(semesters[0] || '')

  const specialIds = Object.keys(form.special).map(Number)
  const count = form.projects.length + specialIds.length
  const perProject = Number(form.teacherMinutes || 0) + Number(form.presentationMinutes || 0)
  const required = count * perProject
  const startDate = parseDate(form.start)
  // Mientras no se edite a mano, el fin se ajusta al tiempo que necesitan los proyectos marcados
  // y el nombre propone el número de sala libre en ese horario.
  const end = form.endAuto && !editing && startDate ? toInput(addMinutes(startDate, Math.max(30, required))) : form.end
  const endDate = parseDate(end)
  const available = startDate && endDate ? Math.round((endDate - startDate) / 60000) : 0
  const busy = busyFor(rooms, { id: room?.id, start: form.start, end })
  const name = form.nameAuto && !editing ? suggestRoomName(busy.rooms) : form.name

  // Proyectos del semestre libres en ese horario (más los que ya están en esta sala).
  const regular = projects.filter((project) => {
    const assigned = Number(project.assigned_room_id || 0)
    if (room && assigned === Number(room.id)) return true
    return String(projectSemester(project)) === semester && !assigned && (!busy.projects.has(Number(project.id)) || form.projects.includes(Number(project.id)))
  }).sort((a, b) => {
    const indexA = form.projects.indexOf(Number(a.id))
    const indexB = form.projects.indexOf(Number(b.id))
    if ((indexA >= 0) !== (indexB >= 0)) return indexA >= 0 ? -1 : 1
    if (indexA >= 0) return indexA - indexB
    return String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' })
  })
  // Casos especiales: proyectos de otro semestre que se evalúan con la etapa de esta sala.
  const specials = projects.filter((project) => projectSemester(project) && String(projectSemester(project)) !== semester && !Number(project.assigned_room_id || 0) && !busy.projects.has(Number(project.id)))
    .sort((a, b) => Math.abs(projectSemester(a) - Number(semester)) - Math.abs(projectSemester(b) - Number(semester)) || String(a.title || '').localeCompare(String(b.title || ''), 'es'))
  const orderedTeachers = [...teachers].sort((a, b) => {
    const busyA = busy.teachers.has(String(a.id)) && !form.teachers.includes(String(a.id))
    const busyB = busy.teachers.has(String(b.id)) && !form.teachers.includes(String(b.id))
    return Number(busyA) - Number(busyB)
  })

  const toggleProject = (id) => set({ projects: form.projects.includes(id) ? form.projects.filter((item) => item !== id) : [...form.projects, id] })
  const moveProject = (id, delta) => {
    const list = [...form.projects]
    const index = list.indexOf(id)
    if (index < 0 || index + delta < 0 || index + delta >= list.length) return
    ;[list[index], list[index + delta]] = [list[index + delta], list[index]]
    set({ projects: list })
  }
  const toggleSpecial = (id) => {
    const next = { ...form.special }
    if (id in next) delete next[id]; else next[id] = ''
    set({ special: next })
  }
  const toggleTeacher = (id) => {
    const teachersNext = form.teachers.includes(id) ? form.teachers.filter((item) => item !== id) : [...form.teachers, id]
    // Se propone como responsable al primer evaluador marcado.
    set({ teachers: teachersNext, responsible: teachersNext.includes(form.responsible) ? form.responsible : teachersNext[0] || '' })
  }
  const changeSemester = (value) => { if (!editing && value !== semester) set({ semester: value, projects: [], special: {} }) }
  const fitEnd = () => startDate && set({ end: toInput(addMinutes(startDate, Math.max(60, required))), endAuto: false })

  const classroom = classrooms.find((item) => String(item.id) === form.classroom)
  const responsible = teachers.find((teacher) => String(teacher.id) === form.responsible)
  const range = startDate ? `${startDate.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · ${startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}${endDate ? `–${endDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : ''}` : null
  const summary = [
    [Boolean(name.trim()), 'Sala', name.trim() || 'Sin nombre'],
    [Boolean(semester), 'Semestre', semester ? `${semester}° · ${ROOM_STAGES[semester] || ''}` : 'Elige el semestre'],
    [Boolean(range), 'Horario', range || 'Elige fecha y hora'],
    [Boolean(classroom), 'Salón', classroom?.nombre || 'Elige un salón'],
    [count > 0, 'Proyectos', count ? `${count} proyecto(s)${specialIds.length ? `, ${specialIds.length} caso(s) especial(es)` : ''}` : 'Marca al menos uno'],
    [form.teachers.length > 0, 'Evaluadores', form.teachers.length ? `${form.teachers.length} docente(s)` : 'Marca al menos uno'],
    [Boolean(responsible), 'Responsable', responsible ? personName(responsible) : 'Elige entre los evaluadores'],
  ]

  const save = async () => {
    const fail = (message, goTo) => { if (goTo !== undefined) setStep(goTo); toast.warning(message) }
    if (!startDate || !endDate || endDate <= startDate) return fail('La hora de fin de la sala debe ser posterior a la hora de inicio.', 0)
    const specialCases = specialIds.map((id) => ({ project_id: id, reason: String(form.special[id] || '').trim() }))
    if (specialCases.some((item) => item.reason.length < 10)) { setSpecialOpen(true); return fail('Escribe el motivo de cada caso especial (mínimo 10 caracteres).', 1) }
    if (!editing && available < required) return fail(`El horario no alcanza: se necesitan ${required} min para ${count} proyecto(s) y hay ${available} min. Usa "Ajustar fin" o reduce los tiempos.`, 0)
    if (!form.classroom) return fail('Elige el salón institucional de la sala.', 0)
    if (!name.trim() || !form.start) return fail('Indica el nombre de la sala y la fecha de evaluación.', 0)
    if (!editing && startDate < new Date()) return fail('La fecha de la sala debe ser posterior al momento actual.', 0)
    if (!form.teachers.length || (!editing && !count)) return fail(editing ? 'Selecciona al menos un docente para la sala.' : 'Selecciona al menos un docente y un proyecto para la sala.', !editing && !count ? 1 : 2)
    if (!form.responsible) return fail('Selecciona como encargado a uno de los docentes de la sala.', 2)
    // Orden consecutivo 1..n; los casos especiales pasan al final en el orden en que se marcaron.
    const ids = [...form.projects, ...specialIds]
    const payload = {
      nombre: normalizeRoomName(name), salon_id: Number(form.classroom), semestre: semester, responsible_teacher_id: form.responsible,
      fecha_evaluacion: form.start, fecha_fin_evaluacion: end, teacher_evaluation_minutes: Number(form.teacherMinutes),
      project_presentation_minutes: Number(form.presentationMinutes), max_attempts: Number(form.attempts), teacher_ids: form.teachers,
      project_ids: ids, project_order: Object.fromEntries(ids.map((id, index) => [id, index + 1])), special_cases: specialCases,
    }
    setSaving(true)
    try {
      if (editing) await api.put(`/evaluations/rooms/${room.id}`, payload)
      else await api.post('/evaluations/rooms', payload)
      toast.success(specialCases.length ? `Sala guardada con ${specialCases.length} caso(s) especial(es)` : 'Sala guardada')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      setSaving(false)
    }
    return undefined
  }

  return (
    <Sheet open title={editing ? `Editar ${room.nombre}` : 'Nueva sala'} subtitle={editing ? 'El horario se cambia con el botón Horario; aquí ajustas proyectos, orden y evaluadores.' : 'Tres pasos: cuándo y dónde, proyectos y evaluadores.'} onClose={onClose} size="xl"
      footer={<>
        <Button variant="ghost" icon={FiArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</Button>
        <span className="spacer" />
        {step < 2 && <Button variant="soft" onClick={() => setStep(step + 1)}>Siguiente <FiArrowRight /></Button>}
        <Button icon={FiSave} loading={saving} onClick={save}>Guardar sala</Button>
      </>}>
      <Steps steps={STEPS.map((label, index) => (index === 1 && count ? `${label} (${count})` : index === 2 && form.teachers.length ? `${label} (${form.teachers.length})` : label))} current={step} onSelect={setStep} />
      <div className="wizard-layout">
        <div className="wizard-main">
          {step === 0 && (
            <div className="stack">
              <div>
                <span className="field-label">Semestre que se evalúa</span>
                <div className="semester-chips" role="radiogroup" aria-label="Semestre">
                  {semesters.map((value) => (
                    <button type="button" key={value} role="radio" aria-checked={semester === String(value)} className={semester === String(value) ? 'active' : ''} disabled={editing && semester !== String(value)} onClick={() => changeSemester(String(value))}>
                      <strong>{value}°</strong><small>{ROOM_STAGES[value]}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <Field label="Inicio" hint={editing ? 'Para cambiar el horario usa el botón Horario de la sala.' : 'Debe ser posterior a la fecha actual.'}>
                  <input className="control" type="datetime-local" min={editing ? undefined : nextMinute()} readOnly={editing} value={form.start} onChange={(event) => set({ start: event.target.value })} />
                </Field>
                <Field label="Fin" hint="Se calcula solo con los proyectos; puedes cambiarlo.">
                  <input className="control" type="datetime-local" readOnly={editing} value={end} onChange={(event) => set({ end: event.target.value, endAuto: false })} />
                </Field>
                <Field label="Salón" hint="Los salones ocupados en ese horario aparecen bloqueados.">
                  <select className="control" value={form.classroom} onChange={(event) => set({ classroom: event.target.value })}>
                    <option value="">Selecciona salón institucional</option>
                    {classrooms.map((item) => {
                      const takenBy = busy.classrooms.get(String(item.id))
                      return <option key={item.id} value={item.id} disabled={Boolean(takenBy) && String(item.id) !== form.classroom}>{takenBy ? `${item.nombre} — ocupado por ${roomName(takenBy)}` : item.nombre}</option>
                    })}
                  </select>
                </Field>
                <Field label="Nombre de la sala" hint="Te sugerimos el siguiente número libre."><input className="control upper" placeholder="SALA 1" value={name} onChange={(event) => set({ name: event.target.value, nameAuto: false })} /></Field>
              </div>
              <details className="times-box">
                <summary>Tiempos por proyecto: <strong>{form.presentationMinutes} min de presentación + {form.teacherMinutes} de evaluación · {form.attempts} oportunidad{Number(form.attempts) === 1 ? '' : 'es'}</strong></summary>
                <div className="form-grid three mt-2">
                  <Field label="Presentación (min)"><input className="control" type="number" min={1} max={240} value={form.presentationMinutes} onChange={(event) => set({ presentationMinutes: event.target.value })} /></Field>
                  <Field label="Evaluación docente (min)"><input className="control" type="number" min={1} max={240} value={form.teacherMinutes} onChange={(event) => set({ teacherMinutes: event.target.value })} /></Field>
                  <Field label="Oportunidades"><input className="control" type="number" min={1} max={10} value={form.attempts} onChange={(event) => set({ attempts: event.target.value })} /></Field>
                </div>
              </details>
              <AvailabilityHint start={form.start} end={end} busy={busy} />
            </div>
          )}
          {step === 1 && (
            <div className="stack">
              <div className="toolbar">
                <SearchInput value={search.projects} onChange={(value) => setSearch({ ...search, projects: value })} placeholder="Buscar proyecto o integrante..." />
                <Button size="sm" variant="soft" onClick={() => set({ projects: [...new Set([...form.projects, ...regular.filter((project) => matches(`${project.title} ${authorsOf(project)}`, search.projects)).map((project) => Number(project.id))])] })}>Marcar todos</Button>
                <Button size="sm" variant="ghost" onClick={() => set({ projects: [] })}>Quitar todos</Button>
              </div>
              <p className="muted small-text">Marca los proyectos en el orden en que presentarán; ajusta el orden con las flechas.</p>
              <ul className="pick-list">
                {regular.filter((project) => matches(`${project.title} ${authorsOf(project)} ${companyOf(project)}`, search.projects)).map((project) => {
                  const order = form.projects.indexOf(Number(project.id)) + 1
                  const category = categoryOf(project)
                  return (
                    <li key={project.id} className={order ? 'picked' : ''}>
                      <label>
                        <input type="checkbox" checked={Boolean(order)} onChange={() => toggleProject(Number(project.id))} />
                        <span className={`order-badge ${order ? '' : 'empty'}`} title="Orden de presentación">{order || '–'}</span>
                        <span className="pick-text">
                          <strong>{project.title}</strong>
                          <span className="row-wrap">{category && <Badge tone="info">{category}</Badge>}{academicSemester(project) && academicSemester(project) !== Number(semester) && <Badge tone="warning">Caso especial: {academicSemester(project)}° evaluado como {semester}°</Badge>}</span>
                          <small>{authorsOf(project) || 'Sin integrantes registrados'}</small>
                          {companyOf(project) && <small>Empresa: {companyOf(project)}</small>}
                        </span>
                      </label>
                      {order > 0 && <span className="order-arrows"><button type="button" aria-label="Subir en el orden" disabled={order === 1} onClick={() => moveProject(Number(project.id), -1)}><FiChevronUp /></button><button type="button" aria-label="Bajar en el orden" disabled={order === form.projects.length} onClick={() => moveProject(Number(project.id), 1)}><FiChevronDown /></button></span>}
                    </li>
                  )
                })}
                {!regular.length && <li className="muted small-text">No hay proyectos de este semestre libres en ese horario. Revisa los casos especiales si es un proyecto de otro semestre.</li>}
              </ul>
              <details className="special-box" open={specialOpen} onToggle={(event) => setSpecialOpen(event.currentTarget.open)}>
                <summary><FiStar /> Casos especiales <Badge tone="warning">{specialIds.length}</Badge><small>Proyectos de otro semestre que se evaluarán con la etapa de esta sala; por ejemplo, alumnos de 7° que adelantaron materias y se evalúan como 8° para saber si van a titulación.</small></summary>
                <SearchInput value={search.special} onChange={(value) => setSearch({ ...search, special: value })} placeholder="Buscar proyecto de otro semestre..." />
                <ul className="pick-list mt-2">
                  {specials.filter((project) => matches(`${project.title} ${authorsOf(project)}`, search.special)).map((project) => {
                    const checked = Number(project.id) in form.special
                    return (
                      <li key={project.id} className={checked ? 'picked' : ''}>
                        <label>
                          <input type="checkbox" checked={checked} onChange={() => toggleSpecial(Number(project.id))} />
                          <span className="pick-text">
                            <strong>{project.title}</strong>
                            <span className="row-wrap">{categoryOf(project) && <Badge tone="info">{categoryOf(project)}</Badge>}<Badge>{projectSemester(project)}° → se evalúa como {semester}°</Badge></span>
                            <small>{authorsOf(project) || 'Sin integrantes registrados'}</small>
                          </span>
                        </label>
                        {checked && <input className="control mt-1" maxLength={500} autoFocus placeholder={`Motivo (mín. 10 caracteres), p. ej. adelantó materias de ${semester}°`} value={form.special[project.id]} onChange={(event) => set({ special: { ...form.special, [project.id]: event.target.value } })} />}
                      </li>
                    )
                  })}
                  {!specials.length && <li className="muted small-text">No hay proyectos de otros semestres disponibles en este horario.</li>}
                </ul>
              </details>
            </div>
          )}
          {step === 2 && (
            <div className="stack">
              <SearchInput value={search.teachers} onChange={(value) => setSearch({ ...search, teachers: value })} placeholder="Buscar evaluador..." />
              <p className="muted small-text">Un docente no puede estar en dos salas a la vez; los ocupados en ese horario aparecen bloqueados.</p>
              <ul className="pick-list grid">
                {orderedTeachers.filter((teacher) => matches(personName(teacher), search.teachers)).map((teacher) => {
                  const id = String(teacher.id)
                  const checked = form.teachers.includes(id)
                  const takenBy = busy.teachers.get(id)
                  return (
                    <li key={id} className={`${checked ? 'picked' : ''} ${takenBy && !checked ? 'busy' : ''}`}>
                      <label>
                        <input type="checkbox" checked={checked} disabled={Boolean(takenBy) && !checked} onChange={() => toggleTeacher(id)} />
                        <span className="pick-text"><strong>{personName(teacher)}</strong><small>{EVALUATOR_PROFILES[Number(teacher.perfil_id)] || 'Docente'}</small>{takenBy && <small className={checked ? 'text-danger' : ''}>Ocupado en {roomName(takenBy)}</small>}</span>
                      </label>
                    </li>
                  )
                })}
                {!teachers.length && <li className="muted small-text">No hay evaluadores activos.</li>}
              </ul>
              <Field label="Responsable de sala" hint="Se propone el primer evaluador que marques.">
                <select className="control" value={form.responsible} onChange={(event) => set({ responsible: event.target.value })}>
                  <option value="">{form.teachers.length ? 'Sin responsable' : 'Selecciona primero docentes'}</option>
                  {teachers.filter((teacher) => form.teachers.includes(String(teacher.id))).map((teacher) => <option key={teacher.id} value={teacher.id}>{personName(teacher)}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <aside className="wizard-summary" aria-label="Resumen de la sala">
          <h3>Resumen</h3>
          <ul>{summary.map(([ok, label, value]) => <li key={label} className={ok ? 'ok' : 'missing'}>{ok ? <FiCheckCircle /> : <FiCircle />}<small>{label}</small><span>{value}</span></li>)}</ul>
          <div className={`time-budget ${!count ? '' : available < required ? 'short' : 'ok'}`} aria-live="polite">
            {!count ? 'Marca proyectos para calcular el tiempo necesario.' : <>
              {available < required ? <FiAlertTriangle /> : <FiCheckCircle />} {count} proyecto(s) × {perProject} min = <strong>{required} min</strong> necesarios · disponibles <strong>{available} min</strong>
              {available < required && startDate && !editing && <Button size="sm" variant="link" onClick={fitEnd}>Ajustar fin</Button>}
            </>}
          </div>
        </aside>
      </div>
    </Sheet>
  )
}

function AvailabilityHint({ start, end, busy }) {
  if (!start || !end) return <p className="muted small-text">Selecciona hora de inicio y fin para ver qué docentes, salones y proyectos están libres.</p>
  if (parseDate(end) <= parseDate(start)) return <p className="small-text text-warning"><FiAlertTriangle /> La hora de fin debe ser posterior a la hora de inicio.</p>
  if (!busy.rooms.length) return <p className="muted small-text">Horario libre: no coincide con otras salas.</p>
  return <p className="small-text text-warning"><FiAlertTriangle /> Coincide con {busy.rooms.map(roomName).join(', ')}. Sus docentes, salón y proyectos quedan bloqueados para esta sala.</p>
}
