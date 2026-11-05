export const fullName = (user) => [user?.nombres, user?.apa, user?.ama].filter(Boolean).join(' ') || 'Sin nombre'
export const publicAssetUrl = (path) => {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const apiBase = (import.meta.env.VITE_API_URL || 'https://api.swgpi.online/api').replace(/\/api\/?$/, '')
  return `${apiBase}/storage/${String(path).replace(/^\/?(storage\/)?/, '')}`
}
export const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date)
}
export const roomDisplayIdentifier = (room) => {
  if (room?.display_identifier) return room.display_identifier
  const labels = { 1: '1ro', 2: '2do', 3: '3ro', 4: '4to', 5: '5to', 6: '6to', 7: '7mo', 8: '8vo', 9: '9no', 10: '10mo' }
  const semester = Number(room?.semestre || 0)
  const date = new Date(room?.fecha_evaluacion || room?.inicia_en || Date.now())
  const half = date.getMonth() < 6 ? 1 : 2
  const year = String(date.getFullYear()).slice(-2)
  return `${labels[semester] || `${semester}to`}-${half}-${year}`
}
export const roomDisplayName = (room) => room?.display_name || `${room?.nombre || 'Sin sala'} · ${roomDisplayIdentifier(room)}`
const STATUS_LABELS = {
  borrador: 'Borrador', pendiente: 'Pendiente', en_revision: 'En revisión', enviado: 'Enviado', revisado: 'Revisado',
  aprobado: 'Aprobado', publicado: 'Publicado', cerrado: 'Cerrado', finalizado: 'Finalizado', archivado: 'Archivado',
  requiere_cambios: 'Requiere cambios', rechazado: 'Rechazado', activo: 'Activo', inactivo: 'Inactivo', vencido: 'Vencido',
  completado: 'Completado', en_progreso: 'En progreso', programada: 'Programada', en_curso: 'En curso',
}
export const statusLabel = (value = '') => STATUS_LABELS[value] || String(value || '').replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase())
export const statusTone = (value = '') => {
  const state = value.toLowerCase()
  if (['aprobado', 'activo', 'publicado', 'revisado', 'completado'].includes(state)) return 'success'
  if (['rechazado', 'reprobado', 'inactivo', 'vencido'].includes(state)) return 'danger'
  if (['enviado', 'requiere_cambios', 'en_revision', 'pendiente'].includes(state)) return 'warning'
  return 'neutral'
}
export const formatDateTime = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
export const percent = (value, total) => (Number(total) > 0 ? Math.round((Number(value || 0) / Number(total)) * 100) : 0)
/** Colecciones de Laravel que llegan como objeto ({0: …}) o como arreglo. */
export const asList = (value) => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [])

/** Texto sin acentos ni mayúsculas, para comparar búsquedas. */
export const plainText = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
/** Cada palabra buscada debe aparecer en el texto, en cualquier orden: «perez juan» encuentra a «Juan Pérez». */
export const matchesSearch = (text, term) => {
  const haystack = plainText(text)
  return plainText(term).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))
}
