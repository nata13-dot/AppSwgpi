// Seguimiento de tesis. Mismo módulo en la app (src/shared/thesisConsole.js) y en la web (assets/js/thesis-console.js).
// api(method, url, body): JSON; con method 'BLOB' devuelve el archivo como Blob (para verlo dentro del sistema).
// Todo lo que escribe el usuario se pinta como texto.
const ROLE_LABEL = { director: 'Director', codirector: 'Codirector', revisor: 'Revisor', invitado: 'Docente invitado' }
const STATE = {
  sin_entregar: ['', 'Sin entregar'],
  en_revision: ['warn', 'En revisión'],
  aprobado: ['ok', 'Aprobado'],
  por_corregir: ['danger', 'Por corregir'],
}
const COURSE_STATE = { activo: ['ok', 'En desarrollo'], liberada: ['ok', 'Liberada'], cerrado: ['', 'Cerrado'] }
const COMMON_CHAPTERS = ['Introducción', 'Marco teórico', 'Metodología', 'Desarrollo', 'Resultados', 'Conclusiones']

export function mountThesisConsole(root, api, user, options = {}) {
  const ask = (text) => (options.confirm ? options.confirm(text) : Promise.resolve(window.confirm(text)))
  let disposed = false
  let courseId = Number(new URLSearchParams(window.location.search).get('course')) || null
  let creating = false
  let viewing = null // { envio, page }
  let lastView = ''
  let autoOpened = false // el alumno con un solo curso entra directo a él
  let revealViewer = false
  const blobs = new Map()

  const el = (tag, text, attrs = {}) => Object.assign(document.createElement(tag), attrs, text === undefined || text === null ? {} : { textContent: String(text) })
  const box = (className, ...children) => { const node = el('div', undefined, { className }); node.append(...children.filter(Boolean)); return node }
  const error = (e) => e?.response?.data?.message || e?.response?.data?.error || Object.values(e?.response?.data?.errors || {}).flat().join(' ') || e?.message || 'No fue posible completar la operación.'
  const date = (value) => value ? new Date(value).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'
  const localInput = (value) => { if (!value) return ''; const d = new Date(value); const pad = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
  const serverDate = (value) => value ? `${value.replace('T', ' ')}:00` : null
  const grade = (value) => value === null || value === undefined ? '—' : Number(value).toFixed(Number(value) % 1 ? 1 : 0)

  const status = el('p', '', { role: 'status', className: 'ac-status' })
  let content = box('tc-content', el('p', 'Cargando…', { className: 'ac-muted' }))
  root.classList.add('academic-console', 'tracking-console', 'thesis-console')
  root.replaceChildren(status, content)

  const notice = (text) => { status.textContent = ''; const toast = el('div', text, { role: 'status', className: 'ac-toast' }); document.body.append(toast); setTimeout(() => toast.remove(), 2600) }
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
  const textarea = (attrs) => el('textarea', undefined, { className: 'ac-input', rows: 2, ...attrs })
  const select = (pairs, value = '', attrs = {}) => {
    const node = el('select', undefined, { className: 'ac-input', ...attrs })
    for (const [id, text] of pairs) node.append(el('option', text, { value: String(id) }))
    node.value = value == null ? '' : String(value)
    return node
  }
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
  const act = async (fn) => { const result = await fn(); notice(result?.message || 'Listo.'); await render() }
  const remember = () => {
    try { const url = new URL(window.location.href); if (courseId) url.searchParams.set('course', String(courseId)); else url.searchParams.delete('course'); window.history.replaceState(window.history.state, '', url) } catch { /* sin historial */ }
  }
  const pills = (parent, title, items, selected = []) => {
    const group = box('tc-checks tc-types')
    if (title) group.append(el('span', title, { className: 'tc-checks-title' }))
    const checks = new Map()
    for (const [value, label] of items) {
      const wrap = el('label', undefined, { className: 'ac-check tc-pill' })
      const node = el('input', undefined, { type: 'checkbox', className: 'ac-checkbox', checked: selected.includes(value) })
      checks.set(value, node); wrap.append(node, el('span', label)); group.append(wrap)
    }
    parent.append(group)
    return { group, checks, values: () => [...checks].filter(([, node]) => node.checked).map(([value]) => value) }
  }

  // ------------------------------------------------------------------ Lista
  async function renderList() {
    const data = await api('GET', '/thesis')
    if (disposed) return
    if (!autoOpened && Number(user?.active_profile_id ?? user?.perfil_id) === 3 && data.data.length === 1) { autoOpened = true; courseId = data.data[0].id; remember(); return renderCourse() }
    autoOpened = true
    const head = box('tc-row-actions tc-list-actions')
    if (data.can_create) button('Nuevo curso de tesis', async () => { creating = true; await render() }, head, 'primary')
    content.append(head)
    if (!data.data.length) {
      hint(content, data.can_create ? 'Aún no hay cursos de tesis. Crea uno sobre la tesis de un alumno: capítulos, docentes que revisan y fechas de entrega.' : 'No tienes cursos de tesis. Aparecerán aquí cuando te asignen a uno.')
      return
    }
    const grid = box('tc-cards')
    for (const course of data.data) {
      const [kind, label] = COURSE_STATE[course.estado] || ['', course.estado]
      const card = el('article', undefined, { className: 'tc-card' })
      card.append(
        box('tc-card-head', el('h3', course.titulo), chip(label, kind)),
        el('p', course.alumno, { className: 'ac-muted' }),
        box('tc-mini',
          el('span', `${course.aprobados}/${course.capitulos} capítulos aprobados`),
          course.general !== null ? el('span', `General ${grade(course.general)}`) : null,
          course.por_revisar ? chip(`${course.por_revisar} por revisar`, 'warn') : null,
          course.proxima ? chip(`${course.proxima.titulo}: ${date(course.proxima.fecha_limite)}`) : null),
        el('small', course.revisores.join(', '), { className: 'ac-muted' }))
      button('Abrir', async () => { courseId = course.id; viewing = null; await render() }, card, 'primary')
      grid.append(card)
    }
    content.append(grid)
  }

  // ------------------------------------------------------------------ Crear / editar
  async function renderCreate() {
    const { data } = await api('GET', '/thesis/options')
    if (disposed) return
    button('← Volver', async () => { creating = false; await render() }, content, 'tc-back')
    const node = panel('Nuevo curso de tesis', content)
    if (!data.projects.length) { hint(node, 'No hay tesis activas en la carrera (proyectos de tipo tesis). Regístrala primero en Proyectos y tesis.'); return }
    hint(node, 'Elige la tesis y su alumno. Sus docentes (director y revisores) se agregan solos; puedes sumar más. Define los capítulos y, si quieres, las entregas con fecha.')
    const [f, done] = form(node, 'Crear curso', async () => {
      const capitulos = chapterRows.read()
      if (!capitulos.length) throw new Error('Agrega al menos un capítulo.')
      const revisores = reviewerRows.read()
      if (!revisores.some((r) => r.rol === 'director')) throw new Error('Indica quién dirige la tesis.')
      const response = await api('POST', '/thesis', { proyecto_id: Number(project.value), estudiante_id: student.value, titulo: title.value || null, descripcion: description.value || null, capitulos, revisores, plan: planRows.read() })
      creating = false; courseId = response.id
      return response.message
    })
    const project = field(f, 'Tesis', select([['', 'Selecciona'], ...data.projects.map((p) => [p.id, p.titulo])], '', { required: true }))
    const student = field(f, 'Alumno', select([['', 'Elige primero la tesis']], '', { required: true }))
    const title = field(f, 'Título del curso', input({ maxLength: 255, placeholder: 'Por defecto, el de la tesis' }))
    const description = field(f, 'Descripción', input({ maxLength: 3000 }))
    const chapterRows = chaptersEditor(f, [])
    const reviewerRows = reviewersEditor(f, data.teachers, [])
    const planRows = planEditor(f, [], () => chapterRows.count())
    project.onchange = () => {
      const p = data.projects.find((item) => String(item.id) === project.value)
      student.replaceChildren(...[['', p ? 'Selecciona' : 'Elige primero la tesis'], ...(p?.alumnos || []).map((a) => [a.id, a.con_curso ? `${a.nombre} (ya tiene curso)` : a.nombre])]
        .map(([value, text]) => el('option', text, { value: String(value), disabled: Boolean(p?.alumnos.find((a) => a.id === value)?.con_curso) })))
      if (p?.alumnos.filter((a) => !a.con_curso).length === 1) student.value = p.alumnos.find((a) => !a.con_curso).id
      reviewerRows.reset(p?.docentes || [])
      if (p && !title.value) title.placeholder = p.titulo
    }
    done()
  }

  function chaptersEditor(parent, chapters) {
    const wrap = box('tc-wide tc-editor')
    const head = box('tc-pick-head', el('strong', 'Capítulos'))
    const rows = box('tc-template')
    const add = (c = {}) => {
      const row = box('tc-template-row tc-chapter-row')
      if (c.id) row.dataset.id = String(c.id)
      const name = input({ required: true, maxLength: 200, value: c.titulo || '', placeholder: `Capítulo ${rows.children.length + 1}` })
      name.dataset.k = 'titulo'
      row.append(el('span', '', { className: 'tc-chapter-number' }), name)
      const remove = el('button', 'Quitar', { type: 'button', className: 'ac-btn tc-remove' })
      remove.onclick = () => { row.remove(); renumber() }
      row.append(remove); rows.append(row); renumber()
    }
    const renumber = () => { [...rows.children].forEach((row, i) => { row.firstChild.textContent = `${i + 1}.` }); parent.dispatchEvent(new CustomEvent('chapters')) }
    const common = el('button', 'Estructura común (6)', { type: 'button', className: 'ac-btn' })
    common.onclick = () => { rows.replaceChildren(); COMMON_CHAPTERS.forEach((t) => add({ titulo: t })) }
    head.append(common)
    const more = el('button', 'Agregar capítulo', { type: 'button', className: 'ac-btn' })
    more.onclick = () => add()
    for (const c of chapters) add(c)
    if (!chapters.length) add()
    wrap.append(head, rows, more)
    parent.append(wrap)
    return {
      count: () => rows.children.length,
      read: () => [...rows.children].map((row) => ({ id: row.dataset.id ? Number(row.dataset.id) : null, titulo: row.querySelector('[data-k="titulo"]').value.trim() })).filter((c) => c.titulo),
    }
  }

  function reviewersEditor(parent, teachers, current) {
    const wrap = box('tc-wide tc-editor')
    wrap.append(box('tc-pick-head', el('strong', 'Docentes que revisan')))
    const rows = box('tc-template')
    const add = (r = {}) => {
      const row = box('tc-template-row tc-reviewer-row')
      const who = select([['', 'Selecciona docente'], ...teachers.map((t) => [t.id, t.nombre])], r.id || '', { ariaLabel: 'Docente' }); who.dataset.k = 'docente_id'
      const role = select(Object.entries(ROLE_LABEL), r.rol || 'revisor', { ariaLabel: 'Rol' }); role.dataset.k = 'rol'
      const remove = el('button', 'Quitar', { type: 'button', className: 'ac-btn tc-remove' })
      remove.onclick = () => row.remove()
      row.append(who, role, remove); rows.append(row)
    }
    const more = el('button', 'Agregar docente', { type: 'button', className: 'ac-btn' })
    more.onclick = () => add()
    for (const r of current) add(r)
    if (!current.length) add({ rol: 'director' })
    wrap.append(rows, more)
    parent.append(wrap)
    return {
      reset: (list) => { rows.replaceChildren(); list.forEach(add); if (!list.length) add({ rol: 'director' }) },
      read: () => [...rows.children].map((row) => ({ docente_id: row.querySelector('[data-k="docente_id"]').value, rol: row.querySelector('[data-k="rol"]').value })).filter((r) => r.docente_id),
    }
  }

  function planEditor(parent, plan, chapterCount) {
    const wrap = box('tc-wide tc-editor')
    wrap.append(box('tc-pick-head', el('strong', 'Entregas planeadas (opcional)')), el('p', 'Cada entrega con su fecha límite y los capítulos que se esperan. El alumno recibe recordatorio 3 y 1 días antes.', { className: 'ac-muted' }))
    const rows = box('tc-template')
    const add = (p = {}) => {
      const row = box('tc-template-row tc-plan-row')
      if (p.id) row.dataset.id = String(p.id)
      const name = input({ required: true, maxLength: 150, value: p.titulo || `Entrega ${rows.children.length + 1}` }); name.dataset.k = 'titulo'
      const due = input({ type: 'datetime-local', value: localInput(p.fecha_limite), ariaLabel: 'Fecha límite' }); due.dataset.k = 'fecha'
      const remove = el('button', 'Quitar', { type: 'button', className: 'ac-btn tc-remove' })
      remove.onclick = () => row.remove()
      const line = box('tc-types-line')
      row.selected = p.capitulos || []
      row.draw = () => { const before = row.picker ? row.picker.values() : row.selected; line.replaceChildren(); row.picker = pills(line, 'Capítulos', Array.from({ length: chapterCount() }, (_, i) => [i + 1, String(i + 1)]), before) }
      row.draw()
      row.append(field(box('tc-tf'), 'Entrega', name).parentElement.parentElement, field(box('tc-tf'), 'Fecha límite', due).parentElement.parentElement, remove, line)
      rows.append(row)
    }
    parent.addEventListener('chapters', () => [...rows.children].forEach((row) => row.draw?.()))
    const more = el('button', 'Agregar entrega', { type: 'button', className: 'ac-btn' })
    more.onclick = () => add()
    for (const p of plan) add(p)
    wrap.append(rows, more)
    parent.append(wrap)
    return {
      read: () => [...rows.children].map((row) => ({
        id: row.dataset.id ? Number(row.dataset.id) : null, titulo: row.querySelector('[data-k="titulo"]').value.trim(),
        fecha_limite: serverDate(row.querySelector('[data-k="fecha"]').value), capitulos: row.picker.values(),
      })).filter((p) => p.titulo),
    }
  }

  // ------------------------------------------------------------------ Curso
  async function renderCourse() {
    const { data } = await api('GET', `/thesis/${courseId}`)
    if (disposed) return
    const { course, me } = data
    const student = me.role === 'student'
    const chapterById = new Map(data.capitulos.map((c) => [c.id, c]))
    button('← Volver', async () => { courseId = null; viewing = null; await render() }, content, 'tc-back')

    const [kind, label] = COURSE_STATE[course.estado] || ['', course.estado]
    const head = panel(course.titulo, content, chip(label, kind))
    head.append(el('p', `${course.alumno.nombre} · ${data.revisores.map((r) => `${r.nombre} (${ROLE_LABEL[r.rol] || r.rol})`).join(', ')}`, { className: 'ac-muted' }))
    if (course.descripcion) head.append(el('p', course.descripcion))
    const approved = data.capitulos.filter((c) => c.estado === 'aprobado').length
    head.append(box('tc-stats',
      box(`tc-stat${data.general !== null && data.general < data.aprobatoria ? ' danger' : ''}`, el('strong', grade(data.general)), el('span', 'Puntaje general')),
      box('tc-stat', el('strong', `${approved}/${data.capitulos.length}`), el('span', 'Capítulos aprobados')),
      box('tc-stat', el('strong', String(data.envios.length)), el('span', 'Entregas'))))
    if (course.estado === 'liberada') hint(head, `Tesis liberada el ${date(course.liberada_en)}: lista para su evaluación de titulación.`)
    if (me.can_manage) {
      const actions = box('tc-row-actions')
      if (data.puede_liberar) button('Liberar tesis', async () => {
        if (!(await ask('Todos los capítulos están aprobados. La tesis quedará liberada para titulación y el alumno ya no podrá entregar. ¿Continuar?'))) return
        await act(() => api('POST', `/thesis/${courseId}/release`))
      }, actions, 'primary')
      if (course.estado !== 'activo') button('Reabrir', () => act(() => api('POST', `/thesis/${courseId}/reopen`)), actions)
      const edit = el('div', undefined, { className: 'ac-details tc-edit', hidden: true })
      button('Editar capítulos y entregas', async () => { edit.hidden = !edit.hidden }, actions)
      const people = el('div', undefined, { className: 'ac-details tc-edit', hidden: true })
      button('Docentes', async () => { people.hidden = !people.hidden; if (!people.dataset.loaded) await loadPeople(people, data) }, actions)
      head.append(actions, edit, people)
      const [f, done] = form(edit, 'Guardar', async () => (await api('PUT', `/thesis/${courseId}`, { titulo: course.titulo, descripcion: course.descripcion, capitulos: chapters.read(), plan: plan.read() })).message)
      const chapters = chaptersEditor(f, data.capitulos)
      const plan = planEditor(f, data.plan, () => chapters.count())
      done()
    }

    // Capítulos
    const chaptersPanel = panel('Capítulos', content, chip(`Aprobatoria ${data.aprobatoria}`))
    if (student) chaptersPanel.append(el('p', 'Cada capítulo se aprueba cuando todos tus docentes lo revisan y el promedio llega a la mínima aprobatoria. Aquí ves el puntaje general y sus comentarios.', { className: 'ac-muted' }))
    const list = box('tc-chapters')
    for (const c of data.capitulos) {
      const [k, text] = STATE[c.estado] || ['', c.estado]
      const row = box('ac-row tc-row tc-chapter',
        box('tc-row-main',
          box('tc-row-title', el('strong', `${c.numero}. ${c.titulo}`), chip(text, k)),
          el('small', c.envio_id ? `Última versión: entrega ${data.envios.find((e) => e.id === c.envio_id)?.numero ?? ''} · revisado por ${c.revisados} de ${c.revisores}` : 'Aún no se entrega', { className: 'ac-muted' })))
      if (!student) row.append(box('tc-chapter-score', el('strong', grade(c.promedio)), el('small', c.revisiones.map((r) => `${r.nombre.split(' ')[0]} ${grade(r.puntaje)}`).join(' · '), { className: 'ac-muted' })))
      list.append(row)
    }
    chaptersPanel.append(list)

    // Plan
    if (data.plan.length) {
      const planPanel = panel('Entregas planeadas', content)
      for (const p of data.plan) {
        const late = !p.entregado && p.fecha_limite && new Date(p.fecha_limite) < new Date()
        planPanel.append(box('ac-row tc-row', box('tc-row-main',
          box('tc-row-title', el('strong', p.titulo), chip(p.entregado ? 'Entregada' : late ? 'Vencida' : 'Pendiente', p.entregado ? 'ok' : late ? 'danger' : 'warn')),
          el('small', `${p.fecha_limite ? `Vence ${date(p.fecha_limite)}` : 'Sin fecha'}${p.capitulos.length ? ` · capítulos ${p.capitulos.join(', ')}` : ''}`, { className: 'ac-muted' }))))
      }
    }

    // Nueva entrega (alumno)
    if (me.can_submit) {
      const up = panel('Nueva entrega', content)
      hint(up, 'Sube tu documento en PDF y marca qué capítulos incluye. Si vuelves a entregar un capítulo, tus docentes revisan la nueva versión y la anterior queda en el historial.')
      const [f, done] = form(up, 'Enviar entrega', async () => {
        const chapters = picker.values()
        if (!file.files[0]) throw new Error('Elige el archivo PDF.')
        if (!chapters.length) throw new Error('Marca al menos un capítulo.')
        const body = new FormData()
        body.append('archivo', file.files[0])
        chapters.forEach((id) => body.append('capitulos[]', String(id)))
        if (plan.value) body.append('plan_id', plan.value)
        if (comment.value) body.append('comentario', comment.value)
        return (await api('POST', `/thesis/${courseId}/submissions`, body)).message
      })
      const file = field(f, 'Documento (PDF)', input({ type: 'file', accept: '.pdf,application/pdf', required: true }))
      const plan = field(f, 'Corresponde a', select([['', 'Entrega libre'], ...data.plan.filter((p) => !p.entregado).map((p) => [p.id, p.titulo])], ''))
      const picker = pills(f, 'Capítulos que incluye', data.capitulos.map((c) => [c.id, `${c.numero}. ${c.titulo}`]))
      plan.onchange = () => {
        const p = data.plan.find((item) => String(item.id) === plan.value)
        if (p) for (const [id, node] of picker.checks) node.checked = p.capitulos.includes(chapterById.get(id)?.numero)
      }
      const comment = field(f, 'Comentario para tus docentes', textarea({ maxLength: 2000 }))
      comment.parentElement.classList.add('tc-wide')
      done()
    }

    // Historial de entregas
    const hist = panel('Entregas', content)
    if (!data.envios.length) hist.append(el('p', student ? 'Aún no envías ninguna entrega.' : 'El alumno aún no envía ninguna entrega.', { className: 'ac-muted' }))
    for (const envio of data.envios) hist.append(await submissionCard(envio, data, chapterById))
  }

  async function loadPeople(parent, data) {
    parent.dataset.loaded = '1'
    const options = await api('GET', '/thesis/options').catch(() => null)
    const teachers = options?.data?.teachers || data.revisores.map((r) => ({ id: r.id, nombre: r.nombre }))
    const [f, done] = form(parent, 'Guardar docentes', async () => {
      const revisores = editor.read()
      if (!revisores.some((r) => r.rol === 'director')) throw new Error('El curso necesita un director.')
      return (await api('PUT', `/thesis/${courseId}/reviewers`, { revisores })).message
    })
    const editor = reviewersEditor(f, teachers, data.revisores)
    done()
  }

  async function submissionCard(envio, data, chapterById) {
    const { me } = data
    const student = me.role === 'student'
    const card = el('article', undefined, { className: 'tc-submission' })
    const titles = envio.capitulos.map((id) => chapterById.get(id)).filter(Boolean)
    card.append(box('tc-row-title', el('strong', `Entrega ${envio.numero}`), el('small', date(envio.enviado_en), { className: 'ac-muted' }),
      ...titles.map((c) => chip(`Cap. ${c.numero}`, envio.vigentes.includes(c.id) ? '' : 'tc-old'))))
    if (envio.comentario) card.append(el('p', `«${envio.comentario}»`, { className: 'ac-muted tc-quote' }))
    if (envio.vigentes.length < envio.capitulos.length) card.append(el('small', 'Los capítulos en gris tienen una versión más reciente.', { className: 'ac-muted' }))
    const tools = box('tc-row-actions')
    const open = viewing && viewing.envio === envio.id
    button(open ? 'Ocultar documento' : 'Ver documento', async () => { viewing = open ? null : { envio: envio.id, page: 1 }; revealViewer = !open; await render() }, tools, open ? 'ghost' : 'primary')
    card.append(tools)
    if (open) card.append(await viewer(envio))

    // Comentarios por capítulo (y puntaje para quien no es el alumno)
    for (const c of titles) {
      const reviews = envio.revisiones.filter((r) => r.capitulo_id === c.id)
      const mine = reviews.find((r) => r.docente_id === me.id)
      const block = box('tc-review-block', el('strong', `${c.numero}. ${c.titulo}`))
      if (!reviews.length && !(me.can_review && envio.vigentes.includes(c.id))) block.append(el('small', 'Sin revisiones todavía.', { className: 'ac-muted' }))
      const editable = me.can_review && envio.vigentes.includes(c.id)
      for (const r of reviews) {
        if (student && !r.comentario) continue
        if (editable && r.docente_id === me.id) continue // la propia se edita en el formulario de abajo
        block.append(box('tc-review', el('span', r.nombre, { className: 'tc-review-who' }), !student ? chip(grade(r.puntaje), r.puntaje >= data.aprobatoria ? 'ok' : 'danger') : null, r.comentario ? el('p', r.comentario) : null))
      }
      if (editable) {
        const [f, done] = form(block, mine ? 'Actualizar revisión' : 'Guardar revisión', async () =>
          (await api('PUT', `/thesis/submissions/${envio.id}/chapters/${c.id}/review`, { puntaje: Number(score.value), comentario: text.value || null })).message, 'tc-review-form')
        const score = field(f, 'Puntaje (0 a 100)', input({ type: 'number', min: 0, max: 100, step: '0.5', required: true, value: mine?.puntaje ?? '' }))
        const text = field(f, 'Comentario', textarea({ maxLength: 5000, value: mine?.comentario || '' }))
        text.parentElement.classList.add('tc-wide')
        done()
      }
      card.append(block)
    }

    // Notas por página
    const notes = box('tc-review-block', el('strong', 'Notas en el documento'))
    if (!envio.anotaciones.length) notes.append(el('small', 'Sin notas.', { className: 'ac-muted' }))
    for (const n of envio.anotaciones) {
      const row = box('tc-note')
      const go = el('button', `p. ${n.pagina}`, { type: 'button', className: 'ac-btn tc-page' })
      go.title = 'Ir a la página en el documento'
      go.onclick = async () => { viewing = { envio: envio.id, page: n.pagina }; revealViewer = true; await render() }
      row.append(go, box('tc-note-text', el('span', `${n.nombre}${n.capitulo_id && chapterById.get(n.capitulo_id) ? ` · cap. ${chapterById.get(n.capitulo_id).numero}` : ''}`, { className: 'tc-review-who' }), el('p', n.texto)))
      if (n.mia && me.can_review) button('Quitar', () => act(() => api('DELETE', `/thesis/annotations/${n.id}`)), row)
      notes.append(row)
    }
    if (me.can_review) {
      const [f, done] = form(notes, 'Agregar nota', async () => (await api('POST', `/thesis/submissions/${envio.id}/annotations`, { pagina: Number(page.value), texto: text.value, capitulo_id: chapter.value ? Number(chapter.value) : null })).message, 'tc-review-form')
      const page = field(f, 'Página', input({ type: 'number', min: 1, max: 2000, required: true, value: viewing?.envio === envio.id ? viewing.page : '' }))
      const chapter = field(f, 'Capítulo', select([['', 'General'], ...titles.map((c) => [c.id, `${c.numero}. ${c.titulo}`])], ''))
      const text = field(f, 'Nota', textarea({ maxLength: 2000, required: true }))
      text.parentElement.classList.add('tc-wide')
      done()
    }
    card.append(notes)
    return card
  }

  async function viewer(envio) {
    const wrap = box('tc-viewer')
    try {
      if (!blobs.has(envio.id)) {
        const blob = await api('BLOB', `/thesis/submissions/${envio.id}/file`)
        blobs.set(envio.id, URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' })))
      }
      const frame = el('iframe', undefined, { className: 'tc-frame', title: `Entrega ${envio.numero}` })
      frame.src = `${blobs.get(envio.id)}#page=${viewing?.page || 1}`
      wrap.append(frame)
    } catch (e) {
      wrap.append(el('p', error(e), { className: 'ac-muted' }))
    }
    return wrap
  }

  async function render() {
    if (disposed) return
    remember()
    window.dispatchEvent(new CustomEvent('sgpi:guide', { detail: { key: courseId ? 'thesis:course' : 'thesis:list' } }))
    const view = `${creating}:${courseId || ''}`
    const scroll = view === lastView ? window.scrollY : 0
    lastView = view
    const previous = content
    content = el('div', undefined, { className: 'tc-content' })
    try {
      if (creating) await renderCreate()
      else if (courseId) await renderCourse()
      else await renderList()
      if (disposed) return
      previous.replaceWith(content)
      window.scrollTo?.({ top: scroll })
      if (revealViewer) { revealViewer = false; content.querySelector('.tc-viewer')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) }
    } catch (e) {
      if (disposed) return
      if (courseId && [403, 404].includes(e?.response?.status ?? e?.status)) { courseId = null; content = previous; await render(); status.textContent = error(e); return }
      content.replaceChildren(el('p', error(e)))
      button('Reintentar', () => render(), content)
      previous.replaceWith(content)
    }
  }

  render()
  return () => { disposed = true; for (const url of blobs.values()) URL.revokeObjectURL(url); root.replaceChildren() }
}
