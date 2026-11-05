import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiArrowRight, FiCompass, FiHelpCircle, FiSearch, FiSend } from 'react-icons/fi'
import api, { apiError } from '../../services/api'
import { activeProfileId } from '../../lib/permissions'
import { registerBackHandler } from '../../utils/backNavigation'
import { Button, IconButton, Sheet } from '../ui'

/* Los temas y la comparación de preguntas viven en la API (resources/help); no intervienen servicios externos. */

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

const Choices = ({ items, onPick }) => (
  <div className="help-suggestions">
    {items.map((item) => <button type="button" key={item.id} onClick={() => onPick(item)}>{item.question || item.title}</button>)}
  </div>
)

function TopicAnswer({ topic, canOpen, onOpen, onPick }) {
  return (
    <>
      {topic.personal ? topic.steps.map((line) => <p key={line}>{line}</p>) : <ol className="help-steps">{topic.steps.map((text) => <li key={text}>{text}</li>)}</ol>}
      {canOpen(topic) && <Button variant="ghost" size="sm" icon={FiArrowRight} onClick={() => onOpen(topic.app)}>Ir a la pantalla</Button>}
      {topic.next && <><small className="help-caption">¿Qué sigue?</small><Choices items={[topic.next]} onPick={onPick} /></>}
      {topic.related?.length > 0 && <><small className="help-caption">También puede servirte</small><Choices items={topic.related} onPick={onPick} /></>}
    </>
  )
}

/** Botón flotante de ayuda: árbol de temas, preguntas libres y guía de inicio. Sin sesión ofrece acceso y registro. */
export default function HelpCenter({ user = null, menuItems = [], simulated = false, onOpenSearch = null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [asking, setAsking] = useState(false)
  const endRef = useRef(null)
  const page = location.pathname
  const guest = !user
  const endpoint = guest ? '/help/public' : '/help'

  const help = useQuery({
    queryKey: ['help', guest ? 'guest' : activeProfileId(user), page],
    queryFn: () => api.get(endpoint, { params: { page } }).then((response) => response.data),
    staleTime: 300_000,
  })
  const tour = help.data?.tour
  const categories = help.data?.categories || []

  // La primera vez que entra con este perfil en este dispositivo; la vista simulada no la activa.
  const [autoChecked, setAutoChecked] = useState(false)
  if (!autoChecked && tour?.length) {
    setAutoChecked(true)
    if (!simulated && !tourSeen(user)) setTouring(true)
  }

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [messages, asking])

  const allowedPaths = useMemo(() => new Set(guest ? ['/login', '/register', '/forgot-password'] : ['/repository', ...menuItems.map((entry) => entry.path)]), [guest, menuItems])
  const canOpen = (topic) => {
    const path = topic.app?.split('?')[0]
    return path && !topic.here && topic.app !== page && allowedPaths.has(path)
  }
  const openPage = (path) => { setOpen(false); navigate(path) }
  const finishTour = () => { markTourSeen(user); setTouring(false) }
  const startTour = () => { setOpen(false); setTouring(true) }
  const push = (...items) => setMessages((current) => [...current, ...items])

  const request = async (params, respond) => {
    setAsking(true)
    try {
      const { data } = await api.get(endpoint, { params: { ...params, page } })
      respond(data)
    } catch (error) {
      push({ from: 'bot', text: apiError(error) })
    } finally { setAsking(false) }
  }
  const openTopic = (item) => {
    push({ from: 'user', text: item.question })
    request({ topic: item.id }, (data) => push({ from: 'bot', topic: data.topic }))
  }
  const openCategory = (category) => push({ from: 'user', text: category.title }, { from: 'bot', category })
  const showCategories = () => push({ from: 'user', text: 'Ver todos los temas' }, { from: 'bot', menu: true })

  const ask = (event) => {
    event.preventDefault()
    const question = draft.trim()
    if (!question || asking) return
    setDraft('')
    push({ from: 'user', text: question })
    request({ q: question }, (data) => {
      if (data.topic) push({ from: 'bot', topic: data.topic, others: data.options })
      else if (data.options?.length) push({ from: 'bot', options: data.options })
      else push({ from: 'bot', notFound: true })
    })
  }

  return (
    <>
      <button type="button" className={`help-fab ${guest ? 'guest' : ''}`} aria-label="Ayuda" title="Ayuda" onClick={() => setOpen(true)}><FiHelpCircle aria-hidden="true" /></button>
      <Sheet open={open} title="Asistente de ayuda" subtitle="Elige un tema o escribe tu pregunta." onClose={() => setOpen(false)} size="sm"
        footer={(
          <form className="help-compose" onSubmit={ask}>
            <input className="control" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe tu pregunta..." aria-label="Escribe tu pregunta" />
            <IconButton type="submit" icon={FiSend} label="Enviar pregunta" disabled={!draft.trim() || asking} />
          </form>
        )}>
        <div className="help-chat" aria-live="polite">
          <div className="help-bubble bot">
            <p>Hola{user?.nombres ? `, ${user.nombres.split(' ')[0]}` : ''}. ¿En qué te ayudo?</p>
            <Choices items={help.data?.suggested || []} onPick={openTopic} />
            <small className="help-caption">Todos los temas</small>
            <Choices items={categories} onPick={openCategory} />
            {!guest && <Button variant="ghost" size="sm" icon={FiCompass} onClick={startTour} disabled={!tour?.length}>Ver la guía de inicio</Button>}
          </div>
          {messages.map((message, index) => (
            <div key={index} className={`help-bubble ${message.from}`}>
              {message.text && <p>{message.text}</p>}
              {message.topic && <>
                {message.others && <strong>{message.topic.question}</strong>}
                <TopicAnswer topic={message.topic} canOpen={canOpen} onOpen={openPage} onPick={openTopic} />
                {message.others?.length > 0 && <><small className="help-caption">¿Buscabas otra cosa?</small><Choices items={message.others} onPick={openTopic} /></>}
              </>}
              {message.category && <><p>Temas de {message.category.title}:</p><Choices items={message.category.topics} onPick={openTopic} /></>}
              {message.menu && <><p>Elige una sección:</p><Choices items={categories} onPick={openCategory} /></>}
              {message.options && <><p>No estoy seguro de haberte entendido. ¿Te refieres a alguna de estas?</p><Choices items={message.options} onPick={openTopic} /></>}
              {message.notFound && <>
                <p>No encontré una respuesta para eso. Intenta con otras palabras o revisa los temas. Si es un problema con tu cuenta o tus datos, acude a tu jefatura.</p>
                <Button variant="ghost" size="sm" onClick={showCategories}>Ver todos los temas</Button>
                {onOpenSearch && <Button variant="ghost" size="sm" icon={FiSearch} onClick={() => { setOpen(false); onOpenSearch() }}>Abrir el buscador</Button>}
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
