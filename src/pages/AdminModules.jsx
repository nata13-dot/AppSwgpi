import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiCheckCircle, FiDownload, FiEdit2, FiKey, FiLink, FiPlus, FiRefreshCw,
  FiSend, FiSlash, FiTrash2, FiUpload,
} from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError, unwrapCollection } from '../services/api'
import CrudModule from '../components/common/CrudModule'
import {
  confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, Pagination,
  SearchField, StatusBadge, useDebounced,
} from '../components/common/Ui'
import { formatDate, fullName } from '../utils/formatters'

const profileOptions = [
  { value: 1, label: 'Administrador' },
  { value: 2, label: 'Docente' },
  { value: 3, label: 'Estudiante' },
]
const semesterOptions = [5, 6, 7, 8, 9].map((value) => ({ value, label: `${value}° semestre` }))
const defaultUserForm = {
  id: '', perfil_id: 3, nombres: '', apa: '', ama: '', email: '', semestre: '',
  grupo: '', telefonos: '', direccion: '', password: '', password_confirmation: '',
}
const defaultProjectForm = {
  title: '', description: '', subject_group_id: '', semestre: 5, year: new Date().getFullYear(),
  student_ids: '', company_name: '', company_giro: '', company_contact_name: '',
  company_contact_position: '', company_address: '', is_thesis: false,
}
const advisorRoles = [
  { value: 'primario', label: 'Asesor primario' },
  { value: 'secundario', label: 'Asesor secundario' },
  { value: 'asesor', label: 'Asesor de tesis' },
  { value: 'revisor_1', label: 'Revisor 1' },
  { value: 'revisor_2', label: 'Revisor 2' },
]

const profileLabel = (id) => profileOptions.find((option) => Number(option.value) === Number(id))?.label || 'Usuario'
const idsFromText = (value) => String(value || '').split(',').map((id) => id.trim()).filter(Boolean)
const downloadBlob = (response, filename) => {
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

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
    mutationFn: () => {
      const editingExisting = editing && !editing.__new
      const payload = {
        ...form,
        perfil_id: Number(form.perfil_id),
        semestre: form.semestre ? Number(form.semestre) : null,
        grupo: form.grupo || null,
      }
      if (editingExisting) {
        delete payload.id
        delete payload.perfil_id
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
  const adminPasswordFor = (user) => Number(user.perfil_id) === 1 ? window.prompt('Confirma con tu contraseña de administrador:') : null
  const toggleUser = async (user) => {
    if (!await confirmAction({ title: user.activo ? 'Desactivar usuario' : 'Reactivar usuario', text: `${fullName(user)} (${user.id})`, confirmText: 'Sí, continuar' })) return
    const admin_password = adminPasswordFor(user)
    if (Number(user.perfil_id) === 1 && !admin_password) return
    userAction.mutate({ endpoint: `/users/${user.id}/toggle-active`, body: { admin_password } })
  }
  const deleteUser = async (user) => {
    if (!await confirmAction({ title: 'Desactivar usuario', text: 'El usuario quedará inactivo y se conservará su historial.', confirmText: 'Sí, desactivar' })) return
    const admin_password = adminPasswordFor(user)
    if (Number(user.perfil_id) === 1 && !admin_password) return
    userAction.mutate({ endpoint: `/users/${user.id}`, method: 'delete', body: { admin_password } })
  }
  const downloadTemplate = async () => {
    try {
      const response = await api.get('/users-template.xls', { responseType: 'blob' })
      downloadBlob(response, 'plantilla_usuarios.xls')
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
          <td className="row-actions" data-label="Acciones"><button onClick={() => openUser(user)}><FiEdit2 /> Editar</button><button onClick={() => toggleUser(user)}>{user.activo ? <FiSlash /> : <FiCheckCircle />} {user.activo ? 'Desactivar' : 'Activar'}</button><button className="danger" onClick={() => deleteUser(user)}><FiTrash2 /> Baja</button></td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination meta={usersQuery.data} onPage={setPage} />
    </section>
    <UserFormModal open={Boolean(editing)} advisors={advisors} editing={editing} form={form} setForm={setForm} onClose={() => setEditing(null)} onSave={() => saveUser.mutate()} saving={saveUser.isPending} />
    <ImportModal open={importOpen} title="Importar usuarios" file={importFile} setFile={setImportFile} onClose={() => setImportOpen(false)} onImport={() => importUsers.mutate()} loading={importUsers.isPending} />
    <CredentialsModal open={credentialOpen} selectedIds={selectedIds} onClose={() => setCredentialOpen(false)} onSent={() => { setCredentialOpen(false); setSelectedIds([]) }} />
  </>
}

function UserFormModal({ open, advisors, editing, form, setForm, onClose, onSave, saving }) {
  const isStudent = Number(form.perfil_id) === 3
  return <Modal open={open} title={editing?.__new ? (advisors ? 'Nuevo asesor' : 'Nuevo usuario') : 'Editar usuario'} onClose={onClose}>
    <form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave() }}>
      <div className="form-grid">
        <label>No. control / nómina<input required disabled={!editing?.__new} value={form.id || ''} onChange={(event) => setForm({ ...form, id: event.target.value })} /></label>
        <label>Perfil<select required disabled={!editing?.__new} value={form.perfil_id} onChange={(event) => setForm({ ...form, perfil_id: event.target.value })}>{profileOptions.filter((option) => !advisors || Number(option.value) !== 3).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
  const [thesisFilter, setThesisFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(defaultProjectForm)
  const [manageProject, setManageProject] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const debounced = useDebounced(search)
  const endpoint = readOnly ? '/my-projects' : '/projects'
  const projectsQuery = useQuery({
    queryKey: ['projects-admin', endpoint, page, debounced, thesisFilter],
    queryFn: () => api.get(endpoint, { params: { page, q: debounced || undefined, per_page: 15, is_thesis: thesisFilter || undefined } }).then((response) => response.data),
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
      setForm(defaultProjectForm)
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
      const response = await api.get('/projects-template.xls', { responseType: 'blob' })
      downloadBlob(response, 'plantilla_proyectos.xls')
    } catch (error) { toast.error(apiError(error)) }
  }

  return <>
    <PageHeader eyebrow="Gestión de proyectos" title={readOnly ? 'Mis proyectos y tesis' : 'Gestión de proyectos y tesis'} description={readOnly ? 'Consulta proyectos vinculados a tu usuario.' : 'Administra proyectos, tesis, integrantes, asesores y materias relacionadas.'} actions={!readOnly && <>
      <button className="btn-primary-app compact" onClick={() => openProject()}><FiPlus /> Nuevo proyecto</button>
      <button className="icon-text-button" onClick={downloadTemplate}><FiDownload /> Plantilla</button>
      <button className="icon-text-button" onClick={() => setImportOpen(true)}><FiUpload /> Importar</button>
    </>} />
    <section className="panel">
      <div className="table-toolbar admin-toolbar">
        <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar proyecto, empresa, asesor o estudiante..." />
        <select value={thesisFilter} onChange={(event) => { setThesisFilter(event.target.value); setPage(1) }}><option value="">Todos</option><option value="0">Integradores</option><option value="1">Tesis</option></select>
        <button className="icon-text-button" onClick={() => projectsQuery.refetch()}><FiRefreshCw /> Actualizar</button>
      </div>
      {projectsQuery.isLoading ? <Loading /> : projectsQuery.isError ? <ErrorState message={apiError(projectsQuery.error)} onRetry={projectsQuery.refetch} /> : rows.length === 0 ? <Empty title="Sin proyectos" /> : <div className="table-responsive"><table className="data-table responsive-cards">
        <thead><tr><th>Proyecto</th><th>Integrantes</th><th>Asesores</th><th>Materias</th><th>Grupo</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{rows.map((project) => <tr key={project.id}>
          <td className="mobile-primary-cell" data-label="Proyecto"><strong>{project.title}</strong><small className="cell-subtitle">{project.company_name || 'Sin empresa'} · {formatDate(project.created_at)}</small></td>
          <td data-label="Integrantes">{project.students?.map(fullName).join(', ') || project.authors || 'Sin asignar'}</td>
          <td data-label="Asesores">{project.advisors?.map((advisor) => `${fullName(advisor)} (${advisor.pivot?.rol || advisor.pivot?.rol_asesor || 'asesor'})`).join(', ') || 'Sin asesores'}</td>
          <td data-label="Materias">{project.asignaturas?.map((subject) => subject.clave ? `${subject.clave} ${subject.nombre}` : subject.nombre).join(', ') || 'Sin materias'}</td>
          <td data-label="Grupo">{project.subject_group ? `${project.subject_group.semestre} ${project.subject_group.grupo} · ${project.subject_group.nombre}` : project.semestre || '-'}</td>
          <td data-label="Estado"><StatusBadge value={project.proposal_status || (project.activo ? 'activo' : 'inactivo')} /></td>
          <td className="row-actions" data-label="Acciones">{!readOnly && <><button onClick={() => openProject(project)}><FiEdit2 /> Editar</button><button onClick={() => setManageProject(project)}><FiLink /> Relaciones</button><button className="danger" onClick={() => remove(project)}><FiTrash2 /> Eliminar</button></>}</td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination meta={projectsQuery.data} onPage={setPage} />
    </section>
    <ProjectFormModal open={Boolean(editing)} editing={editing} form={form} setForm={setForm} groups={groups} onClose={() => setEditing(null)} onSave={() => saveProject.mutate()} saving={saveProject.isPending} />
    <ProjectRelationsModal project={manageProject} onClose={() => setManageProject(null)} onSaved={invalidate} />
    <ImportModal open={importOpen} title="Importar proyectos" file={importFile} setFile={setImportFile} onClose={() => setImportOpen(false)} onImport={() => importProjects.mutate()} loading={importProjects.isPending} />
  </>
}

function ProjectFormModal({ open, editing, form, setForm, groups, onClose, onSave, saving }) {
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
        <label className="switch-field"><input type="checkbox" checked={Boolean(form.is_thesis)} onChange={(event) => setForm({ ...form, is_thesis: event.target.checked })} /><span>Proyecto de tesis</span></label>
        <label className="full-field">Matrículas de integrantes<input required value={form.student_ids || ''} onChange={(event) => setForm({ ...form, student_ids: event.target.value })} placeholder="Separadas por coma" /></label>
        <label>Empresa<input required value={form.company_name || ''} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></label>
        <label>Giro<input required value={form.company_giro || ''} onChange={(event) => setForm({ ...form, company_giro: event.target.value })} /></label>
        <label>Contacto<input required value={form.company_contact_name || ''} onChange={(event) => setForm({ ...form, company_contact_name: event.target.value })} /></label>
        <label>Cargo<input required value={form.company_contact_position || ''} onChange={(event) => setForm({ ...form, company_contact_position: event.target.value })} /></label>
        <label className="full-field">Dirección de empresa<input required value={form.company_address || ''} onChange={(event) => setForm({ ...form, company_address: event.target.value })} /></label>
      </div>
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="btn-primary-app compact" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div>
    </form>
  </Modal>
}

function ProjectRelationsModal({ project, onClose, onSaved }) {
  const client = useQueryClient()
  const [advisor, setAdvisor] = useState({ user_id: '', rol_asesor: 'primario', admin_password: '' })
  const [adminPassword, setAdminPassword] = useState('')
  const projectQuery = useQuery({
    queryKey: ['project-detail', project?.id],
    queryFn: () => api.get(`/projects/${project.id}`).then((response) => response.data),
    enabled: Boolean(project),
  })
  const staffQuery = useQuery({
    queryKey: ['project-staff-options'],
    queryFn: () => api.get('/users', { params: { perfil_ids: '1,2', status: 'active', compact: 1, per_page: 500 } }).then((response) => unwrapCollection(response.data)),
    enabled: Boolean(project),
  })
  const subjectsQuery = useQuery({
    queryKey: ['subjects-options'],
    queryFn: () => api.get('/asignaturas').then((response) => unwrapCollection(response.data)),
    enabled: Boolean(project),
  })
  const [subjectIds, setSubjectIds] = useState(null)
  const currentProject = projectQuery.data || project
  const selectedSubjectIds = subjectIds ?? (currentProject?.asignaturas || []).map((subject) => Number(subject.id))
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['project-detail', project?.id] })
    client.invalidateQueries({ queryKey: ['projects-admin'] })
    onSaved()
  }
  const relationMutation = useMutation({
    mutationFn: ({ method = 'post', endpoint, body }) => method === 'delete' ? api.delete(endpoint, body) : api[method](endpoint, body),
    onSuccess: ({ data }) => { toast.success(data.message || 'Relaciones actualizadas.'); refresh() },
    onError: (error) => toast.error(apiError(error)),
  })
  const addAdvisor = (event) => {
    event.preventDefault()
    relationMutation.mutate({ endpoint: `/projects/${project.id}/advisors`, body: advisor })
  }
  const removeAdvisor = async (userId) => {
    const password = adminPassword || window.prompt('Contraseña de administrador para remover asesor:')
    if (!password) return
    if (!await confirmAction({ title: 'Remover asesor', text: 'Se quitará su relación con este proyecto.', confirmText: 'Sí, remover' })) return
    relationMutation.mutate({ method: 'delete', endpoint: `/projects/${project.id}/advisors/${userId}`, body: { data: { admin_password: password } } })
  }
  const syncSubjects = () => relationMutation.mutate({ endpoint: `/projects/${project.id}/asignaturas`, body: { asignatura_ids: selectedSubjectIds } })

  return <Modal open={Boolean(project)} title="Relaciones del proyecto" onClose={onClose}>
    {projectQuery.isLoading ? <Loading /> : projectQuery.isError ? <ErrorState message={apiError(projectQuery.error)} onRetry={projectQuery.refetch} /> : <div className="modal-form relations-modal">
      <h3>{currentProject?.title}</h3>
      <p className="review-comment">Gestiona asesores, comité de tesis y materias del proyecto. Las acciones de asesores requieren contraseña de administrador.</p>
      <section className="selection-fieldset"><legend>Asesores actuales</legend>{currentProject?.advisors?.length ? currentProject.advisors.map((item) => <div className="relation-row" key={item.id}><span><strong>{fullName(item)}</strong><small>{item.pivot?.rol || item.pivot?.rol_asesor || 'asesor'}</small></span><button className="danger" onClick={() => removeAdvisor(item.id)}><FiTrash2 /> Remover</button></div>) : <Empty title="Sin asesores" />}</section>
      <form onSubmit={addAdvisor} className="selection-fieldset"><legend>Asignar asesor o comité</legend>
        <div className="form-grid">
          <label>Persona<select required value={advisor.user_id} onChange={(event) => setAdvisor({ ...advisor, user_id: event.target.value })}><option value="">Selecciona</option>{staffQuery.data?.map((item) => <option key={item.id} value={item.id}>{fullName(item)} ({item.id})</option>)}</select></label>
          <label>Rol<select value={advisor.rol_asesor} onChange={(event) => setAdvisor({ ...advisor, rol_asesor: event.target.value })}>{advisorRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
          <label className="full-field">Contraseña administrador<input required type="password" value={advisor.admin_password} onChange={(event) => setAdvisor({ ...advisor, admin_password: event.target.value })} /></label>
        </div>
        <button className="btn-primary-app compact" disabled={relationMutation.isPending}>Asignar asesor</button>
      </form>
      <section className="selection-fieldset"><legend>Materias / asignaturas</legend>
        <div className="subject-chip-grid">{subjectsQuery.data?.map((subject) => <label className="selection-card" key={subject.id}><input type="checkbox" checked={selectedSubjectIds.includes(Number(subject.id))} onChange={(event) => setSubjectIds((ids) => {
          const current = ids ?? selectedSubjectIds
          return event.target.checked ? [...current, Number(subject.id)] : current.filter((id) => id !== Number(subject.id))
        })} /><span>{subject.clave ? `${subject.clave} · ` : ''}{subject.nombre}</span></label>)}</div>
        <button className="btn-primary-app compact" onClick={syncSubjects} disabled={relationMutation.isPending}>Guardar materias</button>
      </section>
      <label>Contraseña para remover asesores<input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>
    </div>}
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
