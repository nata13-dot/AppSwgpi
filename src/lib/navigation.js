import {
  FiActivity, FiArchive, FiBookOpen, FiCalendar, FiCheckSquare, FiClipboard, FiCloud, FiDatabase,
  FiFileText, FiFolder, FiGrid, FiHome, FiLayers, FiShield, FiSliders, FiStar, FiTag, FiUser,
  FiUserCheck, FiUsers, FiVolume2, FiBriefcase, FiEdit3, FiMail, FiMonitor, FiFlag,
} from 'react-icons/fi'
import {
  canManageAcademics, canViewUsers, isAdmin, isGeneralAdmin, isManagementStaff, isStudent, isTeacher,
} from './permissions'

/*
 * Menú por perfil, con la misma estructura y permisos que Frontend_Swgpi/includes/sidebar.php.
 * item: { label, path, icon, module?, keywords? }  ·  group: { group, icon, items }  ·  section: { section }
 * `module` es el módulo de carrera que debe estar habilitado (tabla carrera_modulos).
 */
const item = (label, path, icon, module, keywords = []) => ({ label, path, icon, module, keywords })

function managementMenu(user) {
  const career = user?.active_career?.nombre_corto || 'sin seleccionar'
  const menu = []
  if (isGeneralAdmin(user)) {
    menu.push(
      { section: 'Administración general' },
      item('Panel institucional', '/general', FiMonitor, null, ['institucional', 'carreras']),
      item('Carreras y accesos', '/careers', FiLayers, null, ['membresías', 'colores']),
      item('Operaciones', '/operations', FiActivity, null, ['alertas', 'continuidad']),
      { group: 'Seguridad y continuidad', icon: FiShield, items: [
        item('Auditoría', '/audit', FiShield, null, ['bitácora']),
        item('Integridad', '/integrity', FiCheckSquare, null, ['verificación']),
        item('Respaldos', '/backups', FiDatabase, null, ['base de datos', 'backup']),
        item('Correos enviados', '/sent-emails', FiMail, null, ['correo', 'destinatarios', 'email']),
      ] },
      { section: `Carrera: ${career}` },
      item('Inicio de la carrera', '/dashboard', FiHome),
    )
  } else {
    menu.push({ section: 'Administración' }, item('Inicio', '/dashboard', FiHome))
  }
  // Mismos grupos que Gestiones y el menú lateral del front de PHP (navbar.php y sidebar.php).
  menu.push({ group: 'Periodo', icon: FiFlag, items: [
    item('Operación del periodo', '/period-center', FiFlag, null, ['autoregistro', 'aperturas', 'promoción', 'cierre', 'ventanas']),
    item('Seguimiento académico', '/academic-workflows', FiCalendar, null, ['residencias', 'servicio', 'matrícula']),
    canManageAcademics(user) && item('Semestres y periodos', '/semesters', FiCalendar, 'academico', ['periodos', 'grupos', 'promoción', 'irregulares']),
    canManageAcademics(user) && item('Asignaturas y competencias', '/subjects', FiStar, 'academico', ['materias', 'cargas', 'competencias']),
    isAdmin(user) && item('Carga inicial', '/career-setup', FiCloud, 'academico', ['plan de estudios', 'csv']),
  ].filter(Boolean) })
  menu.push({ group: 'Personas', icon: FiUsers, items: [
    canViewUsers(user) && item('Usuarios', '/users', FiUsers, 'usuarios', ['alumnos', 'docentes', 'cuentas', 'excel']),
    canManageAcademics(user) && { ...item('Solicitudes de cuenta', '/registration-requests', FiUserCheck, null, ['autoregistro', 'aprobar', 'alumnos']), badge: 'registration_requests' },
    item('Asesores', '/advisors', FiUserCheck, 'proyectos', ['asesorías', 'revisores']),
    isAdmin(user) && item('Archivo histórico', '/archive', FiArchive, null, ['archivados', 'egresados', 'restaurar', 'histórico']),
  ].filter(Boolean) })
  menu.push({ group: 'Proyectos', icon: FiBookOpen, items: [
    item('Proyectos y tesis', '/projects', FiFolder, 'proyectos', ['tesis', 'dual', 'casos integradores', 'residencias']),
    { ...item('Propuestas', '/proposals', FiCheckSquare, 'proyectos', ['ventanas', 'excepciones', 'validadores']), badge: 'pending_proposals' },
    item('Entregables', '/deliverables', FiFileText, 'entregables', ['fechas límite']),
    item('Empresas', '/companies', FiBriefcase, 'proyectos', ['dual']),
  ] })
  menu.push({ group: 'Evaluación', icon: FiClipboard, items: [
    item('Evaluaciones', '/evaluations', FiClipboard, 'evaluaciones', ['rúbricas', 'calificaciones']),
    item('Salas y turnos', '/evaluation-rooms', FiCalendar, 'evaluaciones', ['horarios', 'presentaciones']),
    item('Evidencias', '/evaluation-documents', FiFileText, 'evaluaciones', ['entregas', 'presentación', 'liberación']),
    item('Evaluaciones previas', '/evaluations-archived', FiArchive, 'evaluaciones', ['historial', 'archivadas']),
  ] })
  menu.push({ group: 'Sistema', icon: FiSliders, items: [
    isAdmin(user) && item('Ajustes', '/settings', FiSliders, 'configuracion', ['configuración', 'sesión']),
    isAdmin(user) && item('Avisos', '/notices', FiVolume2, 'configuracion', ['notificaciones', 'anuncios']),
    isAdmin(user) && item('Etiquetas', '/tags', FiTag, 'repositorio'),
    isAdmin(user) && item('Módulos de carrera', '/career-modules', FiGrid),
    item('Repositorio', '/repository', FiArchive, 'repositorio', ['documentos']),
  ].filter(Boolean) })
  menu.push(item('Mi perfil', '/profile', FiUser, null, ['cuenta', 'foto', 'contraseña']))
  return menu
}

const teacherMenu = () => [
  { section: 'Docente' },
  item('Inicio', '/dashboard', FiHome),
  item('Seguimiento académico', '/academic-workflows', FiCalendar),
  { group: 'Proyectos y tesis', icon: FiBookOpen, items: [
    item('Mis proyectos', '/projects', FiFolder, 'proyectos', ['asesorías', 'tesis']),
    item('Revisar propuestas', '/proposals', FiCheckSquare, 'proyectos', ['aprobar', 'rechazar']),
    item('Evaluaciones', '/evaluations', FiClipboard, 'evaluaciones', ['rúbricas']),
    item('Salas y turnos', '/evaluation-rooms', FiCalendar, 'evaluaciones'),
    item('Evaluaciones previas', '/evaluations-archived', FiArchive, 'evaluaciones'),
    item('Evidencias', '/evaluation-documents', FiFileText, 'evaluaciones'),
  ] },
  { group: 'Académico', icon: FiBookOpen, items: [item('Entregables', '/deliverables', FiFileText, 'entregables', ['calificar'])] },
  { group: 'Sistema', icon: FiSliders, items: [item('Repositorio', '/repository', FiArchive, 'repositorio')] },
  item('Mi perfil', '/profile', FiUser),
]

const studentMenu = () => [
  { section: 'Estudiante' },
  item('Inicio', '/dashboard', FiHome),
  item('Seguimiento académico', '/academic-workflows', FiCalendar),
  { group: 'Proyectos y tesis', icon: FiBookOpen, items: [
    item('Registrar propuesta', '/proposals', FiEdit3, 'proyectos', ['proyecto', 'tesis']),
    item('Evidencias', '/evaluation-documents', FiFileText, 'evaluaciones', ['presentación', 'hoja de liberación']),
  ] },
  { group: 'Académico', icon: FiBookOpen, items: [item('Mis entregables', '/deliverables', FiFileText, 'entregables', ['subir'])] },
  { group: 'Sistema', icon: FiSliders, items: [item('Repositorio', '/repository', FiArchive, 'repositorio')] },
  item('Mi perfil', '/profile', FiUser),
]

export function menuForUser(user) {
  if (isManagementStaff(user)) return managementMenu(user)
  if (isTeacher(user)) return teacherMenu()
  if (isStudent(user)) return studentMenu()
  return [item('Mi perfil', '/profile', FiUser)]
}

/** Quita lo que pertenece a módulos deshabilitados en la carrera activa (null = aún no se sabe: se muestra todo). */
export function filterMenu(menu, enabledModules) {
  const allowed = (entry) => !entry.module || !enabledModules || enabledModules.has(entry.module)
  return menu
    .filter(allowed)
    .map((entry) => (entry.group ? { ...entry, items: entry.items.filter(allowed) } : entry))
    .filter((entry) => !entry.group || entry.items.length)
}

export const flattenMenu = (menu) => menu.flatMap((entry) => (entry.group ? entry.items : entry.path ? [entry] : []))

/** Accesos de la barra inferior en el teléfono (el quinto botón, "Más", abre el menú completo). */
export function bottomNavPaths(user) {
  if (isGeneralAdmin(user)) return ['/general', '/dashboard', '/projects', '/evaluations']
  if (isManagementStaff(user)) return ['/dashboard', '/projects', '/evaluations', '/evaluation-documents']
  if (isTeacher(user)) return ['/dashboard', '/projects', '/evaluations', '/deliverables']
  return ['/dashboard', '/proposals', '/evaluation-documents', '/deliverables']
}

export const SHORT_LABELS = {
  '/general': 'Panel', '/dashboard': 'Inicio', '/projects': 'Proyectos', '/evaluations': 'Evaluar',
  '/evaluation-documents': 'Evidencias', '/deliverables': 'Entregas', '/proposals': 'Propuesta',
}
