export const fullName = (user) => [user?.nombres, user?.apa, user?.ama].filter(Boolean).join(' ') || 'Sin nombre'
export const publicAssetUrl = (path) => {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const apiBase = (import.meta.env.VITE_API_URL || 'https://apiswgpi-production-0e59.up.railway.app/api').replace(/\/api\/?$/, '')
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
export const statusLabel = (value = '') => value.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase())
export const statusTone = (value = '') => {
  const state = value.toLowerCase()
  if (['aprobado', 'activo', 'publicado', 'revisado', 'completado'].includes(state)) return 'success'
  if (['rechazado', 'reprobado', 'inactivo', 'vencido'].includes(state)) return 'danger'
  if (['enviado', 'requiere_cambios', 'en_revision'].includes(state)) return 'warning'
  return 'neutral'
}
