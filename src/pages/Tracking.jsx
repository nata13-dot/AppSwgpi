import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { mountTrackingConsole } from '../shared/trackingConsole'
import { downloadApiFile } from '../utils/downloads'
import { confirmAction, Page } from '../components/ui'

/**
 * Avances por materia (Frontend_Swgpi/pages/tracking.php): el docente de cada materia abre y califica los
 * avances de sus equipos; la jefatura ve el panorama y elige materias y plantillas. Mismo módulo que la web.
 */
export default function Tracking() {
  const root = useRef(null)
  const { user } = useAuth()
  const [params] = useSearchParams()
  const initialTab = params.get('tab') || 'courses'
  useEffect(() => mountTrackingConsole(root.current, async (method, url, data) => {
    if (method === 'DOWNLOAD') return downloadApiFile(url, data.name)
    const response = await api.request({ method, url, data })
    return response.data
  }, user, initialTab, { confirm: (text) => confirmAction({ title: 'Confirmar', text, confirmText: 'Sí, continuar' }) }), [user, initialTab])
  return (
    <Page title="Avances por materia" subtitle="Avances de los proyectos en las materias que eligió la carrera: abrir, calificar y dar seguimiento por equipo.">
      <div ref={root} className="academic-console" />
    </Page>
  )
}
