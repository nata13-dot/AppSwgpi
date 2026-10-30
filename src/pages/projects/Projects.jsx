import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiBook, FiDownload, FiEdit2, FiEye, FiPlus, FiTrash2, FiUploadCloud, FiUserCheck, FiAward } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { canManageProjects, isProjectCoordinator, isTeacher } from '../../lib/permissions'
import { downloadApiFile } from '../../utils/downloads'
import { fullName } from '../../utils/formatters'
import { Badge, Button, Card, confirmAction, DataTable, ErrorState, IconButton, Loading, Page, Pager, SearchInput, Tabs, useDebounced } from '../../components/ui'
import { advisorForRole, authors, MODALITIES, PROJECT_SEMESTERS, ProjectDetails, THESIS_ROLES, THESIS_SEMESTERS } from './projectShared'
import ProjectForm from './ProjectForm'
import ProjectSubjects from './ProjectSubjects'
import ProjectsImport from './ProjectsImport'
import TeacherProjects from './TeacherProjects'

export default function ProjectsPage() {
  const { user } = useAuth()
  return isTeacher(user) ? <TeacherProjects /> : <Projects />
}

/**
 * Gestión de proyectos y tesis (Frontend_Swgpi/pages/admin/projects.php). Cada pestaña consulta sólo su
 * modalidad: la llave de la consulta incluye la vista, así una respuesta tardía nunca pinta otra pestaña.
 */
function Projects() {
  const { user } = useAuth()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const manage = canManageProjects(user)
  const [view, setView] = useState('integrator')
  const [semester, setSemester] = useState('')
  const [search, setSearch] = useState(params.get('q') || '')
  const [page, setPage] = useState(1)
  const [sheet, setSheet] = useState(() => (params.get('id') ? { type: 'details', id: params.get('id') } : params.get('edit') && manage ? { type: 'form', id: params.get('edit') } : null))
  const debounced = useDebounced(search)
  const thesis = view === 'thesis'
  const modality = MODALITIES[view]

  const filters = { tipo_registro: thesis ? 'tesis' : 'proyecto', ...(thesis ? {} : { modalidad: modality.value }), ...(semester ? { semestre: semester } : {}), ...(debounced.trim() ? { q: debounced.trim() } : {}) }
  const query = useQuery({ queryKey: ['projects', filters, page], queryFn: () => api.get('/projects', { params: { ...filters, page, per_page: 12 } }).then((response) => response.data) })
  // Se filtra otra vez en el cliente por si la API devolviera registros de otra categoría.
  const rows = (query.data?.data || []).filter((project) => (thesis ? project.is_thesis || project.tipo === 'tesis' : !project.is_thesis && project.tipo !== 'tesis' && project.modalidad === modality.value))
  const refresh = () => client.invalidateQueries({ queryKey: ['projects'] })
  const changeView = (next) => {
    setView(next)
    setPage(1)
    if (!(next === 'thesis' ? THESIS_SEMESTERS : PROJECT_SEMESTERS).some(([value]) => value === semester)) setSemester('')
  }
  const closeSheet = () => { setSheet(null); if (params.get('id') || params.get('edit')) setParams({}, { replace: true }) }

  const toggleThesis = async (project, value) => {
    const ok = await confirmAction({
      title: value ? 'Marcar como tesis' : 'Quitar de tesis',
      text: value ? 'El proyecto pasará al apartado aislado de gestión de tesis.' : 'La tesis volverá a gestionarse sólo como proyecto integrador y se limpiará su comité de tesis.',
      confirmText: value ? 'Sí, marcar' : 'Sí, quitar',
    })
    if (!ok) return
    try {
      await api.put(`/projects/${project.id}`, { is_thesis: value })
      toast.success(value ? 'Proyecto marcado como tesis' : 'Proyecto retirado de tesis')
      refresh()
    } catch (error) { toast.error(apiError(error)) }
  }
  const remove = async (project) => {
    if (!(await confirmAction({ title: thesis ? 'Eliminar tesis' : 'Eliminar proyecto', text: '¿Seguro que deseas eliminarlo?', confirmText: 'Sí, eliminar', danger: true }))) return
    try {
      await api.delete(`/projects/${project.id}`)
      toast.success('Proyecto eliminado')
      refresh()
    } catch (error) { toast.error(apiError(error)) }
  }
  const template = async () => {
    try { await downloadApiFile('/projects-template.xls', 'plantilla_proyectos.xls') } catch (error) { toast.error(error.message) }
  }

  const projectColumns = [
    { key: 'title', label: 'Proyecto', primary: true, render: (project) => <span className="cell-main"><strong>{project.title}</strong><small>{authors(project, 'Sin integrantes')}</small></span> },
    { key: 'semestre', label: 'Semestre', render: (project) => project.semestre || '—' },
    { key: 'year', label: 'Periodo / año', render: (project) => project.year || '—' },
    { key: 'empresa', label: 'Empresa', render: (project) => (project.company_name ? <span className="cell-main"><strong>{project.company_name}</strong>{project.company_contact_name && <small>{project.company_contact_name}</small>}</span> : <span className="muted">Sin empresa</span>) },
    { key: 'creator', label: 'Registrado por', hideOnMobile: true, render: (project) => (project.creator?.nombres ? String(project.creator.nombres).split(' ')[0] : '—') },
  ]
  const thesisColumns = [
    { key: 'title', label: 'Tesis', primary: true, render: (project) => <span className="cell-main"><strong>{project.title}</strong><small>{project.company_name || 'Sin empresa'}</small></span> },
    { key: 'semestre', label: 'Semestre', render: (project) => project.semestre || '—' },
    { key: 'grupo', label: 'Grupo', render: (project) => project.subject_group?.nombre || project.subjectGroup?.nombre || '—' },
    { key: 'integrantes', label: 'Integrantes', render: (project) => authors(project) },
    { key: 'comite', label: 'Comité', render: (project) => <span className="stack-tight">{THESIS_ROLES.map((role) => { const advisor = advisorForRole(project, role.key); return <small key={role.key}><Badge>{role.label}</Badge> {advisor ? fullName(advisor) : 'Sin asignar'}</small> })}</span> },
    { key: 'estado', label: 'Estado', render: (project) => (project.is_proposal && project.proposal_status ? <Badge tone="info">{project.proposal_status}</Badge> : <Badge>Proyecto directo</Badge>) },
  ]
  const actions = (project) => <>
    <IconButton icon={FiEye} label="Ver detalles" onClick={() => setSheet({ type: 'details', id: project.id })} />
    {manage && <>
      {thesis && <IconButton icon={FiUserCheck} label="Asignar comité" onClick={() => navigate(`/advisors?project=${project.id}&view=thesis`)} />}
      {!thesis && !isProjectCoordinator(user) && <IconButton icon={FiAward} label="Marcar como tesis" onClick={() => toggleThesis(project, true)} />}
      {thesis && <IconButton icon={FiAward} className="danger" label="Quitar de tesis" onClick={() => toggleThesis(project, false)} />}
      <IconButton icon={FiBook} label="Materias" onClick={() => setSheet({ type: 'subjects', id: project.id })} />
      <IconButton icon={FiEdit2} label="Editar" onClick={() => setSheet({ type: 'form', id: project.id, thesis })} />
      <IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={() => remove(project)} />
    </>}
  </>
  const total = Number(query.data?.total || 0)
  const noun = thesis ? 'tesis' : `${modality.label.toLowerCase()}(s)`

  return (
    <Page title="Gestión de proyectos y tesis" subtitle={total ? `${total} ${noun}` : `Sin ${thesis ? 'tesis' : modality.label.toLowerCase()}`}
      actions={manage && <>
        <Button icon={FiPlus} onClick={() => setSheet({ type: 'form', id: null, thesis })}>{thesis ? 'Nueva tesis' : `Nuevo ${modality.label}`}</Button>
        <Button variant="ghost" icon={FiUploadCloud} onClick={() => setSheet({ type: 'import' })}>Cargar Excel</Button>
        <Button variant="ghost" icon={FiDownload} onClick={template}>Plantilla</Button>
      </>}>
      <Tabs value={view} onChange={changeView} items={[
        { key: 'integrator', label: 'Proyecto integrador' }, { key: 'dual', label: 'Modalidad Dual' }, { key: 'case', label: 'Caso integrador' },
        // Las tesis las administra la jefatura; la coordinación no las ve.
        !isProjectCoordinator(user) && { key: 'thesis', label: 'Tesis' },
      ]} />
      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder={`${thesis ? 'Tesis' : 'Proyecto'}, estudiante, asesor, empresa o año`} />
        <select className="control" aria-label="Semestre" value={semester} onChange={(event) => { setSemester(event.target.value); setPage(1) }}>
          <option value="">Todos los semestres</option>
          {(thesis ? THESIS_SEMESTERS : PROJECT_SEMESTERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable columns={thesis ? thesisColumns : projectColumns} rows={rows} actions={actions} onRowClick={(project) => setSheet({ type: 'details', id: project.id })} />
        )}
        <Pager meta={query.data} onPage={setPage} />
      </Card>

      {sheet?.type === 'details' && <ProjectDetails projectId={sheet.id} onClose={closeSheet} />}
      {sheet?.type === 'form' && <ProjectForm projectId={sheet.id} asThesis={sheet.thesis} defaultModality={thesis ? 'proyecto_integrador' : modality.value} onClose={closeSheet} onSaved={refresh} />}
      {sheet?.type === 'subjects' && <ProjectSubjects projectId={sheet.id} onClose={closeSheet} onSaved={refresh} />}
      {sheet?.type === 'import' && <ProjectsImport onClose={closeSheet} onImported={refresh} />}
    </Page>
  )
}
