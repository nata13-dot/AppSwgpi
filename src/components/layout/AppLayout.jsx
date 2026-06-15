import { createElement, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FiArchive, FiBell, FiBookOpen, FiCheckSquare, FiChevronLeft, FiFileText,
  FiFolder, FiHome, FiLogOut, FiMenu, FiMoon, FiSettings, FiSun, FiUser,
  FiUsers, FiX,
} from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { fullName } from '../../utils/formatters'
import { homeForUser, roleFromUser, roleLabel, useAuth } from '../../hooks/useAuth'

const navigation = {
  admin: [
    ['Inicio', '', FiHome], ['Usuarios', 'users', FiUsers], ['Proyectos', 'projects', FiFolder],
    ['Entregables', 'deliverables', FiFileText], ['Evaluaciones', 'evaluations', FiCheckSquare],
    ['Académico', 'academics', FiBookOpen], ['Repositorio', 'repository', FiArchive],
    ['Ajustes', 'settings', FiSettings], ['Mi perfil', 'profile', FiUser],
  ],
  teacher: [
    ['Inicio', '', FiHome], ['Mis tesis', 'projects', FiFolder], ['Entregables', 'deliverables', FiFileText],
    ['Propuestas', 'proposals', FiCheckSquare], ['Evaluaciones', 'evaluations', FiCheckSquare],
    ['Repositorio', 'repository', FiArchive], ['Mi perfil', 'profile', FiUser],
  ],
  student: [
    ['Inicio', '', FiHome], ['Registrar tesis', 'proposal', FiFolder], ['Mis entregables', 'deliverables', FiFileText],
    ['Evaluación', 'evaluations', FiCheckSquare], ['Repositorio', 'repository', FiArchive], ['Mi perfil', 'profile', FiUser],
  ],
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = roleFromUser(user)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const base = `/${role}`
  const items = useMemo(() => navigation[role], [role])
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/activity-notifications', { params: { per_page: 5 } }).then((r) => r.data),
    refetchInterval: 60_000,
  })
  const unread = notifications.data?.unread_count || 0

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

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
          <div className="topbar-actions">
            <button aria-label="Cambiar tema" onClick={() => setDark((value) => !value)}>{dark ? <FiSun /> : <FiMoon />}</button>
            <button className="notification-button" aria-label={`${unread} notificaciones`}><FiBell />{unread > 0 && <span>{unread}</span>}</button>
            <button className="mini-profile" onClick={() => navigate(`${homeForUser(user)}/profile`)}>
              <span>{fullName(user).charAt(0)}</span><div><strong>{user?.nombres}</strong><small>{roleLabel(user)}</small></div>
            </button>
          </div>
        </header>
        <div className="content"><Outlet /></div>
      </main>
    </div>
  )
}
