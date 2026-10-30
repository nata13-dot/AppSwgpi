import { toast } from 'react-toastify'
import { downloadApiFile } from '../../utils/downloads'
import { fullName } from '../../utils/formatters'

/* eslint-disable react-refresh/only-export-components */

// Escalas por pregunta: las mismas reglas que App\Support\RubricScale en la API.
export const SCALE_NAMES = { acuerdo: 'Nivel de acuerdo', puntos_5: 'Puntaje del 1 al 5', puntos_10: 'Puntaje del 1 al 10' }
export const AGREEMENT_OPTIONS = [
  { value: 'completamente_en_desacuerdo', points: 1, label: 'Completamente en desacuerdo' },
  { value: 'en_desacuerdo', points: 2, label: 'En desacuerdo' },
  { value: 'nulo', points: 3, label: 'Nulo' },
  { value: 'de_acuerdo', points: 4, label: 'De acuerdo' },
  { value: 'completamente_de_acuerdo', points: 5, label: 'Completamente de acuerdo' },
]
export const STAGE_NAMES = { 5: 'Propuesta', 6: 'Avance', 7: 'Avance', 8: 'Titulación' }
export const stageLabel = (stage) => ({ propuesta: 'Propuesta', avance: 'Avance', titulacion: 'Titulación' })[stage] || stage || '—'

export const scaleOf = (criterion) => (SCALE_NAMES[criterion?.scale] ? criterion.scale : 'acuerdo')
export const scaleOptions = (scale) => {
  if (scale === 'acuerdo') return AGREEMENT_OPTIONS
  const max = scale === 'puntos_10' ? 10 : 5
  return Array.from({ length: max }, (_, index) => ({ value: String(index + 1), points: index + 1, label: String(index + 1) }))
}
/** La respuesta más baja vale 0 % y la más alta 100 %; así se promedian escalas distintas. */
export const scalePercentage = (scale, value) => {
  const option = scaleOptions(scale).find((item) => item.value === String(value))
  if (!option) return null
  const max = scale === 'puntos_10' ? 10 : 5
  return Math.round(((option.points - 1) / (max - 1)) * 10000) / 100
}
export const scalePreview = (scale) => (scale === 'acuerdo'
  ? 'Completamente en desacuerdo · En desacuerdo · Nulo · De acuerdo · Completamente de acuerdo'
  : scale === 'puntos_10' ? '1 (0 %) a 10 (100 %)' : '1 (0 %) a 5 (100 %)')

/** Aprobado desde 80 %, apenas cumple de 70 a 79.99 %, reprobado menos de 70 %. */
export const verdictFor = (average) => {
  if (average === null || average === undefined || Number.isNaN(Number(average))) return { key: 'sin_resultado', label: 'Sin resultado', tone: 'secondary' }
  if (average >= 80) return { key: 'aprobado', label: 'Aprobado', tone: 'success' }
  if (average >= 70) return { key: 'apenas_cumple', label: 'Apenas cumple', tone: 'warning' }
  return { key: 'reprobado', label: 'Reprobado', tone: 'danger' }
}
export function Verdict({ verdict, average }) {
  const value = verdict || verdictFor(average)
  return <span className={`verdict ${value.tone}`}>{value.label}</span>
}
export const VERDICT_RULE = 'Aprobado desde 80 % · Apenas cumple de 70 a 79 % · Reprobado menos de 70 %'

const ROOM_ORDINALS = { 1: '1ro', 2: '2do', 3: '3ro', 4: '4to', 5: '5to', 6: '6to', 7: '7mo', 8: '8vo', 9: '9no', 10: '10mo' }
export const roomIdentifier = (room) => {
  if (room?.display_identifier) return room.display_identifier
  const semester = Number(room?.semestre || 0)
  const date = new Date(room?.fecha_evaluacion || room?.inicia_en || Date.now())
  return `${ROOM_ORDINALS[semester] || `${semester}to`}-${date.getMonth() < 6 ? 1 : 2}-${String(date.getFullYear()).slice(-2)}`
}
export const roomName = (room) => room?.display_name || `${room?.nombre || 'Sin sala'} · ${roomIdentifier(room)}`

export const controlNumbers = (project) => (project?.students || []).map((student) => student.numero_control || student.control_number || student.no_control || student.id).filter(Boolean).join(', ')
export const projectCompany = (project) => project?.company_name || project?.empresa || project?.company?.name || project?.business_name || ''
export const projectDetailRows = (project) => [
  ['Integrantes', (project?.students || []).map(fullName).filter(Boolean).join(', ')],
  ['No. control', controlNumbers(project)],
  ['Empresa', projectCompany(project)],
  ['Giro', project?.company_giro || project?.giro],
  ['Contacto', project?.company_contact_name || project?.contact_name],
  ['Asesor', fullName(project?.advisor || project?.asesor || project?.teacher || project?.docente) === 'Sin nombre' ? '' : fullName(project?.advisor || project?.asesor || project?.teacher || project?.docente)],
  ['Descripción', project?.description || project?.descripcion],
].filter(([, value]) => String(value ?? '').trim() !== '')

/**
 * Reportes PDF. El completo (con nombres de evaluadores) sólo lo descargan jefatura y administración general;
 * el limitado (audience=teachers) oculta nombres y deja sólo comentarios generales.
 */
export async function downloadReport(kind, id, limited) {
  const base = kind === 'room' ? `/evaluations/rooms/${id}/report.pdf` : `/evaluations/${id}/report.pdf`
  const name = `${kind === 'room' ? 'reporte_sala' : 'reporte_evaluacion'}_${id}${limited ? '_limitado' : ''}.pdf`
  try {
    await downloadApiFile(limited ? `${base}?audience=teachers` : base, name, { headers: { Accept: 'application/pdf' }, timeout: 60_000 })
  } catch (error) {
    toast.error(error.message || 'No se pudo generar el reporte PDF.')
  }
}
