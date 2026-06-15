import api from '../services/api'
import CrudModule from '../components/common/CrudModule'
import { StatusBadge } from '../components/common/Ui'
import { formatDate, fullName } from '../utils/formatters'

const profileOptions = [
  { value: 1, label: 'Administrador' }, { value: 2, label: 'Docente' }, { value: 3, label: 'Estudiante' },
]
const semesterOptions = [5, 6, 7, 8, 9].map((value) => ({ value, label: `${value}° semestre` }))

export function UsersModule({ advisors = false }) {
  return <CrudModule
    resource={advisors ? 'advisors' : 'users'}
    endpoint="/users"
    title={advisors ? 'Asesores' : 'Usuarios'}
    eyebrow="Personas"
    description={advisors ? 'Administra docentes y responsables que asesoran proyectos.' : 'Gestiona cuentas, perfiles académicos y estado de acceso.'}
    queryParams={advisors ? { perfil_ids: '1,2' } : { status: 'all' }}
    createLabel={advisors ? 'Nuevo asesor' : 'Nuevo usuario'}
    columns={[
      { label: 'Usuario', render: (item) => <><strong>{fullName(item)}</strong><small className="cell-subtitle">{item.id}</small></> },
      { label: 'Correo', render: (item) => item.email || 'Sin correo' },
      { label: 'Perfil', render: (item) => profileOptions.find((option) => Number(option.value) === Number(item.perfil_id))?.label },
      { label: 'Grupo', render: (item) => item.perfil_id === 3 ? `${item.semestre || '—'} ${item.grupo || ''}` : 'No aplica' },
      { label: 'Estado', render: (item) => <StatusBadge value={item.activo ? 'activo' : 'inactivo'} /> },
    ]}
    fields={[
      { name: 'id', label: 'No. de control o empleado', required: true, createOnly: true },
      { name: 'perfil_id', label: 'Perfil', type: 'select', options: profileOptions, required: true, defaultValue: advisors ? 2 : 3 },
      { name: 'nombres', label: 'Nombre(s)', required: true },
      { name: 'apa', label: 'Apellido paterno' },
      { name: 'ama', label: 'Apellido materno' },
      { name: 'email', label: 'Correo', type: 'email' },
      { name: 'semestre', label: 'Semestre', type: 'select', options: semesterOptions, when: (form) => Number(form.perfil_id) === 3 },
      { name: 'grupo', label: 'Grupo', when: (form) => Number(form.perfil_id) === 3 },
      { name: 'telefonos', label: 'Teléfonos' },
      { name: 'direccion', label: 'Dirección', full: true },
      { name: 'password', label: 'Contraseña', type: 'password', required: true, createOnly: true },
      { name: 'password_confirmation', label: 'Confirmar contraseña', type: 'password', required: true, createOnly: true },
      { name: 'activo', label: 'Cuenta activa', type: 'checkbox', defaultValue: true },
    ]}
    mapFormToPayload={(form, editing) => {
      const payload = { ...form, perfil_id: Number(form.perfil_id), semestre: form.semestre ? Number(form.semestre) : null }
      if (!editing.__new) {
        delete payload.id
        if (!payload.password) { delete payload.password; delete payload.password_confirmation }
        delete payload.perfil_id
      }
      return payload
    }}
  />
}

export function ProjectsModule({ readOnly = false }) {
  return <CrudModule
    resource="projects"
    endpoint={readOnly ? '/my-projects' : '/projects'}
    title={readOnly ? 'Mis proyectos y tesis' : 'Proyectos y tesis'}
    eyebrow="Gestión de proyectos"
    description="Consulta equipos, empresas vinculadas, semestre y estado de cada proyecto."
    canCreate={!readOnly}
    canEdit={!readOnly}
    canDelete={!readOnly}
    responseItems={(payload) => payload?.data || []}
    columns={[
      { label: 'Proyecto', render: (item) => <><strong>{item.title}</strong><small className="cell-subtitle">{item.company_name || 'Sin empresa'}</small></> },
      { label: 'Estudiantes', render: (item) => item.students?.map(fullName).join(', ') || item.authors || 'Sin asignar' },
      { label: 'Semestre', render: (item) => item.semestre || item.subject_group?.semestre || '—' },
      { label: 'Registro', render: (item) => formatDate(item.created_at) },
      { label: 'Estado', render: (item) => <StatusBadge value={item.proposal_status || (item.activo ? 'activo' : 'inactivo')} /> },
    ]}
    fields={[
      { name: 'title', label: 'Título', required: true, full: true },
      { name: 'description', label: 'Descripción', type: 'textarea', required: true, full: true },
      { name: 'subject_group_id', label: 'Carga o grupo', type: 'select', optionsKey: 'groups', required: true },
      { name: 'semestre', label: 'Semestre', type: 'select', options: semesterOptions, required: true },
      { name: 'year', label: 'Año', type: 'number', min: 2000, max: 2100, required: true, defaultValue: new Date().getFullYear() },
      { name: 'student_ids', label: 'Matrículas de estudiantes', placeholder: 'Separadas por coma', full: true },
      { name: 'company_name', label: 'Empresa', required: true },
      { name: 'company_giro', label: 'Giro', required: true },
      { name: 'company_contact_name', label: 'Contacto', required: true },
      { name: 'company_contact_position', label: 'Cargo del contacto', required: true },
      { name: 'company_address', label: 'Dirección de empresa', required: true, full: true },
      { name: 'is_thesis', label: 'Es tesis', type: 'checkbox' },
      { name: 'activo', label: 'Proyecto activo', type: 'checkbox', defaultValue: true },
    ]}
    optionLoaders={{
      groups: () => api.get('/subject-groups').then((response) => response.data.map((group) => ({ value: group.id, label: `${group.semestre} ${group.grupo} · ${group.nombre}` }))),
    }}
    mapItemToForm={(item) => ({
      ...item,
      student_ids: item.students?.map((student) => student.id).join(', ') || '',
    })}
    mapFormToPayload={(form) => ({
      ...form,
      subject_group_id: Number(form.subject_group_id),
      semestre: Number(form.semestre),
      year: Number(form.year),
      student_ids: String(form.student_ids || '').split(',').map((id) => id.trim()).filter(Boolean),
    })}
  />
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
