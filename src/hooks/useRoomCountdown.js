import { useEffect, useRef, useState } from 'react'

const PHASES = { exposicion: 'Exposición', preguntas: 'Preguntas y respuestas' }
const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

/** Pitido corto con Web Audio (sin archivos); se ignora si el navegador no deja reproducir sonido. */
function beep() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext
    const audio = new Context()
    ;[0, 0.35, 0.7].forEach((offset) => {
      const tone = audio.createOscillator()
      const gain = audio.createGain()
      tone.frequency.value = 880
      gain.gain.setValueAtTime(0.25, audio.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + offset + 0.25)
      tone.connect(gain).connect(audio.destination)
      tone.start(audio.currentTime + offset)
      tone.stop(audio.currentTime + offset + 0.25)
    })
    navigator.vibrate?.([200, 100, 200])
  } catch { /* sin sonido */ }
}

/**
 * Estado del temporizador de la sala segundo a segundo, a partir de la última consulta (timer de shapeRoom en la API).
 * Si la exposición termina y la sala pasa sola a preguntas, se muestra en rojo `questions_delay_seconds` y luego
 * cuenta las preguntas, igual que hace la API (RoomTimeline::syncPhase).
 */
export function useRoomCountdown(timer) {
  // Segundos desde la última consulta; se reinician cuando llega un temporizador nuevo.
  const [elapsed, setElapsed] = useState(0)
  const [synced, setSynced] = useState(timer)
  if (synced !== timer) { setSynced(timer); setElapsed(0) }
  const running = timer?.status === 'en_curso'
  useEffect(() => {
    if (!running) return undefined
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(interval)
  }, [running, timer])

  const data = timer || {}
  let phase = data.phase || 'exposicion'
  let remaining = Math.max(0, Number(data.remaining_seconds || 0) - elapsed)
  let expired = remaining === 0 && (running || data.status === 'finalizado')
  if (running && phase === 'exposicion' && data.auto_questions && remaining === 0) {
    const overtime = elapsed - Number(data.remaining_seconds || 0)
    if (overtime >= Number(data.questions_delay_seconds || 5)) {
      phase = 'preguntas'
      remaining = Math.max(0, Number(data.questions_seconds || 0) - (overtime - Number(data.questions_delay_seconds || 5)))
      expired = remaining === 0
    }
  }
  const status = expired ? 'finalizado' : data.status || 'detenido'

  // Un aviso por cada fase que termina.
  const beeped = useRef(new Set())
  const key = `${data.order}:${phase}:${data.started_at}`
  useEffect(() => {
    if (expired && running && !beeped.current.has(key)) { beeped.current.add(key); beep() }
  }, [expired, running, key])

  return { phase, phaseLabel: PHASES[phase] || PHASES.exposicion, remaining, expired, running: running && !expired, status, display: clock(remaining) }
}
