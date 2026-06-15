import { createElement, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FiArchive, FiBell, FiBookOpen, FiCheckSquare, FiChevronLeft, FiFileText,
  FiFolder, FiHome, FiLogOut, FiMenu, FiMoon, FiSearch, FiSettings, FiSun, FiTag,
  FiUser, FiUserCheck, FiUsers, FiX, FiCalendar,
} from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { fullName } from '../../utils/formatters'
import { homeForUser, roleFromUser, roleLabel, useAuth } from '../../hooks/useAuth'

const navigation = {
  admin: [
    ['Inicio', '', FiHome], ['Usuarios', 'users', FiUsers], ['Asesores', 'advisors', FiUserCheck],
    ['Proyectos', 'projects', FiFolder], ['Propuestas', 'proposals', FiCheckSquare],
    ['Entregables', 'deliverables', FiFileText], ['Evaluaciones', 'evaluations', FiCheckSquare],
    ['Documentos de evaluación', 'evaluation-documents', FiFileText], ['Académico', 'academics', FiBookOpen],
    ['Semestres y periodos', 'semesters', FiCalendar], ['Repositorio', 'repository', FiArchive],
    ['Etiquetas', 'tags', FiTag], ['Avisos', 'notices', FiBell],
    ['Ajustes', 'settings', FiSettings], ['Mi perfil', 'profile', FiUser],
  ],
  teacher: [
    ['Inicio', '', FiHome], ['Mis tesis', 'projects', FiFolder], ['Entregables', 'deliverables', FiFileText],
    ['Propuestas', 'proposals', FiCheckSquare], ['Evaluaciones', 'evaluations', FiCheckSquare],
    ['Documentos de evaluación', 'evaluation-documents', FiFileText],
    ['Repositorio', 'repository', FiArchive], ['Mi perfil', 'profile', FiUser],
  ],
  student: [
    ['Inicio', '', FiHome], ['Registrar tesis', 'proposal', FiFolder], ['Mis entregables', 'deliverables', FiFileText],
    ['Evaluación', 'evaluations', FiCheckSquare], ['Documentos de evaluación', 'evaluation-documents', FiFileText],
    ['Repositorio', 'repository', FiArchive], ['Mi perfil', 'profile', FiUser],
  ],
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = roleFromUser(user)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const base = `/${role}`
  const items = useMemo(() => navigation[role], [role])
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/activity-notifications', { params: { per_page: 5 } }).then((r) => r.data),
    refetchInterval: 60_000,
  })
  const unread = notifications.data?.unread_count || 0
  const searchItems = useMemo(() => items.filter(([label]) => label.toLowerCase().includes(search.toLowerCase())), [items, search])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNoticeOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const signout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {open && <button className="mobile-overlay" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src="/images/itssmt.webp" alt="ITSSMT" />
          <div><strong>SGPI</strong><small>ITSSMT</small></div>
          <button className="mobile-close" onClick={() => setOpen(false)}><FiX /></button>
        </div>
        <div className="user-summary">
          <div className="avatar">{fullName(user).charAt(0)}</div>
          <div><strong>{fullName(user)}</strong><small>{roleLabel(user)}</small></div>
        </div>
        <nav>
          <span className="nav-caption">{roleLabel(user)}</span>
          {items.map(([label, path, Icon]) => (
            <NavLink key={label} end={!path} to={path ? `${base}/${path}` : base} title={label} onClick={() => setOpen(false)}>
              {createElement(Icon)}<span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={signout}><FiLogOut /><span>Cerrar sesión</span></button>
          <small>SGPI v3.0 React</small>
        </div>
        <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}><FiChevronLeft /></button>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)}><FiMenu /></button>
          <div className="topbar-title"><strong>Sistema de Gestión de Proyectos Integradores</strong><small>Instituto Tecnológico Superior San Martín Texmelucan</small></div>
          <button className="global-search-trigger" onClick={() => setSearchOpen(true)}><FiSearch /><span>Buscar páginas y opciones...</span><kbd>Ctrl K</kbd></button>
          <div className="topbar-actions">
            <button aria-label="Cambiar tema" onClick={() => setDark((value) => !value)}>{dark ? <FiSun /> : <FiMoon />}</button>
            <button className="notification-button" aria-label={`${unread} notificaciones`} onClick={() => setNoticeOpen(!noticeOpen)}><FiBell />{unread > 0 && <span>{unread}</span>}</button>
            <button className="mini-profile" onClick={() => navigate(`${homeForUser(user)}/profile`)}>
              <span>{fullName(user).charAt(0)}</span><div><strong>{user?.nombres}</strong><small>{roleLabel(user)}</small></div>
            </button>
          </div>
        </header>
        {noticeOpen && <NotificationPanel data={notifications.data} onClose={() => setNoticeOpen(false)} onRefresh={notifications.refetch} />}
        <div className="content"><Outlet /></div>
      </main>
      {searchOpen && <div className="search-dialog-backdrop" onMouseDown={() => setSearchOpen(false)}><section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}><label><FiSearch /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar páginas y opciones..." /><button onClick={() => setSearchOpen(false)}><FiX /></button></label><div>{searchItems.map(([label, path, Icon]) => <button key={label} onClick={() => { navigate(path ? `${base}/${path}` : base); setSearchOpen(false); setSearch('') }}>{createElement(Icon)}<span>{label}</span></button>)}</div></section></div>}
    </div>
  )
}

function NotificationPanel({ data, onClose, onRefresh }) {
  const markAll = async () => {
    await api.put('/activity-notifications/read-all')
    onRefresh()
  }
  const markOne = async (notification) => {
    if (!notification.leida_en) await api.put(`/activity-notifications/${notification.id}/read`)
    onRefresh()
  }
  return <aside className="notification-panel"><header><div><strong>Actividad reciente</strong><small>{data?.unread_count || 0} sin leer</small></div><button onClick={onClose}><FiX /></button></header><div className="notification-items">{data?.data?.length ? data.data.map((notification) => <button className={notification.leida_en ? '' : 'unread'} key={notification.id} onClick={() => markOne(notification)}><span>{notification.titulo || notification.title || 'Actividad del sistema'}</span><small>{notification.mensaje || notification.message || notification.tipo}</small></button>) : <p>No hay actividad reciente.</p>}</div>{data?.unread_count > 0 && <footer><button onClick={markAll}>Marcar todas como leídas</button></footer>}</aside>
}
