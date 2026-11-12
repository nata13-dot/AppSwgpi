import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { guideKeyFor, mountSectionGuide, roleOf } from '../shared/sectionGuide'

/** Guía "Cómo usar esta sección" de la pantalla actual (src/shared/sectionGuide.js, igual que en la web). */
export default function SectionGuide() {
  const root = useRef(null)
  const { pathname, search } = useLocation()
  const { user } = useAuth()
  const key = guideKeyFor(pathname, search)
  // Sólo importa el tipo de perfil: si el usuario se vuelve a consultar, la guía no se reinicia.
  const profile = { student: 3, teacher: 2, staff: 0 }[roleOf(user)]
  useEffect(() => (key ? mountSectionGuide(root.current, { user: { active_profile_id: profile }, key }) : undefined), [key, profile])
  if (!key) return null
  return <div ref={root} className="section-guide" />
}
