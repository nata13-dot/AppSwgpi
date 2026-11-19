// Guías de uso de cada sección: cómo hacer las cosas y qué afecta hacerlas. El mismo archivo se usa en la app
// (src/shared/sectionGuide.js) y en la web (Frontend_Swgpi/assets/js/section-guide.js). Todo se pinta como texto.

/** Una pantalla con pestañas avisa cuál se ve: dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: { key } })). */
export const GUIDE_EVENT = 'sgpi:guide'
export const AUTO_HIDE_MS = 8000

/** student, teacher o staff según el perfil activo. */
export function roleOf(user) {
  const profile = Number(user?.active_profile_id ?? user?.perfil_id)
  if (profile === 3) return 'student'
  if (profile === 2) return 'teacher'
  return 'staff'
}

// [clave, rutas de la app, páginas de PHP]
const ROUTES = [
  ['users', ['/users'], ['/pages/admin/users.php', '/pages/admin/user-create.php', '/pages/admin/user-edit.php']],
  ['registration-requests', ['/registration-requests'], ['/pages/admin/registration-requests.php']],
  ['projects', ['/projects'], ['/pages/admin/projects.php', '/pages/admin/project-create.php', '/pages/admin/project-edit.php', '/pages/teacher/my-projects.php']],
  ['proposals', ['/proposals'], ['/pages/student/proposal-register.php', '/pages/teacher/proposal-review.php', '/pages/admin/proposal-config.php']],
  ['deliverables', ['/deliverables'], ['/pages/admin/deliverables.php', '/pages/student/my-deliverables.php', '/pages/teacher/my-deliverables.php']],
  ['evaluations', ['/evaluations'], ['/pages/admin/evaluations.php']],
  ['evaluations-archived', ['/evaluations-archived'], ['/pages/admin/evaluations-archived.php']],
  ['evaluation-rooms', ['/evaluation-rooms'], ['/pages/admin/evaluation-rooms.php']],
  ['evaluation-documents', ['/evaluation-documents'], ['/pages/evaluation-documents.php']],
  ['subjects', ['/subjects'], ['/pages/admin/asignaturas.php', '/pages/admin/competencias.php']],
  ['advisors', ['/advisors'], ['/pages/admin/advisors.php']],
  ['companies', ['/companies'], []],
  ['period-center', ['/period-center'], ['/pages/admin/period-center.php']],
  ['archive', ['/archive'], ['/pages/admin/archive.php']],
  ['settings', ['/settings'], ['/pages/admin/settings.php']],
  ['general', ['/general'], ['/pages/admin/general.php']],
  ['notices', ['/notices'], ['/pages/admin/notices.php']],
  ['tags', ['/tags'], ['/pages/admin/document-tags.php']],
  ['career-modules', ['/career-modules'], ['/pages/admin/career-modules.php']],
  ['career-setup', ['/career-setup'], ['/pages/admin/career-setup.php']],
  ['careers', ['/careers'], ['/pages/admin/careers.php']],
  ['backups', ['/backups'], ['/pages/admin/database-backups.php']],
  ['operations', ['/operations'], ['/pages/admin/operations.php']],
  ['integrity', ['/integrity'], ['/pages/admin/career-integrity.php']],
  ['repository', ['/repository'], ['/pages/repositorio.php']],
  ['profile', ['/profile'], ['/pages/profile.php']],
  ['academic', ['/academic-workflows', '/semesters'], ['/pages/academic-workflows.php', '/pages/admin/semesters.php']],
  ['tracking', ['/tracking'], ['/pages/tracking.php']],
]

const GUIDES = {
  users: {
    how: ['Busca por nombre, número de control o correo y filtra por perfil o estado.', 'Para dar de alta a alguien usa "Nuevo usuario"; los alumnos también pueden crear su cuenta solos y se aprueban en Solicitudes de cuenta.', 'Con "Seleccionar" eliges varios: en Activos los desactivas, en Inactivos los reactivas o eliminas, y en cualquier pestaña les envías credenciales (sin elegir a nadie, el envío es por perfil).'],
    affects: ['La contraseña inicial de una cuenta nueva es su número de control; se le pide cambiarla al entrar.', 'Inactivo: no puede iniciar sesión y se liberan sus asignaciones, pero se conserva todo. Archivo histórico: además se oculta de listas, grupos y búsquedas hasta restaurarlo.', 'Eliminar definitivamente borra la cuenta con su historial propio y no se puede deshacer; archivar y eliminar piden tu contraseña y sólo los hacen la administración general y la jefatura.'],
  },
  'registration-requests': {
    how: ['Revisa nombre, matrícula, correo y grupo de cada alumno que confirmó su correo.', 'Pulsa "Aprobar" para crear la cuenta, o "Rechazar" e indica el motivo.', 'La lista se actualiza sola cuando llegan solicitudes nuevas.'],
    affects: ['Aprobar crea la cuenta en el grupo elegido del periodo abierto y le avisa al alumno por correo; hace falta un periodo abierto.', 'Rechazar le envía el motivo; la solicitud rechazada se borra a los 90 días.', 'El contador de "Gestiones" baja en cuanto atiendes cada solicitud.'],
  },
  projects: (role) => role === 'teacher' ? {
    how: ['Abre un proyecto para ver su equipo, documentos, entregas y evaluaciones.', 'Usa los filtros de semestre y estado para encontrar tus asesorías.'],
    affects: ['Sólo ves los proyectos donde participas como asesor o revisor.', 'Lo que califiques o comentes lo ve el equipo del proyecto.'],
  } : {
    how: ['Filtra por semestre, estado o tipo y abre un proyecto para ver su detalle.', 'Con "Nuevo" registra uno; con las acciones de la fila edita equipo, materias, asesor o modalidad.', 'En la pestaña Residencias quedan los integradores de 9° marcados como residencia.'],
    affects: ['Los cambios de equipo o asesor se reflejan de inmediato en entregas, evaluaciones y en lo que ve cada alumno.', 'Marcar como residencia lo separa de los integradores y sólo aplica a proyectos de 9°.', 'Archivar lo oculta de listas y evaluaciones hasta restaurarlo; lo publicado en el repositorio sigue disponible.'],
  },
  proposals: (role) => ({
    student: {
      how: ['Aquí ves tu propuesta mientras se revisa y tu proyecto cuando se aprueba.', 'Mientras la ventana de propuestas esté abierta, registra la tuya con título, descripción e integrantes, o pide unirte a la de un compañero.', 'Revisa aquí el estado y las observaciones de quien la valida.'],
      affects: ['Sólo puedes estar en una propuesta; pedir unirte a otra queda pendiente hasta que un integrante responda.', 'Cuando la aprueban se convierte en tu proyecto y aparecen sus entregas.', 'Al cerrar la ventana ya no se pueden registrar ni cambiar propuestas.'],
    },
    teacher: {
      how: ['Abre cada propuesta pendiente y revisa su contenido e integrantes.', 'Apruébala o pide cambios con observaciones claras.'],
      affects: ['Al aprobar, la propuesta se vuelve proyecto y el equipo empieza a recibir entregas.', 'Si pides cambios, el equipo ve tus observaciones y puede corregirla mientras la ventana siga abierta.'],
    },
    staff: {
      how: ['En "Validar" aprueba o devuelve las propuestas pendientes.', 'En "Validadores" designa a los docentes que también pueden validar.', 'La ventana de propuestas se abre y se cierra en Operación del periodo.'],
      affects: ['Aprobar crea el proyecto con su equipo y lo suma a las listas de seguimiento.', 'Si la devuelves, el equipo ve tus observaciones y puede corregirla mientras la ventana siga abierta.', 'Los validadores designados pueden aprobar propuestas de la carrera.'],
    },
  })[role],
  deliverables: (role) => ({
    student: {
      how: ['Abre cada entregable para ver sus indicaciones y fecha límite.', 'Sube tu archivo antes del cierre; puedes reemplazarlo mientras siga abierto.'],
      affects: ['Lo que subas lo ve tu asesor y el resto de tu equipo.', 'Después de la fecha límite ya no se aceptan archivos.', 'Tu calificación y los comentarios aparecen aquí cuando el docente los registra.'],
    },
    teacher: {
      how: ['Usa la matriz para ver qué alumno entregó cada entregable.', 'Abre una entrega para descargarla, calificarla y dejar comentarios.'],
      affects: ['La calificación y los comentarios los ve el alumno al momento.', 'Puedes corregir una calificación mientras el entregable siga activo.'],
    },
    staff: {
      how: ['Crea entregables por materia y competencia, con fecha límite e indicaciones.', 'Filtra por materia o competencia para revisar las entregas y calificar.'],
      affects: ['Un entregable nuevo aparece a todos los alumnos inscritos en esa materia.', 'Cambiar la fecha límite cambia hasta cuándo pueden subir archivos.', 'Eliminar un entregable lo retira para los alumnos, pero los archivos ya entregados se conservan.'],
    },
  })[role],
  evaluations: {
    how: ['Elige la sala o el proyecto y abre su hoja de evaluación.', 'Califica cada criterio de la rúbrica y guarda; la pantalla se actualiza sola mientras otros evalúan.', 'En 5° marca también tu dictamen de viabilidad; cuando voten, coordinación pulsa «Confirmar dictamen» (sugiere el de la mayoría y pide motivo si lo cambias).'],
    affects: ['Cada evaluador registra su propia calificación con la rúbrica de la etapa.', 'Al confirmar el dictamen de 5°: «viable» deja el proyecto igual; «con correcciones» regresa la propuesta a corrección con un plazo; «no viable» cierra el proyecto y el equipo queda libre para otra propuesta. Se avisa al equipo y no se deshace.', 'Lo que guardes lo ven al momento los demás evaluadores de la sala.', 'Los resultados alimentan los reportes y el seguimiento del proyecto.'],
  },
  'evaluations-archived': {
    how: ['Busca evaluaciones de periodos anteriores por proyecto o periodo.', 'Descarga los reportes que necesites.'],
    affects: ['Es sólo consulta: lo archivado no cambia las evaluaciones del periodo actual.'],
  },
  'evaluation-rooms': {
    how: ['Crea la sala con la fecha y la hora de inicio, el salón, los proyectos en su orden y los docentes; la hora de fin se calcula sola.', 'Cada turno es exposición + preguntas y respuestas; entre proyectos hay una tolerancia (3 min por defecto).', 'Al bloquear el orden empieza la sala: el encargado inicia la exposición, el temporizador pasa a preguntas (solo o a mano) y "Siguiente" avanza el turno.'],
    affects: ['Todos los evaluadores ven el mismo temporizador en la sala y dentro de su rúbrica.', 'Los alumnos ven en su inicio qué turno va pasando, cuántos faltan y a qué hora pasarían; el siguiente equipo recibe "Te toca en el siguiente turno".', 'Los docentes y el salón quedan reservados en ese horario y no se pueden asignar a otra sala.'],
  },
  'evaluation-documents': (role) => role === 'student' ? {
    how: ['Sube la hoja de liberación, la presentación y, si tu etapa lo pide, el enlace o el reporte.', 'Revisa el estado de cada entrega y corrige las que tengan observaciones.'],
    affects: ['Tu equipo sólo puede presentar cuando todo está aprobado y al menos un integrante está liberado.', 'Subir otro archivo reemplaza el anterior y su revisión vuelve a empezar.', 'Si la coordinación niega tu presentación, aquí verás el aviso con el motivo.'],
  } : {
    how: ['Revisa cada entrega y apruébala o envía observaciones; en la hoja de liberación marca qué alumnos quedan liberados.', 'Con "Negar al equipo" o "Negar a" un alumno detienes su presentación por decisión administrativa; el motivo es opcional.', 'Con "Permitir de nuevo" retiras la negación.'],
    affects: ['Un equipo negado no puede ponerse en sala ni evaluarse en este periodo; un alumno negado no puede liberarse, pero su equipo sí presenta.', 'Los alumnos reciben el aviso en la app y por correo, con tu motivo o con «Se te impide continuar por una decisión administrativa».', 'Cada negación y cada permiso quedan en la bitácora con quién y cuándo.'],
  },
  subjects: {
    how: ['Registra las materias del plan con su semestre y sus competencias.', 'Edita o desactiva las que ya no se impartan.'],
    affects: ['Las materias y competencias se usan para organizar entregables, cursos y calificaciones.', 'Desactivar una materia la quita de los nuevos registros, sin borrar lo ya calificado.'],
  },
  advisors: {
    how: ['Elige el proyecto y asigna su asesor y revisores.', 'Consulta la carga de cada docente antes de asignar.'],
    affects: ['El asesor ve el proyecto en sus asesorías, recibe sus entregas y puede calificarlas.', 'Al reasignar, el proyecto pasa a las asesorías del nuevo docente.'],
  },
  companies: {
    how: ['Registra la empresa con sus datos de contacto.', 'Vincúlala a los proyectos o residencias que trabajen con ella.'],
    affects: ['Las empresas registradas aparecen al crear residencias y proyectos externos.'],
  },
  'period-center': {
    how: ['Sigue las etapas en orden: periodo, autoregistro, propuestas, evaluaciones y cierre.', 'Abre cada etapa para ver sus pendientes y abrir o cerrar su ventana.'],
    affects: ['Abrir el autoregistro permite que alumnos de los semestres marcados soliciten cuenta (5° si no marcas ninguno).', 'La ventana de propuestas controla cuándo y qué semestres registran propuestas; hay que marcar al menos uno.', 'Lo pendiente al cerrar el periodo no se borra: se avisa a la jefatura.'],
  },
  archive: {
    how: ['Elige el tipo (usuarios, proyectos, propuestas o grupos) y busca el elemento archivado.', 'Pulsa "Restaurar" para devolverlo al sistema.'],
    affects: ['Lo archivado no aparece en listas, búsquedas ni grupos, y sus cuentas no pueden iniciar sesión.', 'Restaurar lo vuelve a mostrar con todos sus datos.', 'Lo publicado en el repositorio público sigue disponible aunque esté archivado.'],
  },
  settings: {
    how: ['Ajusta los parámetros de la carrera y guarda cada sección.'],
    affects: ['Los cambios aplican a toda la carrera desde la siguiente vez que cada persona cargue la pantalla.'],
  },
  general: {
    how: ['Revisa el estado de las carreras y ajusta la configuración institucional.'],
    affects: ['Lo que cambies aquí aplica a todas las carreras.'],
  },
  notices: {
    how: ['Escribe el aviso, elige a quién va dirigido y su vigencia.', 'Desactívalo cuando ya no sea necesario.'],
    affects: ['El aviso aparece arriba de todas las pantallas para el público elegido mientras esté vigente.'],
  },
  tags: {
    how: ['Crea las etiquetas con las que se clasifican los documentos.'],
    affects: ['Las etiquetas ayudan a buscar en el repositorio; borrar una la quita de los documentos que la usan.'],
  },
  'career-modules': {
    how: ['Activa o desactiva los módulos que usa la carrera.'],
    affects: ['Un módulo desactivado desaparece del menú para todos los miembros de la carrera.'],
  },
  'career-setup': {
    how: ['Completa los datos de la carrera: nombre, claves, jefatura y reglas de correo.'],
    affects: ['Estos datos se usan en correos, documentos y en el autoregistro de alumnos.'],
  },
  careers: {
    how: ['Registra carreras, su clave y su jefatura.'],
    affects: ['Cada carrera tiene sus propios usuarios, periodos y configuración.'],
  },
  backups: {
    how: ['Genera un respaldo o descarga uno existente.'],
    affects: ['El respaldo incluye datos personales: guárdalo en un lugar seguro y no lo compartas.'],
  },
  operations: {
    how: ['Revisa las alertas por gravedad y atiende primero las críticas.', 'Marca cada alerta como resuelta al corregirla.'],
    affects: ['Las alertas resueltas dejan de contar en el aviso del menú.'],
  },
  integrity: {
    how: ['Ejecuta la revisión y corrige los registros que aparezcan con problemas.'],
    affects: ['Las correcciones cambian datos reales de la carrera; revisa antes de aplicar.'],
  },
  repository: {
    how: ['Busca por título, autor, etiqueta o periodo y abre el documento.', 'Si tienes permiso, sube documentos finales con sus etiquetas.'],
    affects: ['Lo que se publica aquí es público y sigue disponible aunque el proyecto se archive.'],
  },
  profile: {
    how: ['Actualiza tu foto, teléfono y datos de contacto.', 'Elige qué avisos recibir y el sonido de las notificaciones.'],
    affects: ['Tu foto y nombre se muestran a tu equipo, docentes y en la pantalla de bloqueo de la app.', 'Si desactivas un aviso, ya no te llega por correo ni al teléfono.'],
  },
  'academic:periods': {
    how: ['Los periodos se abren y cierran solos por fecha; aquí sólo acomodas a los alumnos que quedaron sin grupo.', 'Elige el grupo de cada uno y guarda; usa las opciones manuales sólo en casos especiales.'],
    affects: ['El alumno queda inscrito en ese grupo del periodo y desde ahí ve sus materias, proyecto, entregas y evaluaciones.', 'Cerrar un periodo a mano o confirmar una promoción mueve a todos los alumnos del lote.'],
  },
  'academic:courses': (role) => role === 'student' ? {
    how: ['Escribe la clave que te dio tu docente mientras la inscripción esté abierta.', 'Si necesitas darte de baja, indica el motivo.'],
    affects: ['Al inscribirte recibes los entregables y las calificaciones de la materia.', 'Una baja te quita los entregables pendientes de esa materia.'],
  } : {
    how: ['Abre la inscripción con una clave y una ventana de fechas, y compártela con el grupo.', 'En "Ver inscritos" revisa la lista y registra bajas.'],
    affects: ['Sólo los alumnos inscritos reciben los entregables del curso y pueden ser calificados. En las materias que la carrera eligió para avances, los equipos quedan inscritos solos.', 'Cambiar la clave invalida la anterior.'],
  },
  'academic:authorizations': {
    how: ['Elige el periodo, el tipo de excepción y llena sólo los campos que apliquen.', 'Escribe el motivo y la vigencia; jefatura o administración la resuelve en la lista de abajo.'],
    affects: ['Una autorización aprobada se usa una sola vez y vence en la fecha indicada.', 'Si eliges un alumno, la excepción no se extiende al resto del equipo salvo que se confirme el alcance.'],
  },
  'academic:memberships': {
    how: ['Elige a la persona y su nuevo perfil.', 'Antes, pulsa "Consultar compromisos" y reasigna cursos, salas, asesorías o residencias a su cargo.'],
    affects: ['Cambia lo que la persona ve y puede hacer en todo el sistema.', 'Sus compromisos pendientes quedarían sin responsable si no los reasignas.'],
  },
  'academic:residencies': {
    how: ['Crea el expediente con el residente, su proyecto y su asesor.', 'El alumno sube versiones de cada requisito; el asesor las valida o pide correcciones.'],
    affects: ['Cada versión queda en el historial del expediente.', 'Cerrar el seguimiento impide subir más versiones.'],
  },
  'tracking:courses': {
    how: ['Abre el tablero de tu materia. Si la carrera definió una plantilla, agrégala con un clic y ajusta las fechas. En cada avance eliges su competencia y los tipos de archivo que aceptas (PDF, Word…).', 'Pulsa «Abrir» en cada avance cuando quieras que los equipos lo vean; «Cerrar» deja de recibir entregas.', 'Toca una casilla del tablero para descargar, calificar con comentario, ajustar la calificación de un integrante o dar una prórroga a ese equipo.'],
    affects: ['Los equipos del grupo con la modalidad elegida por la carrera se ligan solos; agregar o quitar uno pide motivo y queda en la bitácora.', 'Abrir un avance avisa a los equipos; los borradores no los ven. Si el equipo reemplaza su archivo, la calificación se borra para revisarlo de nuevo.', 'Si pasan 5 días sin calificar una entrega, te llega un recordatorio.'],
  },
  'tracking:overview': {
    how: ['Revisa por materia y grupo cuántos avances se entregaron, cuántos vencieron y cuántos faltan por calificar.', 'Filtra por modalidad u ordena por lo más atrasado, y abre el tablero de la materia para ver el detalle.'],
    affects: ['Sólo consulta: no cambia nada. Las materias «Sin docente» no tienen quién abra ni califique sus avances; asígnalo en Propuestas.', 'Los lunes llega un resumen semanal a jefatura y coordinación cuando hay atrasos.'],
  },
  'tracking:config': {
    how: ['Usa un paquete de materias del semestre (o crea uno) y aplícalo; también puedes agregar materias sueltas y marcar sus modalidades: integrador, caso integrador o dual.', 'En cada materia define sus competencias y su plantilla de avances: competencia, semana sugerida, ponderación y tipos de archivo aceptados.'],
    affects: ['Los proyectos de cada grupo con esa modalidad quedan ligados a la materia en el periodo abierto, sin contraseña.', '«Aplicar y reemplazar» deja de pedir avances en las materias que no están en el paquete; lo entregado, las plantillas y las competencias se conservan.', 'Si un avance exige tipos de archivo, el alumno sólo puede subir ésos.'],
  },
  'academic:continuity': {
    how: ['Elige el proyecto y el grupo del periodo abierto donde seguirá.'],
    affects: ['El proyecto conserva su equipo, documentos y evaluaciones anteriores, sin crear uno nuevo.'],
  },
}

// Pantallas a las que una guía puede recomendar ir: ruta de la app, página de PHP por tipo de perfil y quién la abre
// (lo mismo que permiten el menú y la API). staff = coordinación, asistencia, jefatura y administración.
const SCREENS = {
  users: { label: 'Usuarios', app: '/users', php: '/pages/admin/users.php', who: 'users' },
  'registration-requests': { label: 'Solicitudes de cuenta', app: '/registration-requests', php: '/pages/admin/registration-requests.php', who: 'academic' },
  'period-center': { label: 'Operación del periodo', app: '/period-center', php: '/pages/admin/period-center.php', who: 'staff' },
  academic: { label: 'Seguimiento académico', app: '/academic-workflows', php: '/pages/academic-workflows.php', who: 'all' },
  courses: { label: 'Inscripciones a materias', app: '/academic-workflows?tab=courses', php: '/pages/academic-workflows.php?tab=courses', who: 'all' },
  residencies: { label: 'Residencias', app: '/academic-workflows?tab=residencies', php: '/pages/academic-workflows.php?tab=residencies', who: 'all' },
  proposals: { label: { student: 'Mi proyecto', teacher: 'Revisar propuestas', staff: 'Propuestas' }, app: '/proposals', php: { student: '/pages/student/proposal-register.php', teacher: '/pages/teacher/proposal-review.php', staff: '/pages/admin/proposal-config.php' }, who: 'all' },
  projects: { label: { teacher: 'Mis proyectos', staff: 'Proyectos y tesis' }, app: '/projects', php: { teacher: '/pages/teacher/my-projects.php', staff: '/pages/admin/projects.php' }, who: 'notStudent' },
  deliverables: { label: { student: 'Mis entregables', teacher: 'Entregables', staff: 'Entregables' }, app: '/deliverables', php: { student: '/pages/student/my-deliverables.php', teacher: '/pages/teacher/my-deliverables.php', staff: '/pages/admin/deliverables.php' }, who: 'all' },
  evaluations: { label: 'Evaluaciones', app: '/evaluations', php: '/pages/admin/evaluations.php', who: 'notStudent' },
  'evaluation-rooms': { label: 'Salas y turnos', app: '/evaluation-rooms', php: '/pages/admin/evaluation-rooms.php', who: 'notStudent' },
  'evaluation-documents': { label: 'Evidencias', app: '/evaluation-documents', php: '/pages/evaluation-documents.php', who: 'all' },
  advisors: { label: 'Asesores', app: '/advisors', php: '/pages/admin/advisors.php', who: 'staff' },
  subjects: { label: 'Asignaturas y competencias', app: '/subjects', php: '/pages/admin/asignaturas.php', who: 'academic' },
  archive: { label: 'Archivo histórico', app: '/archive', php: '/pages/admin/archive.php', who: 'admin' },
  notices: { label: 'Avisos del sistema', app: '/notices', php: '/pages/admin/notices.php', who: 'admin' },
  settings: { label: 'Ajustes', app: '/settings', php: '/pages/admin/settings.php', who: 'admin' },
  repository: { label: 'Repositorio', app: '/repository', php: '/pages/repositorio.php', who: 'all' },
  tracking: { label: 'Avances por materia', app: '/tracking', php: '/pages/tracking.php', who: 'notStudent' },
}

// "También te puede servir": a qué pantalla ir desde cada sección y para qué.
const RELATED = {
  users: [['registration-requests', 'Aprueba a los alumnos que se registraron solos.'], ['period-center', 'Abre o cierra el autoregistro de alumnos.'], ['advisors', 'Asigna docentes como asesores de proyectos.'], ['archive', 'Restaura usuarios enviados al archivo.']],
  'registration-requests': [['period-center', 'Abre, amplía o cierra el autoregistro.'], ['users', 'Revisa y edita las cuentas ya creadas.'], ['academic', 'Acomoda en su grupo a los alumnos pendientes.']],
  projects: (role) => role === 'teacher'
    ? [['deliverables', 'Califica las entregas de tus equipos.'], ['evaluations', 'Evalúa sus presentaciones.'], ['proposals', 'Revisa las propuestas pendientes.']]
    : [['proposals', 'Valida las propuestas que se convierten en proyecto.'], ['advisors', 'Asigna o cambia asesores.'], ['evaluation-rooms', 'Programa sus presentaciones.'], ['archive', 'Consulta o restaura proyectos archivados.']],
  proposals: (role) => ({
    student: [['deliverables', 'Sube los entregables de tu proyecto.'], ['evaluation-documents', 'Sube tu hoja de liberación y tu presentación.'], ['courses', 'Inscríbete a tus materias.']],
    teacher: [['projects', 'Consulta los proyectos que asesoras.'], ['deliverables', 'Califica sus entregas.']],
    staff: [['period-center', 'Abre o cierra la ventana de propuestas.'], ['projects', 'Consulta las propuestas ya aprobadas.'], ['advisors', 'Asigna asesores a los proyectos nuevos.']],
  })[role],
  deliverables: (role) => ({
    student: [['proposals', 'Revisa el estado de tu proyecto.'], ['evaluation-documents', 'Prepara tus evidencias de evaluación.']],
    teacher: [['evaluations', 'Evalúa las presentaciones.'], ['projects', 'Consulta tus asesorías.']],
    staff: [['subjects', 'Configura materias y competencias.'], ['projects', 'Revisa los proyectos y sus equipos.'], ['evaluations', 'Da seguimiento a las evaluaciones.']],
  })[role],
  evaluations: [['evaluation-rooms', 'Programa salas, docentes y turnos.'], ['evaluation-documents', 'Revisa las evidencias de cada equipo.']],
  'evaluation-rooms': [['evaluations', 'Califica con la rúbrica.'], ['evaluation-documents', 'Comprueba que cada equipo pueda presentar.'], ['projects', 'Consulta los equipos y su semestre.']],
  'evaluation-documents': (role) => role === 'student'
    ? [['proposals', 'Revisa tu proyecto y su equipo.'], ['deliverables', 'Sube tus entregables.']]
    : [['evaluation-rooms', 'Programa la presentación de los equipos listos.'], ['evaluations', 'Califica las presentaciones.']],
  subjects: [['courses', 'Abre la inscripción a las materias.'], ['deliverables', 'Crea entregables por materia.']],
  advisors: [['projects', 'Consulta los proyectos y sus equipos.'], ['users', 'Revisa a los docentes de la carrera.']],
  'period-center': [['registration-requests', 'Atiende las solicitudes de cuenta.'], ['proposals', 'Valida las propuestas.'], ['academic', 'Acomoda alumnos y revisa el periodo.'], ['evaluation-rooms', 'Programa las evaluaciones.']],
  archive: [['users', 'Gestiona las cuentas activas e inactivas.'], ['projects', 'Consulta los proyectos vigentes.']],
  notices: [['settings', 'Ajusta la configuración de la carrera.']],
  settings: [['notices', 'Publica avisos para la carrera.']],
  'academic:periods': [['period-center', 'Sigue las etapas del periodo en orden.'], ['users', 'Revisa a los alumnos y sus grupos.']],
  'academic:courses': (role) => role === 'student' ? [['deliverables', 'Consulta los entregables de tus materias.']] : [['subjects', 'Configura las materias.'], ['deliverables', 'Crea entregables para el curso.']],
  'tracking:courses': [['deliverables', 'Consulta todas las entregas de tus materias.'], ['projects', 'Revisa los equipos y sus integrantes.']],
  'tracking:overview': [['proposals', 'Asigna docentes a las materias sin responsable.'], ['projects', 'Revisa la modalidad de los proyectos.']],
  'tracking:config': [['subjects', 'Da de alta las materias de la carrera.'], ['proposals', 'Asigna el docente de cada materia y grupo.']],
  'academic:residencies': [['evaluation-documents', 'Revisa las evidencias de evaluación.'], ['projects', 'Consulta los proyectos de residencia.']],
  'academic:memberships': [['users', 'Edita los datos de la persona.'], ['advisors', 'Reasigna sus asesorías.']],
}

function allowed(who, user) {
  const profile = Number(user?.active_profile_id ?? user?.perfil_id)
  const general = Boolean(user?.is_general_admin) || profile === 4
  return {
    all: true,
    notStudent: profile !== 3,
    staff: general || [1, 5, 6, 7].includes(profile),
    academic: general || [1, 5, 6].includes(profile),
    users: general || [5, 6, 7].includes(profile),
    admin: general || [1, 5].includes(profile),
  }[who] ?? false
}

/** Pantallas relacionadas que el perfil puede abrir: [{ key, label, why, app, php }]. */
export function relatedFor(key, user) {
  const role = roleOf(user)
  const list = typeof RELATED[key] === 'function' ? RELATED[key](role) : RELATED[key]
  return (list || []).map(([screen, why]) => {
    const target = SCREENS[screen]
    if (!target || !allowed(target.who, user)) return null
    const pick = (value) => (value && typeof value === 'object' ? value[role] : value)
    const php = pick(target.php)
    return php ? { key: screen, label: pick(target.label), why, app: target.app, php } : null
  }).filter(Boolean)
}

/** Clave de la guía para una ruta de la app (pathname) o una página de PHP. */
export function guideKeyFor(path, search = '') {
  const clean = String(path || '').replace(/\/+$/, '') || '/'
  const match = ROUTES.find(([, app, php]) => app.includes(clean) || php.includes(clean))
  if (!match) return null
  if (match[0] !== 'academic') return match[0]
  return `academic:${new URLSearchParams(search).get('tab') || 'periods'}`
}

export function guideFor(key, user) {
  const guide = GUIDES[key]
  const resolved = typeof guide === 'function' ? guide(roleOf(user)) : guide
  return resolved?.how?.length ? resolved : null
}

const el = (tag, text, className) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = String(text)
  return node
}
const icon = (path) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'sg-icon')
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  shape.setAttribute('d', path); shape.setAttribute('fill', 'currentColor'); svg.append(shape)
  return svg
}
const INFO = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'
const STEPS = 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z'
const EFFECT = 'M12 2 1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z'

/**
 * Pinta la guía en `root`. Al aparecer se muestra abierta y se pliega sola a los pocos segundos (se pausa mientras
 * el puntero o el foco están encima). Si la persona la vuelve a abrir, se queda abierta hasta que la cierre.
 */
const ARROW = 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z'

/** Tarjetas "También te puede servir"; en la app `go` navega sin recargar, en la web es un enlace normal. */
function relatedBlock(items, target, go) {
  const section = el('nav', undefined, 'sg-related')
  section.setAttribute('aria-label', 'Pantallas relacionadas')
  section.append(el('span', 'También te puede servir', 'sg-related-title'))
  const grid = el('div', undefined, 'sg-related-grid')
  for (const item of items) {
    const link = el('a', undefined, 'sg-related-card')
    link.href = item[target]
    const text = el('span', undefined, 'sg-related-text')
    text.append(el('strong', item.label), el('small', item.why))
    link.append(text, icon(ARROW))
    if (go) link.onclick = (event) => { event.preventDefault(); go(item[target]) }
    grid.append(link)
  }
  section.append(grid)
  return section
}

export function mountSectionGuide(root, { user, key, go = null, target = 'php' }) {
  let current = key
  let open = true
  let pinned = false
  let timer = null
  const clear = () => { window.clearTimeout(timer); timer = null }
  const schedule = () => {
    clear()
    if (!pinned && open) timer = window.setTimeout(() => { open = false; render() }, AUTO_HIDE_MS)
  }

  function render() {
    const guide = guideFor(current, user)
    root.hidden = !guide
    if (!guide) { root.replaceChildren(); clear(); return }
    const box = el('aside', undefined, `sg-guide${open ? '' : ' collapsed'}${open && !pinned ? ' auto' : ''}`)
    box.setAttribute('aria-label', 'Cómo usar esta sección')
    const head = el('div', undefined, 'sg-head')
    const toggle = el('button', open ? 'Ocultar' : 'Ver guía', 'sg-toggle')
    toggle.type = 'button'
    toggle.setAttribute('aria-expanded', String(open))
    toggle.onclick = () => {
      open = !open
      // Abierta a mano ya no se cierra sola.
      pinned = open
      render()
    }
    head.append(icon(INFO), el('strong', 'Cómo usar esta sección'), toggle)
    box.append(head)
    if (open) {
      const body = el('div', undefined, 'sg-body')
      for (const [title, path, items, ordered] of [['Cómo hacerlo', STEPS, guide.how, true], ['Qué afecta', EFFECT, guide.affects || [], false]]) {
        if (!items.length) continue
        const column = el('section', undefined, 'sg-col')
        const caption = el('h3', undefined, 'sg-caption')
        caption.append(icon(path), el('span', title))
        const list = el(ordered ? 'ol' : 'ul')
        for (const item of items) list.append(el('li', item))
        column.append(caption, list)
        body.append(column)
      }
      box.append(body)
      // Barra que se vacía mientras corre el cierre automático; se detiene con el puntero o el foco encima.
      const bar = () => el('div', undefined, 'sg-timer')
      if (!pinned) box.append(bar())
      const hold = () => { clear(); box.querySelector('.sg-timer')?.remove() }
      box.onmouseenter = hold
      box.onfocusin = hold
      box.onmouseleave = () => {
        if (pinned || !open || box.contains(document.activeElement)) return
        box.append(bar()); schedule()
      }
    }
    const related = relatedFor(current, user).filter((item) => !window.location.href.endsWith(item[target]))
    root.replaceChildren(box, ...(related.length ? [relatedBlock(related, target, go)] : []))
    schedule()
  }

  // Al cambiar de pestaña se muestra la guía de la nueva sección, otra vez abierta salvo que ya estuviera fijada.
  const onKey = (event) => {
    const next = event.detail?.key
    if (!next || next === current) return
    current = next
    if (!pinned) open = true
    render()
  }
  window.addEventListener(GUIDE_EVENT, onKey)
  render()
  return () => { clear(); window.removeEventListener(GUIDE_EVENT, onKey); root.replaceChildren() }
}
