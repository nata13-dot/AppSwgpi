// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/dom'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'
import { mountAcademicConsole } from './academicConsole'

let dispose
const catalog = { periods: [{ id: 1, nombre: 'Actual' }], groups: [], members: [], projects: [], rooms: [], courses: [], advisors: [] }
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.restoreAllMocks() })
const setup = (profile, tab, responses = {}) => {
  const root = document.createElement('div'); document.body.append(root)
  const api = vi.fn(async (method, path, data) => {
    if (path === '/academic-operations/catalog') return catalog
    const response = responses[path]
    return typeof response === 'function' ? response(method, data) : response || { data: [] }
  })
  dispose = mountAcademicConsole(root, api, { id: 's', active_profile_id: profile }, tab)
  return { root, api }
}
const findButton = (root, title) => [...root.querySelectorAll('button')].find(b => b.textContent === title)

describe('shared academic client', () => {
  it('ships identical behavior to PHP', () => {
    expect(readFileSync(resolve(process.cwd(), '../Frontend_Swgpi/assets/js/academic-console.js'), 'utf8'))
      .toBe(readFileSync(resolve(process.cwd(), 'src/shared/academicConsole.js'), 'utf8'))
  })
  it.each([1, 2, 3, 4, 5, 6, 7])('shows the same permitted workflow navigation for profile %i in both clients', async profile => {
    const { root } = setup(profile, 'courses')
    await waitFor(() => expect(root.textContent).toContain('No hay cursos'))
    const labels = [...root.querySelectorAll('nav button')].map(b => b.textContent)
    expect(labels.includes('Perfiles')).toBe([1, 4, 5].includes(profile))
    expect(labels.includes('Periodos y matrícula')).toBe([1, 4, 5, 6].includes(profile))
    expect(labels.includes('Autorizaciones')).toBe(profile !== 3)
    expect(labels.includes('Residencias')).toBe(true)
  })
  it('does not expose management actions to students', async () => {
    const { root } = setup(3, 'courses')
    await waitFor(() => expect(root.textContent).toContain('No hay cursos'))
    expect(root.textContent).not.toContain('Perfiles')
    expect(root.textContent).not.toContain('Autorizaciones')
    expect(root.textContent).toContain('Residencias')
  })
  it('renders untrusted course names as text and submits enrollment', async () => {
    const { root, api } = setup(3, 'courses', { '/course-enrollments': { data: [{ id: 4, subject: { nombre: '<img src=x onerror=alert(1)>' }, group: { semestre: 5 } }] } })
    await waitFor(() => expect(root.querySelector('input[name=password]')).not.toBeNull())
    expect(root.querySelector('img')).toBeNull()
    fireEvent.change(root.querySelector('input'), { target: { value: 'secret-key' } })
    fireEvent.submit(root.querySelector('form'))
    await waitFor(() => expect(api).toHaveBeenCalledWith('POST', '/course-enrollments/4', { password: 'secret-key' }))
  })
  it('requires an explicit whole-project scope in approval payload', async () => {
    const { root, api } = setup(5, 'authorizations', { '/academic-operations/authorizations': { data: [{ id: 8, tipo: 'presentacion_semestre', estado: 'solicitada', version: 2 }] } })
    await waitFor(() => expect(findButton(root, 'Registrar resolución')).toBeDefined())
    const form = findButton(root, 'Registrar resolución').closest('form')
    fireEvent.change(form.querySelector('[name=status]'), { target: { value: 'aprobada' } })
    fireEvent.change(form.querySelector('[name=reason]'), { target: { value: 'Revisado' } })
    fireEvent.click(form.querySelector('[name=scope]'))
    fireEvent.submit(form)
    await waitFor(() => expect(api).toHaveBeenCalledWith('PUT', '/semester-management/exceptions/8/decision', { version: 2, status: 'aprobada', reason: 'Revisado', project_scope: true }))
  })
  it('assistant can preview promotion but cannot confirm it', async () => {
    const { root } = setup(6, 'periods', {
      '/semester-management': { periods: [{ id: 1, nombre: 'Actual' }] },
      '/semester-management/periods/1/promotion-preview': { snapshot: 'x', groups: [], movements: [], source_period_id: 0 },
    })
    await waitFor(() => expect(findButton(root, 'Preparar promoción')).toBeDefined())
    fireEvent.click(findButton(root, 'Preparar promoción'))
    await waitFor(() => expect(root.textContent).toContain('Solicita a jefatura'))
    expect(findButton(root, 'Confirmar lote')).toBeUndefined()
  })
})
