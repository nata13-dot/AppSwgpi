import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEye, FiRotateCcw, FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { isProjectCoordinator } from '../lib/permissions'
import { fullName } from '../utils/formatters'
import { Badge, Button, Card, Empty, ErrorState, IconButton, Loading, Page, promptPassword, SearchInput, Tabs } from '../components/ui'
import { ProjectDetails } from './projects/projectShared'

const PROJECT_ROLES = [{ key: 'primario', label: 'Primario', help: 'Responsable principal', tone: 'primary' }, { key: 'secundario', label: 'Secundario', help: 'Apoyo académico', tone: 'info' }]
const THESIS_ROLES = [{ key: 'asesor', label: 'Asesor', help: 'Responsable académico', tone: 'primary' }, { key: 'revisor_1', label: 'Revisor 1', help: 'Primera revisión', tone: 'info' }, { key: 'revisor_2', label: 'Revisor 2', help: 'Segunda revisión', tone: 'warning' }]
const ALL_ROLES = [...PROJECT_ROLES, ...THESIS_ROLES]
const roleOf = (key) => ALL_ROLES.find((role) => role.key === key) || PROJECT_ROLES[0]
const advisorByRole = (project, role) => (project.advisors || []).find((advisor) => advisor.pivot?.rol_asesor === role) || null
const SEMESTERS = [['5', '5 - Propuesta'], ['6', '6 - Avance'], ['7', '7 - Avance'], ['8', '8 - Titulación'], ['9', '9 - Titulación']]

/** Asesores por proyecto y comités de tesis (Frontend_Swgpi/pages/admin/advisors.php). */
export default function Advisors() {
  const { user } = useAuth()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const [view, setView] = useState(params.get('view') || 'projects')
  const [semester, setSemester] = useState('')
  const [drafts, setDrafts] = useState({}) // { projectId: { role: teacherId } }
  const [details, setDetails] = useState(null)
  const [saving, setSaving] = useState(false)
  const [focus, setFocus] = useState(params.get('project'))
  const teachers = useQuery({
    queryKey: ['advisor-teachers'],
    queryFn: async () => {
      const [admins, staff] = await Promise.all([1, 2].map((profile) => api.get('/users', { params: { perfil_id: profile, status: 'active', compact: 1, per_page: 500 } }).then((response) => response.data.data || [])))
      return [...admins, ...staff].sort((a, b) => Number(a.perfil_id) - Number(b.perfil_id) || fullName(a).localeCompare(fullName(b)))
    },
    staleTime: 60_000,
  })
  const projectsQuery = useQuery({
    queryKey: ['advisor-projects', semester],
    queryFn: async () => {
      const common = { per_page: 100, ...(semester ? { semestre: semester } : {}) }
      const [regular, theses] = await Promise.all(['proyecto', 'tesis'].map((tipo) => api.get('/projects', { params: { ...common, tipo_registro: tipo } }).then((response) => response.data.data || [])))
      return { regular, theses }
    },
  })
  const regular = useMemo(() => projectsQuery.data?.regular || [], [projectsQuery.data])
  const theses = useMemo(() => projectsQuery.data?.theses || [], [projectsQuery.data])
  const all = useMemo(() => [...regular, ...theses], [regular, theses])
  const thesisView = view === 'thesis'
  const roles = thesisView ? THESIS_ROLES : PROJECT_ROLES
  const rows = thesisView ? theses : regular

  useEffect(() => {
    if (!focus || !projectsQuery.data) return
    const element = document.getElementById(`advisor-row-${focus}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setFocus(null), 1600)
  }, [focus, projectsQuery.data])

  const current = (project, role) => String(advisorByRole(project, role)?.id || '')
  const value = (project, role) => drafts[project.id]?.[role] ?? current(project, role)
  const changedRoles = (project) => roles.filter((role) => value(project, role.key) !== current(project, role.key))
  const changedProjects = rows.filter((project) => changedRoles(project).length)
  const changeCount = changedProjects.reduce((total, project) => total + changedRoles(project).length, 0)
  const setValue = (project, role, teacherId) => setDrafts((state) => ({ ...state, [project.id]: { ...state[project.id], [role]: teacherId } }))
  const revert = (project) => { setDrafts((state) => { const next = { ...state }; delete next[project.id]; return next }); toast.info('Cambios de la fila revertidos') }

  const saveAll = async () => {
    if (!changedProjects.length) return toast.info('No hay cambios por guardar')
    const invalid = changedProjects.find((project) => { const values = roles.map((role) => value(project, role.key)).filter(Boolean); return new Set(values).size !== values.length })
    if (invalid) { setFocus(String(invalid.id)); return toast.error('Los roles de la fila deben ser personas diferentes.') }
    const adminPassword = await promptPassword({ title: 'Confirmar modificación de asesores', confirmText: 'Guardar cambios' })
    if (!adminPassword) return undefined
    setSaving(true)
    try {
      for (const project of changedProjects) {
        for (const role of roles) {
          const before = current(project, role.key)
          if (before && before !== value(project, role.key)) await api.delete(`/projects/${project.id}/advisors/${encodeURIComponent(before)}`, { data: { admin_password: adminPassword } })
        }
        for (const role of roles) {
          const next = value(project, role.key)
          if (next) await api.post(`/projects/${project.id}/advisors`, { user_id: next, rol_asesor: role.key, admin_password: adminPassword })
        }
      }
      toast.success('Cambios de asesores guardados correctamente')
      setDrafts({})
    } catch (error) { toast.error(apiError(error)) } finally {
      setSaving(false)
      client.invalidateQueries({ queryKey: ['advisor-projects'] })
    }
    return undefined
  }

  return (
    <Page title="Asignación de asesores" subtitle="Asesores por proyecto y comités para tesis marcadas por la jefatura."
      actions={view !== 'teachers' && <Button variant="success" icon={FiSave} disabled={!changeCount} loading={saving} onClick={saveAll}>Guardar cambios{changeCount ? ` (${changeCount})` : ''}</Button>}>
      <Tabs value={view} onChange={setView} items={[{ key: 'projects', label: 'Por proyecto' }, !isProjectCoordinator(user) && { key: 'thesis', label: 'Comités de tesis' }, { key: 'teachers', label: 'Por asesor' }]} />
      {view !== 'teachers' && (
        <div className="toolbar">
          <select className="control" aria-label="Semestre" value={semester} onChange={(event) => setSemester(event.target.value)}><option value="">Todos los semestres</option>{SEMESTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          {changeCount > 0 && <Badge tone="warning">{changeCount} cambio(s) sin guardar</Badge>}
        </div>
      )}
      {projectsQuery.isLoading || teachers.isLoading ? <Loading rows={5} /> : projectsQuery.isError ? <ErrorState error={projectsQuery.error} onRetry={projectsQuery.refetch} /> : view === 'teachers' ? (
        <TeacherView teachers={teachers.data || []} projects={all} onOpen={setDetails} onFocus={(project) => { setView(project.is_thesis ? 'thesis' : 'projects'); setFocus(String(project.id)) }} />
      ) : !rows.length ? <Empty message={thesisView ? 'No hay tesis marcadas.' : 'No hay proyectos integradores.'} /> : (
        <div className="stack">
          {rows.map((project) => {
            const dirty = changedRoles(project).length > 0
            return (
              <Card key={project.id} className={`advisor-card ${dirty ? 'dirty' : ''} ${focus === String(project.id) ? 'focused' : ''}`}>
                <div id={`advisor-row-${project.id}`} className="row-wrap">
                  <div className="cell-main grow"><strong>{project.title}</strong><small>Semestre {project.semestre || '–'} · {project.subject_group?.nombre || project.subjectGroup?.nombre || 'Sin grupo'}</small></div>
                  {project.is_thesis && <Badge tone="success">Tesis</Badge>}
                  {dirty && <IconButton icon={FiRotateCcw} label="Deshacer cambios" onClick={() => revert(project)} />}
                  <IconButton icon={FiEye} label="Ver proyecto" onClick={() => setDetails(project.id)} />
                </div>
                <div className={`role-grid roles-${roles.length}`}>
                  {roles.map((role) => {
                    const blocked = roles.filter((other) => other.key !== role.key).map((other) => value(project, other.key)).filter(Boolean)
                    const changed = value(project, role.key) !== current(project, role.key)
                    return (
                      <label key={role.key} className={`role-field ${changed ? 'changed' : ''}`}>
                        <span><Badge tone={role.tone}>{role.label}</Badge><small>{role.help}</small></span>
                        <select className="control" value={value(project, role.key)} onChange={(event) => setValue(project, role.key, event.target.value)}>
                          <option value="">Sin asignar</option>
                          {(teachers.data || []).map((teacher) => <option key={teacher.id} value={teacher.id} disabled={blocked.includes(String(teacher.id))}>{fullName(teacher)} ({teacher.id}) - {Number(teacher.perfil_id) === 1 ? 'Administrador' : 'Docente'}</option>)}
                        </select>
                      </label>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {details && <ProjectDetails projectId={details} onClose={() => setDetails(null)} />}
    </Page>
  )
}

function TeacherView({ teachers, projects, onOpen, onFocus }) {
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const advisorFor = (project, teacher) => (project.advisors || []).find((advisor) => String(advisor.id) === String(teacher.id))
  const cards = teachers.map((teacher) => {
    const assigned = projects.filter((project) => advisorFor(project, teacher) && (!role || advisorFor(project, teacher)?.pivot?.rol_asesor === role))
    const count = (key) => assigned.filter((project) => advisorFor(project, teacher)?.pivot?.rol_asesor === key).length
    return { teacher, assigned, count }
  }).filter((item) => !search.trim() || `${item.teacher.id} ${fullName(item.teacher)} ${item.teacher.email || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.assigned.length - a.assigned.length || fullName(a.teacher).localeCompare(fullName(b.teacher)))
  const withProjects = teachers.filter((teacher) => projects.some((project) => advisorFor(project, teacher))).length
  const totalRoles = teachers.reduce((total, teacher) => total + projects.filter((project) => advisorFor(project, teacher)).length, 0)
  return (
    <>
      <div className="stats-row">
        <div className="kpi"><strong>{teachers.length}</strong><span>Asesores</span></div>
        <div className="kpi"><strong>{withProjects}</strong><span>Con proyectos</span></div>
        <div className="kpi"><strong>{totalRoles}</strong><span>Roles asignados</span></div>
      </div>
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Nombre, apellidos o nómina" />
        <select className="control" aria-label="Rol" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Todos los roles</option>{[['primario', 'Asesor primario'], ['secundario', 'Asesor secundario'], ['asesor', 'Asesor de tesis'], ['revisor_1', 'Revisor 1'], ['revisor_2', 'Revisor 2']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </div>
      {!cards.length ? <Empty message="No hay asesores que coincidan con la búsqueda o el filtro seleccionado." /> : (
        <div className="grid-2">
          {cards.map(({ teacher, assigned, count }) => (
            <Card key={teacher.id} title={fullName(teacher)} subtitle={`${teacher.id} · ${Number(teacher.perfil_id) === 1 ? 'Administrador' : 'Docente'}`} actions={<Badge tone="info">{assigned.length} proyectos</Badge>}>
              <div className="row-wrap mb-3">{ALL_ROLES.map((item) => <Badge key={item.key} tone={item.tone}>{count(item.key)} {item.label.toLowerCase()}</Badge>)}</div>
              <ul className="list-app">
                {assigned.map((project) => (
                  <li key={project.id} className="list-row">
                    <div><strong>{project.title}</strong><small>{project.subject_group?.nombre || project.subjectGroup?.nombre || '—'}</small></div>
                    <Badge tone={roleOf(advisorFor(project, teacher)?.pivot?.rol_asesor).tone}>{roleOf(advisorFor(project, teacher)?.pivot?.rol_asesor).label}</Badge>
                    <IconButton icon={FiEye} label="Ver proyecto" onClick={() => onOpen(project.id)} />
                    <IconButton icon={FiSave} label="Editar asignación" onClick={() => onFocus(project)} />
                  </li>
                ))}
                {!assigned.length && <li className="muted small-text">Sin proyectos asesorados en este filtro.</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
