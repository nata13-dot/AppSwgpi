import { createElement, Fragment, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowRight, FiBell, FiCheck, FiChevronDown, FiChevronsLeft, FiEye, FiGrid, FiLayers, FiLogOut, FiMenu, FiMoon,
  FiSearch, FiShield, FiSun, FiUser, FiX,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { bottomNavPaths, filterMenu, flattenMenu, menuForUser, SHORT_LABELS } from '../../lib/navigation'
import { homePath, isGeneralAdmin, isManagementStaff, profileLabel, roleLabel, SIMULABLE_PROFILES, viewAs, activeProfileId, isAdmin } from '../../lib/permissions'
import { markNoticesRead, noticeKey, noticesForUser, readNoticeKeys } from '../../lib/notices'
import { accountAppearance, setAppearance } from '../../lib/theme'
import { fullName, matchesSearch, publicAssetUrl } from '../../utils/formatters'
import { recordPath } from '../../lib/searchRoutes'
import { Button, confirmAction, Empty, IconButton, Sheet, Tabs, useDebounced } from '../ui'
import HelpCenter from './HelpCenter'

const careerColor = (career) => career?.color_acento || career?.color_primario || '#1B396A'

function Avatar({ user, size = 'md' }) {
  const photo = publicAssetUrl(user?.photo_path || user?.foto_ruta)
  return <span className={`avatar-app ${size}`}>{photo ? <img src={photo} alt="" /> : (user?.nombres || '?').charAt(0)}</span>
}

export default function AppLayout() {
  const [appVersion, setAppVersion] = useState('')
  useEffect(() => {
    if (Capacitor.isNativePlatform()) CapacitorApp.getInfo().then((info) => setAppVersion(info.version)).catch(() => {})
  }, [])
  const { user, logout, switchCareer, startLevelView, exitLevelView } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const client = useQueryClient()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sgpi-sidebar-collapsed') === '1')
  const [sheet, setSheet] = useState(null) // more | notifications | career | level | search
  const [busy, setBusy] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const simulation = viewAs(user)
  const generalAdmin = isGeneralAdmin(user)

  const modules = useQuery({
    queryKey: ['career-modules', user?.active_career?.id, activeProfileId(user)],
    queryFn: () => api.get('/career/modules').then((response) => response.data),
    staleTime: 60_000,
  })
  const enabledModules = useMemo(() => (modules.data ? new Set((modules.data.modules || []).filter((module) => module.habilitado).map((module) => module.modulo)) : null), [modules.data])
  const menu = useMemo(() => filterMenu(menuForUser(user), enabledModules), [user, enabledModules])
  const flatMenu = useMemo(() => flattenMenu(menu), [menu])
  const bottomItems = useMemo(() => bottomNavPaths(user).map((path) => flatMenu.find((entry) => entry.path === path)).filter(Boolean), [flatMenu, user])

  const settings = useQuery({ queryKey: ['public-settings'], queryFn: () => api.get('/settings/public').then((response) => response.data), staleTime: 300_000 })
  const activity = useQuery({ queryKey: ['activity-notifications'], queryFn: () => api.get('/activity-notifications', { params: { per_page: 8 } }).then((response) => response.data), refetchInterval: 60_000 })
  // Pendientes que se marcan en el menú: solicitudes de cuenta y propuestas por validar.
  const badges = useQuery({ queryKey: ['management-badges'], queryFn: () => api.get('/period-center/badges').then((response) => response.data), enabled: isManagementStaff(user), refetchInterval: 60_000, staleTime: 30_000 })
  const operations = useQuery({ queryKey: ['operational-alerts-summary'], queryFn: () => api.get('/admin/operational-alerts/summary').then((response) => response.data), enabled: generalAdmin && !simulation, refetchInterval: 60_000 })
  const notices = useMemo(() => noticesForUser(settings.data?.system_notices, user), [settings.data, user])
  const [readKeys, setReadKeys] = useState(readNoticeKeys)
  const unreadNotices = notices.filter((notice) => !readKeys.has(noticeKey(notice))).length
  const unread = unreadNotices + Number(activity.data?.unread_count || 0) + Number(operations.data?.total || 0)

  const careers = user?.careers || []
  const canSwitchCareer = !simulation && (generalAdmin || careers.length > 1)
  const canSimulate = generalAdmin || Boolean(simulation)

  useEffect(() => { localStorage.setItem('sgpi-sidebar-collapsed', collapsed ? '1' : '0') }, [collapsed])
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark')
    window.addEventListener('sgpi:appearance', sync)
    return () => window.removeEventListener('sgpi:appearance', sync)
  }, [])
  const flipTheme = () => {
    setAppearance({ theme: dark ? 'light' : 'dark' })
    if (!simulation) api.put('/appearance', accountAppearance()).then(() => client.removeQueries({ queryKey: ['appearance'] })).catch(() => toast.error('No se pudo guardar el tema en tu cuenta.'))
  }
  // Al cambiar de pantalla se cierra cualquier hoja abierta (ajuste durante el render, sin efecto).
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) { setLastPath(location.pathname); setSheet(null) }
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSheet('search') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const reloadSession = (nextUser) => {
    setSheet(null)
    client.clear()
    navigate(homePath(nextUser), { replace: true })
  }
  const run = async (action) => {
    setBusy(true)
    try { await action() } catch (error) { toast.error(error.message && !error.response ? error.message : apiError(error)) } finally { setBusy(false) }
  }
  const changeCareer = (careerId) => run(async () => {
    if (Number(careerId) === Number(user?.active_career?.id)) return setSheet(null)
    reloadSession(await switchCareer(careerId))
  })
  const changeLevel = (profileId) => run(async () => {
    reloadSession(await startLevelView(profileId))
    toast.info(`Simulando ${profileLabel(profileId)} (sólo lectura).`)
  })
  const leaveLevel = () => run(async () => {
    try { reloadSession(await exitLevelView()) } catch (error) { navigate('/login', { replace: true }); throw error }
  })
  const signout = async () => {
    if (!(await confirmAction({ title: 'Cerrar sesión', text: '¿Seguro que deseas cerrar sesión?', confirmText: 'Sí, cerrar sesión', icon: 'question' }))) return
    await logout()
    navigate('/login', { replace: true })
  }
  const openNotifications = () => {
    setSheet('notifications')
    markNoticesRead(notices)
    setReadKeys(readNoticeKeys())
  }

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${simulation ? 'simulating' : ''}`} style={{ '--career-color': careerColor(user?.active_career) }}>
      {settings.data?.global_notice && <div className="global-notice" role="status">{settings.data.global_notice}</div>}
      <aside className="sidebar-app" aria-label="Menú principal">
        <NavLink to={homePath(user)} className="sidebar-brand">
          <img src="/images/itssmt.webp" alt="ITSSMT" />
          <span><strong>Gestión de Proyectos</strong><strong>{user?.active_career?.nombre_corto || 'Integradores ITSSMT'}</strong><small>{user?.active_career?.clave || 'Sistema institucional'}</small></span>
        </NavLink>
        <div className="sidebar-profile"><Avatar user={user} /><span><strong>{user?.nombres}</strong><small>{roleLabel(user)}</small></span></div>
        <MenuList menu={menu} pathname={location.pathname} collapsed={collapsed} badges={badges.data} />
        <footer className="sidebar-foot">
          <small>SGPI{appVersion ? ` · versión ${appVersion}` : ''}</small>
          <IconButton icon={FiChevronsLeft} label={collapsed ? 'Expandir menú' : 'Contraer menú'} className="collapse-toggle" onClick={() => setCollapsed((value) => !value)} />
        </footer>
      </aside>

      <div className="workspace">
        <header className="topbar-app">
          <NavLink to={homePath(user)} className="topbar-logo" aria-label="Inicio"><img src="/images/itssmt.webp" alt="" /></NavLink>
          <div className="topbar-title"><strong>{user?.active_career?.nombre_corto || 'SGPI'}</strong><small>{roleLabel(user)}</small></div>
          <button type="button" className="topbar-search" onClick={() => setSheet('search')}><FiSearch /><span>Buscar pantallas y registros...</span><kbd>Ctrl K</kbd></button>
          <div className="topbar-actions">
            {canSwitchCareer && <button type="button" className="topbar-chip" onClick={() => setSheet('career')} disabled={busy}><i style={{ background: careerColor(user?.active_career) }} /><span>{user?.active_career?.nombre_corto || 'Carrera'}</span><FiChevronDown /></button>}
            {canSimulate && <button type="button" className={`topbar-chip level ${simulation ? 'active' : ''}`} onClick={() => setSheet('level')} disabled={busy}><FiLayers /><span>{simulation ? roleLabel(user) : 'Administrador general'}</span><FiChevronDown /></button>}
            <IconButton icon={FiSearch} label="Buscar" className="mobile-only" onClick={() => setSheet('search')} />
            <button type="button" className="icon-btn badge-host" aria-label={`Notificaciones${unread ? `, ${unread} nuevas` : ''}`} onClick={openNotifications}><FiBell />{unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}</button>
            <button type="button" className="topbar-user" onClick={() => setSheet('more')} aria-label="Cuenta y menú"><Avatar user={user} size="sm" /><span><strong>{user?.nombres}</strong><small>{roleLabel(user)}</small></span><FiChevronDown /></button>
          </div>
        </header>
        {simulation && (
          <div className="view-as-banner" role="status">
            <FiEye aria-hidden="true" />
            <span>Viendo <strong>{user?.active_career?.nombre_corto}</strong> como <strong>{roleLabel(user)}</strong>. Simulación de sólo lectura con tu cuenta: los cambios están bloqueados y no se muestran datos personales de nadie.</span>
            <Button variant="dark" size="sm" onClick={leaveLevel} loading={busy}>Volver a administrador general</Button>
          </div>
        )}
        <main className="content-app" id="main"><Outlet /></main>
      </div>

      <nav className="bottom-nav" aria-label="Accesos rápidos">
        {bottomItems.map((entry) => (
          <NavLink key={entry.path} to={entry.path} end={entry.path === '/dashboard'}>{createElement(entry.icon, { 'aria-hidden': true })}<span>{SHORT_LABELS[entry.path] || entry.label}</span></NavLink>
        ))}
        <button type="button" className={sheet === 'more' ? 'active' : ''} onClick={() => setSheet('more')}><FiMenu aria-hidden="true" /><span>Más</span></button>
      </nav>

      <Sheet open={sheet === 'more'} title={fullName(user)} subtitle={`${roleLabel(user)}${user?.active_career ? ` · ${user.active_career.nombre_corto}` : ''}`} onClose={() => setSheet(null)} size="menu">
        <div className="more-quick">
          {canSwitchCareer && <button type="button" onClick={() => setSheet('career')}><FiGrid /><span>Carrera</span><small>{user?.active_career?.nombre_corto}</small></button>}
          {canSimulate && <button type="button" onClick={() => setSheet('level')}><FiLayers /><span>Nivel</span><small>{simulation ? roleLabel(user) : 'Admin. general'}</small></button>}
          <button type="button" onClick={flipTheme}>{dark ? <FiSun /> : <FiMoon />}<span>{dark ? 'Modo claro' : 'Modo oscuro'}</span></button>
          <button type="button" onClick={() => navigate('/profile')}><FiUser /><span>Mi perfil</span></button>
        </div>
        <MenuList menu={menu} pathname={location.pathname} badges={badges.data} />
        <Button variant="ghost-danger" icon={FiLogOut} className="w-100 mt-3" onClick={signout}>Cerrar sesión</Button>
      </Sheet>

      <Sheet open={sheet === 'career'} title="Administrar como" subtitle="Elige la carrera con la que quieres trabajar." onClose={() => setSheet(null)} size="sm">
        <div className="option-list">
          {careers.map((career) => {
            const active = Number(career.id) === Number(user?.active_career?.id)
            return (
              <button type="button" key={career.id} className={active ? 'active' : ''} disabled={busy} onClick={() => changeCareer(career.id)}>
                <i className="dot" style={{ background: careerColor(career) }} />
                <span><strong>{career.nombre_corto || career.nombre}</strong><small>{career.clave}{career.perfil_id && !generalAdmin ? ` · ${profileLabel(career.perfil_id)}` : ''}</small></span>
                {active && <FiCheck />}
              </button>
            )
          })}
        </div>
        {generalAdmin && <Button variant="ghost" className="w-100 mt-2" onClick={() => navigate('/careers')}>Gestionar carreras</Button>}
      </Sheet>

      <Sheet open={sheet === 'level'} title={`Ver ${user?.active_career?.nombre_corto || 'la carrera'} como`} subtitle="Simulación de sólo lectura con tu cuenta; no muestra datos personales de nadie." onClose={() => setSheet(null)} size="sm">
        <div className="option-list">
          <button type="button" className={simulation ? '' : 'active'} disabled={busy || !simulation} onClick={leaveLevel}><b className="level-number">1</b><span><strong>Administrador general</strong><small>Tu sesión real</small></span>{!simulation && <FiCheck />}</button>
          {SIMULABLE_PROFILES.map((profileId, index) => {
            const active = simulation && activeProfileId(user) === profileId
            return <button type="button" key={profileId} className={active ? 'active' : ''} disabled={busy || active} onClick={() => changeLevel(profileId)}><b className="level-number">{index + 2}</b><span><strong>{profileLabel(profileId)}</strong></span>{active && <FiCheck />}</button>
          })}
        </div>
      </Sheet>

      <NotificationsSheet open={sheet === 'notifications'} onClose={() => setSheet(null)} notices={notices} activity={activity} operations={generalAdmin && !simulation ? operations : null} canManageNotices={isAdmin(user)} />
      <SearchSheet open={sheet === 'search'} onClose={() => setSheet(null)} items={flatMenu} user={user} />
      <HelpCenter user={user} menuItems={flatMenu} simulated={Boolean(simulation)} onOpenSearch={() => setSheet('search')} />
    </div>
  )
}

const badgeText = (count) => (count > 99 ? '99+' : String(count))

function MenuList({ menu, pathname, collapsed = false, badges = {} }) {
  const [open, setOpen] = useState({})
  return (
    <nav className="menu-app">
      {menu.map((entry, index) => {
        if (entry.section) return <h6 key={`s${index}`} className="menu-section">{entry.section}</h6>
        if (!entry.group) return <MenuLink key={entry.path} entry={entry} collapsed={collapsed} count={badges?.[entry.badge]} />
        const pending = entry.items.reduce((sum, child) => sum + Number(badges?.[child.badge] || 0), 0)
        const active = entry.items.some((child) => pathname === child.path || pathname.startsWith(`${child.path}/`))
        const expanded = open[entry.group] ?? active
        return (
          <section key={entry.group} className={`menu-group ${expanded ? 'open' : ''}`}>
            <button type="button" className={`menu-group-toggle ${active ? 'has-active' : ''}`} aria-expanded={expanded} title={entry.group} onClick={() => setOpen((current) => ({ ...current, [entry.group]: !expanded }))}>
              {createElement(entry.icon, { 'aria-hidden': true })}<span>{entry.group}</span>{!expanded && pending > 0 && <b className="menu-badge" aria-label={`${pending} pendientes`}>{badgeText(pending)}</b>}<FiChevronDown className="chevron" aria-hidden="true" />
            </button>
            {expanded && <div className="menu-group-items">{entry.items.map((child) => <MenuLink key={child.path} entry={child} collapsed={collapsed} count={badges?.[child.badge]} />)}</div>}
          </section>
        )
      })}
    </nav>
  )
}

function MenuLink({ entry, count = 0 }) {
  return (
    <NavLink to={entry.path} end={entry.path === '/dashboard'} title={entry.label} className="menu-link">
      {createElement(entry.icon, { 'aria-hidden': true })}<span>{entry.label}</span>
      {count > 0 && <b className="menu-badge" aria-label={`${count} pendientes`}>{badgeText(count)}</b>}
    </NavLink>
  )
}

function NotificationsSheet({ open, onClose, notices, activity, operations, canManageNotices }) {
  const navigate = useNavigate()
  const [selectedTab, setTab] = useState('notices')
  const tab = selectedTab === 'operations' && !operations ? 'notices' : selectedTab
  const activityItems = activity.data?.data || []
  const markAll = async () => { await api.put('/activity-notifications/read-all'); activity.refetch() }
  const openActivity = async (notification) => {
    if (!notification.leida_en) await api.put(`/activity-notifications/${notification.id}/read`).catch(() => {})
    activity.refetch()
    if (notification.url) {
      const target = String(notification.url)
      // Las URL de actividad apuntan a páginas del front de PHP; sólo se siguen las internas de esta app.
      if (target.startsWith('/') && !target.startsWith('/pages/')) navigate(target)
      onClose()
    }
  }

  return (
    <Sheet open={open} title="Notificaciones" onClose={onClose} size="sm">
      <Tabs value={tab} onChange={setTab} items={[
        { key: 'notices', label: 'Avisos', count: notices.length || null },
        { key: 'activity', label: 'Actividad', count: activity.data?.unread_count || null },
        operations && { key: 'operations', label: 'Operación', icon: FiShield, count: operations.data?.total || null },
      ]} />
      {tab === 'notices' && (notices.length ? <ul className="notice-list">{notices.slice(0, 8).map((notice) => <li key={noticeKey(notice)} className={notice.type || 'info'}><strong>{notice.title || 'Aviso del sistema'}</strong><p>{notice.message}</p></li>)}</ul> : <Empty title="Sin avisos" message="No hay notificaciones nuevas." />)}
      {tab === 'notices' && canManageNotices && <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate('/notices')}>Gestionar avisos</Button>}
      {tab === 'activity' && (activityItems.length ? (
        <>
          <ul className="notice-list">{activityItems.map((notification) => <li key={notification.id} className={notification.leida_en ? 'read' : 'unread'}><button type="button" onClick={() => openActivity(notification)}><strong>{notification.titulo}</strong><p>{notification.mensaje}</p><small>{notification.creada_en ? new Date(notification.creada_en).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small></button></li>)}</ul>
          {activity.data?.unread_count > 0 && <Button variant="ghost" size="sm" className="mt-2" onClick={markAll}>Marcar todas como leídas</Button>}
        </>
      ) : <Empty title="Sin actividad" message="No hay actividad reciente." />)}
      {tab === 'operations' && operations && (
        <>
          {(operations.data?.data || []).length ? <ul className="notice-list">{operations.data.data.map((alert) => <li key={alert.id} className={alert.severidad === 'critica' ? 'danger' : 'warning'}><strong>{alert.titulo}</strong><p>{alert.detalle}</p><small>{alert.estado === 'atendida' ? 'En atención' : 'Requiere atención'}</small></li>)}</ul> : <Empty title="Operación saludable" message="No hay alertas operativas activas." />}
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate('/operations')}>Ver centro de operaciones</Button>
        </>
      )}
    </Sheet>
  )
}

function SearchSheet({ open, onClose, items, user }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const debounced = useDebounced(term.trim(), 280)
  const close = () => { setTerm(''); onClose() }
  const go = (path) => { navigate(path); close() }
  const pages = term.trim() ? items.filter((entry) => matchesSearch(`${entry.label} ${(entry.keywords || []).join(' ')}`, term)) : items
  const records = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => api.get('/search', { params: { q: debounced } }).then((response) => response.data),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  })
  const groups = debounced.length >= 2 ? records.data?.groups || [] : []
  const searching = term.trim().length >= 2 && (records.isFetching || debounced !== term.trim())
  const first = pages[0]?.path || (groups[0] && recordPath(groups[0].type, groups[0].items[0], user))
  return (
    <Sheet open={open} title="Buscar" onClose={close} size="sm">
      <label className="search-app big"><FiSearch /><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Pantallas, proyectos, personas, documentos..." onKeyDown={(event) => { if (event.key === 'Enter' && first) go(first) }} /></label>
      <div className="option-list compact">
        {pages.length > 0 && term.trim() && <h6 className="search-group-title">Pantallas</h6>}
        {pages.map((entry) => <button type="button" key={entry.path} onClick={() => go(entry.path)}>{createElement(entry.icon)}<span><strong>{entry.label}</strong></span></button>)}
        {groups.map((group) => (
          <Fragment key={group.type}>
            <h6 className="search-group-title">{group.label}</h6>
            {group.items.map((item) => <button type="button" key={item.id} onClick={() => go(recordPath(group.type, item, user))}><FiArrowRight aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.subtitle}</small></span></button>)}
          </Fragment>
        ))}
        {searching && !groups.length && <p className="muted small-text">Buscando en el sistema...</p>}
        {records.isError && <p className="muted small-text">{apiError(records.error)}</p>}
        {!pages.length && !groups.length && !searching && !records.isError && <Empty title="Sin coincidencias" message={term.trim().length < 2 ? 'Escribe al menos dos letras.' : 'Prueba con otra palabra. Sólo aparece lo que tu perfil puede consultar.'} />}
      </div>
    </Sheet>
  )
}
