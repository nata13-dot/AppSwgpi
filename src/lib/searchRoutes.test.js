import { describe, expect, it } from 'vitest'
import { matchesSearch } from '../utils/formatters'
import { recordPath } from './searchRoutes'

describe('matchesSearch', () => {
  it('ignora acentos, mayúsculas y orden de las palabras', () => {
    expect(matchesSearch('Juan Carlos Pérez', 'PEREZ juan')).toBe(true)
    expect(matchesSearch('Juan Carlos Pérez', 'juan lopez')).toBe(false)
  })
  it('sin término coincide con todo', () => {
    expect(matchesSearch('Cualquier cosa', '   ')).toBe(true)
  })
})

describe('recordPath', () => {
  const student = { active_profile_id: 3, perfil_id: 3 }
  const head = { active_profile_id: 5, perfil_id: 5 }
  it('codifica lo que se envía en la URL', () => {
    expect(recordPath('rooms', { filter: 'Sala 2 & más' }, head)).toBe('/evaluation-rooms?q=Sala%202%20%26%20m%C3%A1s')
  })
  it('lleva al alumno a sus propias pantallas', () => {
    expect(recordPath('projects', { id: 4 }, student)).toBe('/proposals')
    expect(recordPath('projects', { id: 4 }, head)).toBe('/projects?id=4')
  })
})
