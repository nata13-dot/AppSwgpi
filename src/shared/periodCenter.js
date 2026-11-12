// Shared by the React and PHP clients (Frontend_Swgpi/assets/js/period-center.js). All user-provided content is rendered as text.
/**
 * Operación del periodo: las etapas de la carrera en orden, cada una con su estado, sus pendientes y su control.
 * host: { api(method, url, body), go(path), confirm(text) → Promise<boolean>, notify(type, text), links }
 */
export function mountPeriodCenter(root, host) {
  let disposed = false
  let data = null
  const opened = new Set()
  const el = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), attrs, text === undefined ? {} : { textContent: String(text) })
  const error = (e) => e.response?.data?.message || e.response?.data?.error || Object.values(e.response?.data?.errors || {}).flat().join(' ') || e.message || 'No fue posible completar la operación.'
  const notify = (type, text) => (host.notify ? host.notify(type, text) : (status.textContent = text))
  const ask = (text) => (host.confirm ? host.confirm(text) : Promise.resolve(window.confirm(text)))
  const day = (value) => (value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
  const moment = (value) => (value ? new Date(value).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
  const localNow = () => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16) }
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

  const status = el('p', '', { className: 'pc-status', role: 'status', ariaLive: 'polite' })
  const content = el('div')
  root.replaceChildren(status, content)

  const button = (label, action, className = 'pc-btn') => {
    const node = el('button', label, { type: 'button', className })
    node.onclick = async () => {
      node.disabled = true
      try { await action() } catch (e) { notify('error', error(e)) } finally { node.disabled = false }
    }
    return node
  }
  const link = (label, path) => button(label, async () => host.go(path), 'pc-btn ghost')
  const field = (label, control, hint) => {
    const wrap = el('label', undefined, { className: 'pc-field' })
    wrap.append(el('span', label), control)
    if (hint) wrap.append(el('small', hint))
    return wrap
  }
  const chip = (text, tone = '') => el('span', text, { className: `pc-chip ${tone}` })

  /** Abrir, ampliar o cerrar una ventana con fecha de cierre. */
  function windowForm(state, endpoint, extra = () => ({}), controls = []) {
    const box = el('div', undefined, { className: 'pc-form' })
    const until = el('input', undefined, { type: 'datetime-local', min: localNow(), className: 'pc-input' })
    box.append(field(state.open ? 'Cambiar cierre' : 'Abrir hasta', until), ...controls)
    const actions = el('div', undefined, { className: 'pc-actions' })
    actions.append(button(state.open ? 'Actualizar' : 'Abrir', async () => {
      if (!until.value) { notify('warning', 'Indica la fecha y hora de cierre.'); return }
      const result = await host.api('PUT', endpoint, { until: until.value, ...extra() })
      notify('success', result.message)
      await load()
    }))
    if (state.open) actions.append(button('Cerrar ahora', async () => {
      if (!(await ask('Se cerrará la ventana ahora. ¿Continuar?'))) return
      const result = await host.api('PUT', endpoint, { until: null })
      notify('success', result.message)
      await load()
    }, 'pc-btn danger'))
    box.append(actions)
    return box
  }

  function periodStage() {
    const { period } = data
    const body = el('div')
    if (period.open) {
      body.append(el('p', `${period.name}: del ${day(period.starts)} al ${day(period.ends)}. ${period.reconciled ? 'Conciliado.' : 'Falta conciliarlo.'}`))
      if (period.unplaced) body.append(el('p', `${plural(period.unplaced, 'alumno no tiene', 'alumnos no tienen')} grupo en este periodo.`, { className: 'pc-warn' }))
      else if (period.unplaced === 0) body.append(el('p', 'Todos los alumnos activos tienen grupo.'))
    } else {
      body.append(el('p', period.name ? `Siguiente periodo: ${period.name}.` : 'No hay periodo abierto.'))
      if (period.to_promote != null) body.append(el('p', `${plural(period.to_promote, 'alumno subirá', 'alumnos subirán')} de semestre al abrirlo. Nada se guarda hasta que lo confirmes.`))
    }
    const actions = el('div', undefined, { className: 'pc-actions' })
    if (data.permissions.academic) actions.append(link(period.open ? (period.unplaced ? 'Acomodar alumnos' : 'Ver periodos y matrícula') : 'Revisar y abrir periodo', host.links.period))
    body.append(actions)
    const state = !period.open ? 'todo' : period.unplaced ? 'warn' : 'done'
    const summary = period.open ? `${period.name} · ${period.state}` : 'Sin periodo abierto'
    const chips = period.unplaced ? [chip(`${period.unplaced} sin grupo`, 'warn')] : []
    return { key: 'period', title: 'Periodo y promoción', summary, state, chips, body }
  }

  function selfStage() {
    const self = data.self_registration
    const body = el('div')
    body.append(el('p', self.open ? `Los alumnos nuevos entran a ${self.semester}° semestre, grupos ${self.groups.join(', ')}. Cierra el ${moment(self.until)}` : 'Cerrado: el inicio de sesión no muestra «Crear cuenta».'))
    if (self.blocker) body.append(el('p', `«Crear cuenta» no se está mostrando: ${self.blocker}`, { className: 'pc-warn' }))
    body.append(el('p', `Correo esperado: ${self.rule.example}.`, { className: 'pc-muted' }))
    if (data.permissions.self_registration && data.period.open) {
      const options = self.semester_options || []
      const semester = el('select', undefined, { className: 'pc-input' })
      for (const value of options) semester.append(el('option', `${value}° semestre`, { value: String(value) }))
      semester.value = String(options.includes(5) ? 5 : options[0] ?? 5)
      const semesterField = field(self.open ? 'Semestre al actualizar' : 'Semestre de los alumnos nuevos', semester, options.length > 1 ? 'Si no lo cambias, entran a 5°.' : `Este periodo sólo tiene ${options[0]}° para alumnos nuevos.`)
      body.append(windowForm(self, '/proposal/settings/self-registration', () => ({ semester: Number(semester.value) }), options.length ? [semesterField] : []))
      const letters = el('input', undefined, { className: 'pc-input', value: self.groups.join(', ') })
      const groups = el('div', undefined, { className: 'pc-form' })
      groups.append(field('Grupos para alumnos nuevos', letters, 'Separados por coma.'))
      groups.append(button('Guardar grupos', async () => {
        const result = await host.api('PUT', '/proposal/settings/new-student-groups', { groups: letters.value.split(/[\s,]+/).filter(Boolean) })
        notify('success', result.message)
        await load()
      }, 'pc-btn ghost'))
      body.append(groups)
    }
    body.append(el('h4', 'Solicitudes de cuenta'))
    body.append(el('p', self.pending_requests ? `${plural(self.pending_requests, 'solicitud espera', 'solicitudes esperan')} aprobación.` : 'No hay solicitudes por revisar.'))
    if (data.permissions.academic) body.append(link('Revisar solicitudes', host.links.requests))
    const state = self.pending_requests ? 'warn' : self.open ? 'active' : 'idle'
    const chips = [chip(self.open ? `Abierto · ${self.semester}°` : 'Cerrado', self.open ? 'ok' : ''), ...(self.pending_requests ? [chip(`${self.pending_requests} por aprobar`, 'warn')] : [])]
    return { key: 'self', title: 'Autoregistro y solicitudes de cuenta', summary: self.open ? `Abierto hasta ${moment(self.until)}` : 'Cerrado', state, chips, body }
  }

  function proposalStage() {
    const proposals = data.proposals
    const body = el('div')
    body.append(el('p', proposals.open ? `Los alumnos pueden registrar propuestas hasta el ${moment(proposals.until)}` : 'El registro de propuestas está cerrado.'))
    body.append(el('p', `${plural(proposals.pending, 'propuesta pendiente', 'propuestas pendientes')} de validar, ${plural(proposals.changes, 'con cambios solicitados', 'con cambios solicitados')}. ${plural(proposals.validators, 'docente validador', 'docentes validadores')} además de coordinación y jefatura.`))
    if (data.permissions.proposals && data.period.open) body.append(windowForm(proposals, '/proposal/settings/proposal-window'))
    body.append(link('Validar propuestas y elegir validadores', host.links.proposals))
    const state = proposals.pending ? 'warn' : proposals.open ? 'active' : 'idle'
    const chips = [chip(proposals.open ? 'Abierto' : 'Cerrado', proposals.open ? 'ok' : ''), ...(proposals.pending ? [chip(`${proposals.pending} por validar`, 'warn')] : [])]
    return { key: 'proposals', title: 'Propuestas', summary: proposals.open ? `Abierto hasta ${moment(proposals.until)}` : 'Registro cerrado', state, chips, body }
  }

  function evaluationStage() {
    const evaluations = data.evaluations
    const body = el('div')
    body.append(el('p', `${plural(evaluations.scheduled, 'sala programada', 'salas programadas')} y ${plural(evaluations.finished, 'finalizada', 'finalizadas')}${evaluations.next_at ? `; la siguiente empieza el ${moment(evaluations.next_at)}` : '.'}`))
    const actions = el('div', undefined, { className: 'pc-actions' })
    actions.append(link('Salas y turnos', host.links.rooms), link('Evaluaciones', host.links.evaluations))
    body.append(actions)
    const state = evaluations.scheduled ? 'active' : evaluations.finished ? 'done' : 'idle'
    const summary = evaluations.next_at ? `Siguiente: ${moment(evaluations.next_at)}` : evaluations.scheduled ? `${evaluations.scheduled} programadas` : 'Sin salas programadas'
    return { key: 'evaluations', title: 'Evaluaciones', summary, state, chips: evaluations.scheduled ? [chip(`${evaluations.scheduled} salas`)] : [], body }
  }

  function closingStage() {
    const closing = data.closing
    const body = el('div')
    if (!closing.ends) { body.append(el('p', 'Sin periodo abierto.')); return { key: 'closing', title: 'Cierre', summary: '—', state: 'idle', chips: [], body } }
    body.append(el('p', `El periodo concluye solo el ${day(closing.ends)} (${plural(closing.days_left, 'día', 'días')}). Lo pendiente no se borra: se avisa a la jefatura.`))
    if (closing.pending.length) {
      const list = el('ul')
      for (const item of closing.pending) list.append(el('li', item))
      body.append(el('p', 'Hoy quedaría pendiente:'), list)
    } else body.append(el('p', 'Hoy no quedaría nada pendiente.'))
    const state = closing.pending.length && closing.days_left <= 15 ? 'warn' : 'idle'
    return { key: 'closing', title: 'Cierre', summary: `${day(closing.ends)} · faltan ${plural(closing.days_left, 'día', 'días')}`, state, chips: closing.pending.length ? [chip(`${closing.pending.length} pendientes`, closing.days_left <= 15 ? 'warn' : '')] : [], body }
  }

  function render() {
    if (disposed || !data) return
    const head = el('div', undefined, { className: 'pc-head' })
    head.append(el('strong', data.period.open ? `Periodo ${data.period.name}` : 'Sin periodo abierto'), el('span', data.career?.nombre_corto || '', { className: 'pc-muted' }))
    const list = el('ol', undefined, { className: 'pc-stages' })
    const stages = [periodStage(), selfStage(), proposalStage(), evaluationStage(), closingStage()]
    stages.forEach((stage, index) => {
      const item = el('li', undefined, { className: `pc-stage ${stage.state}${opened.has(stage.key) ? ' open' : ''}` })
      const toggle = el('button', undefined, { type: 'button', className: 'pc-stage-head', ariaExpanded: String(opened.has(stage.key)) })
      const text = el('span', undefined, { className: 'pc-stage-text' })
      text.append(el('strong', stage.title), el('small', stage.summary))
      const chips = el('span', undefined, { className: 'pc-chips' })
      chips.append(...stage.chips)
      toggle.append(el('span', String(index + 1), { className: 'pc-step' }), text, chips, el('span', '', { className: 'pc-caret', ariaHidden: 'true' }))
      toggle.onclick = () => { if (opened.has(stage.key)) opened.delete(stage.key); else opened.add(stage.key); render() }
      const body = el('div', undefined, { className: 'pc-stage-body' })
      body.append(stage.body)
      item.append(toggle, body)
      list.append(item)
    })
    content.replaceChildren(head, list)
  }

  async function load() {
    try {
      data = await host.api('GET', '/period-center')
      editing = false
      // La primera vez se despliega lo que pide atención.
      if (!opened.size) {
        if (!data.period.open) opened.add('period')
        if (data.self_registration.pending_requests || data.self_registration.blocker) opened.add('self')
        if (data.proposals.pending) opened.add('proposals')
      }
      render()
    } catch (e) {
      if (!disposed) content.replaceChildren(el('p', error(e), { className: 'pc-warn' }))
    }
  }

  // Cuando el pulso de la web o la app (evento sgpi:live) avisa que llegaron solicitudes o propuestas, se recarga solo;
  // si hay un formulario a medio llenar se espera a que se guarde para no borrar lo escrito.
  let editing = false
  root.addEventListener('input', () => { editing = true })
  root.addEventListener('change', () => { editing = true })
  const live = (event) => {
    const channels = event.detail?.channels || []
    if (!editing && channels.some(channel => ['registration_requests', 'proposals'].includes(channel))) load()
  }
  window.addEventListener('sgpi:live', live)

  content.append(el('p', 'Cargando el periodo…', { className: 'pc-muted' }))
  load()
  return () => { disposed = true; window.removeEventListener('sgpi:live', live) }
}
