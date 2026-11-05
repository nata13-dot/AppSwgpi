import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiArrowRight, FiCompass, FiHelpCircle, FiSearch, FiSend } from 'react-icons/fi'
import api, { apiError } from '../../services/api'
import { activeProfileId } from '../../lib/permissions'
import { registerBackHandler } from '../../utils/backNavigation'
import { Button, IconButton, Sheet } from '../ui'

/* Los textos y la comparación de preguntas viven en la API (config/help.php); no intervienen servicios externos. */

/** Elementos de la pantalla que señala cada paso; se usa el primero que esté visible. */
const TOUR_TARGETS = {
  menu: ['.sidebar-app', '.bottom-nav'],
  search: ['.topbar-search', '.topbar-actions .mobile-only'],
  career: ['.topbar-chip:not(.level)'],
  notifications: ['.topbar-actions .badge-host'],
  account: ['.topbar-user'],
  help: ['.help-fab'],
}

const visibleElement = (target) => (TOUR_TARGETS[target] || [])
  .map((selector) => document.querySelector(selector))
  .find((element) => element && element.getBoundingClientRect().width > 0)

const tourKey = (user) => `sgpi-tour-v1-${user?.id}-${activeProfileId(user)}`
const tourSeen = (user) => { try { return localStorage.getItem(tourKey(user)) === '1' } catch { return true } }
const markTourSeen = (user) => { try { localStorage.setItem(tourKey(user), '1') } catch { /* Sin almacenamiento, la guía sólo se repite. */ } }

function GuidedTour({ steps, onClose }) {
  // Un paso sin elemento visible (por ejemplo, la carrera en un perfil con una sola) se omite.
  const available = useMemo(() => steps.filter((step) => !step.target || visibleElement(step.target)), [steps])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)
  const step = available[index]
  const last = index === available.length - 1

  useLayoutEffect(() => {
    const measure = () => {
      const box = step?.target ? visibleElement(step.target)?.getBoundingClientRect() : null
      setRect(box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null)
    }
    measure()
    cardRef.current?.focus()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const unregister = registerBackHandler(onClose)
    return () => { document.removeEventListener('keydown', onKey); unregister() }
  }, [onClose])

  if (!step) return null
  const pad = 6
  const spotlight = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
  // La tarjeta va del lado con más espacio; el menú lateral la deja a su derecha.
  const tall = rect && rect.height > window.innerHeight * 0.5
  const below = rect && rect.top + rect.height / 2 < window.innerHeight / 2
  const cardStyle = !rect ? undefined
    : tall ? { top: 24, left: Math.min(rect.left + rect.width + 18, window.innerWidth - 336) }
      : below ? { top: rect.top + rect.height + 16, right: 16 }
        : { bottom: window.innerHeight - rect.top + 16, right: 16 }

  return (
    <div className={`tour-layer ${rect ? '' : 'centered'}`} role="dialog" aria-modal="true" aria-label="Guía de inicio">
      {spotlight ? <div className="tour-spotlight" style={spotlight} /> : <div className="tour-backdrop" />}
      <section className="tour-card" ref={cardRef} tabIndex={-1} style={cardStyle}>
        <small>Paso {index + 1} de {available.length}</small>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <footer>
          <button type="button" className="tour-skip" onClick={onClose}>{last ? 'Cerrar' : 'Omitir guía'}</button>
          <span>
            {index > 0 && <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>Atrás</Button>}
            <Button size="sm" onClick={() => (last ? onClose() : setIndex(index + 1))}>{last ? 'Terminar' : 'Siguiente'}</Button>
          </span>
        </footer>
      </section>
    </div>
  )
}

function TopicAnswer({ topic, canOpen, onOpen }) {
  return (
    <>
      <ol className="help-steps">{topic.steps.map((text) => <li key={text}>{text}</li>)}</ol>
      {canOpen(topic) && <Button variant="ghost" size="sm" icon={FiArrowRight} onClick={() => onOpen(topic.app)}>Ir a la pantalla</Button>}
    </>
  )
}

/** Botón flotante de ayuda: asistente de preguntas frecuentes y guía de inicio. */
export default function HelpCenter({ user, menuItems, simulated, onOpenSearch }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [asking, setAsking] = useState(false)
  const endRef = useRef(null)
  const page = location.pathname

  const help = useQuery({
    queryKey: ['help', activeProfileId(user), page],
    queryFn: () => api.get('/help', { params: { page } }).then((response) => response.data),
    staleTime: 300_000,
    enabled: Boolean(user),
  })
  const tour = help.data?.tour

  // La primera vez que entra con este perfil en este dispositivo; la vista simulada no la activa.
  const [autoChecked, setAutoChecked] = useState(false)
  if (!autoChecked && tour?.length) {
    setAutoChecked(true)
    if (!simulated && !tourSeen(user)) setTouring(true)
  }

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [messages, asking])

  const allowedPaths = useMemo(() => new Set(['/repository', ...menuItems.map((entry) => entry.path)]), [menuItems])
  const canOpen = (topic) => topic.app && !topic.here && topic.app !== page && allowedPaths.has(topic.app)
  const openPage = (path) => { setOpen(false); navigate(path) }
  const finishTour = () => { markTourSeen(user); setTouring(false) }
  const startTour = () => { setOpen(false); setTouring(true) }
  const showTopic = (topic) => setMessages((current) => [...current, { from: 'user', text: topic.question }, { from: 'bot', topic }])

  const ask = async (event) => {
    event.preventDefault()
    const question = draft.trim()
    if (!question || asking) return
    setDraft('')
    setMessages((current) => [...current, { from: 'user', text: question }])
    setAsking(true)
    try {
      const { data } = await api.get('/help', { params: { q: question, page } })
      const [best, ...others] = data.topics
      setMessages((current) => [...current, best
        ? { from: 'bot', topic: best, related: others.slice(0, 3) }
        : { from: 'bot', notFound: true }])
    } catch (error) {
      setMessages((current) => [...current, { from: 'bot', text: apiError(error) }])
    } finally { setAsking(false) }
  }

  return (
    <>
      <button type="button" className="help-fab" aria-label="Ayuda" title="Ayuda" onClick={() => setOpen(true)}><FiHelpCircle aria-hidden="true" /></button>
      <Sheet open={open} title="Asistente de ayuda" subtitle="Respuestas sobre cómo usar el SGPI." onClose={() => setOpen(false)} size="sm"
        footer={(
          <form className="help-compose" onSubmit={ask}>
            <input className="control" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe tu pregunta..." aria-label="Escribe tu pregunta" />
            <IconButton type="submit" icon={FiSend} label="Enviar pregunta" disabled={!draft.trim() || asking} />
          </form>
        )}>
        <div className="help-chat" aria-live="polite">
          <div className="help-bubble bot">
            <p>Hola{user?.nombres ? `, ${user.nombres.split(' ')[0]}` : ''}. Pregúntame cómo hacer algo o elige un tema:</p>
            <div className="help-suggestions">
              {(help.data?.topics || []).map((topic) => <button type="button" key={topic.id} onClick={() => showTopic(topic)}>{topic.question}</button>)}
            </div>
            <Button variant="ghost" size="sm" icon={FiCompass} onClick={startTour} disabled={!tour?.length}>Ver la guía de inicio</Button>
          </div>
          {messages.map((message, index) => (
            <div key={index} className={`help-bubble ${message.from}`}>
              {message.text && <p>{message.text}</p>}
              {message.topic && <>
                {message.related && <strong>{message.topic.question}</strong>}
                <TopicAnswer topic={message.topic} canOpen={canOpen} onOpen={openPage} />
              </>}
              {message.related?.length > 0 && (
                <div className="help-suggestions"><small>También puede servirte:</small>
                  {message.related.map((topic) => <button type="button" key={topic.id} onClick={() => showTopic(topic)}>{topic.question}</button>)}
                </div>
              )}
              {message.notFound && <>
                <p>No encontré una respuesta para eso. Intenta con otras palabras, o búscalo en el sistema. Si es un problema con tu cuenta o tus datos, acude a tu jefatura.</p>
                <Button variant="ghost" size="sm" icon={FiSearch} onClick={() => { setOpen(false); onOpenSearch() }}>Abrir el buscador</Button>
              </>}
            </div>
          ))}
          {asking && <div className="help-bubble bot"><p className="muted">Buscando...</p></div>}
          <div ref={endRef} />
        </div>
      </Sheet>
      {touring && tour?.length > 0 && <GuidedTour steps={tour} onClose={finishTour} />}
    </>
  )
}
