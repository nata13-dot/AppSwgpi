import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArchive, FiBookOpen, FiCalendar, FiCheckSquare, FiClipboard, FiEdit3, FiFileText, FiFolder,
  FiTool, FiTrendingUp, FiUserCheck, FiUsers, FiBarChart2, FiGitBranch,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { canGovernUsers, canManageAcademics, isAdmin, isGeneralAdmin, isStudent, isTeacher, viewAs, activeProfileId } from '../lib/permissions'
import { asList, formatDate, formatDateTime, fullName, percent, publicAssetUrl, statusLabel } from '../utils/formatters'
import { BarList, Button, Card, ErrorState, Field, FileDrop, Loading, NextAction, Page, Progress, Sheet, Stat } from '../components/ui'
import IrregularCheck from '../components/IrregularCheck'
import { ordinal, useSemesters } from '../lib/semesters'

export default function Dashboard() {
  const { user } = useAuth()
  if (isStudent(user)) return <StudentDashboard />
  if (isTeacher(user)) return <TeacherDashboard />
  return <ManagementDashboard />
}

// Módulo particular de cada carrera en el panel (Frontend_Swgpi/pages/admin/dashboard.php).
const CAREER_FEATURES = {
  IIND: { module: 'procesos', label: 'Procesos', icon: FiGitBranch },
  IEME: { module: 'laboratorios', label: 'Laboratorios', icon: FiTool },
  CP: { module: 'reportes_financieros', label: 'Reportes financieros', icon: FiBarChart2 },
}

function Hero({ user, title, subtitle }) {
  const career = user?.active_career || {}
  const cover = career.portada_ruta ? publicAssetUrl(career.portada_ruta) : null
  return (
    <section className="hero-app" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
      <h1>{title}</h1>
      <p><strong>Bienvenido, {user?.nombres}</strong>{subtitle && ` · ${subtitle}`}</p>
      {career.nombre && <p>{career.nombre}{career.lema && ` — ${career.lema}`}</p>}
      <span className="hero-tag">#OrgulloHalcón</span>
    </section>
  )
}

function ManagementDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const code = user?.active_career?.clave || 'ISC'
  const feature = CAREER_FEATURES[code] || { module: 'academico', label: 'Asignaturas', icon: FiBookOpen }
  const stats = useQuery({ queryKey: ['dashboard-stats'], queryFn: () => api.get('/dashboard/stats').then((response) => response.data) })
  const modules = useQuery({ queryKey: ['career-modules', user?.active_career?.id, activeProfileId(user)], queryFn: () => api.get('/career/modules').then((response) => response.data), staleTime: 60_000 })
  // La consulta de irregulares la responden la jefatura y su asistencia, no el administrador general ni una simulación.
  const asksIrregular = !isGeneralAdmin(user) && !viewAs(user) && [1, 5, 6].includes(activeProfileId(user))
  const data = stats.data || {}
  const values = data.stats || {}
  const featureModule = (modules.data?.modules || []).find((module) => module.modulo === feature.module)
  const featureTotal = code === 'ISC' ? values.total_asignaturas : featureModule?.records_count
  const featureTarget = code === 'ISC' ? (canManageAcademics(user) ? '/subjects' : null) : isAdmin(user) ? '/career-modules' : null
  const next = values.pending_proposals > 0
    ? { title: `${values.pending_proposals} propuestas pendientes`, text: 'Empieza por revisar las propuestas para mantener el flujo académico en movimiento.', to: '/proposals', actionLabel: 'Revisar propuestas', icon: FiCheckSquare }
    : values.inactive_users > 0 && canGovernUsers(user)
      ? { title: `${values.inactive_users} usuarios inactivos`, text: 'Valida cuentas pendientes o desactiva las que ya no deben tener acceso.', to: '/users', actionLabel: 'Gestionar usuarios', icon: FiUsers }
      : { title: 'Todo se ve estable', text: 'Puedes continuar con la revisión general de proyectos y entregables.', to: '/projects', actionLabel: 'Ver proyectos', icon: FiFolder }
  const shortcuts = [
    canGovernUsers(user) && ['Usuarios', '/users', FiUsers],
    ['Proyectos', '/projects', FiFolder], ['Propuestas', '/proposals', FiCheckSquare], ['Entregables', '/deliverables', FiFileText],
    ['Evaluaciones', '/evaluations', FiClipboard], canManageAcademics(user) && ['Académico', '/subjects', FiBookOpen],
    canManageAcademics(user) && ['Semestres', '/semesters', FiCalendar], ['Repositorio', '/repository', FiArchive],
  ].filter(Boolean)

  return (
    <div className="page">
      {asksIrregular && <IrregularCheck />}
      <Hero user={user} title="Panel administrativo" subtitle="Gestión integral del sistema" />
      <nav className="shortcut-grid" aria-label="Gestiones del sistema">
        {shortcuts.map(([label, path, Icon]) => <button type="button" key={path} onClick={() => navigate(path)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
      {stats.isError ? <ErrorState error={stats.error} onRetry={stats.refetch} /> : (
        <>
          {stats.isLoading ? <Loading /> : <NextAction {...next} />}
          <div className="stats-row">
            <Stat icon={FiUsers} label="Total de usuarios" value={values.total_users} hint={`${values.inactive_users || 0} inactivos`} onClick={canGovernUsers(user) ? () => navigate('/users') : undefined} />
            <Stat icon={FiUserCheck} tone="success" label="Usuarios activos" value={values.active_users} hint={`${percent(values.active_users, values.total_users)}% del total`} onClick={canGovernUsers(user) ? () => navigate('/users') : undefined} />
            <Stat icon={FiFolder} label="Proyectos" value={values.total_projects} hint={`${values.pending_proposals || 0} propuestas pendientes`} onClick={() => navigate('/projects')} />
            <Stat icon={feature.icon} tone="warning" label={feature.label} value={featureTotal ?? 0} hint={code === 'ISC' ? 'Catálogo académico' : 'Módulo particular'} onClick={featureTarget ? () => navigate(featureTarget) : undefined} />
          </div>
          <div className="grid-3">
            <Card title="Avance global" actions={<strong>{values.deliverable_completion_rate || 0}%</strong>}>
              <Progress value={values.deliverable_completion_rate} label="Avance global" />
              <p className="muted small-text mt-2">Porcentaje de entregables aprobados sobre el total activo.</p>
            </Card>
            <Card title="Usuarios por rol"><BarList data={data.charts?.users_by_role} label={statusLabel} /></Card>
            <Card title={code === 'ISC' ? 'Entregables' : 'Indicadores de carrera'}>
              {code === 'ISC' ? <StatusPills data={data.charts?.deliverables_by_status} /> : <CareerIndicators indicators={modules.data?.indicators} />}
            </Card>
          </div>
          <Card title="Estado de propuestas"><BarList data={data.charts?.projects_by_proposal_status} label={statusLabel} /></Card>
          <Card title="Resumen de proyectos" actions={<Button variant="link" onClick={() => navigate('/projects')}>Ver todos</Button>}>
            <StatusPills data={Object.fromEntries(Object.entries(data.charts?.projects_by_proposal_status || {}).filter(([, value]) => Number(value) > 0).slice(0, 4))} />
            <ul className="list-app mt-2">
              {asList(data.recent_projects).slice(0, 4).map((project, index) => (
                <li key={project.id ?? `recent-${index}`}><button type="button" className="list-row" onClick={() => navigate(`/projects?id=${project.id}`)}>
                  <div><strong>{project.title || project.titulo || `Proyecto ${project.id}`}</strong><small>{fullName(project.creator) || 'Sin responsable'} · {formatDate(project.created_at)}</small></div>
                </button></li>
              ))}
              {!stats.isLoading && !asList(data.recent_projects).length && <li className="muted small-text">No hay proyectos recientes.</li>}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}

function StatusPills({ data }) {
  const entries = Object.entries(data || {})
  if (!entries.length) return <p className="muted small-text">Sin datos para mostrar.</p>
  return <div className="pill-grid">{entries.map(([status, value]) => <div key={status}><strong>{value || 0}</strong><span>{statusLabel(status)}</span></div>)}</div>
}

function CareerIndicators({ indicators }) {
  const rows = Array.isArray(indicators) ? indicators.slice(0, 3) : []
  if (!rows.length) return <p className="muted small-text">Sin indicadores configurados.</p>
  const unit = (indicator) => (indicator.unidad === 'porcentaje' ? '%' : '')
  return (
    <div className="pill-grid">
      {rows.map((indicator) => (
        <div key={indicator.id} style={{ borderTop: `3px solid ${indicator.color || '#1B396A'}` }}>
          <strong>{indicator.valor_actual === null ? '—' : `${Number(indicator.valor_actual).toLocaleString('es-MX')}${unit(indicator)}`}</strong>
          <span>{indicator.nombre}</span>
          <small>{indicator.valor_meta === null ? 'Sin meta' : `Meta: ${Number(indicator.valor_meta).toLocaleString('es-MX')}${unit(indicator)}`}</small>
        </div>
      ))}
    </div>
  )
}

const projectProgress = (project) => percent(project.approved_deliverables_count, project.deliverables_count)

function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['dashboard-teacher'], queryFn: () => api.get('/dashboard/teacher').then((response) => response.data) })
  const values = query.data?.stats || {}
  const next = values.pending_proposals > 0
    ? { title: `${values.pending_proposals} propuestas por revisar`, text: 'Empieza por aprobar o solicitar cambios en las propuestas pendientes.', to: '/proposals', actionLabel: 'Revisar propuestas', icon: FiCheckSquare }
    : values.pending_deliverables > 0
      ? { title: `${values.pending_deliverables} entregables pendientes`, text: 'Revisa entregables para que los estudiantes sepan si deben corregir o continuar.', to: '/deliverables', actionLabel: 'Revisar entregables', icon: FiFileText }
      : { title: 'Tu panel está al día', text: 'Puedes consultar tus proyectos recientes o preparar evaluaciones.', to: '/projects', actionLabel: 'Ver proyectos', icon: FiFolder }
  return (
    <div className="page">
      <Hero user={user} title="Panel docente" subtitle="Asesorías, revisiones y evaluaciones" />
      {query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : query.isLoading ? <Loading /> : (
        <>
          <NextAction {...next} />
          <div className="stats-row">
            <Stat icon={FiFolder} label="Mis proyectos" value={values.my_projects} onClick={() => navigate('/projects')} />
            <Stat icon={FiUsers} tone="success" label="Estudiantes" value={values.students} />
            <Stat icon={FiFileText} tone="warning" label="Entregables pendientes" value={values.pending_deliverables} onClick={() => navigate('/deliverables')} />
            <Stat icon={FiCheckSquare} tone="danger" label="Propuestas por revisar" value={values.pending_proposals || 0} onClick={() => navigate('/proposals')} />
          </div>
          <div className="grid-3">
            <Card title="Avance de entregables" actions={<strong>{values.deliverable_completion_rate || 0}%</strong>}><Progress value={values.deliverable_completion_rate} label="Avance" /></Card>
            <Card title="Entregables por estado"><StatusPills data={query.data.charts?.deliverables_by_status} /></Card>
            <Card title="Propuestas"><BarList data={query.data.charts?.projects_by_proposal_status} label={statusLabel} /></Card>
          </div>
          <Card title="Proyectos recientes" actions={<Button variant="link" onClick={() => navigate('/projects')}>Ver todos</Button>}>
            <ProjectList projects={asList(query.data.recent_projects)} onOpen={() => navigate('/projects')} detail={(project) => {
              const group = project.subject_group ? `${project.subject_group.semestre || ''}${project.subject_group.grupo ? ` ${project.subject_group.grupo}` : ''}` : 'Grupo pendiente'
              const students = (project.students || []).map(fullName).filter(Boolean).join(', ')
              return `${students || 'Sin estudiantes asignados'} · ${group} · ${formatDate(project.created_at)}`
            }} />
          </Card>
        </>
      )}
    </div>
  )
}

function ProjectList({ projects, onOpen, detail }) {
  if (!projects?.length) return <p className="muted small-text">No hay proyectos aún.</p>
  return (
    <ul className="list-app">
      {projects.map((project, index) => {
        const progress = projectProgress(project)
        return (
          <li key={project.id ?? `project-${index}`}><button type="button" className="list-row" onClick={() => onOpen(project)}>
            <div><strong>{project.title}</strong><Progress value={progress} label="Avance" /><small>{detail(project)}</small></div>
            <strong>{progress}%</strong>
          </button></li>
        )
      })}
    </ul>
  )
}

function StudentDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const status = useQuery({ queryKey: ['proposal-student-status'], queryFn: () => api.get('/proposal/student-status').then((response) => response.data) })
  const query = useQuery({ queryKey: ['dashboard-student'], queryFn: () => api.get('/dashboard/student').then((response) => response.data) })
  // Con una sala en curso el turno se consulta cada 20 s para que el alumno sepa en qué momento pasa.
  const schedule = useQuery({
    queryKey: ['student-evaluation-schedule'], queryFn: () => api.get('/student/evaluation-schedule').then((response) => response.data),
    refetchInterval: (current) => (asList(current.state.data).some((item) => item.live && !item.live.done) ? 20_000 : false),
  })
  const values = query.data?.stats || {}
  const next = !values.my_projects
    ? { title: 'Registra tu proyecto', text: 'Empieza creando tu propuesta para que pueda avanzar a revisión.', to: '/proposals', actionLabel: 'Registrar proyecto', icon: FiEdit3 }
    : values.pending_deliverables > 0
      ? { title: `${values.pending_deliverables} entregables pendientes`, text: 'Revisa qué documentos faltan por enviar o necesitan atención.', to: '/deliverables', actionLabel: 'Ver entregables', icon: FiFileText }
      : { title: 'Tu avance está al día', text: 'Consulta tus presentaciones programadas o mantén actualizados tus documentos.', to: '/evaluation-documents', actionLabel: 'Ver evidencias', icon: FiFileText }
  const advisors = (project) => (project.advisors || []).map(fullName).filter(Boolean).join(', ') || 'Sin asesores activos'

  return (
    <div className="page">
      {status.data?.profile_required && !viewAs(user) && <InitialProfile student={status.data.student} />}
      <Hero user={user} title="Mi espacio" subtitle="Proyecto, entregables y evaluaciones" />
      {query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : query.isLoading ? <Loading /> : (
        <>
          <NextAction {...next} />
          <div className="stats-row">
            <Stat icon={FiFolder} label="Mis proyectos" value={values.my_projects} />
            <Stat icon={FiCheckSquare} tone="success" label="Entregables aprobados" value={values.completed_deliverables} />
            <Stat icon={FiFileText} tone="warning" label="Pendientes" value={values.pending_deliverables} onClick={() => navigate('/deliverables')} />
            <Stat icon={FiTrendingUp} label="Propuestas en revisión" value={values.pending_proposals || 0} onClick={() => navigate('/proposals')} />
          </div>
          <Card title="Presentaciones programadas" subtitle="Sala, salón y tiempos de tu evaluación.">
            {schedule.isLoading ? <Loading rows={2} /> : schedule.isError ? <p className="muted small-text">No se pudo cargar la agenda de evaluaciones.</p> : !asList(schedule.data).length ? <p className="muted small-text">Aún no tienes presentaciones programadas.</p> : (
              <ul className="list-app">
                {asList(schedule.data).map((item, index) => (
                  <li key={`${item.project_title}-${index}`} className="list-row">
                    <div>
                      <strong>{item.project_title || 'Proyecto'}</strong>
                      <small>{item.room_name || 'Sala pendiente'} · {item.classroom || 'Salón pendiente'}</small>
                      <small>Exposición: {item.presentation_minutes || '-'} min{item.questions_minutes ? ` · Preguntas y respuestas: ${item.questions_minutes} min` : ''}</small>
                      <LiveTurn live={item.live} />
                    </div>
                    <span className="badge-app info">{item.date ? formatDateTime(item.date) : 'Fecha pendiente'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="grid-3">
            <Card title="Avance" actions={<strong>{values.deliverable_completion_rate || 0}%</strong>}><Progress value={values.deliverable_completion_rate} label="Avance" /></Card>
            <Card title="Entregables por estado"><StatusPills data={query.data.charts?.deliverables_by_status} /></Card>
            <Card title="Propuestas"><BarList data={query.data.charts?.projects_by_proposal_status} label={statusLabel} /></Card>
          </div>
          <Card title="Mis proyectos">
            <ProjectList projects={asList(query.data.recent_projects)} onOpen={() => navigate('/deliverables')} detail={(project) => `Docente: ${advisors(project)}`} />
          </Card>
        </>
      )}
    </div>
  )
}

/** Primer ingreso del alumno: completa nombre, semestre, grupo y foto (POST /profile/complete-initial). */
/** Turno en vivo de la sala del alumno: qué número va pasando, cuántos faltan y su hora estimada recalculada. */
function LiveTurn({ live }) {
  if (!live || live.done) return null
  const at = live.estimated_at ? new Date(live.estimated_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : null
  if (live.is_current) return <div className="live-turn now"><strong>¡Es tu turno!</strong><span>Tu equipo está presentando ahora.</span></div>
  return (
    <div className="live-turn">
      <span>{live.started ? <>Va pasando el turno <strong>{live.current_order}</strong> de {live.total}</> : <>La sala aún no empieza</>}</span>
      <span>Tu turno: <strong>{live.my_order}</strong>{live.turns_before === 1 ? ' · eres el siguiente' : live.turns_before > 1 ? ` · faltan ${live.turns_before} antes que tú` : ''}</span>
      {at && <span>Pasarías cerca de las <strong>{at}</strong></span>}
    </div>
  )
}

function InitialProfile({ student }) {
  const client = useQueryClient()
  const { refreshUser } = useAuth()
  const [open, setOpen] = useState(true)
  const [form, setForm] = useState({ nombres: student?.nombres || '', apa: student?.apa || '', ama: student?.ama || '', semestre: '', grupo: '' })
  const [photo, setPhoto] = useState(null)
  const { semesters } = useSemesters('period')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => body.append(key, value))
      if (photo) body.append('photo', photo)
      await api.post('/profile/complete-initial', body)
      await refreshUser()
      client.invalidateQueries({ queryKey: ['proposal-student-status'] })
      toast.success('Perfil completado.')
      setOpen(false)
    } catch (error) {
      toast.error(apiError(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Sheet open={open} title="Completa tu perfil" subtitle="Antes de continuar confirma tus datos." size="md">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Nombre" full><input className="control" required value={form.nombres} onChange={set('nombres')} /></Field>
        <Field label="Apellido paterno"><input className="control" required value={form.apa} onChange={set('apa')} /></Field>
        <Field label="Apellido materno"><input className="control" value={form.ama} onChange={set('ama')} /></Field>
        <Field label="Semestre"><select className="control" required value={form.semestre} onChange={set('semestre')}><option value="">Selecciona</option>{semesters.map((value) => <option key={value} value={value}>{ordinal(value)}</option>)}</select></Field>
        <Field label="Grupo"><input className="control" required placeholder="A, B, 5to A" value={form.grupo} onChange={set('grupo')} /></Field>
        <Field label="Foto de perfil" full><FileDrop accept="image/*" file={photo} onFile={setPhoto} hint="JPG, PNG o WEBP, hasta 2 MB" /></Field>
        <div className="form-actions full"><Button type="submit" loading={saving}>Guardar y continuar</Button></div>
      </form>
    </Sheet>
  )
}
