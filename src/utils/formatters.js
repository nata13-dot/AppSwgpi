export const fullName = (user) => [user?.nombres, user?.apa, user?.ama].filter(Boolean).join(' ') || 'Sin nombre'
export const publicAssetUrl = (path) => {
  if (!path) return ''
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '')
  return `${apiBase}/storage/${String(path).replace(/^\/?(storage\/)?/, '')}`
}
export const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date)
}
export const statusLabel = (value = '') => value.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase())
export const statusTone = (value = '') => {
  const state = value.toLowerCase()
  if (['aprobado', 'activo', 'publicado', 'revisado', 'completado'].includes(state)) return 'success'
  if (['rechazado', 'reprobado', 'inactivo', 'vencido'].includes(state)) return 'danger'
  if (['enviado', 'requiere_cambios', 'en_revision'].includes(state)) return 'warning'
  return 'neutral'
}
