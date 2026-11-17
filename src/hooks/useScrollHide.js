import { useEffect, useState } from 'react'

/** true mientras se desplaza hacia abajo (para ocultar botones flotantes); vuelve a false al subir o al estar arriba. */
export function useScrollHide(threshold = 80) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        if (Math.abs(y - last) < 6) return
        setHidden(y > threshold && y > last)
        last = y
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [threshold])
  return hidden
}
