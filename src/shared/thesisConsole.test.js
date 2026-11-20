// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/dom'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'
import { mountThesisConsole } from './thesisConsole'

let dispose
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })

const detail = (role, extra = {}) => ({ data: {
  course: { id: 4, titulo: 'Tesis <i>uno</i>', estado: 'activo', alumno: { id: 's1', nombre: 'Ana' }, proyecto: { id: 9, titulo: 'T' } },
  me: { role, id: role === 'student' ? 's1' : 'd1', can_manage: role === 'staff', can_review: role === 'reviewer', can_submit: role === 'student' },
  general: 72.5, aprobatoria: 70, puede_liberar: false,
  capitulos: [
    { id: 11, numero: 1, titulo: 'Introducción', estado: 'aprobado', envio_id: 50, revisados: 2, revisores: 2, promedio: role === 'student' ? null : 85, revisiones: role === 'student' ? [] : [{ docente_id: 'd1', nombre: 'Doc Uno', puntaje: 90 }] },
    { id: 12, numero: 2, titulo: 'Marco', estado: 'sin_entregar', envio_id: null, revisados: 0, revisores: 2, promedio: null, revisiones: [] },
  ],
  revisores: [{ id: 'd1', nombre: 'Doc Uno', rol: 'director' }],
  plan: [{ id: 3, numero: 1, titulo: 'Entrega 1', fecha_limite: null, capitulos: [1, 2], entregado: false }],
  envios: [{ id: 50, numero: 1, capitulos: [11], vigentes: [11], comentario: 'Hola', enviado_en: '2026-11-10T10:00:00Z', anotaciones: [{ id: 1, pagina: 4, texto: 'Cita', nombre: 'Doc Uno', mia: role === 'reviewer' }],
    revisiones: [{ capitulo_id: 11, docente_id: 'd1', nombre: 'Doc Uno', puntaje: role === 'student' ? null : 90, comentario: 'Muy bien' }] }],
  ...extra,
} })
const setup = (profile, responses) => {
  const root = document.createElement('div'); document.body.append(root)
  const api = vi.fn(async (method, path, body) => {
    const response = responses[`${method} ${path}`] ?? responses[path]
    return typeof response === 'function' ? response(body) : response || { data: [] }
  })
  dispose = mountThesisConsole(root, api, { id: 'u', active_profile_id: profile }, { confirm: () => Promise.resolve(true) })
  return { root, api }
}

describe('thesis console', () => {
  it('ships identical code to the PHP client', () => {
    expect(readFileSync(resolve(process.cwd(), '../Frontend_Swgpi/assets/js/thesis-console.js'), 'utf8'))
      .toBe(readFileSync(resolve(process.cwd(), 'src/shared/thesisConsole.js'), 'utf8'))
  })

  it('opens the only course of a student and shows the general score without per-teacher scores', async () => {
    const { root } = setup(3, { '/thesis': { data: [{ id: 4, titulo: 'T', estado: 'activo', alumno: 'Ana', capitulos: 2, aprobados: 1, general: 72.5, por_revisar: 0, revisores: [] }] }, '/thesis/4': detail('student') })
    await waitFor(() => expect(root.textContent).toContain('Nueva entrega'))
    expect(root.textContent).toContain('72.5')
    expect(root.textContent).toContain('Muy bien')
    expect(root.querySelector('.tc-chapter-score')).toBeNull()
    expect(root.querySelector('.tc-review .ac-chip')).toBeNull()
    expect(root.querySelector('i')).toBeNull()
    expect(window.location.search).toContain('course=4')
  })

  it('sends the PDF with the selected chapters', async () => {
    const sent = vi.fn(() => ({ message: 'ok' }))
    window.history.replaceState(null, '', '/?course=4')
    const { root } = setup(3, { '/thesis/4': detail('student'), 'POST /thesis/4/submissions': sent })
    await waitFor(() => expect(root.textContent).toContain('Nueva entrega'))
    const form = [...root.querySelectorAll('.ac-panel')].find((p) => p.textContent.startsWith('Nueva entrega')).querySelector('form')
    const file = new File(['%PDF'], 'tesis.pdf', { type: 'application/pdf' })
    Object.defineProperty(form.querySelector('input[type=file]'), 'files', { value: [file] })
    form.querySelector('select').value = '3'
    fireEvent.change(form.querySelector('select'))
    fireEvent.submit(form)
    await waitFor(() => expect(sent).toHaveBeenCalled())
    const body = sent.mock.calls[0][0]
    expect(body.getAll('capitulos[]')).toEqual(['11', '12'])
    expect(body.get('plan_id')).toBe('3')
    expect(body.get('archivo').name).toBe('tesis.pdf')
  })

  it('lets a reviewer score a current chapter and see teacher scores', async () => {
    const saved = vi.fn(() => ({ message: 'ok' }))
    window.history.replaceState(null, '', '/?course=4')
    const { root } = setup(2, { '/thesis/4': detail('reviewer'), 'PUT /thesis/submissions/50/chapters/11/review': saved })
    await waitFor(() => expect(root.textContent).toContain('Actualizar revisión'))
    expect(root.querySelector('.tc-chapter-score').textContent).toContain('85')
    const form = root.querySelector('.tc-review-block form')
    form.querySelector('input[type=number]').value = '77'
    form.querySelector('textarea').value = 'Ajusta'
    fireEvent.submit(form)
    await waitFor(() => expect(saved).toHaveBeenCalledWith({ puntaje: 77, comentario: 'Ajusta' }))
  })
})
