import { fullName } from '../../utils/formatters'

export const ROOM_STAGES = { 5: 'Propuesta', 6: 'Avance', 7: 'Avance', 8: 'Titulación' }
// Pueden evaluar los mismos perfiles que acepta la API.
export const EVALUATOR_PROFILES = { 1: 'Administrativo', 2: 'Docente', 5: 'Jefatura', 6: 'Asistencia de jefatura', 7: 'Coordinación' }

// La API manda los apellidos con dos nombres (apa y apellido_paterno): se toma uno de cada uno.
export const personName = (user) => [user?.nombres, user?.apa ?? user?.apellido_paterno, user?.ama ?? user?.apellido_materno].filter(Boolean).join(' ') || user?.id || ''
export const projectSemester = (project) => Number(project?.presentation_semester ?? project?.semestre ?? 0)
export const academicSemester = (project) => Number(project?.academic_semester ?? project?.semestre ?? 0)
export const authorsOf = (project) => (project?.students || []).map(personName).filter(Boolean).join(', ')
export const companyOf = (project) => project?.company_name || project?.empresa?.nombre || ''
export const categoryOf = (project) => (project?.tipo === 'tesis' ? 'Tesis' : project?.modalidad === 'dual' ? 'Dual' : project?.modalidad === 'caso_integrador' ? 'Caso integrador' : null)

export const parseDate = (value) => {
  if (!value) return null
  const date = new Date(String(value).includes('T') ? String(value) : String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}
const pad = (value) => String(value).padStart(2, '0')
export const toInput = (date) => (date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}` : '')
// La API entrega "YYYY-MM-DD HH:MM:SS"; datetime-local exige la "T".
export const apiToInput = (value) => (value ? String(value).replace(' ', 'T').slice(0, 16) : '')
export const nextMinute = () => { const date = new Date(); date.setSeconds(0, 0); date.setMinutes(date.getMinutes() + 1); return toInput(date) }
export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000)

export const roomRange = (room) => {
  const start = parseDate(room.fecha_evaluacion)
  const end = parseDate(room.fecha_fin_evaluacion)
  return { start, end: end || (start ? addMinutes(start, 60) : null) }
}
const overlaps = (startA, endA, startB, endB) => startA && endA && startB && endB && startA < endB && endA > startB

/** Salas que chocan con el horario elegido y lo que dejan ocupado (docentes, salón y proyectos). */
export function busyFor(rooms, { id, start, end }) {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  const conflicts = !startDate || !endDate || endDate <= startDate ? [] : rooms.filter((room) => {
    if (id && String(room.id) === String(id)) return false
    const range = roomRange(room)
    return overlaps(startDate, endDate, range.start, range.end)
  })
  const teachers = new Map()
  conflicts.forEach((room) => (room.teachers || []).forEach((teacher) => teachers.set(String(teacher.id), room)))
  return {
    rooms: conflicts,
    teachers,
    projects: new Set(conflicts.flatMap((room) => (room.projects || []).map((project) => Number(project.id)))),
    classrooms: new Map(conflicts.filter((room) => room.salon_id).map((room) => [String(room.salon_id), room])),
  }
}

export const orderedProjects = (room) => [...(room?.projects || [])].sort((a, b) => {
  const orderA = Number(a.presentation_order ?? a.pivot?.presentation_order ?? 0)
  const orderB = Number(b.presentation_order ?? b.pivot?.presentation_order ?? 0)
  if (orderA && orderB && orderA !== orderB) return orderA - orderB
  if (orderA !== orderB) return orderA ? -1 : 1
  return String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' })
})

export const normalizeRoomName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
  if (/^SALA\s+\d+/.test(clean)) return clean
  const number = clean.match(/\d+/)?.[0] || ''
  return number ? `SALA ${number}` : clean
}

/** El número de sala libre más bajo en ese horario (la API sólo impide repetir nombre en el mismo horario). */
export const suggestRoomName = (conflicts) => {
  const used = new Set(conflicts.map((room) => Number(String(room.nombre || '').match(/(\d+)/)?.[1] || 0)))
  let number = 1
  while (used.has(number)) number++
  return `SALA ${number}`
}

/** Datos de una sala existente con otra lista de proyectos (asignación desde la vista "Por proyecto"). */
export const roomPayload = (room, projects = orderedProjects(room)) => ({
  nombre: room.nombre, salon: room.salon || null, salon_id: room.salon_id, semestre: room.semestre,
  responsible_teacher_id: room.responsible_teacher_id || room.responsible_teacher?.id || null,
  fecha_evaluacion: room.fecha_evaluacion, fecha_fin_evaluacion: room.fecha_fin_evaluacion,
  teacher_evaluation_minutes: Number(room.teacher_evaluation_minutes || 15), project_presentation_minutes: Number(room.project_presentation_minutes || 20),
  max_attempts: Number(room.max_attempts || 1), teacher_ids: (room.teachers || []).map((teacher) => teacher.id),
  project_ids: projects.map((project) => Number(project.id)),
  project_order: Object.fromEntries(projects.map((project, index) => [project.id, Number(project.presentation_order || project.pivot?.presentation_order || index + 1)])),
})

export const roomSearchText = (room, displayName) => [displayName, room.salon, fullName(room.responsible_teacher), ...(room.teachers || []).map(fullName), ...(room.projects || []).map((project) => project.title)].join(' ').toLowerCase()
