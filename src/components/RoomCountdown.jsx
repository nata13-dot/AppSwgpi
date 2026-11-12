import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { useRoomCountdown } from '../hooks/useRoomCountdown'

/** Reloj grande del turno: fase, cuenta regresiva y rojo al terminar. */
export function RoomCountdown({ timer, title = 'Tiempo del equipo en turno', children }) {
  const countdown = useRoomCountdown(timer)
  const label = countdown.expired ? 'Tiempo terminado' : countdown.status === 'pausado' ? 'En pausa' : countdown.running ? countdown.phaseLabel : 'Sin iniciar'
  return (
    <div className={`room-timer phase-${countdown.phase} ${countdown.running ? 'running' : ''} ${countdown.expired ? 'expired' : ''}`}>
      <div className="row-wrap">
        <span className="room-timer-title"><small>{title}</small><strong>{label}</strong></span>
        <span className="spacer" />
        <strong className="timer-display" aria-live="off">{countdown.display}</strong>
      </div>
      {children}
    </div>
  )
}

/**
 * Temporizador de la sala para la hoja de evaluación: lo consulta cada 5 s (GET /evaluations/rooms/{id}/live) para
 * que todos los evaluadores vean el mismo tiempo que controla el encargado.
 */
export function LiveRoomTimer({ roomId }) {
  const live = useQuery({
    queryKey: ['room-live', roomId],
    queryFn: () => api.get(`/evaluations/rooms/${roomId}/live`).then((response) => response.data),
    enabled: Boolean(roomId),
    refetchInterval: 5_000,
    retry: false,
  })
  if (!live.data || !live.data.current_order || live.data.completed_at) return null
  return <RoomCountdown timer={live.data.timer} title={`Turno ${live.data.current_order} de ${live.data.total}${live.data.current_project?.title ? ` · ${live.data.current_project.title}` : ''}`} />
}
