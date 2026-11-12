// Shared by the React and PHP clients. All user-provided content is rendered as text.
// `options.confirm(text)` muestra la confirmación con el estilo de cada cliente; sin ella se usa la del navegador.
export function mountAcademicConsole(root, api, user, initialTab = 'periods', options = {}) {
  const ask = (text) => (options.confirm ? options.confirm(text) : Promise.resolve(window.confirm(text)))
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
  const ICONS = {
    info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  }
  const icon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'ac-icon')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', ICONS[name]); path.setAttribute('fill', 'currentColor'); svg.append(path)
    return svg
  }
  const panel = (title, parent, chip) => {
    const node = el('section', undefined, { className: 'ac-panel' })
    const head = el('div', undefined, { className: 'ac-panel-head' })
    head.append(el('h2', title)); if (chip) head.append(el('span', chip, { className: `ac-chip ${chip}` }))
    node.append(head); parent.append(node); return node
  }
  // Aviso breve dentro de una sección: qué pasa al usar el formulario.
  const hint = (parent, text) => { const node = el('div', undefined, { className: 'ac-hint', role: 'note' }); node.append(icon('info'), el('p', text)); parent.append(node); return node }
  const button = (label, action, parent, kind = 'ghost') => {
    const node = el('button', label, { type: 'button', className: `ac-btn ${kind}` })
    node.onclick = async () => { node.disabled = true; try { await action() } catch (e) { status.textContent = error(e) } finally { node.disabled = false } }
    parent.append(node); return node
  }
  const input = (form, title, name, type = 'text', value = '', required = true) => {
    const field = el('input', undefined, { name, type, value: type === 'checkbox' ? 'on' : (value ?? ''), required, className: type === 'checkbox' ? 'ac-checkbox' : 'ac-input' })
    const label = el('label', undefined, { className: type === 'checkbox' ? 'ac-check' : 'ac-field' })
    if (type === 'checkbox') label.append(field, el('span', title))
    else label.append(el('span', title), field)
    form.append(label); return field
  }
  const select = (form, title, name, options, value = '', required = true) => {
    const label = el('label', undefined, { className: 'ac-field' })
    label.append(el('span', title))
    const field = el('select', undefined, { name, required, className: 'ac-input' })
    field.append(el('option', 'Selecciona', { value: '' }))
    for (const [id, text] of options) field.append(el('option', text, { value: String(id) }))
    field.value = value == null ? '' : String(value); label.append(field); form.append(label); return field
  }
  const form = (parent, submitLabel, submit) => {
    const node = el('form', undefined, { className: 'ac-form' }); parent.append(node)
    const finish = () => {
      const send = el('button', submitLabel, { type: 'submit', className: 'ac-btn primary' })
      const actions = el('div', undefined, { className: 'ac-actions' }); actions.append(send); node.append(actions)
      node.onsubmit = async (event) => {
        event.preventDefault(); send.disabled = true; status.textContent = 'Guardando…'
        try { await submit(Object.fromEntries(new FormData(node))); notice('Cambios guardados.'); await render() }
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
  const status = el('p', '', { role: 'status', ariaLive: 'polite', className: 'ac-status' })
  const nav = el('nav', undefined, { ariaLabel: 'Operación académica', className: 'ac-tabs' })
  let content = el('div')
  root.classList.add('academic-console')
  root.replaceChildren(nav, status, content)
  // Lo que el usuario ya eligió en otros formularios sobrevive a la actualización tras guardar.
  const touched = (event) => { if (event.target.name) event.target.dataset.touched = '1' }
  root.addEventListener('input', touched)
  root.addEventListener('change', touched)
  // Aviso flotante: tras guardar abajo en la página, el estado de arriba no se ve.
  const notice = (text) => {
    status.textContent = text
    const toast = el('div', text, { role: 'status', className: 'ac-toast' })
    document.body.append(toast)
    setTimeout(() => toast.remove(), 2600)
  }
  const tabs = [...(academic ? [['periods', 'Periodos y matrícula']] : []), ['courses', student ? 'Mis materias' : 'Inscripciones'], ...(!student ? [['authorizations', 'Autorizaciones']] : []), ...(manager ? [['memberships', 'Perfiles']] : []), ['residencies', 'Residencias'], ...(!student ? [['continuity', 'Continuidad']] : [])]
  if (!tabs.some(([id]) => id === tab)) tab = tabs[0][0]
  const tabButtons = new Map(tabs.map(([id, label]) => [id, button(label, async () => {
    tab = id
    // La pestaña queda en la dirección para volver a ella al recargar o compartir el enlace.
    try { const url = new URL(window.location.href); url.searchParams.set('tab', id); window.history.replaceState(window.history.state, '', url) } catch { /* sin historial */ }
    await render(false)
  }, nav, 'ac-tab')]))

  // La guía "Cómo usar esta sección" (sectionGuide.js) cambia con la pestaña.
  function renderGuide() {
    for (const [id, node] of tabButtons) { node.classList.toggle('active', id === tab); node.setAttribute('aria-current', id === tab ? 'page' : 'false') }
    window.dispatchEvent(new CustomEvent('sgpi:guide', { detail: { key: `academic:${tab}` } }))
  }

  async function renderPeriods() {
    const data = await request('GET', '/semester-management')
    if (data.scheduler) content.append(el('p', `Última preparación automática: ${date(data.scheduler.updated_at)} · ${data.scheduler.estado}`, { className: 'ac-muted' }))
    else content.append(el('p', 'Todavía no se ha registrado una preparación automática.', { className: 'ac-muted' }))
    await renderAutomation()
    // Lo manual queda disponible para casos especiales; el trabajo normal es automático.
    const advanced = el('details', undefined, { className: 'ac-details' })
    advanced.append(el('summary', 'Opciones manuales de periodos')); content.append(advanced)
    const section = panel('Periodos por carrera', advanced)
    for (const p of data.periods) {
      const row = el('article', undefined, { className: 'ac-row' })
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

  async function renderAutomation() {
    const auto = await request('GET', '/academic-operations/automation').catch(() => null)
    if (!auto?.plan) return
    const { plan, unplaced, open_period: open } = auto
    const box = panel(open ? `Periodo abierto: ${open.nombre}` : `Abrir periodo: ${plan.period.nombre}`, content)
    hint(box, auto.scheduled ? 'Los periodos se abren y se cierran solos por fecha.' : 'La apertura automática por fecha está apagada; puedes abrirlo con este botón.')
    const reasons = (rows) => { const list = el('ul'); for (const row of rows) list.append(el('li', `${row.name} (${row.student_id}): ${row.reason}`)); return list }
    if (open) {
      if (!unplaced.length) { box.append(el('p', 'Todos los alumnos activos tienen grupo en este periodo.')); return }
      hint(box, `${unplaced.length} alumno(s) por acomodar: elige el grupo de cada uno y guarda. El resto ya quedó inscrito.`)
      const options = groups(catalog.groups.filter(g => Number(g.periodo_id) === Number(open.id)))
      for (const row of unplaced) {
        const [f, done] = form(box, 'Guardar', d => request('POST', '/academic-operations/enrollments', { student_id: row.student_id, group_id: Number(d.group_id) }))
        f.append(el('strong', `${row.name} (${row.student_id})`), el('p', row.suggestion ? `Sugerido: ${row.suggestion}` : row.reason))
        select(f, 'Grupo', 'group_id', options); done()
      }
      return
    }
    if (!plan.can_apply) { box.append(el('p', `Este periodo está ${plan.state}. Revisa las opciones manuales.`)); return }
    const summary = {}
    for (const move of plan.moves) { const key = `${move.source_group} (${move.from}°) → ${move.to}° ${move.clave}`; summary[key] = (summary[key] || 0) + 1 }
    box.append(el('p', `Vista previa: nada se guarda hasta que lo apliques. ${plan.moves.length} alumno(s) se ubican solos y ${plan.unplaced.length} quedan por acomodar.`))
    const moves = el('ul'); for (const [key, total] of Object.entries(summary)) moves.append(el('li', `${key}: ${total}`)); box.append(moves)
    if (plan.new_groups.length) box.append(el('p', `Grupos nuevos: ${plan.new_groups.map(g => `${g.semestre}° ${g.clave}`).join(', ')}.`))
    for (const period of plan.close) box.append(el('p', `Concluye ${period.nombre}${period.pending.length ? ` con pendientes: ${period.pending.join(', ')}` : ''}.`))
    if (plan.moves.some(move => move.to === 9)) box.append(el('p', 'Revisa a quienes pasan a 9°: si alguien ya egresó, desactívalo antes de abrir.'))
    if (plan.unplaced.length) { box.append(el('h3', 'Por acomodar después de abrir')); box.append(reasons(plan.unplaced)) }
    if (manager) button('Abrir periodo ahora', async () => {
      if (!await ask(`Se abrirá ${plan.period.nombre} y ${plan.moves.length} alumno(s) quedarán inscritos en su nuevo grupo. ¿Continuar?`)) return
      const result = await request('POST', '/academic-operations/automation', { snapshot: plan.snapshot })
      status.textContent = `Periodo abierto: ${result.promoted} inscrito(s), ${result.unplaced} por acomodar.`
      catalog = await request('GET', '/academic-operations/catalog')
      await render()
    }, box)
  }

  async function promotion(period) {
    const preview = await request('GET', `/semester-management/periods/${period.id}/promotion-preview`)
    content.replaceChildren(); const p = panel(`Promoción a ${period.nombre}`, content)
    hint(p, 'Resuelve todos los movimientos. Noveno permanece en seguimiento; no se declara egreso.')
    // Al cambiar de mitad de año cambia la paridad (6° A → 7° A): se crean los grupos destino que falten.
    if (manager && preview.movements.some(m => !m.group_id && m.action === 'avance')) {
      button('Generar grupos destino que faltan', async () => {
        const result = await request('POST', `/semester-management/periods/${period.id}/generate-groups`)
        status.textContent = result.created?.length ? `Grupos creados: ${result.created.join(', ')}` : result.message
        await promotion(period)
      }, p)
    }
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
    hint(p, 'Compara cada matrícula. Dejar grupo vacío excluye al alumno de este periodo y requiere un motivo.')
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
      p.append(el('p', `Inscripción: ${date(c.inscripcion_desde)} — ${date(c.inscripcion_hasta)}`, { className: 'ac-muted' }))
      if (student) {
        if (!c.inscrito) {
          const [f, done] = form(p, 'Inscribirme', d => request('POST', `/course-enrollments/${c.id}`, d)); input(f, 'Clave del docente', 'password', 'password'); done()
        } else {
          p.append(el('span', 'inscrito', { className: 'ac-chip aprobada' }))
          const [f, done] = form(p, 'Solicitar baja directa', d => request('DELETE', `/course-enrollments/${c.id}`, d)); input(f, 'Motivo de baja', 'reason'); done()
        }
      } else {
        const [f, done] = form(p, 'Abrir inscripción / renovar clave', d => request('PUT', `/courses/${c.id}/self-enrollment`, { enabled: true, password: d.password, password_confirmation: d.password, starts_at: d.start, ends_at: d.end }))
        input(f, 'Nueva clave (mínimo 6 caracteres)', 'password', 'password').minLength = 6
        const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        input(f, 'Apertura', 'start', 'datetime-local').min = now; input(f, 'Cierre', 'end', 'datetime-local').min = now; done()
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

  const AUTHORIZATION_TYPES = { presentacion_semestre: 'Presentación en otra etapa', reprogramacion: 'Reprogramación', reintento: 'Nuevo intento', inscripcion_semestre: 'Inscripción en otro semestre' }

  async function renderAuthorizations() {
    const data = await request('GET', '/academic-operations/authorizations')
    const p = panel('Solicitar autorización', content)
    hint(p, 'Llena sólo lo que aplique al tipo: las evaluaciones piden proyecto; la inscripción excepcional pide materia. Si eliges un alumno, la excepción no se extiende al resto del equipo.')
    const [f, done] = form(p, 'Registrar solicitud', d => request('POST', '/academic-operations/authorizations', {
      ...d, period_id: Number(d.period_id), project_id: d.project_id ? Number(d.project_id) : null,
      presentation_semester: d.presentation_semester ? Number(d.presentation_semester) : null,
      evaluation_id: d.evaluation_id ? Number(d.evaluation_id) : null, student_id: d.student_id || null,
      course_id: d.course_id ? Number(d.course_id) : null,
    }))
    select(f, 'Periodo', 'period_id', periods()); select(f, 'Tipo', 'type', Object.entries(AUTHORIZATION_TYPES).filter(([type]) => manager || type !== 'inscripcion_semestre'))
    select(f, 'Proyecto (obligatorio para evaluaciones)', 'project_id', projects(), '', false)
    select(f, 'Alumno involucrado (no autoriza automáticamente al equipo)', 'student_id', members([3]), '', false)
    select(f, 'Etapa de presentación', 'presentation_semester', [5, 6, 7, 8].map(n => [n, `${n}°`]), '', false)
    select(f, 'Evaluación de origen', 'evaluation_id', (catalog.evaluations || []).map(e => [e.id, `${e.project?.title || e.project?.titulo || e.project_id} · ${e.semestre}° · ${e.estado} (#${e.id})`]), '', false)
    select(f, 'Materia (para inscripción excepcional)', 'course_id', (catalog.courses || []).map(c => [c.id, `${c.subject?.nombre} · ${c.group?.semestre}° ${c.group?.grupo || ''}`]), '', false)
    input(f, 'Motivo', 'reason'); input(f, 'Vigencia hasta', 'expires_at', 'datetime-local'); done()
    for (const a of data.data) {
      const box = panel(AUTHORIZATION_TYPES[a.tipo] || a.tipo, content, a.estado); box.append(el('p', `Proyecto ${a.proyecto_id || '—'} · ${a.motivo} · vigencia ${date(a.vigente_hasta)}`, { className: 'ac-muted' }))
      if (manager && ['solicitada', 'aprobada'].includes(a.estado) && !a.consumida_en) {
        const [f, done] = form(box, 'Registrar resolución', d => request('PUT', `/semester-management/exceptions/${a.id}/decision`, { version: a.version, status: d.status, reason: d.reason, project_scope: d.scope === 'on' }))
        select(f, 'Decisión', 'status', a.estado === 'solicitada' ? [['aprobada', 'Aprobar'], ['rechazada', 'Rechazar']] : [['revocada', 'Revocar']]); input(f, 'Motivo de resolución', 'reason'); input(f, 'Confirmo el alcance sobre todo el proyecto al aprobar', 'scope', 'checkbox', '', false); done()
      }
    }
  }

  async function renderMemberships() {
    const p = panel('Perfiles operativos de miembros actuales', content)
    hint(p, 'Administración general gestiona altas, cambios de carrera, jefaturas y administradores. Los compromisos pendientes deben reasignarse antes de cambiar un perfil.')
    const [f, done] = form(p, 'Asignar perfil', d => request('PUT', `/academic-operations/memberships/${d.membership}`, { profile_id: Number(d.profile_id) }))
    const field = select(f, 'Persona', 'membership', catalog.members.filter(m => [2, 3, 6, 7].includes(Number(m.perfil_id))).map(m => [m.id, `${m.nombres} ${m.apellido_paterno} · perfil ${m.perfil_id}`]))
    select(f, 'Perfil', 'profile_id', [[2, 'Docente'], [3, 'Estudiante'], [6, 'Asistencia'], [7, 'Coordinación']]); done()
    button('Consultar compromisos', async () => { if (!field.value) return; const commitments = await request('GET', `/academic-operations/memberships/${field.value}/commitments`); const box = panel('Compromisos pendientes', p); for (const [key, ids] of Object.entries(commitments)) box.append(el('p', `${({ courses: 'Cursos', rooms: 'Salas', projects: 'Asesorías', residencies: 'Residencias' })[key]}: ${ids.join(', ') || 'ninguno'}`)) }, p)
    if (general) { const box = panel('Catálogo institucional de salones', content); const [f, done] = form(box, 'Agregar salón', d => request('POST', '/academic-operations/classrooms', d)); input(f, 'Nombre del salón', 'name'); done() }
  }

  async function renderContinuity() {
    const p = panel('Seguimiento del proyecto en el periodo abierto', content)
    hint(p, 'La continuidad conserva el grupo, documentos y evaluaciones de los periodos anteriores.')
    const [f, done] = form(p, 'Registrar continuidad', d => request('POST', '/academic-operations/project-period', { project_id: Number(d.project_id), group_id: Number(d.group_id) }))
    select(f, 'Proyecto', 'project_id', projects()); select(f, 'Grupo del periodo', 'group_id', groups()); done()
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
      const box = panel(`Residencia · ${r.estudiante_id}`, content, r.estado)
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

  // Mismo campo en el contenido nuevo: el mismo formulario (por su primer título) y el mismo nombre.
  const fieldKey = (field) => `${field.form?.querySelector('strong, h2, h3')?.textContent || ''}|${field.name}`

  // Una actualización a la vez: las secciones se arman sobre `content` y no deben mezclarse.
  let queue = Promise.resolve()
  function render(soft = true) {
    queue = queue.then(() => draw(soft))
    return queue
  }

  /**
   * Al cambiar de pestaña se muestra "Cargando…". Después de guardar (soft) la vista no se vacía: el contenido
   * nuevo se arma aparte y reemplaza al anterior, conservando la posición, las secciones abiertas y lo elegido.
   */
  async function draw(soft) {
    if (disposed) return
    renderGuide()
    const previous = content
    const keep = soft && previous.childElementCount > 0
    if (!keep) previous.replaceChildren(el('p', 'Cargando…'))
    const opened = [...previous.querySelectorAll('details')].map(node => node.open)
    const values = new Map([...previous.querySelectorAll('[data-touched]')].map(field => [fieldKey(field), field.value]))
    content = el('div')
    try {
      catalog = await request('GET', '/academic-operations/catalog')
      if (disposed) return
      await ({ periods: renderPeriods, courses: renderCourses, authorizations: renderAuthorizations, memberships: renderMemberships, residencies: renderResidencies, continuity: renderContinuity })[tab]()
      if (disposed) return
      if (keep) {
        content.querySelectorAll('details').forEach((node, index) => { if (opened[index]) node.open = true })
        for (const field of content.querySelectorAll('input[name], select[name], textarea[name]')) {
          const key = fieldKey(field)
          if (!values.has(key) || field.type === 'checkbox' || field.type === 'hidden') continue
          field.value = values.get(key)
          // Si la opción ya no existe (p. ej. el grupo se llenó) el campo queda vacío y deja de contar como elegido.
          if (field.value === values.get(key)) field.dataset.touched = '1'
        }
      }
      previous.replaceWith(content)
    } catch (e) {
      content = previous
      if (!disposed) { content.replaceChildren(el('p', error(e))); button('Reintentar', () => render(false), content) }
    }
  }
  render()
  return () => { disposed = true; root.replaceChildren() }
}
