import { useEffect, useState } from 'react'
import { FiAlertCircle, FiChevronLeft, FiChevronRight, FiInbox, FiSearch } from 'react-icons/fi'
import { statusLabel, statusTone } from '../../utils/formatters'

/* eslint-disable react-refresh/only-export-components */

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Loading({ label = 'Cargando información...' }) {
  return <div className="state-card"><span className="spinner-border spinner-border-sm" /> {label}</div>
}

export function Empty({ title = 'Sin resultados', message = 'No hay información para mostrar.' }) {
  return <div className="state-card"><FiInbox /><strong>{title}</strong><span>{message}</span></div>
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card state-error">
      <FiAlertCircle /><strong>Algo no salió bien</strong><span>{message}</span>
      {onRetry && <button className="btn btn-outline-danger btn-sm" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}

export function StatusBadge({ value }) {
  return <span className={`status-badge ${statusTone(value)}`}>{statusLabel(value || 'pendiente')}</span>
}

export function SearchField({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <label className="search-field">
      <FiSearch />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return null
  return (
    <nav className="pagination-bar" aria-label="Paginación">
      <span>Página {meta.current_page} de {meta.last_page}</span>
      <div>
        <button disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}><FiChevronLeft /></button>
        <button disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}><FiChevronRight /></button>
      </div>
    </nav>
  )
}

export function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop-custom" role="presentation" onMouseDown={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>{title}</h2><button aria-label="Cerrar" onClick={onClose}>×</button></header>
        {children}
      </section>
    </div>
  )
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
