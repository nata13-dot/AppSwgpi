import { activeProfileId } from './permissions'
import { formatDate, formatDateTime, parseDay } from '../utils/formatters'

/** Avisos del sistema (ajustes públicos) que aplican a quien navega, como en Frontend_Swgpi/includes/footer.php. */
export function noticesForUser(notices, user, { isHome = false } = {}) {
  if (!Array.isArray(notices)) return []
  const profile = activeProfileId(user)
  const role = [1, 4].includes(profile) ? 'admin' : profile === 2 ? 'teacher' : profile === 3 ? 'student' : 'public'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const matches = (notice) => {
    const audience = notice.audience || 'all'
    if (audience === 'all') return true
    if (audience === 'index') return isHome
    if (audience === 'authenticated') return Boolean(user)
    if (audience === 'academic') return ['teacher', 'student'].includes(role)
    return audience === role
  }
  return notices
    .filter((notice) => notice && notice.active !== false && notice.message && matches(notice))
    .filter((notice) => !(notice.starts_at && parseDay(notice.starts_at) > today) && !(notice.ends_at && parseDay(notice.ends_at) < today))
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
}

// La API cambia updated_at al crear o modificar un aviso: con otra clave vuelve a mostrarse y a contar como no leído.
export const noticeKey = (notice) => `${notice.id || notice.title}|${notice.updated_at || notice.created_at || ''}`

/** Vigencia completa: "Vigente del 12 nov 2026 al 13 nov 2026", "desde…", "hasta…" o sin fechas. */
export function noticeValidity(notice) {
  if (notice.starts_at && notice.ends_at) return `Vigente del ${formatDate(notice.starts_at)} al ${formatDate(notice.ends_at)}`
  if (notice.ends_at) return `Vigente hasta el ${formatDate(notice.ends_at)}`
  if (notice.starts_at) return `Vigente desde el ${formatDate(notice.starts_at)}, sin fecha de cierre`
  return 'Sin fecha de cierre'
}

/** Cuándo se publicó y, si se modificó después, cuándo (con hora). */
export function noticePublished(notice) {
  if (!notice.created_at && !notice.updated_at) return ''
  if (notice.updated_at && notice.created_at && notice.updated_at !== notice.created_at) return `Publicado ${formatDateTime(notice.created_at)} · actualizado ${formatDateTime(notice.updated_at)}`
  return `Publicado ${formatDateTime(notice.updated_at || notice.created_at)}`
}

export function readNoticeKeys() {
  try { return new Set(JSON.parse(localStorage.getItem('sgpi-read-notifications') || '[]')) } catch { return new Set() }
}

export function markNoticesRead(notices) {
  const keys = readNoticeKeys()
  notices.forEach((notice) => keys.add(noticeKey(notice)))
  try { localStorage.setItem('sgpi-read-notifications', JSON.stringify([...keys])) } catch { /* sólo se pierde el contador */ }
}
