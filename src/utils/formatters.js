export const fullName = (user) => [user?.nombres, user?.apa, user?.ama].filter(Boolean).join(' ') || 'Sin nombre'
export const formatDate = (value) => value
  ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
  : 'Sin fecha'
export const statusLabel = (value = '') => value.replaceAll('_', ' ').replace(/^\w/, (char) => char.toUpperCase())
export const statusTone = (value = '') => {
  const state = value.toLowerCase()
  if (['aprobado', 'activo', 'publicado', 'revisado', 'completado'].includes(state)) return 'success'
  if (['rechazado', 'reprobado', 'inactivo', 'vencido'].includes(state)) return 'danger'
  if (['enviado', 'requiere_cambios', 'en_revision'].includes(state)) return 'warning'
  return 'neutral'
}
