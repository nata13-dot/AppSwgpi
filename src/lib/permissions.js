/**
 * Perfiles y permisos. Replica los helpers de Frontend_Swgpi/includes/config.php para que React ofrezca
 * exactamente las mismas pantallas que el front de PHP; la API vuelve a validar todo con CheckRole.
 * Ids de la tabla perfiles: 4 admin general, 5 jefe, 6 asistente, 7 coordinador, 2 docente, 3 estudiante.
 */
export const PROFILES = {
  GENERAL_ADMIN: 4, CAREER_HEAD: 5, HEAD_ASSISTANT: 6, PROJECT_COORDINATOR: 7, TEACHER: 2, STUDENT: 3,
}

/** id => [nivel, nombre visible], en orden de jerarquía. */
export const PROFILE_LEVELS = {
  4: [1, 'Administrador general'],
  5: [2, 'Jefe de carrera'],
  6: [3, 'Asistente de jefatura'],
  7: [4, 'Coordinador de proyectos integradores'],
  2: [5, 'Docente'],
  3: [6, 'Estudiante'],
}

/** Niveles que el administrador general puede simular, del más alto al más bajo. */
export const SIMULABLE_PROFILES = [5, 6, 7, 2, 3]

export const profileLabel = (profileId) => PROFILE_LEVELS[Number(profileId)]?.[1] || 'Usuario'
export const profileLevel = (profileId) => PROFILE_LEVELS[Number(profileId)]?.[0] || null

export const activeProfileId = (user) => Number(user?.active_profile_id ?? user?.perfil_id ?? 0)
export const viewAs = (user) => user?.view_as || null
export const mustChangePassword = (user) => Boolean(user?.must_change_password) && !viewAs(user)

// El perfil base 4 identifica al administrador general; durante una simulación la API devuelve el simulado.
export const isGeneralAdmin = (user) => Number(user?.perfil_id) === 4
export const isTeacher = (user) => activeProfileId(user) === 2
export const isStudent = (user) => activeProfileId(user) === 3
export const isCareerHead = (user) => activeProfileId(user) === 5
export const isHeadAssistant = (user) => activeProfileId(user) === 6
export const isProjectCoordinator = (user) => activeProfileId(user) === 7
export const isAdmin = (user) => [1, 5].includes(activeProfileId(user)) || isGeneralAdmin(user)
export const canManageAcademics = (user) => isAdmin(user) || isHeadAssistant(user)
export const canManageProjects = (user) => isAdmin(user) || isHeadAssistant(user) || isProjectCoordinator(user)
export const isManagementStaff = canManageProjects
export const canGovernUsers = (user) => isGeneralAdmin(user) || [5, 6].includes(activeProfileId(user))
export const canViewUsers = (user) => canGovernUsers(user) || isProjectCoordinator(user)
export const canDownloadFullEvaluationReports = (user) => isGeneralAdmin(user) || activeProfileId(user) === 5
export const isEvaluationManager = (user) => isAdmin(user) || Boolean(user?.is_evaluation_manager)

/** Nombre del perfil con el que se está trabajando (el simulado durante "ver como"). */
export const roleLabel = (user) => profileLabel(activeProfileId(user))

export const homePath = (user) => {
  if (mustChangePassword(user)) return '/change-password'
  if (isGeneralAdmin(user)) return '/general'
  return '/dashboard'
}
