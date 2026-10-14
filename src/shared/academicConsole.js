// Shared by the React and PHP clients. All user-provided content is rendered as text.
export function mountAcademicConsole(root, api, user, initialTab = 'periods') {
  let disposed = false
  let tab = initialTab
  let catalog
  const profile = Number(user.active_profile_id ?? user.perfil_id)
  const general = Boolean(user.is_general_admin) || profile === 4
  const manager = general || [1, 5].includes(profile)
  const academic = manager || profile === 6
  const student = profile === 3
  const el = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), attrs, text === undefined ? {} : { textContent: String(text) })
  const error = (e) => e.response?.data?.message || e.response?.data?.error || Object.values(e.response?.data?.errors || {}).flat().join(' ') || e.message || 'No fue posible completar la operación.'
  const panel = (title, parent) => { const node = el('section', undefined, { className: 'panel', style: 'padding:20px;margin-bottom:16px' }); node.append(el('h2', title)); parent.append(node); return node }
  const button = (label, action, parent) => {
    const node = el('button', label, { type: 'button', className: 'btn btn-outline-primary', style: 'margin:4px' })
    node.onclick = async () => { node.disabled = true; try { await action() } catch (e) { status.textContent = error(e) } finally { node.disabled = false } }
    parent.append(node); return node
  }
  const input = (form, title, name, type = 'text', value = '', required = true) => {
    const label = el('label', title, { style: 'display:block;margin:10px 0' })
    const field = el('input', undefined, { name, type, value: type === 'checkbox' ? 'on' : (value ?? ''), required, className: 'form-control' })
    label.append(field); form.append(label); return field
  }
  const select = (form, title, name, options, value = '', required = true) => {
    const label = el('label', title, { style: 'display:block;margin:10px 0' })
    const field = el('select', undefined, { name, required, className: 'form-select' })
    field.append(el('option', 'Selecciona', { value: '' }))
    for (const [id, text] of options) field.append(el('option', text, { value: String(id) }))
    field.value = value == null ? '' : String(value); label.append(field); form.append(label); return field
  }
  const form = (parent, submitLabel, submit) => {
    const node = el('form'); parent.append(node)
    const finish = () => {
      const send = el('button', submitLabel, { type: 'submit', className: 'btn btn-primary' }); node.append(send)
      node.onsubmit = async (event) => {
        event.preventDefault(); send.disabled = true; status.textContent = 'Guardando…'
        try { await submit(Object.fromEntries(new FormData(node))); status.textContent = 'Operación completada.'; await render() }
        catch (e) { status.textContent = error(e) }
        finally { send.disabled = false }
      }
    }
    return [node, finish]
  }
  const periods = () => catalog.periods.map(p => [p.id, p.nombre])
  const projects = () => catalog.projects.map(p => [p.id, p.titulo])
  const members = (roles) => catalog.members.filter(m => roles.includes(Number(m.perfil_id))).map(m => [m.usuario_id, `${m.nombres} ${m.apellido_paterno} · ${m.usuario_id}`])
  const groups = (items = catalog.groups) => items.map(g => [g.id, `${g.nombre} · ${g.semestre}° ${g.grupo || g.clave_grupo || ''}`])
  const date = value => value ? new Date(value).toLocaleString('es-MX') : '—'
  const request = (method, url, body) => api(method, url, body)
  const status = el('p', '', { role: 'status', ariaLive: 'polite' })
  const nav = el('nav', undefined, { ariaLabel: 'Operación académica', style: 'margin-bottom:16px' })
  const content = el('div')
  root.replaceChildren(nav, status, content)
  const tabs = [...(academic ? [['periods', 'Periodos y matrícula']] : []), ['courses', student ? 'Mis materias' : 'Inscripciones'], ...(!student ? [['authorizations', 'Autorizaciones']] : []), ...(manager ? [['memberships', 'Perfiles']] : []), ['residencies', 'Residencias'], ...(!student ? [['continuity', 'Continuidad']] : [])]
  if (!tabs.some(([id]) => id === tab)) tab = tabs[0][0]
  for (const [id, label] of tabs) button(label, async () => { tab = id; await render() }, nav)

  async function renderPeriods() {
    const data = await request('GET', '/semester-management')
    if (data.scheduler) content.append(el('p', `Última preparación automática: ${date(data.scheduler.updated_at)} · ${data.scheduler.estado}`))
    else content.append(el('p', 'Todavía no se ha registrado una preparación automática.'))
    const section = panel('Periodos por carrera', content)
    for (const p of data.periods) {
      const row = el('article', undefined, { style: 'padding:12px;border-bottom:1px solid #aaa' })
      row.append(el('strong', `${p.nombre} · ${p.operacion?.estado || 'sin preparar'} · ${p.operacion?.conciliado ? 'conciliado' : 'requiere conciliación'}`))
      if (manager) {
        button('Conciliar', () => reconciliation(p), row)
        for (const [state, label] of [['abierto', 'Abrir'], ['en_cierre', 'Iniciar cierre'], ['cerrado', 'Cerrar']]) button(label, async () => { await request('POST', `/semester-management/periods/${p.id}/transition`, { state }); await render() }, row)
      }
      button('Preparar promoción', () => promotion(p), row); section.append(row)
    }
    if (general) {
      const p = panel('Calendario institucional', content)
      const [f, done] = form(p, 'Crear periodo', d => request('POST', '/semester-management/periods', { ...d, automatic_promotion: false }))
      input(f, 'Nombre', 'name'); input(f, 'Inicio', 'starts_at', 'date'); input(f, 'Fin', 'ends_at', 'date'); done()
    }
    const p = panel('Asignar matrícula del periodo abierto', content)
    const [f, done] = form(p, 'Guardar matrícula', d => request('POST', '/academic-operations/enrollments', { student_id: d.student_id, group_id: Number(d.group_id) }))
    select(f, 'Alumno', 'student_id', members([3])); select(f, 'Grupo', 'group_id', groups()); done()
  }

  async function promotion(period) {
    const preview = await request('GET', `/semester-management/periods/${period.id}/promotion-preview`)
    content.replaceChildren(); const p = panel(`Promoción a ${period.nombre}`, content)
    p.append(el('p', 'Resuelve todos los movimientos. Noveno permanece en seguimiento; no se declara egreso.'))
    const [f, done] = form(p, manager ? 'Confirmar lote' : 'Sólo preparación: requiere jefatura o administrador', async () => {
      const movements = rows.map(r => ({ student_id: r.student, action: r.action.value, group_id: r.group.value ? Number(r.group.value) : null, reason: r.reason.value }))
      await request('POST', `/semester-management/periods/${period.id}/promote`, { operation_id: operationId, snapshot: preview.snapshot, movements })
    })
    const operationId = crypto.randomUUID()
    const rows = preview.movements.map((m, i) => {
      const box = panel(`${m.student_id} · ${m.from}° → ${m.to}°`, f)
      if (m.pending) box.append(el('p', m.pending))
      return { student: m.student_id, action: select(box, 'Movimiento', `action${i}`, [['avance', 'Avance'], ['permanencia', 'Permanencia'], ['salida', 'Salida del seguimiento']], m.action), group: select(box, 'Grupo destino', `group${i}`, groups(preview.groups), m.group_id, false), reason: input(box, 'Motivo', `reason${i}`) }
    })
    if (manager) done()
    else p.append(el('p', 'Solicita a jefatura o administración la confirmación del lote.'))
    button('Volver', render, p)
  }

  async function reconciliation(period) {
    const report = await request('GET', `/academic-operations/periods/${period.id}/reconciliation`)
    content.replaceChildren(); const p = panel(`Conciliación · ${period.nombre}`, content)
    p.append(el('p', 'Compara cada matrícula. Dejar grupo vacío excluye al alumno de este periodo y requiere un motivo.'))
    for (const old of report.legacy_exceptions) p.append(el('p', `Autorización histórica #${old.id}, proyecto ${old.proyecto_id}: ${old.motivo}. Debe revisarse y solicitarse nuevamente con alcance explícito.`))
    const [f, done] = form(p, 'Aplicar conciliación', async d => {
      await request('POST', `/academic-operations/periods/${period.id}/reconciliation`, { snapshot: report.snapshot,
        room_resolutions: roomRows.map(r => ({ room_id: r.id, period_id: Number(r.period.value), classroom_id: Number(r.classroom.value), reason: r.reason.value })),
        acknowledge_legacy_exceptions: d.ack === 'on', resolutions: rows.map(r => ({ student_id: r.student, group_id: r.group.value ? Number(r.group.value) : null, reason: r.reason.value })) })
    })
    const rows = report.students.map((s, i) => {
      const box = panel(`${s.name} · ${s.student_id}`, f)
      if (s.issue) box.append(el('p', s.issue))
      return { student: s.student_id, group: select(box, 'Grupo confirmado', `group${i}`, groups(report.groups), s.group_id, false), reason: input(box, 'Motivo / fuente verificada', `reason${i}`) }
    })
    const roomRows = (report.rooms || []).map((r, i) => {
      const box = panel(`Sala histórica #${r.id} · ${r.nombre || r.salon}`, f)
      box.append(el('p', `Periodos de los grupos originales: ${(r.candidate_periods || []).join(', ') || 'sin evidencia'}. Verifica el calendario antes de confirmar.`))
      return { id: r.id, period: select(box, 'Periodo confirmado', `roomPeriod${i}`, catalog.periods.map(p => [p.id, p.nombre]), r.periodo_id),
        classroom: select(box, 'Salón institucional', `roomClassroom${i}`, catalog.rooms.map(c => [c.id, c.nombre]), r.salon_id), reason: input(box, 'Fuente de verificación', `roomReason${i}`) }
    })
    input(f, 'He revisado las excepciones históricas y entiendo que requieren nueva autorización', 'ack', 'checkbox', '', report.legacy_exceptions.length > 0)
    done(); button('Volver', render, p)
  }

  async function renderCourses() {
    const data = await request('GET', '/course-enrollments')
    if (!data.data.length) content.append(el('p', 'No hay cursos en el periodo abierto de esta carrera.'))
    for (const c of data.data) {
      const p = panel(`${c.subject?.nombre || 'Materia'} · ${c.group?.semestre}° ${c.group?.grupo || ''}`, content)
      p.append(el('p', `Ventana: ${date(c.inscripcion_desde)} — ${date(c.inscripcion_hasta)}`))
      if (student) {
        if (!c.inscrito) {
          const [f, done] = form(p, 'Inscribirme', d => request('POST', `/course-enrollments/${c.id}`, d)); input(f, 'Clave del docente', 'password', 'password'); done()
        } else {
          p.append(el('strong', 'Inscrito'))
          const [f, done] = form(p, 'Solicitar baja directa', d => request('DELETE', `/course-enrollments/${c.id}`, d)); input(f, 'Motivo de baja', 'reason'); done()
        }
      } else {
        const [f, done] = form(p, 'Abrir inscripción / renovar clave', d => request('PUT', `/courses/${c.id}/self-enrollment`, { enabled: true, password: d.password, password_confirmation: d.password, starts_at: d.start, ends_at: d.end }))
        input(f, 'Nueva clave (mínimo 6 caracteres)', 'password', 'password').minLength = 6
        input(f, 'Apertura', 'start', 'datetime-local'); input(f, 'Cierre', 'end', 'datetime-local'); done()
        button('Cerrar autorregistro', async () => { await request('PUT', `/courses/${c.id}/self-enrollment`, { enabled: false }); await render() }, p)
        button('Ver inscritos', async () => {
          const data = await request('GET', `/courses/${c.id}/students`)
          const box = panel('Matrícula del curso', p)
          for (const s of data.data) box.append(el('p', `${s.id} · ${s.nombres} ${s.apellido_paterno} · ${s.pivot?.activo ? 'activo' : 'baja'}`))
          if (academic) { const [f, done] = form(box, 'Registrar baja administrativa', d => request('DELETE', `/course-enrollments/${c.id}`, d)); select(f, 'Alumno', 'student_id', data.data.map(s => [s.id, `${s.id} ${s.nombres}`])); input(f, 'Motivo', 'reason'); done() }
        }, p)
      }
    }
  }

  async function renderAuthorizations() {
    const data = await request('GET', '/academic-operations/authorizations')
    const p = panel('Solicitar autorización', content)
    const [f, done] = form(p, 'Registrar solicitud', d => request('POST', '/academic-operations/authorizations', {
      ...d, period_id: Number(d.period_id), project_id: d.project_id ? Number(d.project_id) : null,
      presentation_semester: d.presentation_semester ? Number(d.presentation_semester) : null,
      evaluation_id: d.evaluation_id ? Number(d.evaluation_id) : null, student_id: d.student_id || null,
      course_id: d.course_id ? Number(d.course_id) : null,
    }))
    select(f, 'Periodo', 'period_id', periods()); select(f, 'Tipo', 'type', [['presentacion_semestre', 'Presentación en otra etapa'], ['reprogramacion', 'Reprogramación'], ['reintento', 'Nuevo intento'], ...(manager ? [['inscripcion_semestre', 'Inscripción en otro semestre']] : [])])
    select(f, 'Proyecto (obligatorio para evaluaciones)', 'project_id', projects(), '', false)
    select(f, 'Alumno involucrado (no autoriza automáticamente al equipo)', 'student_id', members([3]), '', false)
    select(f, 'Etapa de presentación', 'presentation_semester', [5, 6, 7, 8].map(n => [n, `${n}°`]), '', false)
    select(f, 'Evaluación de origen', 'evaluation_id', (catalog.evaluations || []).map(e => [e.id, `${e.project?.title || e.project?.titulo || e.project_id} · ${e.semestre}° · ${e.estado} (#${e.id})`]), '', false)
    select(f, 'Materia (para inscripción excepcional)', 'course_id', (catalog.courses || []).map(c => [c.id, `${c.subject?.nombre} · ${c.group?.semestre}° ${c.group?.grupo || ''}`]), '', false)
    input(f, 'Motivo', 'reason'); input(f, 'Vigencia hasta', 'expires_at', 'datetime-local'); done()
    for (const a of data.data) {
      const box = panel(`${a.tipo} · ${a.estado}`, content); box.append(el('p', `Proyecto ${a.proyecto_id || '—'} · ${a.motivo} · vigencia ${date(a.vigente_hasta)}`))
      if (manager && ['solicitada', 'aprobada'].includes(a.estado) && !a.consumida_en) {
        const [f, done] = form(box, 'Registrar resolución', d => request('PUT', `/semester-management/exceptions/${a.id}/decision`, { version: a.version, status: d.status, reason: d.reason, project_scope: d.scope === 'on' }))
        select(f, 'Decisión', 'status', a.estado === 'solicitada' ? [['aprobada', 'Aprobar'], ['rechazada', 'Rechazar']] : [['revocada', 'Revocar']]); input(f, 'Motivo de resolución', 'reason'); input(f, 'Confirmo el alcance sobre todo el proyecto al aprobar', 'scope', 'checkbox', '', false); done()
      }
    }
  }

  async function renderMemberships() {
    const p = panel('Perfiles operativos de miembros actuales', content)
    p.append(el('p', 'Administración general gestiona altas, cambios de carrera, jefaturas y administradores. Los compromisos pendientes deben reasignarse antes de cambiar un perfil.'))
    const [f, done] = form(p, 'Asignar perfil', d => request('PUT', `/academic-operations/memberships/${d.membership}`, { profile_id: Number(d.profile_id) }))
    const field = select(f, 'Persona', 'membership', catalog.members.filter(m => [2, 3, 6, 7].includes(Number(m.perfil_id))).map(m => [m.id, `${m.nombres} ${m.apellido_paterno} · perfil ${m.perfil_id}`]))
    select(f, 'Perfil', 'profile_id', [[2, 'Docente'], [3, 'Estudiante'], [6, 'Asistencia'], [7, 'Coordinación']]); done()
    button('Consultar compromisos', async () => { if (!field.value) return; const commitments = await request('GET', `/academic-operations/memberships/${field.value}/commitments`); const box = panel('Compromisos pendientes', p); for (const [key, ids] of Object.entries(commitments)) box.append(el('p', `${({ courses: 'Cursos', rooms: 'Salas', projects: 'Asesorías', residencies: 'Residencias' })[key]}: ${ids.join(', ') || 'ninguno'}`)) }, p)
    if (general) { const box = panel('Catálogo institucional de salones', content); const [f, done] = form(box, 'Agregar salón', d => request('POST', '/academic-operations/classrooms', d)); input(f, 'Nombre del salón', 'name'); done() }
  }

  async function renderContinuity() {
    const p = panel('Seguimiento del proyecto en el periodo abierto', content)
    const [f, done] = form(p, 'Registrar continuidad', d => request('POST', '/academic-operations/project-period', { project_id: Number(d.project_id), group_id: Number(d.group_id) }))
    select(f, 'Proyecto', 'project_id', projects()); select(f, 'Grupo del periodo', 'group_id', groups()); done()
    p.append(el('p', 'La continuidad conserva el grupo, documentos y evaluaciones de los periodos anteriores.'))
  }

  async function renderResidencies() {
    const data = await request('GET', '/residencies')
    if (student || academic) {
      const p = panel('Nuevo expediente individual de residencia', content)
      const [f, done] = form(p, 'Crear expediente', d => {
        const project = catalog.projects.find(p => Number(p.id) === Number(d.project_id))
        return request('POST', '/residencies', { ...d, student_id: student ? user.id : d.student_id, period_id: Number(d.period_id), project_id: Number(d.project_id), company_id: project?.empresa_id })
      })
      if (!student) select(f, 'Residente', 'student_id', members([3]))
      select(f, 'Periodo', 'period_id', periods()); select(f, 'Proyecto asociado', 'project_id', projects())
      select(f, 'Origen', 'origin', [['empresa', 'Proyecto nuevo de empresa'], ['continuacion', 'Continuación del integrador']])
      select(f, 'Asesor asignado al proyecto', 'advisor_id', student ? (catalog.advisors || []).map(a => [a.id, `${a.nombres} ${a.apellido_paterno}`]) : members([1, 2, 5, 6, 7]))
      input(f, 'Alcance y cambios propuestos (mínimo 20 caracteres)', 'changes').minLength = 20; done()
    }
    for (const r of data.data) {
      const box = panel(`Residencia · ${r.estudiante_id} · ${r.estado}`, content)
      box.append(el('p', r.cambios_propuestos))
      for (const item of r.requirements) {
        const sub = panel(`${item.nombre}${item.obligatorio ? ' · obligatorio' : ''}`, box)
        for (const v of item.versions) {
          const line = el('div'); line.append(el('p', `Versión ${v.numero} · ${v.nombre} · ${v.estado} · ${v.observaciones || 'Sin observaciones'}`))
          button('Descargar', () => request('DOWNLOAD', `/residencies/${r.id}/versions/${v.id}/download`, { name: v.nombre }), line)
          if (r.estado === 'abierta' && String(user.id) === String(r.asesor_id) && v.estado === 'pendiente') {
            const [f, done] = form(line, 'Guardar revisión', d => request('PUT', `/residencies/${r.id}/versions/${v.id}/review`, d)); select(f, 'Resultado', 'status', [['correcciones', 'Solicitar correcciones'], ['validada', 'Validar']]); input(f, 'Observaciones', 'observations'); done()
          }
          sub.append(line)
        }
        if (r.estado === 'abierta' && String(user.id) === String(r.estudiante_id)) {
          const [f, done] = form(sub, 'Subir nueva versión', async () => { const data = new FormData(); data.append('file', file.files[0]); await request('POST', `/residencies/${r.id}/requirements/${item.id}/versions`, data) }); const file = input(f, 'Documento PDF o Word', 'file', 'file'); file.accept = '.pdf,.doc,.docx'; done()
        }
      }
      if (r.estado === 'abierta' && (academic || String(user.id) === String(r.asesor_id))) {
        const [f, done] = form(box, 'Agregar requisito documental', d => request('POST', `/residencies/${r.id}/requirements`, { name: d.name, required: d.required === 'on', deadline: d.deadline || null })); input(f, 'Nombre del requisito', 'name'); input(f, 'Obligatorio', 'required', 'checkbox', '', false).checked = true; input(f, 'Fecha límite opcional', 'deadline', 'datetime-local', '', false); done()
      }
      if (manager && r.estado === 'abierta') {
        const [af, adone] = form(box, 'Reasignar asesor', d => request('PUT', `/residencies/${r.id}/advisor`, { advisor_id: d.advisor_id, version: r.version, reason: d.reason }))
        select(af, 'Nuevo asesor asignado al proyecto', 'advisor_id', members([1, 2, 5, 6, 7]), r.asesor_id); input(af, 'Motivo de reasignación', 'reason'); adone()
        const [f, done] = form(box, 'Cerrar seguimiento', d => request('POST', `/residencies/${r.id}/close`, { version: r.version, reason: d.reason })); input(f, 'Motivo del cierre', 'reason'); done()
      }
    }
  }

  async function render() {
    if (disposed) return
    content.replaceChildren(el('p', 'Cargando…'))
    try {
      catalog = await request('GET', '/academic-operations/catalog')
      if (disposed) return
      content.replaceChildren()
      await ({ periods: renderPeriods, courses: renderCourses, authorizations: renderAuthorizations, memberships: renderMemberships, residencies: renderResidencies, continuity: renderContinuity })[tab]()
    } catch (e) { if (!disposed) { content.replaceChildren(el('p', error(e))); button('Reintentar', render, content) } }
  }
  render()
  return () => { disposed = true; root.replaceChildren() }
}
