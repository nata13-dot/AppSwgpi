import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiCheckCircle, FiDownload, FiEdit2, FiKey, FiPlus, FiRefreshCw,
  FiSend, FiSlash, FiTrash2, FiUpload, FiUserCheck, FiUserX, FiUsers,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../services/api'
import CrudModule from '../components/common/CrudModule'
import {
  confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, Pagination,
  SearchField, StatusBadge, useDebounced,
} from '../components/common/Ui'
import { formatDate, fullName } from '../utils/formatters'
import { downloadApiFile } from '../utils/downloads'

const profileOptions = [
  { value: 1, label: 'Administrador' },
  { value: 2, label: 'Docente' },
  { value: 3, label: 'Estudiante' },
  { value: 5, label: 'Jefe de Carrera' },
  { value: 6, label: 'Asistente de Jefe de Carrera' },
  { value: 7, label: 'Coordinador de Proyectos' },
]
const semesterOptions = [5, 6, 7, 8, 9].map((value) => ({ value, label: `${value}° semestre` }))
const defaultUserForm = {
  id: '', perfil_id: 3, nombres: '', apa: '', ama: '', email: '', semestre: '',
  grupo: '', telefonos: '', direccion: '', password: '', password_confirmation: '',
}
const defaultProjectForm = {
  title: '', description: '', modalidad: 'proyecto_integrador', subject_group_id: '', semestre: 5, year: new Date().getFullYear(),
  student_ids: '', company_name: '', company_giro: '', company_contact_name: '',
  company_contact_position: '', company_address: '', company_rfc: '', request_company_registration: true, is_thesis: false,
}
const advisorRoles = [
  { value: 'primario', label: 'Asesor primario' },
  { value: 'secundario', label: 'Asesor secundario' },
  { value: 'asesor', label: 'Asesor de tesis' },
  { value: 'revisor_1', label: 'Revisor 1' },
  { value: 'revisor_2', label: 'Revisor 2' },
]
const projectAdvisorRoles = advisorRoles.filter((role) => ['primario', 'secundario'].includes(role.value))
const thesisAdvisorRoles = advisorRoles.filter((role) => ['asesor', 'revisor_1', 'revisor_2'].includes(role.value))

const profileLabel = (id) => profileOptions.find((option) => Number(option.value) === Number(id))?.label || 'Usuario'
const idsFromText = (value) => String(value || '').split(',').map((id) => id.trim()).filter(Boolean)
const isThesisProject = (project) => Boolean(project?.is_thesis) || project?.tipo === 'tesis'
const advisorRoleOf = (advisor) => advisor?.pivot?.rol || advisor?.pivot?.rol_asesor || 'asesor'
const semesterOf = (project) => project?.semestre || project?.subject_group?.semestre || 'Sin semestre'
export function UsersModule({ advisors = false }) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [profile, setProfile] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultUserForm)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [credentialOpen, setCredentialOpen] = useState(false)
  const debounced = useDebounced(search)
  const fixedProfiles = advisors ? '1,2' : ''
  const resource = advisors ? 'advisors-admin' : 'users-admin'
  const title = advisors ? 'Gestión de asesores' : 'Gestión de usuarios'

  const queryParams = {
    page,
    per_page: 20,
    q: debounced || undefined,
    status,
    perfil_ids: fixedProfiles || undefined,
    perfil_id: !fixedProfiles && profile ? profile : undefined,
  }
  const usersQuery = useQuery({
    queryKey: [resource, queryParams],
    queryFn: () => api.get('/users', { params: queryParams }).then((response) => response.data),
  })
  const rows = unwrapCollection(usersQuery.data)
  const allVisibleSelected = rows.length > 0 && rows.every((user) => selectedIds.includes(user.id))
  const invalidate = () => {
    client.invalidateQueries({ queryKey: [resource] })
    client.invalidateQueries({ queryKey: ['users'] })
  }

  const saveUser = useMutation({
    mutationFn: ({ admin_password } = {}) => {
      const editingExisting = editing && !editing.__new
      const payload = {
        ...form,
        perfil_id: Number(form.perfil_id),
        semestre: form.semestre ? Number(form.semestre) : null,
        grupo: form.grupo || null,
      }
      if (editingExisting) {
        delete payload.id
        if (admin_password) payload.admin_password = admin_password
        if (!payload.password) {
          delete payload.password
          delete payload.password_confirmation
        }
      }
      return editingExisting ? api.put(`/users/${editing.id}`, payload) : api.post('/users', payload)
    },
    onSuccess: ({ data }) => {
      toast.success(data.message || 'Usuario guardado correctamente.')
      setEditing(null)
      invalidate()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  const userAction = useMutation({
    mutationFn: ({ endpoint, method = 'post', body }) => method === 'delete' ? api.delete(endpoint, { data: body }) : api[method](endpoint, body),
    onSuccess: ({ data }) => {
      toast.success(data.message || 'Acción completada.')
      invalidate()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  const importUsers = useMutation({
    mutationFn: () => {
      const data = new FormData()
      data.append('archivo', importFile)
      return api.post('/users/import-excel', data)
    },
    onSuccess: ({ data }) => {
      toast.success(`Importación procesada. Creados: ${data.created || 0}. Errores: ${data.errors?.length || 0}.`)
      setImportOpen(false)
      setImportFile(null)
      invalidate()
    },
    onError: (error) => toast.error(apiError(error)),
  })

  const openUser = (user = null) => {
    if (!user) {
      setForm({ ...defaultUserForm, perfil_id: advisors ? 2 : 3 })
      setEditing({ __new: true })
      return
    }
    setForm({
      ...defaultUserForm,
      ...user,
      perfil_id: user.perfil_id || (advisors ? 2 : 3),
      email: user.email || '',
      semestre: user.semestre || '',
      grupo: user.grupo || '',
      telefonos: user.telefonos || user.phone_numbers?.map((phone) => phone.telefono).join(', ') || '',
      password: '',
      password_confirmation: '',
    })
    setEditing(user)
  }
  const isProtectedAuthority = (user) => [1, 5].includes(Number(user.perfil_id))
  const adminPasswordFor = (user) => isProtectedAuthority(user) ? window.prompt('Confirma con tu contraseña de Administrador General:') : null
  const saveCurrentUser = () => {
    const changesProtectedAuthority = editing && !editing.__new && isProtectedAuthority(editing)
      && Number(form.perfil_id) !== Number(editing.perfil_id)
    const admin_password = changesProtectedAuthority ? adminPasswordFor(editing) : null
    if (changesProtectedAuthority && !admin_password) return
    saveUser.mutate({ admin_password })
  }
  const toggleUser = async (user) => {
    if (!await confirmAction({ title: user.activo ? 'Desactivar usuario' : 'Reactivar usuario', text: `${fullName(user)} (${user.id})`, confirmText: 'Sí, continuar' })) return
    const admin_password = adminPasswordFor(user)
    if (isProtectedAuthority(user) && !admin_password) return
    userAction.mutate({ endpoint: `/users/${user.id}/toggle-active`, body: { admin_password } })
  }
  const deleteUser = async (user) => {
    if (!await confirmAction({ title: 'Desactivar usuario', text: 'El usuario quedará inactivo y se conservará su historial.', confirmText: 'Sí, desactivar' })) return
    const admin_password = adminPasswordFor(user)
    if (isProtectedAuthority(user) && !admin_password) return
    userAction.mutate({ endpoint: `/users/${user.id}`, method: 'delete', body: { admin_password } })
  }
  const downloadTemplate = async () => {
    try {
      await downloadApiFile('/users-template.xls', 'plantilla_usuarios.xls')
    } catch (error) { toast.error(apiError(error)) }
  }
  const toggleVisible = () => {
    if (allVisibleSelected) setSelectedIds((ids) => ids.filter((id) => !rows.some((row) => row.id === id)))
    else setSelectedIds((ids) => [...new Set([...ids, ...rows.map((row) => row.id)])])
  }

  return <>
    <PageHeader eyebrow="Personas" title={title} description={advisors ? 'Administra docentes y administrativos que asesoran, revisan o participan en salas.' : 'Administra cuentas, perfiles, grupos, activación, importaciones y envío de credenciales.'} actions={<>
      <button className="btn-primary-app compact" onClick={() => openUser()}><FiPlus /> {advisors ? 'Nuevo asesor' : 'Nuevo usuario'}</button>
      <button className="icon-text-button" onClick={downloadTemplate}><FiDownload /> Plantilla</button>
      <button className="icon-text-button" onClick={() => setImportOpen(true)}><FiUpload /> Importar</button>
      {!advisors && <button className="icon-text-button" disabled={!selectedIds.length} onClick={() => setCredentialOpen(true)}><FiSend /> Credenciales ({selectedIds.length})</button>}
    </>} />
    <section className="panel">
      <div className="table-toolbar admin-toolbar">
        <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder={`Buscar en ${title.toLowerCase()}...`} />
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
        {!advisors && <select value={profile} onChange={(event) => { setProfile(event.target.value); setPage(1) }}><option value="">Todos los perfiles</option>{profileOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
        <button className="icon-text-button" onClick={() => usersQuery.refetch()}><FiRefreshCw /> Actualizar</button>
      </div>
      {usersQuery.isLoading ? <Loading /> : usersQuery.isError ? <ErrorState message={apiError(usersQuery.error)} onRetry={usersQuery.refetch} /> : rows.length === 0 ? <Empty /> : <div className="table-responsive"><table className="data-table responsive-cards">
        <thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th><th>Usuario</th><th>Correo</th><th>Perfil</th><th>Grupo</th><th>Proyectos</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{rows.map((user) => <tr key={user.id}>
          <td data-label="Sel."><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, user.id] : ids.filter((id) => id !== user.id))} /></td>
          <td className="mobile-primary-cell" data-label="Usuario"><strong>{fullName(user)}</strong><small className="cell-subtitle">{user.id}</small></td>
          <td data-label="Correo">{user.email || 'Sin correo'}</td>
          <td data-label="Perfil">{profileLabel(user.perfil_id)}</td>
          <td data-label="Grupo">{Number(user.perfil_id) === 3 ? `${user.semestre || '-'} ${user.grupo || ''}` : 'No aplica'}</td>
          <td data-label="Proyectos">{user.advising_projects_count ?? user.student_projects_count ?? 0}</td>
          <td data-label="Estado"><StatusBadge value={user.activo ? 'activo' : 'inactivo'} /></td>
          <td className="row-actions" data-label="Acciones"><button onClick={() => openUser(user)}><FiEdit2 /> Editar</button><button className={user.activo ? 'active-state' : 'inactive-state'} title={user.activo ? 'Clic para desactivar' : 'Clic para activar'} aria-label={user.activo ? 'Usuario activo; desactivar' : 'Usuario inactivo; activar'} onClick={() => toggleUser(user)}>{user.activo ? <FiCheckCircle /> : <FiSlash />} {user.activo ? 'Activo' : 'Inactivo'}</button><button className="danger" onClick={() => deleteUser(user)}><FiTrash2 /> Baja</button></td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination meta={usersQuery.data} onPage={setPage} />
    </section>
    <UserFormModal open={Boolean(editing)} advisors={advisors} editing={editing} form={form} setForm={setForm} onClose={() => setEditing(null)} onSave={saveCurrentUser} saving={saveUser.isPending} />
    <ImportModal open={importOpen} title="Importar usuarios" file={importFile} setFile={setImportFile} onClose={() => setImportOpen(false)} onImport={() => importUsers.mutate()} loading={importUsers.isPending} />
    <CredentialsModal open={credentialOpen} selectedIds={selectedIds} onClose={() => setCredentialOpen(false)} onSent={() => { setCredentialOpen(false); setSelectedIds([]) }} />
  </>
}

export function AdvisorsModule() {
  const client = useQueryClient()
  const [viewMode, setViewMode] = useState('projects')
  const [recordType, setRecordType] = useState('proyecto')
  const [search, setSearch] = useState('')
  const [semester, setSemester] = useState('')
  const [coverage, setCoverage] = useState('all')
  const [teacherId, setTeacherId] = useState('')
  const [manageProject, setManageProject] = useState(null)
  const debounced = useDebounced(search)
  const queryParams = {
    per_page: 100,
    semestre: semester || undefined,
    tipo_registro: recordType,
  }
  const projectsQuery = useQuery({
    queryKey: ['advisor-projects', queryParams],
    queryFn: () => api.get('/projects', { params: queryParams }).then((response) => response.data),
  })
  const staffQuery = useQuery({
    queryKey: ['advisor-active-staff'],
    queryFn: () => api.get('/users', { params: { perfil_ids: '1,2', status: 'active', compact: 1, per_page: 500 } }).then((response) => unwrapCollection(response.data)),
  })
  const rows = Array.isArray(projectsQuery.data?.data) ? projectsQuery.data.data : unwrapCollection(projectsQuery.data)
  const requiredRoles = recordType === 'tesis' ? thesisAdvisorRoles : projectAdvisorRoles
  const projectCoverage = (project) => requiredRoles.filter((role) => project.advisors?.some((advisor) => advisorRoleOf(advisor) === role.value)).length
  const visibleRows = rows.filter((project) => {
    const assigned = projectCoverage(project)
    const term = debounced.trim().toLowerCase()
    const searchable = [project.title, project.authors, project.company_name, ...(project.students || []).map(fullName), ...(project.advisors || []).flatMap((advisor) => [advisor.id, fullName(advisor)])].filter(Boolean).join(' ').toLowerCase()
    if (term && !searchable.includes(term)) return false
    if (teacherId && !project.advisors?.some((advisor) => String(advisor.id) === String(teacherId))) return false
    if (coverage === 'complete') return assigned === requiredRoles.length
    if (coverage === 'incomplete') return assigned < requiredRoles.length
    return true
  })
  const activeStaffIds = new Set((staffQuery.data || []).map((person) => String(person.id)))
  const teacherMap = new Map()
  rows.forEach((project) => project.advisors?.forEach((advisor) => {
    if (!activeStaffIds.has(String(advisor.id))) return
    const key = String(advisor.id)
    if (!teacherMap.has(key)) teacherMap.set(key, { ...advisor, projects: [] })
    teacherMap.get(key).projects.push({
      id: project.id,
      title: project.title,
      semester: semesterOf(project),
      role: advisorRoleOf(advisor),
      group: project.subject_group?.nombre || project.company_name || 'Sin grupo asociado',
    })
  }))
  const teacherRows = [...teacherMap.values()].filter((teacher) => {
    const term = debounced.trim().toLowerCase()
    if (teacherId && String(teacher.id) !== String(teacherId)) return false
    if (!term) return true
    return [teacher.id, fullName(teacher), ...teacher.projects.map((project) => project.title)].join(' ').toLowerCase().includes(term)
  }).sort((a, b) => fullName(a).localeCompare(fullName(b), 'es'))
  const completeCount = rows.filter((project) => projectCoverage(project) === requiredRoles.length).length
  const assignedCount = rows.reduce((total, project) => total + projectCoverage(project), 0)
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['advisor-projects'] })
    client.invalidateQueries({ queryKey: ['projects-admin'] })
  }

  return <>
    <PageHeader
      eyebrow="Vinculación académica"
      title="Gestión de asesores"
      description="Consulta las asignaciones desde los proyectos o revisa la carga académica de cada docente activo."
    />
    <div className="stats-grid advisor-stats">
      <article className="stat-card"><span className="stat-icon"><FiUsers /></span><div><small>{viewMode === 'teachers' ? 'Docentes con asignación' : recordType === 'tesis' ? 'Tesis visibles' : 'Proyectos visibles'}</small><strong>{viewMode === 'teachers' ? teacherRows.length : rows.length}</strong></div></article>
      <article className="stat-card"><span className="stat-icon color-1"><FiUserCheck /></span><div><small>Roles cubiertos</small><strong>{assignedCount}</strong></div></article>
      <article className="stat-card"><span className="stat-icon color-2"><FiUserX /></span><div><small>Con asignación incompleta</small><strong>{rows.length - completeCount}</strong></div></article>
    </div>
    <section className="panel">
      <div className="advisor-control-row">
        <div className="module-tabs compact-tabs" aria-label="Organizar asesores">
          <button className={viewMode === 'projects' ? 'active' : ''} onClick={() => setViewMode('projects')}>Por proyectos</button>
          <button className={viewMode === 'teachers' ? 'active' : ''} onClick={() => setViewMode('teachers')}>Por docentes</button>
        </div>
        <button className="icon-text-button" onClick={() => projectsQuery.refetch()}><FiRefreshCw /> Actualizar</button>
      </div>
      <div className="module-tabs compact-tabs advisor-record-tabs" aria-label="Tipo de registro">
        <button className={recordType === 'proyecto' ? 'active' : ''} onClick={() => setRecordType('proyecto')}>Proyectos integradores</button>
        <button className={recordType === 'tesis' ? 'active' : ''} onClick={() => setRecordType('tesis')}>Tesis</button>
      </div>
      <div className="table-toolbar admin-toolbar advisor-filters">
        <SearchField value={search} onChange={setSearch} placeholder={viewMode === 'teachers' ? 'Buscar docente o proyecto asignado...' : 'Buscar proyecto, integrante o asesor...'} />
        <select value={semester} onChange={(event) => setSemester(event.target.value)}>
          <option value="">Todos los semestres</option>
          {[5, 6, 7, 8, 9].map((value) => <option value={value} key={value}>{value}° semestre</option>)}
        </select>
        <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
          <option value="">Todos los docentes activos</option>
          {(staffQuery.data || []).map((person) => <option value={person.id} key={person.id}>{fullName(person)} ({person.id})</option>)}
        </select>
        {viewMode === 'projects' && <select value={coverage} onChange={(event) => setCoverage(event.target.value)}>
          <option value="all">Toda la cobertura</option>
          <option value="incomplete">Asignación incompleta</option>
          <option value="complete">Asignación completa</option>
        </select>}
      </div>
      {projectsQuery.isLoading || staffQuery.isLoading ? <Loading /> : projectsQuery.isError || staffQuery.isError ? <ErrorState message={apiError(projectsQuery.error || staffQuery.error)} onRetry={() => { projectsQuery.refetch(); staffQuery.refetch() }} /> : viewMode === 'teachers' ? teacherRows.length === 0 ? <Empty title="Sin docentes con proyectos para este filtro" /> : (
        <div className="advisor-teacher-grid">{teacherRows.map((teacher) => <article className="advisor-teacher-card" key={teacher.id}>
          <header><span className="advisor-teacher-avatar">{fullName(teacher).charAt(0).toUpperCase()}</span><div><h2>{fullName(teacher)}</h2><p>{teacher.id} · Perfil activo</p></div><strong>{teacher.projects.length}</strong></header>
          <div className="teacher-project-list">{teacher.projects.map((project) => {
            const role = advisorRoles.find((item) => item.value === project.role)?.label || project.role
            return <div key={`${teacher.id}-${project.id}`}><span><strong>{project.title}</strong><small>Semestre {project.semester} · {project.group}</small></span><StatusBadge value={role} /></div>
          })}</div>
        </article>)}</div>
      ) : visibleRows.length === 0 ? <Empty title="Sin proyectos para este filtro" /> : (
        <div className="advisor-project-grid">{visibleRows.map((project) => {
          const covered = projectCoverage(project)
          return <article className={`advisor-project-card ${covered === requiredRoles.length ? 'complete' : ''}`} key={project.id}>
            <header>
              <div><span className="eyebrow">Semestre {semesterOf(project)}</span><h2>{project.title}</h2><p>{project.students?.map(fullName).join(', ') || project.authors || 'Sin integrantes asignados'}</p></div>
              <span className="coverage-counter">{covered}/{requiredRoles.length}</span>
            </header>
            <div className="advisor-role-list">{requiredRoles.map((role) => {
              const assigned = project.advisors?.find((advisor) => advisorRoleOf(advisor) === role.value)
              return <div className={assigned ? 'advisor-role filled' : 'advisor-role missing'} key={role.value}>
                <span>{role.label}</span>
                <strong>{assigned ? fullName(assigned) : 'Sin asignar'}</strong>
                <small>{assigned?.id || 'Requiere atención'}</small>
              </div>
            })}</div>
            <footer><span>{project.subject_group?.nombre || project.company_name || 'Sin grupo asociado'}</span><button className="btn-primary-app compact" onClick={() => setManageProject(project)}><FiUserCheck /> Gestionar asesores</button></footer>
          </article>
        })}</div>
      )}
    </section>
    <AdvisorAssignmentModal key={manageProject?.id || 'no-advisor-project'} project={manageProject} onClose={() => setManageProject(null)} onSaved={invalidate} />
  </>
}

function AdvisorAssignmentModal({ project, onClose, onSaved }) {
  const client = useQueryClient()
  const thesis = isThesisProject(project)
  const roles = thesis ? thesisAdvisorRoles : projectAdvisorRoles
  const initialAssignments = () => Object.fromEntries(roles.map((role) => [
    role.value,
    project?.advisors?.find((advisor) => advisorRoleOf(advisor) === role.value)?.id || '',
  ]))
  const [draft, setDraft] = useState(initialAssignments)
  const [baseline] = useState(initialAssignments)
  const projectQuery = useQuery({
    queryKey: ['project-detail', project?.id],
    queryFn: () => api.get(`/projects/${project.id}`).then((response) => response.data),
    enabled: Boolean(project),
    initialData: project || undefined,
  })
  const staffQuery = useQuery({
    queryKey: ['project-staff-options'],
    queryFn: () => api.get('/users', { params: { perfil_ids: '1,2', status: 'active', compact: 1, per_page: 500 } }).then((response) => unwrapCollection(response.data)),
    enabled: Boolean(project),
  })
  const currentProject = projectQuery.data || project
  const hasChanges = roles.some((role) => (draft[role.value] || '') !== (baseline[role.value] || ''))
  const selectedIds = Object.values(draft).filter(Boolean)
  const mutation = useMutation({
    mutationFn: () => api.put(`/projects/${project.id}/advisors`, { assignments: draft }),
    onSuccess: ({ data }) => {
      toast.success(data.message || 'Asignaciones actualizadas.')
      client.invalidateQueries({ queryKey: ['project-detail', project?.id] })
      onSaved()
      onClose()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  const save = async (event) => {
    event.preventDefault()
    if (!hasChanges) return
    const assignedNames = roles.map((role) => {
      const person = staffQuery.data?.find((item) => String(item.id) === String(draft[role.value]))
      return `${role.label}: ${person ? fullName(person) : 'Sin asignar'}`
    }).join('\n')
    const confirmed = await confirmAction({
      title: 'Confirmar cambios de asesores',
      text: assignedNames,
      confirmText: 'Sí, guardar cambios',
    })
    if (confirmed) mutation.mutate()
  }
  const close = async () => {
    if (hasChanges) {
      const discard = await confirmAction({
        title: 'Descartar cambios',
        text: 'Las selecciones todavía no se han guardado.',
        confirmText: 'Sí, descartar',
      })
      if (!discard) return
    }
    onClose()
  }

  return <Modal open={Boolean(project)} title="Gestionar asesores" onClose={close}>
    {projectQuery.isLoading ? <Loading /> : projectQuery.isError ? <ErrorState message={apiError(projectQuery.error)} onRetry={projectQuery.refetch} /> : <div className="modal-form advisor-assignment-modal">
      <h3>{currentProject?.title}</h3>
      <p className="review-comment">{thesis ? 'Selecciona al asesor de tesis y a sus revisores.' : 'Selecciona al asesor primario y secundario en una sola operación.'} Solo aparecen docentes y administradores activos.</p>
      <form className="advisor-bulk-form" onSubmit={save}>
        <div className="advisor-select-grid">{roles.map((role) => {
          const selected = staffQuery.data?.find((person) => String(person.id) === String(draft[role.value]))
          return <label className={`advisor-select-card ${selected ? 'filled' : 'missing'}`} key={role.value}>
            <span>{role.label}</span>
            <select value={draft[role.value] || ''} onChange={(event) => setDraft((current) => ({ ...current, [role.value]: event.target.value }))}>
              <option value="">Sin asignar</option>
              {staffQuery.data?.map((person) => <option
                value={person.id}
                key={person.id}
                disabled={selectedIds.includes(String(person.id)) && String(draft[role.value]) !== String(person.id)}
              >{fullName(person)} ({person.id})</option>)}
            </select>
            <small>{selected ? `Perfil activo · ${selected.id}` : 'Puesto disponible'}</small>
          </label>
        })}</div>
        <div className="draft-change-summary">
          <StatusBadge value={hasChanges ? 'cambios pendientes' : 'sin cambios'} />
          <span>{hasChanges ? 'Revisa las selecciones antes de confirmar.' : 'Las asignaciones coinciden con la información guardada.'}</span>
        </div>
        <div className="modal-actions advisor-draft-actions">
          <button type="button" onClick={close}>Cancelar</button>
          <button type="button" className="icon-text-button" disabled={!hasChanges || mutation.isPending} onClick={() => setDraft({ ...baseline })}><FiRefreshCw /> Deshacer cambios</button>
          <button className="btn-primary-app compact" disabled={!hasChanges || mutation.isPending}><FiCheckCircle /> {mutation.isPending ? 'Guardando...' : 'Confirmar cambios'}</button>
        </div>
      </form>
    </div>}
  </Modal>
}

function UserFormModal({ open, advisors, editing, form, setForm, onClose, onSave, saving }) {
  const isStudent = Number(form.perfil_id) === 3
  return <Modal open={open} title={editing?.__new ? (advisors ? 'Nuevo asesor' : 'Nuevo usuario') : 'Editar usuario'} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <div className="form-grid">
        <label>No. control / nómina<input required disabled={!editing?.__new} value={form.id || ''} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
        <label>Perfil<select required value={form.perfil_id} onChange={(event) => setForm({ ...form, perfil_id: event.target.value })}>{profileOptions.filter((option) => !advisors || Number(option.value) !== 3).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Nombre(s)<input required value={form.nombres || ''} onChange={(event) => setForm({ ...form, nombres: event.target.value })} /></label>
        <label>Apellido paterno<input value={form.apa || ''} onChange={(event) => setForm({ ...form, apa: event.target.value })} /></label>
        <label>Apellido materno<input value={form.ama || ''} onChange={(event) => setForm({ ...form, ama: event.target.value })} /></label>
        <label>Correo<input type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        {isStudent && <><label>Semestre<select value={form.semestre || ''} onChange={(event) => setForm({ ...form, semestre: event.target.value })}><option value="">Sin semestre</option>{semesterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Grupo<input value={form.grupo || ''} onChange={(event) => setForm({ ...form, grupo: event.target.value.toUpperCase() })} /></label></>}
        <label>Teléfonos<input value={form.telefonos || ''} onChange={(event) => setForm({ ...form, telefonos: event.target.value })} /></label>
        <label className="full-field">Dirección<input value={form.direccion || ''} onChange={(event) => setForm({ ...form, direccion: event.target.value })} /></label>
        {editing?.__new && <><label>Contraseña<input required type="password" value={form.password || ''} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Confirmar contraseña<input required type="password" value={form.password_confirmation || ''} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} /></label></>}
        {!editing?.__new && <><label>Nueva contraseña<input type="password" value={form.password || ''} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Confirmar nueva contraseña<input type="password" value={form.password_confirmation || ''} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} /></label></>}
      </div>
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
    </form>
  </Modal>
}

function CredentialsModal({ open, selectedIds, onClose, onSent }) {
  const [form, setForm] = useState({ subject: 'Credenciales de acceso al SGPI', body: '', rotate_password: true, admin_password: '' })
  const templateQuery = useQuery({
    queryKey: ['credential-template'],
    queryFn: () => api.get('/users/credential-email-template').then((response) => response.data),
    enabled: open,
  })
  const mutation = useMutation({
    mutationFn: () => api.post('/users/send-credentials', {
      ...form,
      subject: form.subject || templateQuery.data?.subject || 'Credenciales de acceso al SGPI',
      body: form.body || templateQuery.data?.body || '',
      user_ids: selectedIds,
    }),
    onSuccess: ({ data }) => {
      toast.success(`${data.message || 'Credenciales enviadas.'} Enviados: ${data.sent || 0}.`)
      onSent()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  return <Modal open={open} title="Enviar credenciales" onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <p className="review-comment">Se enviarán credenciales a {selectedIds.length} usuario(s) seleccionado(s). Si marcas renovar contraseña, el correo incluirá una temporal nueva.</p>
      <label>Asunto<input value={form.subject || templateQuery.data?.subject || ''} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
      <label>Cuerpo<textarea required rows="8" value={form.body || templateQuery.data?.body || ''} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      <label className="switch-field"><input type="checkbox" checked={form.rotate_password} onChange={(event) => setForm({ ...form, rotate_password: event.target.checked })} /><span>Generar contraseña temporal nueva</span></label>
      <label>Contraseña de administrador<input required type="password" value={form.admin_password} onChange={(event) => setForm({ ...form, admin_password: event.target.value })} /></label>
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={mutation.isPending}><FiKey /> Enviar</button></div>
    </form>
  </Modal>
}

export function ProjectsModule({ readOnly = false }) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [recordType, setRecordType] = useState('proyecto')
  const [semester, setSemester] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultProjectForm)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const debounced = useDebounced(search)
  const endpoint = readOnly ? '/my-projects' : '/projects'
  const projectsQuery = useQuery({
    queryKey: ['projects-admin', endpoint, page, debounced, recordType, semester],
    queryFn: () => api.get(endpoint, { params: { page, q: debounced || undefined, per_page: 15, tipo_registro: recordType === 'tesis' ? 'tesis' : 'proyecto', modalidad: recordType === 'tesis' ? undefined : recordType, semestre: semester || undefined } }).then((response) => response.data),
  })
  const groupsQuery = useQuery({
    queryKey: ['subject-groups-options'],
    queryFn: () => api.get('/subject-groups').then((response) => response.data),
    enabled: !readOnly,
  })
  const rows = Array.isArray(projectsQuery.data?.data) ? projectsQuery.data.data : unwrapCollection(projectsQuery.data)
  const groups = Array.isArray(groupsQuery.data) ? groupsQuery.data : unwrapCollection(groupsQuery.data)
  const invalidate = () => { client.invalidateQueries({ queryKey: ['projects-admin'] }); client.invalidateQueries({ queryKey: ['evaluation-projects'] }) }

  const saveProject = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        subject_group_id: Number(form.subject_group_id),
        semestre: Number(form.semestre),
        year: Number(form.year),
        student_ids: idsFromText(form.student_ids),
        is_thesis: Boolean(form.is_thesis),
      }
      return editing.__new ? api.post('/projects', body) : api.put(`/projects/${editing.id}`, body)
    },
    onSuccess: ({ data }) => {
      toast.success(data.message || 'Proyecto guardado.')
      setEditing(null)
      invalidate()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  const deleteProject = useMutation({
    mutationFn: (project) => api.delete(`/projects/${project.id}`),
    onSuccess: ({ data }) => { toast.success(data.message || 'Proyecto eliminado.'); invalidate() },
    onError: (error) => toast.error(apiError(error)),
  })
  const importProjects = useMutation({
    mutationFn: () => {
      const data = new FormData()
      data.append('archivo', importFile)
      return api.post('/projects/import-excel', data)
    },
    onSuccess: ({ data }) => {
      toast.success(`Importación procesada. Creados: ${data.created || 0}. Errores: ${data.errors?.length || 0}.`)
      setImportOpen(false)
      setImportFile(null)
      invalidate()
    },
    onError: (error) => toast.error(apiError(error)),
  })

  const openProject = (project = null) => {
    if (!project) {
      setForm({ ...defaultProjectForm, modalidad: recordType === 'tesis' ? 'proyecto_integrador' : recordType, is_thesis: recordType === 'tesis' })
      setEditing({ __new: true })
      return
    }
    setForm({
      ...defaultProjectForm,
      ...project,
      subject_group_id: project.subject_group_id || project.subject_group?.id || '',
      semestre: project.semestre || project.subject_group?.semestre || 5,
      student_ids: project.students?.map((student) => student.id).join(', ') || '',
      company_name: project.company_name || '',
      company_rfc: project.company_rfc || '',
      company_giro: project.company_giro || '',
      company_contact_name: project.company_contact_name || '',
      company_contact_position: project.company_contact_position || '',
      company_address: project.company_address || '',
      is_thesis: Boolean(project.is_thesis),
    })
    setEditing(project)
  }
  const remove = async (project) => {
    if (await confirmAction({ title: 'Eliminar proyecto', text: project.title, confirmText: 'Sí, eliminar' })) deleteProject.mutate(project)
  }
  const downloadTemplate = async () => {
    try {
      await downloadApiFile('/projects-template.xls', 'plantilla_proyectos.xls')
    } catch (error) { toast.error(apiError(error)) }
  }

  return <>
    <PageHeader eyebrow="Gestión de proyectos" title={readOnly ? 'Mis proyectos y tesis' : 'Gestión de proyectos y tesis'} description={readOnly ? 'Consulta proyectos vinculados a tu usuario.' : 'Administra proyectos, tesis, integrantes, asesores y materias relacionadas.'} actions={!readOnly && <>
      <button className="btn-primary-app compact" onClick={() => openProject()}><FiPlus /> Nuevo proyecto</button>
      <button className="icon-text-button" onClick={downloadTemplate}><FiDownload /> Plantilla</button>
      <button className="icon-text-button" onClick={() => setImportOpen(true)}><FiUpload /> Importar</button>
    </>} />
    <section className="panel">
      <div className="module-tabs compact-tabs project-type-tabs">
        <button className={recordType === 'proyecto_integrador' ? 'active' : ''} onClick={() => { setRecordType('proyecto_integrador'); setPage(1) }}>Proyecto integrador</button>
        <button className={recordType === 'dual' ? 'active' : ''} onClick={() => { setRecordType('dual'); setPage(1) }}>Modalidad Dual</button>
        <button className={recordType === 'caso_integrador' ? 'active' : ''} onClick={() => { setRecordType('caso_integrador'); setPage(1) }}>Caso integrador</button>
        <button className={recordType === 'tesis' ? 'active' : ''} onClick={() => { setRecordType('tesis'); setPage(1) }}>Tesis</button>
      </div>
      <div className="table-toolbar admin-toolbar">
        <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar proyecto, empresa, asesor o estudiante..." />
        <select value={semester} onChange={(event) => { setSemester(event.target.value); setPage(1) }}><option value="">Todos los semestres</option>{[5, 6, 7, 8, 9].map((value) => <option value={value} key={value}>{value}° semestre</option>)}</select>
        <button className="icon-text-button" onClick={() => projectsQuery.refetch()}><FiRefreshCw /> Actualizar</button>
      </div>
      {projectsQuery.isLoading ? <Loading /> : projectsQuery.isError ? <ErrorState message={apiError(projectsQuery.error)} onRetry={projectsQuery.refetch} /> : rows.length === 0 ? <Empty title="Sin proyectos" /> : <div className="table-responsive"><table className="data-table responsive-cards">
        <thead><tr><th>Proyecto</th><th>Integrantes</th><th>Asesores</th><th>Materias</th><th>Grupo</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{rows.map((project) => <tr key={project.id}>
          <td className="mobile-primary-cell" data-label="Proyecto"><strong>{project.title}</strong><small className="cell-subtitle">{{ dual: 'Modalidad Dual', proyecto_integrador: 'Proyecto integrador', caso_integrador: 'Caso integrador' }[project.modalidad] || 'Proyecto integrador'} · {project.company_name || 'Sin empresa'} · {formatDate(project.created_at)}</small></td>
          <td data-label="Integrantes">{project.students?.map(fullName).join(', ') || project.authors || 'Sin asignar'}</td>
          <td data-label="Asesores"><div className="inline-role-list">{(isThesisProject(project) ? thesisAdvisorRoles : projectAdvisorRoles).map((role) => {
            const assigned = project.advisors?.find((advisor) => advisorRoleOf(advisor) === role.value)
            return <span className={assigned ? 'filled' : 'missing'} key={role.value}><small>{role.label}</small>{assigned ? fullName(assigned) : 'Sin asignar'}</span>
          })}</div></td>
          <td data-label="Materias">{project.asignaturas?.map((subject) => subject.clave ? `${subject.clave} ${subject.nombre}` : subject.nombre).join(', ') || 'Sin materias'}</td>
          <td data-label="Grupo">{project.subject_group ? `${project.subject_group.semestre} ${project.subject_group.grupo} · ${project.subject_group.nombre}` : project.semestre || '-'}</td>
          <td data-label="Estado"><StatusBadge value={project.proposal_status || (project.activo ? 'activo' : 'inactivo')} /></td>
          <td className="row-actions" data-label="Acciones">{!readOnly && <><button onClick={() => openProject(project)}><FiEdit2 /> Editar</button><button className="danger" onClick={() => remove(project)}><FiTrash2 /> Eliminar</button></>}</td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination meta={projectsQuery.data} onPage={setPage} />
    </section>
    <ProjectFormModal open={Boolean(editing)} editing={editing} form={form} setForm={setForm} groups={groups} onClose={() => setEditing(null)} onSave={() => saveProject.mutate()} saving={saveProject.isPending} />
    <ImportModal open={importOpen} title="Importar proyectos" file={importFile} setFile={setImportFile} onClose={() => setImportOpen(false)} onImport={() => importProjects.mutate()} loading={importProjects.isPending} />
  </>
}

function ProjectFormModal({ open, editing, form, setForm, groups, onClose, onSave, saving }) {
  const companies = useQuery({ queryKey: ['project-company-suggestions', form.company_name], queryFn: () => api.get('/companies', { params: { q: form.company_name } }).then((response) => response.data), enabled: open && String(form.company_name || '').trim().length >= 2 })
  const selectCompany = (id) => {
    const company = (companies.data || []).find((item) => String(item.id) === String(id))
    if (company) setForm({ ...form, company_id: company.id, company_name: company.nombre, company_rfc: company.rfc || '', company_giro: company.giro || '', company_contact_name: company.contacto_nombre || '', company_contact_position: company.contacto_cargo || '', company_address: company.direccion || '', request_company_registration: false })
  }
  return <Modal open={open} title={editing?.__new ? 'Nuevo proyecto' : 'Editar proyecto'} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <div className="form-grid">
        <label className="full-field">Título<input required value={form.title || ''} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="full-field">Descripción<textarea required rows="4" value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label>Carga / grupo<select required value={form.subject_group_id || ''} onChange={(event) => {
          const group = groups.find((item) => String(item.id) === event.target.value)
          setForm({ ...form, subject_group_id: event.target.value, semestre: group?.semestre || form.semestre })
        }}><option value="">Selecciona</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.semestre} {group.grupo} · {group.nombre}</option>)}</select></label>
        <label>Semestre<select value={form.semestre || 5} onChange={(event) => setForm({ ...form, semestre: event.target.value })}>{semesterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Año<input type="number" min="2000" max="2100" value={form.year || ''} onChange={(event) => setForm({ ...form, year: event.target.value })} /></label>
        <label>Modalidad<select required value={form.modalidad || 'proyecto_integrador'} onChange={(event) => setForm({ ...form, modalidad: event.target.value })}><option value="dual">Modalidad Dual</option><option value="proyecto_integrador">Proyecto integrador</option><option value="caso_integrador">Caso integrador</option></select></label>
        <label className="switch-field"><input type="checkbox" checked={Boolean(form.is_thesis)} onChange={(event) => setForm({ ...form, is_thesis: event.target.checked })} /><span>Proyecto de tesis</span></label>
        <label className="full-field">Matrículas de integrantes<input required value={form.student_ids || ''} onChange={(event) => setForm({ ...form, student_ids: event.target.value })} placeholder="Separadas por coma" /></label>
        <label>Empresa registrada<select value={form.company_id || ''} onChange={(event) => selectCompany(event.target.value)}><option value="">Nueva empresa</option>{(companies.data || []).filter((company) => company.estado_validacion === 'aprobada').map((company) => <option key={company.id} value={company.id}>{company.nombre} · {company.rfc || 'sin RFC histórico'}</option>)}</select></label>
        <label>Empresa<input required value={form.company_name || ''} onChange={(event) => setForm({ ...form, company_id: '', company_name: event.target.value, request_company_registration: true })} /></label>
        <label>RFC<input required maxLength="13" value={form.company_rfc || ''} onChange={(event) => setForm({ ...form, company_rfc: event.target.value.toUpperCase() })} /></label>
        <label>Giro<input required value={form.company_giro || ''} onChange={(event) => setForm({ ...form, company_giro: event.target.value })} /></label>
        <label>Contacto<input required value={form.company_contact_name || ''} onChange={(event) => setForm({ ...form, company_contact_name: event.target.value })} /></label>
        <label>Cargo<input required value={form.company_contact_position || ''} onChange={(event) => setForm({ ...form, company_contact_position: event.target.value })} /></label>
        <label className="full-field">Dirección de empresa<input required value={form.company_address || ''} onChange={(event) => setForm({ ...form, company_address: event.target.value })} /></label>
      </div>
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
    </form>
  </Modal>
}

function ImportModal({ open, title, file, setFile, onClose, onImport, loading }) {
  return <Modal open={open} title={title} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onImport() }}>
      <p className="review-comment">Usa la plantilla del sistema. Se aceptan .xls, .xlsx y .csv según el procesador del API.</p>
      <label>Archivo<input required type="file" accept=".xls,.xlsx,.csv,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      {file && <small className="cell-subtitle">Seleccionado: {file.name}</small>}
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={loading || !file}>{loading ? 'Importando...' : 'Importar'}</button></div>
    </form>
  </Modal>
}

export function TagsModule() {
  return <CrudModule
    resource="document-tags"
    endpoint="/document-tags"
    title="Etiquetas de documentos"
    eyebrow="Sistema"
    description="Organiza entregables y documentos del repositorio mediante etiquetas."
    createLabel="Nueva etiqueta"
    columns={[
      { label: 'Etiqueta', render: (item) => <span className="tag-preview"><i style={{ background: item.color || '#1B396A' }} />{item.nombre}</span> },
      { label: 'Descripción', key: 'descripcion' },
      { label: 'Documentos', render: (item) => item.documents_count ?? 0 },
    ]}
    fields={[
      { name: 'nombre', label: 'Nombre', required: true },
      { name: 'color', label: 'Color', type: 'color', defaultValue: '#1B396A' },
      { name: 'descripcion', label: 'Descripción', type: 'textarea', full: true },
    ]}
  />
}
