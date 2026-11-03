import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiActivity, FiCalendar, FiDatabase, FiLayers, FiLogIn, FiMail, FiShield, FiCheckSquare, FiGrid } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { homePath, profileLabel, SIMULABLE_PROFILES } from '../../lib/permissions'
import { Badge, Button, Card, ErrorState, Field, Loading, Page, Progress, Sheet, Switch } from '../../components/ui'

const PERIOD_STATES = { abierto: ['success', 'Abierto'], en_cierre: ['warning', 'En cierre'], preparacion: ['neutral', 'En preparación'] }

/** Panel institucional del administrador general (Frontend_Swgpi/pages/admin/general.php). */
export default function GeneralPanel() {
  const navigate = useNavigate()
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
      <Card title="Carreras" subtitle={'"Administrar" entra a la carrera con tu perfil de administrador general.'}>
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
                    <Button size="sm" icon={FiLogIn} loading={busy === `career-${career.id}`} onClick={() => administer(career.id)}>Administrar</Button>
                    <Button size="sm" variant="ghost" icon={FiLayers} aria-label="Simular un nivel en esta carrera" onClick={() => setViewAsCareer(career.id)} />
                  </footer>
                </article>
              )
            })}
            {!list.length && <p className="muted">No hay carreras registradas.</p>}
          </div>
        )}
      </Card>
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
