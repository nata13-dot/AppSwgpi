import { describe, expect, it } from 'vitest'
import { fullName, statusLabel, statusTone } from './formatters'

describe('formatters', () => {
  it('construye el nombre completo omitiendo datos vacíos', () => {
    expect(fullName({ nombres: 'Ana', apa: 'López', ama: null })).toBe('Ana López')
  })

  it('normaliza estados de la API para la interfaz', () => {
    expect(statusLabel('requiere_cambios')).toBe('Requiere cambios')
    expect(statusTone('aprobado')).toBe('success')
    expect(statusTone('rechazado')).toBe('danger')
  })
})
