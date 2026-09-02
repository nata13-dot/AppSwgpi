import { describe, expect, it, vi } from 'vitest'
import { handleRegisteredBack, registerBackHandler } from './backNavigation'

describe('backNavigation', () => {
  it('indica cuando no existe una capa que cerrar', () => {
    expect(handleRegisteredBack()).toBe(false)
  })

  it('cierra primero la capa registrada al final', () => {
    const first = vi.fn()
    const second = vi.fn()
    const unregisterFirst = registerBackHandler(first)
    const unregisterSecond = registerBackHandler(second)

    expect(handleRegisteredBack()).toBe(true)
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()

    unregisterSecond()
    expect(handleRegisteredBack()).toBe(true)
    expect(first).toHaveBeenCalledOnce()
    unregisterFirst()
  })
})
