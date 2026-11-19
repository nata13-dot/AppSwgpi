// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/dom'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'
import { mountTrackingConsole } from './trackingConsole'

let dispose
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })

const summary = { proyectos: 2, avances: 1, borradores: 0, esperadas: 2, entregadas: 1, vencidas: 1, sin_calificar: 1, atrasadas: 0, promedio: null }
const course = { id: 7, asignatura: 'Taller de investigación', clave: 'TI1', semestre: 5, grupo: 'A', modalidades: ['proyecto_integrador', 'dual'], docentes: ['Ana Ruiz'], puede_editar: true }
const board = {
  course, resumen: summary, removed: [], template_pending: [{ id: 1, nombre: 'Avance final' }],
  deliverables: [{ id: 11, nombre: 'Avance 1', estado: 'publicado', fecha_limite: null, ponderacion: 40, tipo_documento: 'documento' }],
  projects: [
    { id: 3, titulo: '<b>Equipo uno</b>', modalidad: 'dual', origen: 'automatico', promedio: null, integrantes: [{ id: 's1', nombre: 'Uno' }, { id: 's2', nombre: 'Dos' }],
      celdas: [{ deliverable_id: 11, delivery_id: 90, estado: 'entregado', calificacion: null, comentario: null, ajustes: [], prorroga: null, archivo: 'a.pdf', version: 1 }] },
    { id: 4, titulo: 'Equipo dos', modalidad: 'proyecto_integrador', origen: 'manual', promedio: null, integrantes: [],
      celdas: [{ deliverable_id: 11, delivery_id: null, estado: 'vencido', calificacion: null, ajustes: [], prorroga: null }] },
  ],
}
const setup = (profile, responses = {}, tab = 'courses') => {
  const root = document.createElement('div'); document.body.append(root)
  const api = vi.fn(async (method, path, body) => {
    const response = responses[`${method} ${path}`] ?? responses[path]
    return typeof response === 'function' ? response(body) : response || { data: [] }
  })
  dispose = mountTrackingConsole(root, api, { id: 'u', active_profile_id: profile }, tab, { confirm: () => Promise.resolve(true) })
  return { root, api }
}
const findButton = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent === text)

describe('tracking console', () => {
  it('ships identical code to the PHP client', () => {
    expect(readFileSync(resolve(process.cwd(), '../Frontend_Swgpi/assets/js/tracking-console.js'), 'utf8'))
      .toBe(readFileSync(resolve(process.cwd(), 'src/shared/trackingConsole.js'), 'utf8'))
  })

  it.each([[2, false], [5, true], [7, true], [1, true]])('profile %i sees management tabs: %s', async (profile, staff) => {
    const { root } = setup(profile, { '/tracking/courses': { data: [], staff, configured: true, period_open: true } })
    await waitFor(() => expect(root.textContent).toContain('materias de seguimiento'))
    const tabs = [...root.querySelectorAll('nav button')].map((b) => b.textContent)
    expect(tabs.includes('Panorama de la carrera')).toBe(staff)
    expect(tabs.includes('Materias y plantillas')).toBe(staff)
  })

  it('opens a course board, renders text safely and grades a delivery with a comment', async () => {
    const graded = vi.fn(() => ({ message: 'ok' }))
    const { root, api } = setup(2, {
      '/tracking/courses': { data: [{ ...course, resumen: summary }], configured: true, period_open: true },
      '/tracking/courses/7': { data: board },
      'POST /deliverables/11/calificar': graded,
    })
    await waitFor(() => expect(findButton(root, 'Abrir tablero')).toBeTruthy())
    fireEvent.click(findButton(root, 'Abrir tablero'))
    await waitFor(() => expect(root.querySelector('.tc-matrix')).toBeTruthy())
    expect(root.querySelector('b')).toBeNull()
    expect(root.textContent).toContain('<b>Equipo uno</b>')
    expect(root.textContent).toContain('Agregar 1 de la plantilla')
    expect(window.location.search).toContain('course=7')
    fireEvent.click(root.querySelector('.tc-cell.warn'))
    await waitFor(() => expect(root.querySelector('.tc-detail')).toBeTruthy())
    const form = [...root.querySelectorAll('.tc-detail form')][0]
    form.querySelector('input[type=number]').value = '88'
    form.querySelector('textarea').value = 'Bien'
    fireEvent.submit(form)
    await waitFor(() => expect(graded).toHaveBeenCalledWith({ project_id: 3, calificacion: 88, comentarios: 'Bien' }))
    expect(api).toHaveBeenCalledWith('GET', '/tracking/courses/7')
  })

  it('offers an extension (not grading) for a team without delivery', async () => {
    window.history.replaceState(null, '', '/?course=7')
    const again = setup(2, { '/tracking/courses/7': { data: board } })
    await waitFor(() => expect(again.root.querySelector('.tc-cell.danger')).toBeTruthy())
    fireEvent.click(again.root.querySelector('.tc-cell.danger'))
    await waitFor(() => expect(again.root.textContent).toContain('Dar prórroga'))
    expect(again.root.textContent).not.toContain('Calificación del equipo')
  })

  it('saves modalities in the configuration tab', async () => {
    const created = vi.fn(() => ({ message: 'ok' }))
    const { root } = setup(5, {
      '/tracking/config': { data: { subjects: [], catalog: [{ id: 9, nombre: 'Taller', clave: 'T', semestres: [5] }] } },
      'POST /tracking/config': created,
    }, 'config')
    await waitFor(() => expect(root.textContent).toContain('Agregar materia'))
    const form = root.querySelector('form')
    form.querySelector('select').value = '9'
    const dual = [...form.querySelectorAll('label')].find((l) => l.textContent === 'Dual').querySelector('input')
    dual.checked = true
    fireEvent.submit(form)
    await waitFor(() => expect(created).toHaveBeenCalledWith({ asignatura_id: 9, modalidades: ['proyecto_integrador', 'dual'] }))
  })
})
