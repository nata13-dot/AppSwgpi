import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiCalendar, FiCheckSquare, FiClock, FiDatabase, FiGrid, FiLayers, FiLogIn, FiMail, FiShield, FiUserMinus, FiUserPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { homePath, profileLabel, SIMULABLE_PROFILES } from '../../lib/permissions'
import { Badge, Button, Card, Chips, ErrorState, Field, IconButton, Loading, Page, Progress, promptPassword, SearchInput, Sheet, Switch, useDebounced } from '../../components/ui'

const PERIOD_STATES = { abierto: ['success', 'Abierto'], en_cierre: ['warning', 'En cierre'], preparacion: ['neutral', 'En preparación'] }

/** Panel institucional del administrador general (Frontend_Swgpi/pages/admin/general.php). */
export default function GeneralPanel() {
  const navigate = useNavigate()
  const needsCareer = Boolean(useLocation().state?.needsCareer)
  const client = useQueryClient()
  const { switchCareer, startLevelView } = useAuth()
  const [viewAsCareer, setViewAsCareer] = useState(null)
  const [busy, setBusy] = useState(null)
  const careers = useQuery({ queryKey: ['admin-careers'], queryFn: () => api.get('/admin/careers').then((response) => (response.data.careers || []).filter((career) => career.activa !== false)) })
  const alerts = useQuery({ queryKey: ['operational-alerts-summary'], queryFn: () => api.get('/admin/operational-alerts/summary').then((response) => response.data), staleTime: 60_000 })
  const backups = useQuery({ queryKey: ['backups-health'], queryFn: () => api.get('/admin/database-backups-health').then((response) => response.data), staleTime: 60_000 })
  const integrity = useQuery({ queryKey: ['integrity-history'], queryFn: () => api.get('/admin/integrity/history').then((response) => response.data), staleTime: 60_000 })

  const list = careers.data || []
  const openPeriods = list.filter((career) => career.period?.estado === 'abierto').length
  const lastIntegrity = (integrity.data?.data || [])[0]
  const kpis = [
    ['Carreras activas', list.length],
    ['Membresías activas', list.reduce((total, career) => total + Number(career.members_count || 0), 0)],
    ['Periodos abiertos', `${openPeriods}/${list.length}`, openPeriods < list.length],
    ['Alertas abiertas', alerts.data ? Number(alerts.data.open || 0) : '–', Number(alerts.data?.critical || 0) > 0],
    ['Respaldos', backups.data ? (backups.data.healthy ? 'Sanos' : 'Revisar') : '–', backups.data && !backups.data.healthy],
    ['Última integridad', integrity.data ? (lastIntegrity ? (lastIntegrity.saludable ? 'Correcta' : `${lastIntegrity.incidencias} incid.`) : 'Sin datos') : '–', integrity.data && (!lastIntegrity || !lastIntegrity.saludable)],
  ]

  const administer = async (careerId) => {
    setBusy(`career-${careerId}`)
    try {
      await switchCareer(careerId)
      client.clear()
      navigate('/dashboard', { replace: true })
    } catch (error) { toast.error(apiError(error)) } finally { setBusy(null) }
  }
  const toggleBasic = async (career, enabled) => {
    setBusy(`basic-${career.id}`)
    try {
      await api.put(`/admin/careers/${career.id}`, { basic_semesters_enabled: enabled })
      client.setQueryData(['admin-careers'], (current) => current.map((item) => (item.id === career.id ? { ...item, basic_semesters_enabled: enabled } : item)))
      client.invalidateQueries({ queryKey: ['semester-policy'] })
      toast.success(enabled ? 'La carrera ya puede registrar 1° a 4°' : 'La carrera registra sólo 5° a 9°')
    } catch (error) { toast.error(apiError(error)) } finally { setBusy(null) }
  }
  const simulate = async (profileId) => {
    setBusy(`level-${profileId}`)
    try {
      const user = await startLevelView(profileId, viewAsCareer)
      client.clear()
      toast.info(`Simulando ${profileLabel(profileId)} (sólo lectura).`)
      navigate(homePath(user), { replace: true })
    } catch (error) { toast.error(error.response ? apiError(error) : error.message) } finally { setBusy(null) }
  }

  return (
    <Page eyebrow="Administración general" title="Panel institucional" subtitle="Todas las carreras en un solo lugar. Desde aquí entras a administrar una carrera o la ves como la ve cada perfil, sin mezclar su información."
      actions={<>
        <Button variant="ghost" icon={FiLayers} onClick={() => setViewAsCareer(list[0]?.id ?? null)} disabled={!list.length}>Simular nivel…</Button>
        <Button variant="ghost" icon={FiGrid} onClick={() => navigate('/careers')}>Carreras y accesos</Button>
      </>}>
      <section className="kpi-grid" aria-label="Indicadores institucionales">
        {kpis.map(([label, value, warn]) => <div key={label} className={`kpi ${warn ? 'warn' : ''}`}><strong>{careers.isLoading ? '–' : value}</strong><span>{label}</span></div>)}
      </section>
      {needsCareer && <div className="alert-app info mb-3">Esa pantalla pertenece a una carrera. Entra primero a la carrera que quieres modificar.</div>}
      <Card title="Carreras" subtitle="Para modificar algo de una carrera, «Entrar»: actúas como su jefatura y todo queda en la auditoría. «Salir de la carrera» te devuelve aquí.">
        {careers.isLoading ? <Loading /> : careers.isError ? <ErrorState error={careers.error} onRetry={careers.refetch} /> : (
          <div className="grid-4">
            {list.map((career) => {
              const [tone, label] = PERIOD_STATES[career.period?.estado] || ['neutral', 'Sin periodo']
              const roles = career.role_counts || {}
              const readiness = Number(career.readiness?.percentage || 0)
              return (
                <article key={career.id} className="career-tile" style={{ '--tile-color': career.color_primario || '#1B396A' }}>
                  <header><div><strong>{career.nombre_corto}</strong><small>{career.clave}</small></div><Badge tone={tone}>{label}</Badge></header>
                  {career.period && <small>{career.period.nombre}</small>}
                  <small>{Number(roles.students || 0)} alumnos · {Number(roles.teachers || 0)} docentes · {Number(career.projects_count || 0)} proyectos</small>
                  <div><div className="row-wrap"><small>Preparación</small><span className="spacer" /><small>{readiness}%</small></div><Progress value={readiness} label="Preparación" /></div>
                  <Switch checked={career.basic_semesters_enabled} disabled={busy === `basic-${career.id}`} onChange={(value) => toggleBasic(career, value)} label="Registrar 1° a 4°" hint="Casos integradores" />
                  <footer>
                    <Button size="sm" icon={FiLogIn} loading={busy === `career-${career.id}`} onClick={() => administer(career.id)}>Entrar</Button>
                    <Button size="sm" variant="ghost" icon={FiLayers} aria-label="Simular un nivel en esta carrera" onClick={() => setViewAsCareer(career.id)} />
                  </footer>
                </article>
              )
            })}
            {!list.length && <p className="muted">No hay carreras registradas.</p>}
          </div>
        )}
      </Card>
      <GeneralAdmins />
      <Card title="Gestiones institucionales">
        <div className="quick-links">
          {[
            ['Carreras y accesos', 'Identidad, membresías y jefaturas', '/careers', FiGrid],
            ['Calendario institucional', 'Periodos, conciliación y salones', '/academic-workflows', FiCalendar],
            ['Operaciones', 'Alertas y continuidad', '/operations', FiActivity],
            ['Auditoría', 'Quién cambió qué, por carrera', '/audit', FiShield],
            ['Integridad', 'Verificaciones entre carreras', '/integrity', FiCheckSquare],
            ['Respaldos', 'Copias y verificación', '/backups', FiDatabase],
            ['Correos enviados', 'A quién se envió, sin contenido', '/sent-emails', FiMail],
          ].map(([title, hint, path, Icon]) => <button type="button" key={path} onClick={() => navigate(path)}><Icon aria-hidden="true" /><span>{title}<small>{hint}</small></span></button>)}
        </div>
      </Card>

      <Sheet open={viewAsCareer !== null} title="Simular un nivel de perfil" onClose={() => setViewAsCareer(null)} size="sm">
        <p className="muted small-text">Revisa la carrera con los permisos de otro nivel, usando tu propia cuenta y en <strong>sólo lectura</strong>. No se entra a la cuenta de ninguna persona: las secciones personales (mis proyectos, mis entregas) aparecen vacías.</p>
        <Field label="Carrera" className="mt-3">
          <select className="control" value={viewAsCareer ?? ''} onChange={(event) => setViewAsCareer(Number(event.target.value))}>
            {list.map((career) => <option key={career.id} value={career.id}>{career.nombre_corto}</option>)}
          </select>
        </Field>
        <div className="option-list mt-3">
          {SIMULABLE_PROFILES.map((profileId, index) => <button type="button" key={profileId} disabled={Boolean(busy)} onClick={() => simulate(profileId)}><b className="level-number">{index + 2}</b><span><strong>{profileLabel(profileId)}</strong></span></button>)}
        </div>
      </Sheet>
    </Page>
  )
}

const localInput = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const remaining = (iso) => {
  const ms = new Date(iso) - new Date()
  const days = Math.floor(ms / 86400000)
  return days >= 1 ? `${days} día${days === 1 ? '' : 's'}` : `${Math.max(1, Math.round(ms / 3600000))} h`
}

/** Administradores generales: designar de forma definitiva o temporal, cambiar vigencia y retirar. */
function GeneralAdmins() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['general-admins'], queryFn: () => api.get('/admin/general-admins').then((response) => response.data.data || []) })
  const [editing, setEditing] = useState(null) // null cerrado · {} nuevo · admin existente
  const [term, setTerm] = useState('')
  const search = useDebounced(term, 250)
  const [person, setPerson] = useState(null)
  const [kind, setKind] = useState('forever')
  const [until, setUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const candidates = useQuery({
    queryKey: ['ga-candidates', search], enabled: editing !== null && !person && search.trim().length >= 2,
    queryFn: () => api.get('/admin/career-candidates', { params: { search: search.trim() } }).then((response) => response.data.data || []),
  })
  const open = (admin = {}) => {
    setEditing(admin); setTerm('')
    setPerson(admin.id ? { id: admin.id, nombre: admin.nombre } : null)
    setKind(admin.hasta ? 'temp' : 'forever')
    setUntil(admin.hasta ? localInput(new Date(admin.hasta)) : '')
  }
  const days = (n) => setUntil(localInput(new Date(Date.now() + n * 86400000)))
  const save = async () => {
    if (!person) return toast.error('Elige a la persona.')
    if (kind === 'temp' && !until) return toast.error('Indica cuándo termina.')
    const password = await promptPassword({ title: editing?.id ? 'Confirma el cambio de vigencia' : `¿Designar a ${person.nombre}?`, confirmText: 'Confirmar' })
    if (!password) return
    setSaving(true)
    try {
      const response = await api.put(`/users/${encodeURIComponent(person.id)}/general-admin`, { grant: true, admin_password: password, hasta: kind === 'temp' ? new Date(until).toISOString() : null })
      toast.success(response.data.message); setEditing(null); client.invalidateQueries({ queryKey: ['general-admins'] })
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  const revoke = async (admin) => {
    const password = await promptPassword({ title: `¿Retirar la administración general a ${admin.nombre}?`, confirmText: 'Retirar' })
    if (!password) return
    try {
      const response = await api.put(`/users/${encodeURIComponent(admin.id)}/general-admin`, { grant: false, admin_password: password })
      toast.success(response.data.message); client.invalidateQueries({ queryKey: ['general-admins'] })
    } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Card title="Administradores generales" subtitle="Ven todas las carreras y no aparecen como jefatura ni personal de ninguna. La designación puede ser definitiva o temporal."
      actions={<Button size="sm" icon={FiUserPlus} onClick={() => open({})}>Designar</Button>}>
      {query.isLoading ? <Loading rows={2} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
        <ul className="list-app">
          {query.data.map((admin) => (
            <li key={admin.id} className="list-row">
              <div><strong>{admin.nombre}{admin.soy_yo ? ' (tú)' : ''}</strong><small>{admin.id}{admin.designado_por ? ` · designado por ${admin.designado_por}` : ''}</small></div>
              {admin.hasta ? <Badge tone="warning" icon={FiClock}>Temporal · quedan {remaining(admin.hasta)}</Badge> : <Badge tone="primary">Definitiva</Badge>}
              {!admin.soy_yo && <><IconButton icon={FiCalendar} label="Cambiar vigencia" onClick={() => open(admin)} /><IconButton icon={FiUserMinus} className="danger" label="Retirar" onClick={() => revoke(admin)} /></>}
            </li>
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} title={editing?.id ? 'Cambiar vigencia' : 'Designar administrador general'} onClose={() => setEditing(null)} size="sm">
        <div className="stack">
          {person ? (
            <div className="list-row picked-person"><div><strong>{person.nombre}</strong><small>{person.id}</small></div>{!editing?.id && <Button variant="ghost" size="sm" onClick={() => { setPerson(null); setTerm('') }}>Cambiar</Button>}</div>
          ) : (
            <div className="suggest-host">
              <SearchInput value={term} onChange={setTerm} placeholder="Nombre o número de empleado…" />
              {search.trim().length >= 2 && (
                <div className="suggest-list" role="listbox">
                  {candidates.isLoading ? <small className="muted">Buscando…</small> : (candidates.data || []).length ? candidates.data.map((item) => (
                    <button type="button" key={item.id} onClick={() => setPerson(item)}><strong>{item.nombre}</strong><small>{item.id}{item.carreras.length ? ` · ${item.carreras.map((c) => c.clave).join(', ')}` : ''}</small></button>
                  )) : <small className="muted">Sin coincidencias entre el personal.</small>}
                </div>
              )}
            </div>
          )}
          <Field label="Vigencia"><Chips options={[{ value: 'forever', label: 'Definitiva' }, { value: 'temp', label: 'Temporal' }]} value={kind} onChange={(value) => { setKind(value); if (value === 'temp' && !until) days(7) }} /></Field>
          {kind === 'temp' && (
            <>
              <div className="row-wrap">{[[1, '1 día'], [7, '1 semana'], [30, '1 mes'], [180, '6 meses']].map(([n, label]) => <Button key={n} size="sm" variant="ghost" onClick={() => days(n)}>{label}</Button>)}</div>
              <Field label="Termina el" hint="Al vencer se retira sola, se cierran sus sesiones de la app y se le avisa."><input className="control" type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} /></Field>
            </>
          )}
          <Button icon={FiShield} loading={saving} onClick={save}>{editing?.id ? 'Guardar vigencia' : 'Designar'}</Button>
        </div>
      </Sheet>
    </Card>
  )
}
