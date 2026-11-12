import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

/** Lo avisa LiveSync cuando cambia algo; lo escuchan los módulos que no usan React Query (centro del periodo, widget). */
export const LIVE_EVENT = 'sgpi:live'
const PULSE_MS = 10_000

// Consultas que se recargan cuando cambia la huella de cada canal de /live.
const CHANNEL_QUERIES = {
  notifications: ['activity-notifications'],
  notices: ['public-settings', 'notices'],
  registration_requests: ['registration-requests', 'management-badges'],
  proposals: ['proposal-teacher-projects', 'proposal-group-projects', 'proposal-student-status', 'management-badges', 'dashboard-teacher', 'dashboard-student'],
  join_requests: ['proposal-student-status', 'proposal-group-projects'],
  projects: ['projects', 'project', 'my-projects', 'advisor-projects', 'evaluation-projects'],
  deliverables: ['deliverables', 'my-deliverables', 'deliverables-matrix', 'dashboard-teacher', 'dashboard-student'],
}

/**
 * Pulso de cambios (GET /live): cada 10 s con la app visible, y al volver a ella. Sólo se recargan las secciones
 * cuya huella cambió, así las solicitudes, propuestas o notificaciones aparecen al momento sin recargar todo.
 */
export default function LiveSync({ enabled }) {
  const client = useQueryClient()
  const last = useRef(null)
  const { data } = useQuery({
    queryKey: ['live'],
    queryFn: () => api.get('/live').then((response) => response.data),
    enabled,
    staleTime: 0,
    retry: false,
    refetchInterval: PULSE_MS,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    const channels = data?.channels
    if (!channels) return
    const previous = last.current
    last.current = channels
    if (!previous) return
    const changed = Object.keys(channels).filter((channel) => previous[channel] !== undefined && previous[channel] !== channels[channel])
    if (!changed.length) return
    for (const key of new Set(changed.flatMap((channel) => CHANNEL_QUERIES[channel] || []))) client.invalidateQueries({ queryKey: [key] })
    window.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: { channels: changed } }))
  }, [data, client])

  return null
}
