import { createElement, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  FiArchive, FiBell, FiBookOpen, FiCheckSquare, FiChevronDown, FiChevronLeft, FiFileText,
  FiFolder, FiHome, FiLogOut, FiMenu, FiMoon, FiSearch, FiSettings, FiSun, FiTag,
  FiUser, FiUserCheck, FiUsers, FiX, FiCalendar, FiActivity, FiDatabase, FiGrid,
  FiShield, FiUpload, FiKey,
} from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { fullName, publicAssetUrl } from '../../utils/formatters'
import { activeProfileId, homeForUser, roleFromUser, roleLabel, useAuth } from '../../hooks/useAuth'
import { registerBackHandler } from '../../utils/backNavigation'

const navigation = {
  admin: [
    ['Inicio', '', FiHome, 'Administración'],
    ['Operaciones', 'operations', FiActivity, 'Gobierno institucional'], ['Carreras y accesos', 'careers', FiGrid, 'Gobierno institucional'],
    ['Auditoría', 'audit', FiShield, 'Seguridad y continuidad'], ['Integridad', 'integrity', FiCheckSquare, 'Seguridad y continuidad'], ['Respaldos', 'backups', FiDatabase, 'Seguridad y continuidad'],
    ['Usuarios', 'users', FiUsers, 'Personas'], ['Asesores', 'advisors', FiUserCheck, 'Personas'],
    ['Gestionar proyectos', 'projects', FiFolder, 'Proyectos y tesis', 'proyectos'], ['Propuestas', 'proposals', FiCheckSquare, 'Proyectos y tesis', 'proyectos'],
    ['Evaluaciones', 'evaluations', FiCheckSquare, 'Proyectos y tesis', 'evaluaciones'], ['Salas y turnos', 'evaluation-rooms', FiCalendar, 'Proyectos y tesis', 'evaluaciones'],
    ['Evaluaciones previas', 'evaluations-archived', FiArchive, 'Proyectos y tesis', 'evaluaciones'], ['Evidencias', 'evaluation-documents', FiFileText, 'Proyectos y tesis', 'evaluaciones'],
    ['Asignaturas y competencias', 'academics', FiBookOpen, 'Académico', 'academico'], ['Semestres y periodos', 'semesters', FiCalendar, 'Académico', 'academico'], ['Entregables', 'deliverables', FiFileText, 'Académico', 'entregables'],
    ['Autoregistro de materias', 'course-enrollment', FiKey, 'Académico', 'academico'], ['Empresas', 'companies', FiDatabase, 'Proyectos y tesis', 'proyectos'],
    ['Etiquetas', 'tags', FiTag, 'Sistema', 'repositorio'], ['Avisos', 'notices', FiBell, 'Sistema', 'configuracion'], ['Ajustes', 'settings', FiSettings, 'Sistema', 'configuracion'],
    ['Módulos de carrera', 'career-modules', FiGrid, 'Sistema'], ['Carga inicial', 'career-setup', FiUpload, 'Sistema', 'academico'], ['Repositorio', 'repository', FiArchive, 'Sistema', 'repositorio'],
    ['Mi perfil', 'profile', FiUser, 'Cuenta'],
  ],
  teacher: [
    ['Inicio', '', FiHome, 'Docente'], ['Mis proyectos', 'projects', FiFolder, 'Proyectos y tesis', 'proyectos'],
    ['Revisar propuestas', 'proposals', FiCheckSquare, 'Proyectos y tesis', 'proyectos'], ['Evaluaciones', 'evaluations', FiCheckSquare, 'Proyectos y tesis', 'evaluaciones'],
    ['Salas y turnos', 'evaluation-rooms', FiCalendar, 'Proyectos y tesis', 'evaluaciones'], ['Evaluaciones previas', 'evaluations-archived', FiArchive, 'Proyectos y tesis', 'evaluaciones'],
    ['Evidencias', 'evaluation-documents', FiFileText, 'Proyectos y tesis', 'evaluaciones'], ['Entregables', 'deliverables', FiFileText, 'Académico', 'entregables'],
    ['Claves de autoregistro', 'course-enrollment', FiKey, 'Académico', 'academico'],
    ['Repositorio', 'repository', FiArchive, 'Sistema', 'repositorio'], ['Mi perfil', 'profile', FiUser, 'Cuenta'],
  ],
  assistant: [
    ['Inicio', '', FiHome, 'Administración'], ['Asesores', 'advisors', FiUserCheck, 'Personas', 'proyectos'], ['Gestionar proyectos', 'projects', FiFolder, 'Proyectos y tesis', 'proyectos'],
    ['Propuestas', 'proposals', FiCheckSquare, 'Proyectos y tesis', 'proyectos'], ['Evaluaciones', 'evaluations', FiCheckSquare, 'Proyectos y tesis', 'evaluaciones'],
    ['Salas y turnos', 'evaluation-rooms', FiCalendar, 'Proyectos y tesis', 'evaluaciones'], ['Evaluaciones previas', 'evaluations-archived', FiArchive, 'Proyectos y tesis', 'evaluaciones'],
    ['Evidencias', 'evaluation-documents', FiFileText, 'Proyectos y tesis', 'evaluaciones'], ['Asignaturas y competencias', 'academics', FiBookOpen, 'Académico', 'academico'],
    ['Semestres y periodos', 'semesters', FiCalendar, 'Académico', 'academico'], ['Entregables', 'deliverables', FiFileText, 'Académico', 'entregables'],
    ['Autoregistro de materias', 'course-enrollment', FiKey, 'Académico', 'academico'], ['Empresas', 'companies', FiDatabase, 'Proyectos y tesis', 'proyectos'],
    ['Repositorio', 'repository', FiArchive, 'Sistema', 'repositorio'], ['Mi perfil', 'profile', FiUser, 'Cuenta'],
  ],
  coordinator: [
    ['Inicio', '', FiHome, 'Administración'], ['Asesores', 'advisors', FiUserCheck, 'Personas', 'proyectos'], ['Gestionar proyectos', 'projects', FiFolder, 'Proyectos y tesis', 'proyectos'],
    ['Propuestas', 'proposals', FiCheckSquare, 'Proyectos y tesis', 'proyectos'], ['Entregables', 'deliverables', FiFileText, 'Proyectos y tesis', 'entregables'],
    ['Empresas', 'companies', FiDatabase, 'Proyectos y tesis', 'proyectos'],
    ['Evaluaciones', 'evaluations', FiCheckSquare, 'Proyectos y tesis', 'evaluaciones'], ['Salas y turnos', 'evaluation-rooms', FiCalendar, 'Proyectos y tesis', 'evaluaciones'],
    ['Evaluaciones previas', 'evaluations-archived', FiArchive, 'Proyectos y tesis', 'evaluaciones'], ['Evidencias', 'evaluation-documents', FiFileText, 'Proyectos y tesis', 'evaluaciones'],
    ['Repositorio', 'repository', FiArchive, 'Sistema', 'repositorio'], ['Mi perfil', 'profile', FiUser, 'Cuenta'],
  ],
  student: [
    ['Inicio', '', FiHome, 'Estudiante'], ['Registrar propuesta', 'proposal', FiFolder, 'Proyectos y tesis', 'proyectos'],
    ['Mis evaluaciones', 'evaluations', FiCheckSquare, 'Proyectos y tesis', 'evaluaciones'],
    ['Evidencias', 'evaluation-documents', FiFileText, 'Proyectos y tesis', 'evaluaciones'], ['Mis entregables', 'deliverables', FiFileText, 'Académico', 'entregables'],
    ['Autoregistro de materias', 'course-enrollment', FiKey, 'Académico', 'academico'],
    ['Repositorio', 'repository', FiArchive, 'Sistema', 'repositorio'], ['Mi perfil', 'profile', FiUser, 'Cuenta'],
  ],
}
const institutionalPaths = ['operations', 'careers', 'audit', 'integrity', 'backups', 'users']
const groupIcons = { 'Gobierno institucional': FiGrid, 'Seguridad y continuidad': FiShield, Personas: FiUsers, 'Proyectos y tesis': FiFolder, Académico: FiBookOpen, Sistema: FiSettings }

export default function AppLayout() {
  const { user, logout, switchCareer } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const role = roleFromUser(user)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [careerOpen, setCareerOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [switchingCareer, setSwitchingCareer] = useState(false)
  const [search, setSearch] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const base = `/${role}`
  const canGovernUsers = activeProfileId(user) === 4
  const modules = useQuery({
    queryKey: ['navigation-career-modules', user?.active_career?.id],
    queryFn: () => api.get('/career/modules').then((response) => response.data.modules || []),
    staleTime: 60_000,
  })
  const enabledModules = useMemo(() => new Set((modules.data || []).filter((module) => module.habilitado).map((module) => module.modulo)), [modules.data])
  const items = useMemo(() => navigation[role].filter(([, path, , , module]) => {
    if (!canGovernUsers && institutionalPaths.includes(path)) return false
    return !module || !modules.data || enabledModules.has(module)
  }), [canGovernUsers, enabledModules, modules.data, role])
  const groupedItems = useMemo(() => items.reduce((result, item) => {
    const category = item[3]
    if (!category || ['Administración', 'Docente', 'Estudiante', 'Cuenta'].includes(category)) {
      result.push({ key: `item:${item[1]}`, item })
      return result
    }
    const current = result[result.length - 1]
    if (current?.category === category) current.items.push(item)
    else result.push({ key: `group:${category}`, category, items: [item] })
    return result
  }, []), [items])
  const careers = useQuery({
    queryKey: ['auth-careers', user?.id],
    queryFn: () => api.get('/auth/careers').then((response) => response.data.careers || []),
    staleTime: 60_000,
  })
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/activity-notifications', { params: { per_page: 5 } }).then((r) => r.data),
    refetchInterval: 60_000,
  })
  const unread = notifications.data?.unread_count || 0
  const searchItems = useMemo(() => items.filter(([label]) => label.toLowerCase().includes(search.toLowerCase())), [items, search])
  const profilePhoto = publicAssetUrl(user?.photo_path || user?.foto_ruta)

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
  useEffect(() => {
    if (!searchOpen && !noticeOpen && !careerOpen && !open) return undefined
    return registerBackHandler(() => {
      if (searchOpen) setSearchOpen(false)
      else if (noticeOpen) setNoticeOpen(false)
      else if (careerOpen) setCareerOpen(false)
      else setOpen(false)
    })
  }, [careerOpen, noticeOpen, open, searchOpen])

  const signout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }
  const changeCareer = async (careerId) => {
    if (Number(careerId) === Number(user?.active_career?.id)) return
    setSwitchingCareer(true)
    try {
      const nextUser = await switchCareer(careerId)
      setCareerOpen(false)
      navigate(homeForUser(nextUser), { replace: true })
      window.location.reload()
    } finally { setSwitchingCareer(false) }
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
          <div className={`avatar ${profilePhoto ? 'has-photo' : ''}`}>{profilePhoto ? <img src={profilePhoto} alt="" /> : fullName(user).charAt(0)}</div>
          <div><strong>{fullName(user)}</strong><small>{roleLabel(user)}</small></div>
        </div>
        <nav>
          <span className="nav-caption">{roleLabel(user)}</span>
          {groupedItems.map((entry) => {
            if (entry.item) {
              const [label, path, Icon] = entry.item
              return <NavLink key={entry.key} end={!path} to={path ? `${base}/${path}` : base} title={label} onClick={() => setOpen(false)}>{createElement(Icon)}<span>{label}</span></NavLink>
            }
            const GroupIcon = groupIcons[entry.category] || FiGrid
            const active = entry.items.some(([, path]) => path && location.pathname === `${base}/${path}`)
            const expanded = active || Boolean(expandedGroups[entry.category])
            return <section className={`react-nav-group ${expanded ? 'open' : ''}`} key={entry.key}>
              <button type="button" className="react-nav-group-toggle" onClick={() => setExpandedGroups((current) => ({ ...current, [entry.category]: !expanded }))}>{createElement(GroupIcon)}<span>{entry.category}</span><FiChevronDown className="nav-chevron" /></button>
              {expanded && <div>{entry.items.map(([label, path, Icon]) => <NavLink key={path} to={`${base}/${path}`} title={label} onClick={() => setOpen(false)}>{createElement(Icon)}<span>{label}</span></NavLink>)}</div>}
            </section>
          })}
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
            {careers.data?.length > 0 && <div className="career-switch-react"><button className="career-switch-button" onClick={() => setCareerOpen((value) => !value)} disabled={switchingCareer}><FiGrid /><span>{user?.active_career?.nombre_corto || 'Seleccionar carrera'}</span></button>{careerOpen && <div className="career-switch-menu">{careers.data.map((career) => <button className={Number(career.id) === Number(user?.active_career?.id) ? 'active' : ''} key={career.id} disabled={switchingCareer} onClick={() => changeCareer(career.id)}><i style={{ background: career.color_primario || '#1B396A' }} /><span><strong>{career.nombre_corto || career.nombre}</strong><small>{career.clave} · {roleLabel({ active_profile_id: career.perfil_id })}</small></span>{Number(career.id) === Number(user?.active_career?.id) && <FiCheckSquare />}</button>)}</div>}</div>}
            <button aria-label="Cambiar tema" onClick={() => setDark((value) => !value)}>{dark ? <FiSun /> : <FiMoon />}</button>
            <button className="notification-button" aria-label={`${unread} notificaciones`} onClick={() => setNoticeOpen(!noticeOpen)}><FiBell />{unread > 0 && <span>{unread}</span>}</button>
            <button className="mini-profile" onClick={() => navigate(`${homeForUser(user)}/profile`)}>
              <span className={profilePhoto ? 'has-photo' : ''}>{profilePhoto ? <img src={profilePhoto} alt="" /> : fullName(user).charAt(0)}</span><div><strong>{user?.nombres}</strong><small>{roleLabel(user)}</small></div>
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
