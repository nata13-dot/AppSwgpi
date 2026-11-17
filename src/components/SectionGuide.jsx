import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { activeProfileId, isGeneralAdmin } from '../lib/permissions'
import { guideKeyFor, mountSectionGuide } from '../shared/sectionGuide'

/**
 * Guía "Cómo usar esta sección" y pantallas relacionadas de la pantalla actual (src/shared/sectionGuide.js, igual que
 * en la web). Los enlaces relacionados navegan dentro de la app.
 */
export default function SectionGuide() {
  const root = useRef(null)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { user } = useAuth()
  const key = guideKeyFor(pathname, search)
  // Sólo importan el perfil activo y si es administrador general: si el usuario se vuelve a consultar, no se reinicia.
  const profile = activeProfileId(user)
  const general = isGeneralAdmin(user)
  useEffect(() => (key
    ? mountSectionGuide(root.current, { user: { active_profile_id: profile, is_general_admin: general }, key, go: navigate, target: 'app' })
    : undefined), [key, profile, general, navigate])
  if (!key) return null
  return <div ref={root} className="section-guide" />
}
