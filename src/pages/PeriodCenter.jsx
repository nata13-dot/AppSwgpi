import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../services/api'
import { mountPeriodCenter } from '../shared/periodCenter'
import { confirmAction, Page } from '../components/ui'

const LINKS = {
  period: '/academic-workflows?tab=periods',
  requests: '/registration-requests',
  proposals: '/proposals',
  rooms: '/evaluation-rooms',
  evaluations: '/evaluations',
}

/**
 * Operación del periodo (Frontend_Swgpi/pages/admin/period-center.php): periodo y promoción, autoregistro y
 * solicitudes, propuestas, evaluaciones y cierre, en orden. El módulo es el mismo que usa el front de PHP.
 */
export default function PeriodCenter() {
  const root = useRef(null)
  const navigate = useNavigate()
  const client = useQueryClient()
  useEffect(() => mountPeriodCenter(root.current, {
    api: async (method, url, data) => {
      const response = await api.request({ method, url, data })
      // Un cambio aquí actualiza los contadores del menú.
      if (method !== 'GET') client.invalidateQueries({ queryKey: ['management-badges'] })
      return response.data
    },
    go: (path) => navigate(path),
    confirm: (text) => confirmAction({ title: 'Confirmar', text, confirmText: 'Sí, continuar' }),
    notify: (type, text) => (toast[type] || toast.info)(text),
    links: LINKS,
  }), [navigate, client])
  return (
    <Page title="Operación del periodo" subtitle="Las etapas de la carrera en orden: abre cada una para ver sus pendientes y controlarla.">
      <div ref={root} className="period-center" />
    </Page>
  )
}
