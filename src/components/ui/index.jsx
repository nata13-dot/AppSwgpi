import { createElement, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FiAlertCircle, FiArrowLeft, FiCheck, FiChevronLeft, FiChevronRight, FiInbox, FiSearch, FiUploadCloud, FiX } from 'react-icons/fi'
import Swal from 'sweetalert2'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { registerBackHandler } from '../../utils/backNavigation'
import SectionGuide from '../SectionGuide'

/* eslint-disable react-refresh/only-export-components */

/** GET a la API con React Query; `params` forma parte de la llave para no mezclar resultados entre filtros. */
export function useApi(key, url, params, options = {}) {
  return useQuery({
    queryKey: [...(Array.isArray(key) ? key : [key]), params ?? null],
    queryFn: ({ signal }) => api.get(url, { params, signal }).then((response) => response.data),
    ...options,
  })
}

export function Page({ title, subtitle, eyebrow, actions, back, children, className = '' }) {
  const navigate = useNavigate()
  return (
    <div className={`page ${className}`}>
      <header className="page-head">
        {back && <button type="button" className="icon-btn page-back" aria-label="Regresar" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}><FiArrowLeft /></button>}
        <div className="page-head-text">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      <SectionGuide />
      {children}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className = '', flush = false, as = 'section' }) {
  return createElement(as, { className: `card-app ${flush ? 'flush' : ''} ${className}` },
    (title || actions) && <header className="card-head"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="card-actions">{actions}</div>}</header>,
    children)
}

export function Button({ variant = 'primary', size, icon, loading, children, className = '', ...props }) {
  return (
    <button type="button" className={`btn-app ${variant} ${size || ''} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : icon && createElement(icon, { 'aria-hidden': true })}
      {children && <span>{children}</span>}
    </button>
  )
}

export function IconButton({ icon, label, className = '', ...props }) {
  return <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...props}>{createElement(icon)}</button>
}

export function Badge({ tone = 'neutral', children, icon }) {
  return <span className={`badge-app ${tone}`}>{icon && createElement(icon, { 'aria-hidden': true })}{children}</span>
}

export function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div className={`tabs-app ${className}`} role="tablist">
      {items.filter(Boolean).map((item) => (
        <button key={item.key} type="button" role="tab" aria-selected={value === item.key} className={value === item.key ? 'active' : ''} onClick={() => onChange(item.key)}>
          {item.icon && createElement(item.icon, { 'aria-hidden': true })}<span>{item.label}</span>
          {item.count != null && <small>{item.count}</small>}
        </button>
      ))}
    </div>
  )
}

export function Chips({ options, value, onChange, multiple = false }) {
  const selected = (key) => (multiple ? value.includes(key) : value === key)
  const toggle = (key) => onChange(multiple ? (selected(key) ? value.filter((item) => item !== key) : [...value, key]) : key)
  return (
    <div className="chips-app">
      {options.map((option) => <button key={option.value} type="button" className={selected(option.value) ? 'active' : ''} onClick={() => toggle(option.value)}>{selected(option.value) && multiple && <FiCheck />}{option.label}{option.count != null && <small>{option.count}</small>}</button>)}
    </div>
  )
}

export function Field({ label, hint, error, children, full = false, className = '' }) {
  return (
    <label className={`field ${full ? 'full' : ''} ${error ? 'invalid' : ''} ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <small className="field-error">{error}</small> : hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

export function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`switch-app ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...', autoFocus }) {
  return (
    <label className="search-app">
      <FiSearch aria-hidden="true" />
      <input type="search" value={value} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" aria-label="Limpiar búsqueda" onClick={() => onChange('')}><FiX /></button>}
    </label>
  )
}

export function Loading({ label = 'Cargando información...', rows = 3 }) {
  return (
    <div className="loading-app" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => <i key={index} className="skeleton" style={{ width: `${92 - index * 14}%` }} />)}
    </div>
  )
}

export function Empty({ title = 'Sin resultados', message = 'No hay información para mostrar.', icon = FiInbox, action }) {
  return <div className="state-app">{createElement(icon, { 'aria-hidden': true })}<strong>{title}</strong><span>{message}</span>{action}</div>
}

export function ErrorState({ error, message, onRetry }) {
  return (
    <div className="state-app error" role="alert">
      <FiAlertCircle aria-hidden="true" /><strong>Algo no salió bien</strong><span>{message || apiError(error)}</span>
      {onRetry && <Button variant="ghost" size="sm" onClick={() => onRetry()}>Reintentar</Button>}
    </div>
  )
}

/** Muestra carga, error o vacío de una consulta; si hay datos, ejecuta `children`. */
export function QueryState({ query, empty, isEmpty, children, rows }) {
  if (query.isLoading) return <Loading rows={rows} />
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />
  if (isEmpty?.(query.data)) return empty || <Empty />
  return children(query.data)
}

export function Stat({ label, value, hint, tone = 'primary', icon, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={`stat-app ${tone}`} onClick={onClick}>
      {icon && <span className="stat-icon">{createElement(icon, { 'aria-hidden': true })}</span>}
      <span className="stat-body"><small>{label}</small><strong>{value ?? '—'}</strong>{hint && <em>{hint}</em>}</span>
    </Tag>
  )
}

export function Progress({ value = 0, tone = 'primary', label }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0))
  return <span className={`progress-app ${tone}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}><i style={{ width: `${percent}%` }} /></span>
}

/** Barras horizontales de una distribución { clave: cantidad }; `label` traduce cada clave. */
export function BarList({ data, label = (key) => key, emptyText = 'Sin datos para mostrar.' }) {
  const entries = Object.entries(data || {})
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0)
  if (!entries.length || !total) return <p className="muted small-text">{emptyText}</p>
  return (
    <ul className="barlist">
      {entries.map(([key, value]) => (
        <li key={key}><span>{label(key)}</span><Progress value={(Number(value || 0) / total) * 100} label={label(key)} /><strong>{value}</strong></li>
      ))}
    </ul>
  )
}

/** Tarjeta "acción sugerida" de los paneles de inicio. */
export function NextAction({ title, text, to, actionLabel, icon }) {
  const navigate = useNavigate()
  return (
    <section className="next-action" aria-live="polite">
      <div><small>Acción sugerida</small><strong>{title}</strong><p>{text}</p></div>
      {to && <Button variant="soft" icon={icon} onClick={() => navigate(to)}>{actionLabel}</Button>}
    </section>
  )
}

export function Steps({ steps, current, onSelect }) {
  return (
    <ol className="steps-app">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : ''
        return (
          <li key={step} className={state}>
            <button type="button" disabled={!onSelect || index > current} onClick={() => onSelect?.(index)}>
              <span>{index < current ? <FiCheck /> : index + 1}</span><small>{step}</small>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function Pager({ meta, onPage }) {
  if (!meta || Number(meta.last_page) <= 1) return null
  return (
    <nav className="pager-app" aria-label="Paginación">
      <span>Página {meta.current_page} de {meta.last_page}{meta.total != null && ` · ${meta.total} registros`}</span>
      <div>
        <IconButton icon={FiChevronLeft} label="Anterior" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)} />
        <IconButton icon={FiChevronRight} label="Siguiente" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)} />
      </div>
    </nav>
  )
}

/**
 * Hoja de acciones: en el teléfono sube desde abajo y en pantallas grandes es un diálogo centrado.
 * El botón "atrás" de Android la cierra antes de cambiar de pantalla.
 */
export function Sheet({ open, title, subtitle, onClose, children, footer, size = 'md' }) {
  const titleId = useId()
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => event.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', close)
    document.body.classList.add('sheet-open')
    const unregister = registerBackHandler(() => closeRef.current?.())
    return () => { document.removeEventListener('keydown', close); document.body.classList.remove('sheet-open'); unregister() }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={() => onClose?.()}>
      <section className={`sheet ${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()}>
        <header className="sheet-head">
          <i className="sheet-grip" aria-hidden="true" />
          <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          {onClose && <IconButton icon={FiX} label="Cerrar" onClick={onClose} />}
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </section>
    </div>
  )
}

/**
 * Tabla en escritorio y tarjetas en el teléfono. `columns`: [{ key, label, render, primary, hideOnMobile, className }].
 * La primera columna con `primary` encabeza la tarjeta móvil.
 */
export function DataTable({ columns, rows, rowKey = 'id', onRowClick, actions, empty, selected, onToggle, onToggleAll }) {
  if (!rows?.length) return empty || <Empty />
  const allSelected = selected && rows.every((row) => selected.has(row[rowKey]))
  return (
    <div className="table-app-wrap">
      <table className="table-app">
        <thead>
          <tr>
            {selected && <th className="select-cell"><input type="checkbox" aria-label="Seleccionar todo" checked={allSelected} onChange={() => onToggleAll?.(!allSelected)} /></th>}
            {columns.map((column) => <th key={column.key || column.label} className={column.className}>{column.label}</th>)}
            {actions && <th className="actions-cell"><span className="visually-hidden">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} className={`${onRowClick ? 'clickable' : ''} ${selected?.has(row[rowKey]) ? 'selected' : ''}`} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {selected && <td className="select-cell" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label="Seleccionar" checked={selected.has(row[rowKey])} onChange={() => onToggle?.(row[rowKey])} /></td>}
              {columns.map((column) => (
                <td key={column.key || column.label} data-label={column.label} className={`${column.primary ? 'primary-cell' : ''} ${column.hideOnMobile ? 'hide-mobile' : ''} ${column.className || ''}`}>
                  {column.render ? column.render(row) : (row[column.key] ?? '—')}
                </td>
              ))}
              {actions && <td className="actions-cell" onClick={(event) => event.stopPropagation()}><div>{actions(row)}</div></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Avisa y devuelve true si el archivo elegido no tiene contenido. La API también lo rechaza. */
export const rejectEmptyFile = (file) => {
  if (file.size > 0) return false
  toast.error(`El archivo «${file.name}» está vacío. Elige otro.`)
  return true
}

export function FileDrop({ accept, onFile, file, hint, label = 'Toca para elegir un archivo o arrástralo aquí', disabled }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  const pick = (chosen) => { if (chosen && !rejectEmptyFile(chosen)) onFile(chosen) }
  return (
    <div
      className={`filedrop ${over ? 'over' : ''} ${file ? 'has-file' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); if (!disabled) pick(event.dataTransfer.files[0]) }}
    >
      <input ref={inputRef} type="file" accept={accept} disabled={disabled} onChange={(event) => { pick(event.target.files[0]); event.target.value = '' }} />
      <FiUploadCloud aria-hidden="true" />
      <strong>{file ? file.name : label}</strong>
      <small>{file ? `${(file.size / 1048576).toFixed(1)} MB` : hint}</small>
    </div>
  )
}

// Las ventanas de confirmación usan las clases de la app (ui.css, "Ventanas de confirmación"): mismos botones,
// tipografía y colores que las hojas (Sheet), en claro y oscuro.
const swalTheme = (danger = false) => ({
  buttonsStyling: false,
  reverseButtons: true,
  showClass: { popup: 'swal-app-in' },
  hideClass: { popup: 'swal-app-out' },
  customClass: {
    container: 'swal-app-backdrop', popup: 'swal-app', title: 'swal-app-title', htmlContainer: 'swal-app-text', icon: 'swal-app-icon',
    input: 'control swal-app-input', validationMessage: 'swal-app-validation', actions: 'swal-app-actions',
    confirmButton: `btn-app ${danger ? 'danger' : 'primary'}`, cancelButton: 'btn-app ghost', denyButton: 'btn-app ghost-danger',
  },
})

export const confirmAction = async ({ title = 'Confirmar acción', text = 'Esta operación no se puede deshacer.', confirmText = 'Sí, continuar', icon = 'warning', danger = false } = {}) => {
  const result = await Swal.fire({ ...swalTheme(danger), title, text, icon, showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar' })
  return result.isConfirmed
}

/** Pide un texto (por ejemplo, un motivo). Devuelve null si se cancela. */
export const promptText = async ({ title, text, placeholder = '', confirmText = 'Guardar', required = true, multiline = true, value = '', input }) => {
  const result = await Swal.fire({
    ...swalTheme(), title, text, input: input || (multiline ? 'textarea' : 'text'), inputValue: value, inputPlaceholder: placeholder,
    showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
    inputValidator: (input) => (required && !String(input || '').trim() ? 'Este dato es obligatorio.' : undefined),
  })
  return result.isConfirmed ? String(result.value || '').trim() : null
}

/** Pide la contraseña del administrador para autorizar una acción protegida. Devuelve null si se cancela. */
export const promptPassword = async ({ title = 'Autorizar acción', placeholder = 'Contraseña del administrador actual', confirmText = 'Autorizar' } = {}) => {
  const result = await Swal.fire({
    ...swalTheme(), title, input: 'password', inputPlaceholder: placeholder, inputAttributes: { autocomplete: 'current-password' },
    showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
    inputValidator: (input) => (!input ? 'Escribe la contraseña.' : undefined),
  })
  return result.isConfirmed ? result.value : null
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Selección múltiple por id para tablas con acciones en lote. */
export function useSelection() {
  const [selected, setSelected] = useState(() => new Set())
  return {
    selected,
    toggle: (id) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }),
    setAll: (ids, on) => setSelected((current) => { const next = new Set(current); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next }),
    clear: () => setSelected(new Set()),
  }
}
