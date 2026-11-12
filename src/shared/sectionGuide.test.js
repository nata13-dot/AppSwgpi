// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { resolve } from 'node:path'
import { AUTO_HIDE_MS, GUIDE_EVENT, guideFor, guideKeyFor, mountSectionGuide } from './sectionGuide'

let dispose
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.useRealTimers() })
const mount = (key, profile = 5) => {
  const root = document.createElement('div'); document.body.append(root)
  dispose = mountSectionGuide(root, { user: { active_profile_id: profile }, key })
  return root
}
const toggle = (root) => root.querySelector('.sg-toggle')

describe('section guide', () => {
  it('ships identical behavior to PHP', () => {
    expect(readFileSync(resolve(process.cwd(), '../Frontend_Swgpi/assets/js/section-guide.js'), 'utf8'))
      .toBe(readFileSync(resolve(process.cwd(), 'src/shared/sectionGuide.js'), 'utf8'))
  })
  it('maps app routes and PHP pages to the same guide', () => {
    expect(guideKeyFor('/users')).toBe('users')
    expect(guideKeyFor('/pages/admin/user-edit.php')).toBe('users')
    expect(guideKeyFor('/academic-workflows', '?tab=authorizations')).toBe('academic:authorizations')
    expect(guideKeyFor('/pages/academic-workflows.php')).toBe('academic:periods')
    expect(guideKeyFor('/dashboard')).toBeNull()
  })
  it('explains each profile its own steps and effects', () => {
    expect(guideFor('deliverables', { active_profile_id: 3 }).how[0]).toContain('indicaciones')
    expect(guideFor('deliverables', { active_profile_id: 2 }).how[0]).toContain('matriz')
    expect(guideFor('deliverables', { active_profile_id: 5 }).how[0]).toContain('Crea entregables')
  })
  it('hides itself after a few seconds and stays open once reopened', () => {
    vi.useFakeTimers()
    const root = mount('users')
    expect(root.querySelector('.sg-body')).not.toBeNull()
    expect(root.textContent).toContain('Cómo hacerlo')
    expect(root.textContent).toContain('Qué afecta')
    vi.advanceTimersByTime(AUTO_HIDE_MS + 10)
    expect(root.querySelector('.sg-guide.collapsed')).not.toBeNull()
    fireEvent.click(toggle(root))
    vi.advanceTimersByTime(AUTO_HIDE_MS * 3)
    expect(root.querySelector('.sg-body')).not.toBeNull()
    fireEvent.click(toggle(root))
    expect(root.querySelector('.sg-guide.collapsed')).not.toBeNull()
  })
  it('pauses the auto hide while the pointer is over it', () => {
    vi.useFakeTimers()
    const root = mount('users')
    fireEvent.mouseEnter(root.querySelector('.sg-guide'))
    vi.advanceTimersByTime(AUTO_HIDE_MS * 2)
    expect(root.querySelector('.sg-body')).not.toBeNull()
    fireEvent.mouseLeave(root.querySelector('.sg-guide'))
    vi.advanceTimersByTime(AUTO_HIDE_MS + 10)
    expect(root.querySelector('.sg-guide.collapsed')).not.toBeNull()
  })
  it('switches guide when a tab announces itself', () => {
    const root = mount('academic:periods')
    window.dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: { key: 'academic:memberships' } }))
    expect(root.textContent).toContain('Consultar compromisos')
  })
})
