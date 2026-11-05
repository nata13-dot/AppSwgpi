import { isStudent } from './permissions'

const withQuery = (path, value) => `${path}?q=${encodeURIComponent(value ?? '')}`

/** Pantalla de la app donde se abre un resultado del buscador general. */
export function recordPath(type, item, user) {
  switch (type) {
    case 'users': return withQuery('/users', item.id)
    // El alumno consulta su proyecto desde Propuestas: no tiene la pantalla de gestión.
    case 'projects': return isStudent(user) ? '/proposals' : `/projects?id=${encodeURIComponent(item.id)}`
    case 'deliverables': return isStudent(user) ? '/deliverables' : withQuery('/deliverables', item.filter)
    case 'rooms': return withQuery('/evaluation-rooms', item.filter)
    case 'documents': return `/repository/${encodeURIComponent(item.id)}`
    case 'companies': return withQuery('/companies', item.filter)
    case 'subjects': return withQuery('/subjects', item.filter)
    default: return '/dashboard'
  }
}
