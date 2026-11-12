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
]

const GUIDES = {
  users: {
    how: ['Busca por nombre, número de control o correo y filtra por perfil o estado.', 'Para dar de alta a varios, descarga la plantilla de Excel, llénala y súbela; para uno solo usa "Nuevo usuario".', 'Edita, desactiva o manda al archivo histórico desde las acciones de cada fila.'],
    affects: ['La contraseña inicial de una cuenta nueva es su número de control; se le pide cambiarla al entrar.', 'Desactivar impide iniciar sesión pero conserva todo; archivar además lo oculta de listas, grupos y búsquedas hasta restaurarlo.', 'Cambiar el perfil cambia lo que ve y puede hacer en todo el sistema desde su siguiente acción.'],
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
      how: ['Mientras la ventana de propuestas esté abierta, registra la tuya con título, descripción e integrantes, o pide unirte a la de un compañero.', 'Revisa aquí el estado y las observaciones de quien la valida.'],
      affects: ['Sólo puedes estar en una propuesta; pedir unirte a otra queda pendiente hasta que un integrante responda.', 'Cuando la aprueban se convierte en tu proyecto y aparecen sus entregas.', 'Al cerrar la ventana ya no se pueden registrar ni cambiar propuestas.'],
    },
    teacher: {
      how: ['Abre cada propuesta pendiente y revisa su contenido e integrantes.', 'Apruébala o pide cambios con observaciones claras.'],
      affects: ['Al aprobar, la propuesta se vuelve proyecto y el equipo empieza a recibir entregas.', 'Si pides cambios, el equipo ve tus observaciones y puede corregirla mientras la ventana siga abierta.'],
    },
    staff: {
      how: ['En "Revisión" aprueba o devuelve las propuestas pendientes.', 'En la configuración abre la ventana de propuestas, define el semestre de alumnos nuevos y designa a los docentes validadores.'],
      affects: ['La ventana controla cuándo pueden registrar propuestas los alumnos; al cerrarla ya no se aceptan.', 'Los validadores designados pueden aprobar propuestas de la carrera.', 'Aprobar crea el proyecto con su equipo y lo suma a las listas de seguimiento.'],
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
    how: ['Elige la sala o el proyecto y abre su hoja de evaluación.', 'Califica cada criterio de la rúbrica y guarda; la pantalla se actualiza sola mientras otros evalúan.'],
    affects: ['Cada evaluador registra su propia calificación con la rúbrica de la etapa.', 'Lo que guardes lo ven al momento los demás evaluadores de la sala.', 'Los resultados alimentan los reportes y el seguimiento del proyecto.'],
  },
  'evaluations-archived': {
    how: ['Busca evaluaciones de periodos anteriores por proyecto o periodo.', 'Descarga los reportes que necesites.'],
    affects: ['Es sólo consulta: lo archivado no cambia las evaluaciones del periodo actual.'],
  },
  'evaluation-rooms': {
    how: ['Crea una sala con salón, fecha, responsable y docentes evaluadores.', 'Agrega los proyectos en el orden en que presentarán.', 'Durante el evento, inicia y cierra cada turno desde la sala.'],
    affects: ['Los docentes asignados ven la sala en su agenda y pueden evaluar a esos proyectos.', 'Los alumnos ven su fecha y turno de presentación.', 'Cambiar horario u orden se refleja al momento en todas las pantallas de la sala.'],
  },
  'evaluation-documents': {
    how: ['Elige el proyecto y la etapa, y sube la presentación o el documento de evaluación.'],
    affects: ['Los evaluadores lo consultan durante la sala; subir otro reemplaza la versión anterior.'],
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
    affects: ['Abrir el autoregistro permite que alumnos nuevos soliciten cuenta en el semestre elegido.', 'La ventana de propuestas controla cuándo pueden registrarse.', 'Lo pendiente al cerrar el periodo no se borra: se avisa a la jefatura.'],
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
    affects: ['Sólo los alumnos inscritos reciben los entregables del curso y pueden ser calificados.', 'Cambiar la clave invalida la anterior.'],
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
  'academic:continuity': {
    how: ['Elige el proyecto y el grupo del periodo abierto donde seguirá.'],
    affects: ['El proyecto conserva su equipo, documentos y evaluaciones anteriores, sin crear uno nuevo.'],
  },
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
export function mountSectionGuide(root, { user, key }) {
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
    root.replaceChildren(box)
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
