// Seguimiento de avances. Mismo módulo en la app (src/shared/trackingConsole.js) y en la web
// (assets/js/tracking-console.js). Todo lo que escribe el usuario se pinta como texto.
// api(method, url, body) devuelve el JSON; con method 'DOWNLOAD' descarga un archivo.
// options.confirm(text) muestra la confirmación con el estilo de cada cliente.
export const MODALITIES = { proyecto_integrador: 'Integrador', caso_integrador: 'Caso integrador', dual: 'Dual' }
const DOC_TYPES = { documento: 'Documento', reporte: 'Reporte', presentacion: 'Presentación', video: 'Video', codigo: 'Código', otro: 'Otro' }
const CELL = {
  calificado: ['ok', null],
  entregado: ['warn', 'Por calificar'],
  vencido: ['danger', 'Vencido'],
  pendiente: ['muted', 'Pendiente'],
  borrador: ['muted', '—'],
}
const STATE_LABEL = { borrador: 'Borrador', publicado: 'Abierto', cerrado: 'Cerrado' }

export function mountTrackingConsole(root, api, user, initialTab = 'courses', options = {}) {
  const ask = (text) => (options.confirm ? options.confirm(text) : Promise.resolve(window.confirm(text)))
  const profile = Number(user.active_profile_id ?? user.perfil_id)
  const staff = Boolean(user.is_general_admin) || [1, 4, 5, 6, 7].includes(profile)
  let disposed = false
  let tab = initialTab
  let courseId = Number(new URLSearchParams(window.location.search).get('course')) || null
  let focus = null // { project, deliverable } celda abierta en el tablero
  let revealDetail = false // al elegir una casilla se baja al panel de esa entrega

  const el = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), attrs, text === undefined || text === null ? {} : { textContent: String(text) })
  const box = (className, ...children) => { const node = el('div', undefined, { className }); node.append(...children.filter(Boolean)); return node }
  const error = (e) => e?.response?.data?.message || e?.response?.data?.error || Object.values(e?.response?.data?.errors || {}).flat().join(' ') || e?.message || 'No fue posible completar la operación.'
  const date = (value) => value ? new Date(value).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'
  const localInput = (value) => { if (!value) return ''; const d = new Date(value); const pad = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
  const serverDate = (value) => value ? `${value.replace('T', ' ')}:00` : null
  const grade = (value) => value === null || value === undefined ? '—' : Number(value).toFixed(Number(value) % 1 ? 1 : 0)
  const modalities = (list) => (list || []).map((m) => MODALITIES[m] || m).join(', ')

  const status = el('p', '', { role: 'status', className: 'ac-status' })
  const nav = el('nav', undefined, { className: 'ac-tabs', ariaLabel: 'Seguimiento de avances' })
  let content = el('div', undefined, { className: 'tc-content' })
  content.append(el('p', 'Cargando…', { className: 'ac-muted' }))
  let lastView = ''
  root.classList.add('academic-console', 'tracking-console')
  root.replaceChildren(nav, status, content)

  const notice = (text) => {
    status.textContent = ''
    const toast = el('div', text, { role: 'status', className: 'ac-toast' })
    document.body.append(toast)
    setTimeout(() => toast.remove(), 2600)
  }
  const chip = (text, kind = '') => el('span', text, { className: `ac-chip tc-chip ${kind}` })
  const button = (label, action, parent, kind = 'ghost') => {
    const node = el('button', label, { type: 'button', className: `ac-btn ${kind}` })
    node.onclick = async () => { node.disabled = true; status.textContent = ''; try { await action() } catch (e) { status.textContent = error(e); status.scrollIntoView?.({ block: 'nearest' }) } finally { node.disabled = false } }
    parent?.append(node)
    return node
  }
  const panel = (title, parent, extra) => {
    const node = el('section', undefined, { className: 'ac-panel' })
    const head = el('div', undefined, { className: 'ac-panel-head' })
    head.append(el('h2', title)); if (extra) head.append(extra)
    node.append(head); parent.append(node)
    return node
  }
  const hint = (parent, text) => { const node = el('div', undefined, { className: 'ac-hint', role: 'note' }); node.append(el('p', text)); parent.append(node); return node }
  const field = (parent, title, input) => { const label = el('label', undefined, { className: 'ac-field' }); label.append(el('span', title), input); parent.append(label); return input }
  const input = (attrs) => el('input', undefined, { className: 'ac-input', ...attrs })
  const select = (pairs, value = '', attrs = {}) => {
    const node = el('select', undefined, { className: 'ac-input', ...attrs })
    for (const [id, text] of pairs) node.append(el('option', text, { value: String(id) }))
    node.value = value == null ? '' : String(value)
    return node
  }
  const textarea = (attrs) => el('textarea', undefined, { className: 'ac-input', rows: 2, ...attrs })
  // Formulario que envía y vuelve a pintar; si falla deja el mensaje y conserva lo escrito.
  const form = (parent, submitLabel, submit, className = '') => {
    const node = el('form', undefined, { className: `ac-form ${className}` })
    parent.append(node)
    const done = () => {
      const send = el('button', submitLabel, { type: 'submit', className: 'ac-btn primary' })
      const actions = el('div', undefined, { className: 'ac-actions' }); actions.append(send); node.append(actions)
      node.onsubmit = async (event) => {
        event.preventDefault(); send.disabled = true; status.textContent = 'Guardando…'
        try { const message = await submit(); notice(message || 'Cambios guardados.'); await render() }
        catch (e) { status.textContent = error(e) }
        finally { send.disabled = false }
      }
    }
    return [node, done]
  }
  const act = async (fn, message) => { const result = await fn(); notice(result?.message || message || 'Listo.'); await render() }
  const remember = () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      if (tab === 'courses' && courseId) url.searchParams.set('course', String(courseId)); else url.searchParams.delete('course')
      window.history.replaceState(window.history.state, '', url)
    } catch { /* sin historial */ }
  }

  const tabs = [['courses', 'Mis materias'], ...(staff ? [['overview', 'Panorama de la carrera'], ['config', 'Materias y plantillas']] : [])]
  if (!tabs.some(([id]) => id === tab)) tab = 'courses'
  // Con una sola pestaña (docente) la barra no aporta nada.
  nav.hidden = tabs.length < 2
  const tabButtons = new Map(tabs.map(([id, label]) => [id, button(label, async () => { tab = id; if (id !== 'courses') courseId = null; focus = null; await render() }, nav, 'ac-tab')]))

  const stat = (label, value, kind = '') => box(`tc-stat ${kind}`, el('strong', value), el('span', label))
  const statsRow = (r) => box('tc-stats',
    stat('Proyectos', r.proyectos),
    stat('Avances abiertos', r.avances),
    stat('Entregados', `${r.entregadas}/${r.esperadas}`),
    stat('Por calificar', r.sin_calificar, r.atrasadas ? 'warn' : ''),
    stat('Vencidos sin entregar', r.vencidas, r.vencidas ? 'danger' : ''),
    stat('Promedio', grade(r.promedio)))

  // ------------------------------------------------------------------ Mis materias
  async function renderCourses() {
    if (courseId) return renderBoard()
    const data = await api('GET', '/tracking/courses')
    if (disposed) return
    if (!data.period_open) hint(content, 'No hay un periodo abierto en tu carrera. Las materias de seguimiento aparecen cuando la jefatura lo abre.')
    else if (!data.configured) hint(content, staff ? 'Tu carrera todavía no elige materias de seguimiento. Agrégalas en «Materias y plantillas».' : 'Tu carrera todavía no elige qué materias piden avances.')
    if (!data.data.length) {
      if (data.period_open && data.configured) content.append(el('p', staff ? 'No impartes materias de seguimiento. Revisa todas las de la carrera en «Panorama de la carrera».' : 'No impartes materias de seguimiento este periodo. Si deberías, pide a tu jefatura que te asigne al grupo.', { className: 'ac-muted' }))
      return
    }
    const grid = box('tc-cards')
    for (const course of data.data) {
      const card = el('article', undefined, { className: 'tc-card' })
      const r = course.resumen
      card.append(
        box('tc-card-head', el('h3', course.asignatura), chip(`${course.semestre ?? '—'}° ${course.grupo || ''}`.trim())),
        el('p', modalities(course.modalidades) || 'Sin modalidades', { className: 'ac-muted' }),
        box('tc-mini',
          el('span', `${r.proyectos} proyecto(s)`),
          el('span', `${r.entregadas}/${r.esperadas} entregados`),
          r.sin_calificar ? chip(`${r.sin_calificar} por calificar`, 'warn') : null,
          r.vencidas ? chip(`${r.vencidas} vencido(s)`, 'danger') : null,
          r.borradores ? chip(`${r.borradores} en borrador`) : null))
      button('Abrir tablero', async () => { courseId = course.id; focus = null; await render() }, card, 'primary')
      grid.append(card)
    }
    content.append(grid)
  }

  async function renderBoard() {
    const { data } = await api('GET', `/tracking/courses/${courseId}`)
    if (disposed) return
    const c = data.course
    const back = button('← Volver', async () => { courseId = null; focus = null; await render() }, content, 'tc-back')
    back.setAttribute('aria-label', 'Volver a la lista de materias')
    const head = panel(`${c.asignatura} · ${c.semestre ?? '—'}° ${c.grupo || ''}`, content, chip(modalities(c.modalidades) || 'Manual'))
    head.append(el('p', c.docentes.length ? `Docente: ${c.docentes.join(', ')}` : 'Sin docente asignado', { className: 'ac-muted' }), statsRow(data.resumen))

    // Avances
    const weights = data.deliverables.reduce((sum, d) => sum + (d.ponderacion || 0), 0)
    const items = panel('Avances', content, weights ? chip(`Ponderación ${grade(weights)} %`, weights > 100 ? 'danger' : '') : null)
    if (data.template_pending.length) {
      const note = hint(items, `La carrera definió ${data.template_pending.length} avance(s) para esta materia: ${data.template_pending.map((t) => t.nombre).join(', ')}. Se agregan en borrador con la fecha sugerida para que los revises antes de abrirlos.`)
      button(`Agregar ${data.template_pending.length} de la plantilla`, () => act(() => api('POST', `/tracking/courses/${courseId}/template`)), note, 'primary tc-hint-action')
    }
    if (!data.deliverables.length) items.append(el('p', 'Aún no hay avances. Agrega el primero abajo o usa la plantilla de la carrera.', { className: 'ac-muted' }))
    for (const d of data.deliverables) items.append(deliverableRow(d))
    const add = el('details', undefined, { className: 'ac-details tc-add' })
    add.append(el('summary', 'Nuevo avance')); items.append(add)
    deliverableForm(add, null)

    // Tablero
    const board = panel('Seguimiento por equipo', content)
    if (!data.projects.length) board.append(el('p', 'Ningún proyecto está ligado a esta materia. Revisa la modalidad de los proyectos o agrégalos abajo.', { className: 'ac-muted' }))
    else board.append(matrix(data))
    if (focus) {
      const project = data.projects.find((p) => p.id === focus.project)
      const deliverable = data.deliverables.find((d) => d.id === focus.deliverable)
      if (project && deliverable) content.insertBefore(detail(project, deliverable), board.nextSibling)
    }

    // Proyectos de la materia
    const links = panel('Proyectos de la materia', content)
    hint(links, 'Se ligan solos los proyectos del grupo con la modalidad que eligió la carrera. Agrega o quita uno en particular (recursadores, cambios de grupo); se pide el motivo y queda en la bitácora.')
    if (data.projects.length) {
      const [f, done] = form(links, 'Quitar de la materia', async () => {
        if (!(await ask('El equipo dejará de ver los avances de esta materia. Lo que ya entregó se conserva. ¿Continuar?'))) throw new Error('Operación cancelada.')
        return (await api('DELETE', `/tracking/courses/${courseId}/projects/${removeSelect.value}`, { motivo: removeReason.value })).message
      })
      const removeSelect = field(f, 'Proyecto', select(data.projects.map((p) => [p.id, `${p.titulo}${p.origen === 'manual' ? ' (agregado a mano)' : ''}`]), '', { required: true }))
      const removeReason = field(f, 'Motivo', input({ required: true, minLength: 5, maxLength: 500, placeholder: 'Ej. cambió de grupo' }))
      done()
    }
    const more = el('details', undefined, { className: 'ac-details' })
    more.append(el('summary', 'Agregar un proyecto'))
    links.append(more)
    more.addEventListener('toggle', async () => {
      if (!more.open || more.dataset.loaded) return
      more.dataset.loaded = '1'
      try {
        const candidates = (await api('GET', `/tracking/courses/${courseId}/candidates`)).data
        if (!candidates.length) { more.append(el('p', 'No hay otros proyectos activos en el periodo.', { className: 'ac-muted' })); return }
        const [f, done] = form(more, 'Agregar a la materia', async () => (await api('POST', `/tracking/courses/${courseId}/projects`, { project_id: Number(pick.value), motivo: reason.value })).message)
        const pick = field(f, 'Proyecto', select([['', 'Selecciona'], ...candidates.map((p) => [p.id, `${p.titulo} · ${p.semestre}° ${p.clave_grupo} · ${MODALITIES[p.modalidad] || p.modalidad}`])], '', { required: true }))
        const reason = field(f, 'Motivo', input({ required: true, minLength: 5, maxLength: 500, placeholder: 'Ej. recursa la materia' }))
        done()
      } catch (e) { more.append(el('p', error(e), { className: 'ac-muted' })) }
    })
    if (data.removed.length) {
      const removed = el('div', undefined, { className: 'tc-removed' })
      removed.append(el('strong', 'Quitados de la materia'))
      for (const p of data.removed) {
        const row = box('ac-row tc-row', box('tc-row-main', el('span', p.titulo), el('small', `Motivo: ${p.motivo}`, { className: 'ac-muted' })))
        button('Restaurar', () => act(() => api('POST', `/tracking/courses/${courseId}/projects`, { project_id: p.id, motivo: 'Se restauró en la materia' })), row)
        removed.append(row)
      }
      links.append(removed)
    }
  }

  function deliverableRow(d) {
    const row = box('ac-row tc-row')
    const info = box('tc-row-main',
      box('tc-row-title', el('strong', d.nombre), chip(STATE_LABEL[d.estado] || d.estado, d.estado === 'publicado' ? 'ok' : d.estado === 'cerrado' ? 'danger' : '')),
      el('small', [d.fecha_limite ? `Vence ${date(d.fecha_limite)}` : 'Sin fecha límite', d.ponderacion !== null ? `${grade(d.ponderacion)} %` : null, DOC_TYPES[d.tipo_documento]].filter(Boolean).join(' · '), { className: 'ac-muted' }))
    const actions = box('tc-row-actions')
    const setState = (estado, text) => button(text, () => act(() => api('PUT', `/deliverables/${d.id}`, { estado }), estado === 'publicado' ? 'Avance abierto: se avisó a los equipos.' : 'Avance actualizado.'), actions, estado === 'publicado' ? 'primary' : 'ghost')
    if (d.estado === 'borrador') setState('publicado', 'Abrir')
    if (d.estado === 'publicado') setState('cerrado', 'Cerrar')
    if (d.estado === 'cerrado') setState('publicado', 'Reabrir')
    const edit = el('div', undefined, { className: 'ac-details tc-edit', hidden: true })
    deliverableForm(edit, d)
    const toggle = button('Editar', async () => { edit.hidden = !edit.hidden; toggle.setAttribute('aria-expanded', String(!edit.hidden)) }, actions)
    toggle.setAttribute('aria-expanded', 'false')
    button('Quitar', async () => {
      if (!(await ask(`¿Quitar «${d.nombre}»? Las entregas recibidas se conservan en el historial.`))) return
      await act(() => api('DELETE', `/deliverables/${d.id}`), 'Avance quitado.')
    }, actions)
    row.append(info, actions, edit)
    return row
  }

  function deliverableForm(parent, d) {
    const [f, done] = form(parent, d ? 'Guardar cambios' : 'Crear avance', async () => {
      const body = {
        nombre: name.value, descripcion: description.value || null, tipo_documento: type.value,
        fecha_limite: serverDate(due.value), ponderacion: weight.value === '' ? null : Number(weight.value),
      }
      if (d) return (await api('PUT', `/deliverables/${d.id}`, body)).message
      return (await api('POST', '/deliverables', { ...body, curso_id: courseId, estado: publish.checked ? 'publicado' : 'borrador' })).message
    })
    const name = field(f, 'Nombre', input({ required: true, maxLength: 255, value: d?.nombre || '', placeholder: 'Ej. Avance 1: planteamiento' }))
    const due = field(f, 'Fecha límite', input({ type: 'datetime-local', value: localInput(d?.fecha_limite) }))
    const weight = field(f, 'Ponderación (%)', input({ type: 'number', min: 0, max: 100, step: '0.5', value: d?.ponderacion ?? '' }))
    const type = field(f, 'Tipo de archivo', select(Object.entries(DOC_TYPES), d?.tipo_documento || 'documento'))
    const description = field(f, 'Instrucciones', textarea({ maxLength: 5000, value: d?.descripcion || '' }))
    description.parentElement.classList.add('tc-wide')
    let publish = null
    if (!d) {
      const label = el('label', undefined, { className: 'ac-check' })
      publish = el('input', undefined, { type: 'checkbox', className: 'ac-checkbox' })
      label.append(publish, el('span', 'Abrir ahora y avisar a los equipos'))
      f.append(label)
    }
    done()
  }

  function matrix(data) {
    const wrap = box('tc-matrix-wrap')
    const table = el('table', undefined, { className: 'tc-matrix' })
    const head = el('tr')
    head.append(el('th', 'Proyecto', { scope: 'col' }))
    for (const d of data.deliverables) head.append(el('th', d.nombre, { scope: 'col', title: d.nombre }))
    head.append(el('th', 'Promedio', { scope: 'col' }))
    const thead = el('thead'); thead.append(head)
    const tbody = el('tbody')
    for (const p of data.projects) {
      const tr = el('tr')
      const th = el('th', undefined, { scope: 'row' })
      th.append(el('span', p.titulo, { className: 'tc-project' }), box('tc-tags', chip(MODALITIES[p.modalidad] || p.modalidad), p.origen === 'manual' ? chip('Agregado', 'warn') : null))
      tr.append(th)
      for (const cell of p.celdas) {
        const td = el('td')
        const [kind, label] = CELL[cell.estado] || ['muted', cell.estado]
        const active = focus && focus.project === p.id && focus.deliverable === cell.deliverable_id
        const text = cell.estado === 'calificado' ? grade(cell.calificacion) : label
        const node = el('button', text, { type: 'button', className: `tc-cell ${kind}${active ? ' active' : ''}${cell.prorroga ? ' extended' : ''}` })
        node.title = cell.prorroga ? `Prórroga hasta ${date(cell.prorroga.vence_en)}` : text
        node.setAttribute('aria-label', `${p.titulo}, ${data.deliverables.find((d) => d.id === cell.deliverable_id)?.nombre}: ${text}${cell.prorroga ? ', con prórroga' : ''}`)
        node.onclick = async () => { focus = active ? null : { project: p.id, deliverable: cell.deliverable_id }; revealDetail = Boolean(focus); await render() }
        td.append(node); tr.append(td)
      }
      tr.append(el('td', grade(p.promedio), { className: 'tc-average' }))
      tbody.append(tr)
    }
    table.append(thead, tbody); wrap.append(table)
    return wrap
  }

  function detail(project, deliverable) {
    const cell = project.celdas.find((c) => c.deliverable_id === deliverable.id)
    const node = el('section', undefined, { className: 'ac-panel tc-detail' })
    const head = box('ac-panel-head', el('h2', `${deliverable.nombre} · ${project.titulo}`))
    button('Cerrar', async () => { focus = null; await render() }, head, 'ghost tc-close')
    node.append(head)
    node.append(el('p', [cell.vence_en ? `Fecha límite del equipo: ${date(cell.vence_en)}` : 'Sin fecha límite', cell.entregado_en ? `Entregado ${date(cell.entregado_en)}${cell.version > 1 ? ` (versión ${cell.version})` : ''}` : 'Sin entrega'].join(' · '), { className: 'ac-muted' }))

    if (cell.delivery_id) {
      button(`Descargar ${cell.archivo || 'archivo'}`, () => api('DOWNLOAD', `/deliverables/${deliverable.id}/download?project_id=${project.id}`, { name: cell.archivo || `${deliverable.nombre}` }), node)
      const [f, done] = form(node, cell.calificacion === null ? 'Calificar' : 'Actualizar calificación', async () =>
        (await api('POST', `/deliverables/${deliverable.id}/calificar`, { project_id: project.id, calificacion: Number(score.value), comentarios: comment.value })).message)
      const score = field(f, 'Calificación del equipo (0 a 100)', input({ type: 'number', min: 0, max: 100, step: '0.5', required: true, value: cell.calificacion ?? '' }))
      const comment = field(f, 'Comentario para el equipo', textarea({ maxLength: 3000, value: cell.comentario || '' }))
      comment.parentElement.classList.add('tc-wide')
      done()

      if (cell.calificacion !== null && project.integrantes.length > 1) {
        const people = el('div', undefined, { className: 'tc-people' })
        people.append(el('strong', 'Calificación por integrante'), el('p', 'Todos reciben la del equipo. Ajusta sólo a quien no participó igual; se pide el motivo y se le avisa.', { className: 'ac-muted' }))
        for (const member of project.integrantes) {
          const adjusted = cell.ajustes.find((a) => a.estudiante_id === member.id)
          const row = box('ac-row tc-row', box('tc-row-main', el('span', member.nombre), el('small', adjusted ? `Ajustada: ${grade(adjusted.calificacion)} · ${adjusted.motivo}` : `Del equipo: ${grade(cell.calificacion)}`, { className: 'ac-muted' })))
          if (adjusted) button('Quitar ajuste', () => act(() => api('DELETE', `/tracking/deliveries/${cell.delivery_id}/adjustments/${encodeURIComponent(member.id)}`)), row)
          const more = el('div', undefined, { className: 'ac-details tc-edit', hidden: true })
          const toggle = button(adjusted ? 'Cambiar' : 'Ajustar', async () => { more.hidden = !more.hidden; toggle.setAttribute('aria-expanded', String(!more.hidden)) }, row)
          toggle.setAttribute('aria-expanded', 'false')
          const [af, adone] = form(more, 'Guardar ajuste', async () => (await api('PUT', `/tracking/deliveries/${cell.delivery_id}/adjustments/${encodeURIComponent(member.id)}`, { calificacion: Number(value.value), motivo: reason.value })).message)
          const value = field(af, 'Calificación', input({ type: 'number', min: 0, max: 100, step: '0.5', required: true, value: adjusted?.calificacion ?? '' }))
          const reason = field(af, 'Motivo', input({ required: true, minLength: 5, maxLength: 500, value: adjusted?.motivo || '' }))
          adone()
          row.append(more); people.append(row)
        }
        node.append(people)
      }
    } else if (deliverable.estado === 'borrador') {
      node.append(el('p', 'Este avance sigue en borrador: el equipo todavía no lo ve.', { className: 'ac-muted' }))
    }

    if (deliverable.estado !== 'borrador' && !cell.delivery_id) {
      const ext = el('div', undefined, { className: 'tc-people' })
      ext.append(el('strong', 'Prórroga para este equipo'))
      if (cell.prorroga) {
        const row = box('ac-row tc-row', box('tc-row-main', el('span', `Hasta ${date(cell.prorroga.vence_en)}`), el('small', cell.prorroga.motivo, { className: 'ac-muted' })))
        button('Retirar prórroga', () => act(() => api('DELETE', `/tracking/deliverables/${deliverable.id}/extensions/${project.id}`)), row)
        ext.append(row)
      } else {
        ext.append(el('p', 'Sólo este equipo podrá entregar hasta la nueva fecha; los demás conservan la general. Se le avisa al equipo.', { className: 'ac-muted' }))
      }
      if (deliverable.estado === 'cerrado') ext.append(el('p', 'El avance está cerrado: para recibir la entrega, reábrelo además de dar la prórroga.', { className: 'ac-muted' }))
      const [f, done] = form(ext, cell.prorroga ? 'Cambiar prórroga' : 'Dar prórroga', async () => (await api('PUT', `/tracking/deliverables/${deliverable.id}/extensions/${project.id}`, { vence_en: serverDate(when.value), motivo: reason.value })).message)
      const when = field(f, 'Nueva fecha límite', input({ type: 'datetime-local', required: true, value: localInput(cell.prorroga?.vence_en) }))
      const reason = field(f, 'Motivo', input({ required: true, minLength: 5, maxLength: 500, value: cell.prorroga?.motivo || '' }))
      done()
      node.append(ext)
    }
    return node
  }

  // ------------------------------------------------------------------ Panorama
  async function renderOverview() {
    const { data } = await api('GET', '/tracking/overview')
    if (disposed) return
    if (!data.period_open) { hint(content, 'No hay un periodo abierto en la carrera.'); return }
    if (!data.courses.length) { hint(content, 'No hay materias de seguimiento en el periodo. Elige las materias en «Materias y plantillas».'); return }
    const t = data.totals
    const summary = panel('Estado de la carrera', content)
    summary.append(box('tc-stats',
      stat('Materias', t.materias),
      stat('Sin docente', t.sin_docente, t.sin_docente ? 'danger' : ''),
      stat('Entregados', `${t.entregadas}/${t.esperadas}`),
      stat('Vencidos sin entregar', t.vencidas, t.vencidas ? 'danger' : ''),
      stat('Por calificar', t.sin_calificar, t.sin_calificar ? 'warn' : ''),
      stat('Más de 5 días sin calificar', t.atrasadas, t.atrasadas ? 'danger' : '')))
    const mods = Object.entries(t.por_modalidad || {})
    if (mods.length) summary.append(box('tc-tags', ...mods.map(([m, n]) => chip(`${MODALITIES[m] || m}: ${n} proyecto(s)`))))

    const list = panel('Por materia y grupo', content)
    const filter = select([['', 'Todas las modalidades'], ...Object.entries(MODALITIES)], '', { ariaLabel: 'Filtrar por modalidad' })
    const order = select([['semestre', 'Ordenar por semestre'], ['vencidas', 'Más vencidos'], ['sin_calificar', 'Más por calificar']], 'semestre', { ariaLabel: 'Ordenar' })
    list.append(box('tc-filters', filter, order))
    const wrap = box('tc-matrix-wrap')
    list.append(wrap)
    const draw = () => {
      const rows = data.courses.filter((c) => !filter.value || c.modalidades.includes(filter.value))
        .sort((a, b) => order.value === 'semestre' ? (a.semestre - b.semestre) || String(a.grupo).localeCompare(String(b.grupo)) : b.resumen[order.value] - a.resumen[order.value])
      const table = el('table', undefined, { className: 'tc-matrix tc-overview' })
      const head = el('tr')
      for (const title of ['Materia', 'Grupo', 'Docente', 'Proyectos', 'Entregados', 'Vencidos', 'Por calificar', 'Promedio', '']) head.append(el('th', title, { scope: 'col' }))
      const thead = el('thead'); thead.append(head)
      const tbody = el('tbody')
      for (const c of rows) {
        const r = c.resumen
        const tr = el('tr')
        const name = el('th', undefined, { scope: 'row' }); name.append(el('span', c.asignatura, { className: 'tc-project' }), el('small', modalities(c.modalidades), { className: 'ac-muted' }))
        const teacher = el('td'); teacher.append(c.docentes.length ? el('span', c.docentes.join(', ')) : chip('Sin docente', 'danger'))
        const late = el('td'); late.append(r.vencidas ? chip(String(r.vencidas), 'danger') : el('span', '0'))
        const pending = el('td'); pending.append(r.sin_calificar ? chip(r.atrasadas ? `${r.sin_calificar} (${r.atrasadas} +5 días)` : String(r.sin_calificar), r.atrasadas ? 'danger' : 'warn') : el('span', '0'))
        const open = el('td')
        button('Abrir', async () => { tab = 'courses'; courseId = c.id; focus = null; await render() }, open)
        tr.append(name, el('td', `${c.semestre ?? '—'}° ${c.grupo || ''}`), teacher, el('td', String(r.proyectos)), el('td', `${r.entregadas}/${r.esperadas}`), late, pending, el('td', grade(r.promedio)), open)
        tbody.append(tr)
      }
      table.append(thead, tbody)
      wrap.replaceChildren(rows.length ? table : el('p', 'Ninguna materia con esa modalidad.', { className: 'ac-muted' }))
    }
    filter.onchange = draw; order.onchange = draw; draw()
  }

  // ------------------------------------------------------------------ Configuración
  async function renderConfig() {
    const { data } = await api('GET', '/tracking/config')
    if (disposed) return
    hint(content, 'Elige qué materias piden avances del proyecto y a qué modalidades aplican. Los proyectos de cada grupo con esa modalidad se ligan solos a la materia; el docente que la imparte abre los avances y los califica.')
    const add = panel('Agregar materia', content)
    if (!data.catalog.length) add.append(el('p', 'Todas las materias activas de la carrera ya están en la lista.', { className: 'ac-muted' }))
    else {
      const [f, done] = form(add, 'Agregar', async () => {
        const picked = Object.entries(checks).filter(([, box]) => box.checked).map(([m]) => m)
        if (!picked.length) throw new Error('Elige al menos una modalidad.')
        return (await api('POST', '/tracking/config', { asignatura_id: Number(subject.value), modalidades: picked })).message
      })
      const subject = field(f, 'Materia', select([['', 'Selecciona'], ...data.catalog.map((a) => [a.id, `${a.nombre} (${a.clave})${a.semestres.length ? ` · ${a.semestres.join(', ')}°` : ''}`])], '', { required: true }))
      const checks = modalityChecks(f, ['proyecto_integrador'])
      done()
    }
    const list = panel('Materias que piden avances', content)
    if (!data.subjects.length) list.append(el('p', 'Aún no hay materias.', { className: 'ac-muted' }))
    for (const s of data.subjects) list.append(subjectPanel(s))
  }

  function modalityChecks(parent, selected) {
    const group = box('tc-checks')
    group.append(el('span', 'Modalidades', { className: 'tc-checks-title' }))
    const checks = {}
    for (const [id, label] of Object.entries(MODALITIES)) {
      const wrap = el('label', undefined, { className: 'ac-check' })
      checks[id] = el('input', undefined, { type: 'checkbox', className: 'ac-checkbox', checked: selected.includes(id) })
      wrap.append(checks[id], el('span', label)); group.append(wrap)
    }
    parent.append(group)
    return checks
  }

  function subjectPanel(s) {
    const node = el('section', undefined, { className: `ac-panel tc-subject${s.activo ? '' : ' off'}` })
    node.append(box('ac-panel-head', el('h2', `${s.asignatura} (${s.clave})`), s.activo ? null : chip('Sin seguimiento', 'danger'), s.semestres.length ? chip(`${s.semestres.join(', ')}°`) : null))
    const [f, done] = form(node, 'Guardar modalidades', async () => {
      const picked = Object.entries(checks).filter(([, box]) => box.checked).map(([m]) => m)
      if (!picked.length) throw new Error('Elige al menos una modalidad.')
      return (await api('PUT', `/tracking/config/${s.id}`, { modalidades: picked })).message
    }, 'tc-inline')
    const checks = modalityChecks(f, s.modalidades)
    done()
    button(s.activo ? 'Dejar de pedir avances' : 'Volver a pedir avances', async () => {
      if (s.activo && !(await ask('Ya no se ligarán proyectos nuevos a esta materia. Los avances y entregas existentes se conservan. ¿Continuar?'))) return
      await act(() => api('PUT', `/tracking/config/${s.id}`, { activo: !s.activo }))
    }, node)

    const tpl = el('details', undefined, { className: 'ac-details' })
    tpl.append(el('summary', s.plantilla.length ? `Plantilla de avances (${s.plantilla.length})` : 'Plantilla de avances'))
    tpl.append(el('p', 'Avances base que cada docente agrega con un clic. La semana cuenta desde el inicio del periodo y fija la fecha sugerida; el docente puede cambiarla.', { className: 'ac-muted' }))
    const rows = el('div', undefined, { className: 'tc-template' })
    const total = el('p', '', { className: 'ac-muted' })
    const sum = () => { const value = [...rows.querySelectorAll('[data-k="ponderacion"]')].reduce((acc, i) => acc + (Number(i.value) || 0), 0); total.textContent = `Ponderación total: ${grade(value)} %${value > 100 ? ' — no debe pasar de 100 %' : ''}`; total.classList.toggle('tc-danger', value > 100) }
    const addRow = (t = {}) => {
      const row = box('tc-template-row')
      const make = (k, attrs) => { const i = input({ ...attrs, value: t[k] ?? '' }); i.dataset.k = k; return i }
      const typeSelect = select(Object.entries(DOC_TYPES), t.tipo_documento || 'documento', { ariaLabel: 'Tipo de archivo' }); typeSelect.dataset.k = 'tipo_documento'
      row.append(
        field(box('tc-tf'), 'Avance', make('nombre', { required: true, maxLength: 150, placeholder: 'Ej. Avance 1' })).parentElement.parentElement,
        field(box('tc-tf tc-sm'), 'Semana', make('semana', { type: 'number', min: 1, max: 24 })).parentElement.parentElement,
        field(box('tc-tf tc-sm'), '%', make('ponderacion', { type: 'number', min: 0, max: 100, step: '0.5' })).parentElement.parentElement,
        field(box('tc-tf'), 'Tipo', typeSelect).parentElement.parentElement)
      const remove = el('button', 'Quitar', { type: 'button', className: 'ac-btn tc-remove' })
      remove.onclick = () => { row.remove(); sum() }
      row.append(remove)
      row.addEventListener('input', sum)
      rows.append(row)
    }
    for (const t of s.plantilla) addRow(t)
    tpl.append(rows, total)
    const tools = box('tc-row-actions')
    const more = el('button', 'Agregar avance', { type: 'button', className: 'ac-btn' })
    more.onclick = () => { addRow(); sum() }
    tools.append(more)
    button('Guardar plantilla', () => act(() => api('PUT', `/tracking/config/${s.id}/template`, {
      items: [...rows.children].map((row) => {
        const value = (k) => row.querySelector(`[data-k="${k}"]`).value
        return { nombre: value('nombre').trim(), semana: value('semana') === '' ? null : Number(value('semana')), ponderacion: value('ponderacion') === '' ? null : Number(value('ponderacion')), tipo_documento: value('tipo_documento') }
      }).filter((item) => item.nombre),
    })), tools, 'primary')
    tpl.append(tools)
    sum()
    node.append(tpl)
    return node
  }

  async function render() {
    if (disposed) return
    for (const [id, node] of tabButtons) { node.classList.toggle('active', id === tab); node.setAttribute('aria-current', id === tab ? 'page' : 'false') }
    remember()
    window.dispatchEvent(new CustomEvent('sgpi:guide', { detail: { key: `tracking:${tab}` } }))
    // Se pinta en un contenedor nuevo y se cambia al terminar: sin parpadeo ni salto de la página.
    // Tras guardar se conserva la posición; al cambiar de pestaña o de materia se sube al inicio.
    const view = `${tab}:${courseId || ''}`
    const scroll = view === lastView ? window.scrollY : 0
    lastView = view
    const previous = content
    content = el('div', undefined, { className: 'tc-content' })
    try {
      if (tab === 'overview') await renderOverview()
      else if (tab === 'config') await renderConfig()
      else await renderCourses()
      if (disposed) return
      previous.replaceWith(content)
      window.scrollTo?.({ top: scroll })
      if (revealDetail) { revealDetail = false; content.querySelector('.tc-detail')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) }
    } catch (e) {
      if (disposed) return
      if (courseId && [403, 404].includes(e?.response?.status ?? e?.status)) { courseId = null; focus = null; content = previous; await render(); status.textContent = error(e); return }
      content.replaceChildren(el('p', error(e)))
      button('Reintentar', () => render(), content)
      previous.replaceWith(content)
    }
  }

  render()
  return () => { disposed = true; root.replaceChildren() }
}
