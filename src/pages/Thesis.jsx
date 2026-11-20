import { useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { mountThesisConsole } from '../shared/thesisConsole'
import { confirmAction, Page } from '../components/ui'

/**
 * Seguimiento de tesis (Frontend_Swgpi/pages/thesis.php): curso por alumno con capítulos, docentes revisores,
 * entregas en PDF, puntaje y comentarios por capítulo y notas por página. Mismo módulo que la web.
 */
export default function Thesis() {
  const root = useRef(null)
  const { user } = useAuth()
  useEffect(() => mountThesisConsole(root.current, async (method, url, data) => {
    if (method === 'BLOB') return (await api.get(url, { responseType: 'blob', timeout: 120_000 })).data
    const response = await api.request({ method, url, data, ...(data instanceof FormData ? { timeout: 120_000 } : {}) })
    return response.data
  }, user, { confirm: (text) => confirmAction({ title: 'Confirmar', text, confirmText: 'Sí, continuar' }) }), [user])
  return (
    <Page title="Seguimiento de tesis" subtitle="Capítulos, entregas en PDF y revisión de cada docente.">
      <div ref={root} className="academic-console" />
    </Page>
  )
}
