import { createElement, Fragment, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FiArchive, FiBell, FiBookOpen, FiCheckSquare, FiChevronLeft, FiFileText,
  FiFolder, FiHome, FiLogOut, FiMenu, FiMoon, FiSearch, FiSettings, FiSun, FiTag,
  FiUser, FiUserCheck, FiUsers, FiX, FiCalendar, FiActivity, FiDatabase, FiGrid,
  FiShield, FiUpload,
} from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { fullName, publicAssetUrl } from '../../utils/formatters'
import { activeProfileId, homeForUser, roleFromUser, roleLabel, useAuth } from '../../hooks/useAuth'

const navigation = {
  admin: [
    ['Inicio', '', FiHome, 'Administración'],
    ['Operaciones', 'operations', FiActivity, 'Gobierno institucional'], ['Carreras y accesos', 'careers', FiGrid, 'Gobierno institucional'],
    ['Auditoría', 'audit', FiShield, 'Seguridad y continuidad'], ['Integridad', 'integrity', FiCheckSquare, 'Seguridad y continuidad'], ['Respaldos', 'backups', FiDatabase, 'Seguridad y continuidad'],
    ['Usuarios', 'users', FiUsers, 'Personas'], ['Asesores', 'advisors', FiUserCheck, 'Personas'],
    ['Proyectos', 'projects', FiFolder, 'Proyectos y tesis'], ['Propuestas', 'proposals', FiCheckSquare, 'Proyectos y tesis'],
    ['Evaluaciones', 'evaluations', FiCheckSquare, 'Proyectos y tesis'], ['Salas de evaluación', 'evaluation-rooms', FiCalendar, 'Proyectos y tesis'],
    ['Evaluaciones archivadas', 'evaluations-archived', FiArchive, 'Proyectos y tesis'], ['Rúbricas', 'evaluation-rubric', FiCheckSquare, 'Proyectos y tesis'],
    ['Gestores', 'evaluation-managers', FiUserCheck, 'Proyectos y tesis'], ['Documentos de evaluación', 'evaluation-documents', FiFileText, 'Proyectos y tesis'],
    ['Académico', 'academics', FiBookOpen, 'Académico'], ['Semestres y periodos', 'semesters', FiCalendar, 'Académico'], ['Entregables', 'deliverables', FiFileText, 'Académico'],
    ['Etiquetas', 'tags', FiTag, 'Sistema'], ['Avisos', 'notices', FiBell, 'Sistema'], ['Ajustes', 'settings', FiSettings, 'Sistema'],
    ['Módulos de carrera', 'career-modules', FiGrid, 'Sistema'], ['Carga inicial', 'career-setup', FiUpload, 'Sistema'], ['Repositorio', 'repository', FiArchive, 'Sistema'],
    ['Mi perfil', 'profile', FiUser, 'Cuenta'],
  ],
  teacher: [
    ['Inicio', '', FiHome], ['Mis tesis', 'projects', FiFolder], ['Entregables', 'deliverables', FiFileText],
    ['Propuestas', 'proposals', FiCheckSquare], ['Evaluaciones', 'evaluations', FiCheckSquare],
    ['Salas de evaluación', 'evaluation-rooms', FiCalendar], ['Evaluaciones archivadas', 'evaluations-archived', FiArchive],
    ['Documentos de evaluación', 'evaluation-documents', FiFileText],
    ['Repositorio', 'repository', FiArchive], ['Mi perfil', 'profile', FiUser],
  ],
  assistant: [
    ['Inicio', '', FiHome], ['Asesores', 'advisors', FiUserCheck], ['Proyectos', 'projects', FiFolder],
    ['Propuestas', 'proposals', FiCheckSquare], ['Entregables', 'deliverables', FiFileText],
    ['Evaluaciones', 'evaluations', FiCheckSquare], ['Salas de evaluación', 'evaluation-rooms', FiCalendar],
    ['Evaluaciones archivadas', 'evaluations-archived', FiArchive], ['Rúbricas', 'evaluation-rubric', FiCheckSquare],
    ['Documentos de evaluación', 'evaluation-documents', FiFileText], ['Académico', 'academics', FiBookOpen],
    ['Semestres y periodos', 'semesters', FiCalendar], ['Repositorio', 'repository', FiArchive],
    ['Mi perfil', 'profile', FiUser],
  ],
  coordinator: [
    ['Inicio', '', FiHome], ['Asesores', 'advisors', FiUserCheck], ['Proyectos', 'projects', FiFolder],
    ['Propuestas', 'proposals', FiCheckSquare], ['Entregables', 'deliverables', FiFileText],
    ['Evaluaciones', 'evaluations', FiCheckSquare], ['Salas de evaluación', 'evaluation-rooms', FiCalendar],
    ['Evaluaciones archivadas', 'evaluations-archived', FiArchive], ['Rúbricas', 'evaluation-rubric', FiCheckSquare],
    ['Documentos de evaluación', 'evaluation-documents', FiFileText], ['Repositorio', 'repository', FiArchive],
    ['Mi perfil', 'profile', FiUser],
  ],
  student: [
    ['Inicio', '', FiHome], ['Registrar tesis', 'proposal', FiFolder], ['Mis entregables', 'deliverables', FiFileText],
    ['Evaluación', 'evaluations', FiCheckSquare], ['Documentos de evaluación', 'evaluation-documents', FiFileText],
    ['Repositorio', 'repository', FiArchive], ['Mi perfil', 'profile', FiUser],
  ],
}
const institutionalPaths = ['operations', 'careers', 'audit', 'integrity', 'backups', 'users']

export default function AppLayout() {
  const { user, logout, switchCareer } = useAuth()
  const navigate = useNavigate()
  const role = roleFromUser(user)
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [careerOpen, setCareerOpen] = useState(false)
  const [switchingCareer, setSwitchingCareer] = useState(false)
  const [search, setSearch] = useState('')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const base = `/${role}`
  const canGovernUsers = activeProfileId(user) === 4
  const items = useMemo(
    () => navigation[role].filter(([, path]) => canGovernUsers || !institutionalPaths.includes(path)),
    [canGovernUsers, role],
  )
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
          {items.map(([label, path, Icon, category], index) => <Fragment key={label}>
            {category && (index === 0 || items[index - 1][3] !== category) && <span className="nav-group-label">{category}</span>}
            <NavLink end={!path} to={path ? `${base}/${path}` : base} title={label} onClick={() => setOpen(false)}>{createElement(Icon)}<span>{label}</span></NavLink>
          </Fragment>)}
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
