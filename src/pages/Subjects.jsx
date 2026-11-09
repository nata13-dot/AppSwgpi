import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiChevronRight, FiEdit2, FiFileText, FiLayers, FiPlus, FiSave, FiStar, FiTrash2, FiGitBranch } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { sendToArchive } from '../services/archive'
import { useAuth } from '../hooks/useAuth'
import { isAdmin } from '../lib/permissions'
import { matchesSearch } from '../utils/formatters'
import { Badge, Button, Card, confirmAction, DataTable, Empty, ErrorState, Field, IconButton, Loading, Page, Pager, SearchInput, Sheet } from '../components/ui'

const dateOnly = (value) => (value ? String(value).substring(0, 10) : '')
const rangeState = (start, end) => {
  if (!start || !end) return <span className="muted small-text">Sin rango</span>
  const now = new Date()
  if (now >= new Date(start) && now <= new Date(end)) return <Badge tone="success">En rango</Badge>
  return now > new Date(end) ? <Badge tone="danger">Vencida</Badge> : <Badge tone="warning">Próxima</Badge>
}
async function allSubjects() {
  const catalog = []
  for (let page = 1, last = 1; page <= last; page++) {
    const { data } = await api.get('/asignaturas', { params: { page, per_page: 100 } })
    catalog.push(...(data.data || []))
    last = Number(data.last_page || 1)
  }
  return catalog
}

/** Asignaturas, cargas por grupo y competencias (Frontend_Swgpi/pages/admin/asignaturas.php). */
export default function Subjects() {
  const client = useQueryClient()
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(15)
  const searchFilter = new URLSearchParams(location.search).get('q') || ''
  const [sheet, setSheet] = useState(() => (location.hash === '#competencias' ? { type: 'launcher' } : null))
  const query = useQuery({ queryKey: ['asignaturas', page, perPage, searchFilter], queryFn: () => api.get('/asignaturas', { params: { page, per_page: perPage, q: searchFilter || undefined } }).then((response) => response.data), placeholderData: (previous) => previous })
  const rows = query.data?.data || []
  const refresh = () => client.invalidateQueries({ queryKey: ['asignaturas'] })
  const remove = async (subject) => {
    if (!(await confirmAction({ title: 'Eliminar asignatura', text: '¿Eliminar esta asignatura?', confirmText: 'Sí, eliminar', danger: true }))) return
    try { await api.delete(`/asignaturas/${subject.id}`); toast.success('Asignatura eliminada'); if (rows.length === 1 && page > 1) setPage(page - 1); refresh() } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <Page title="Gestión de asignaturas" subtitle="Catálogo de la carrera, cargas por grupo y competencias."
      actions={<>
        <Button icon={FiPlus} onClick={() => setSheet({ type: 'subject', subject: null })}>Nueva asignatura</Button>
        <Button variant="ghost" icon={FiLayers} onClick={() => setSheet({ type: 'groups' })}>Gestionar cargas</Button>
        <Button variant="ghost" icon={FiStar} onClick={() => setSheet({ type: 'launcher' })}>Ver competencias</Button>
      </>}>
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable rows={rows} empty={<Empty title="Sin asignaturas" message="Registra la primera asignatura o usa la carga inicial." />}
            columns={[
              { key: 'nombre', label: 'Asignatura', primary: true, render: (subject) => <span className="cell-main"><strong>{subject.nombre}</strong><small>{subject.clave || 'Sin clave'}</small></span> },
              { key: 'competencias', label: 'Competencias', render: (subject) => <Badge tone="info">{Number(subject.competencias_count || 0)}</Badge> },
              { key: 'descripcion', label: 'Descripción', hideOnMobile: true, render: (subject) => <small>{subject.descripción || '—'}</small> },
            ]}
            actions={(subject) => <>
              <IconButton icon={FiStar} label="Ver competencias" onClick={() => setSheet({ type: 'competencies', subject })} />
              <IconButton icon={FiGitBranch} label="Ver estructura" onClick={() => setSheet({ type: 'structure', subject })} />
              <IconButton icon={FiEdit2} label="Editar asignatura" onClick={() => setSheet({ type: 'subject', subject })} />
              <IconButton icon={FiTrash2} className="danger" label="Eliminar asignatura" onClick={() => remove(subject)} />
            </>} />
        )}
        <div className="row-wrap pager-row">
          <select className="control compact" aria-label="Asignaturas por página" value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }}>{[15, 25, 50, 100].map((value) => <option key={value} value={value}>{value} por página</option>)}</select>
          <span className="spacer" /><Pager meta={query.data} onPage={setPage} />
        </div>
      </Card>
      {sheet?.type === 'subject' && <SubjectForm subject={sheet.subject} onClose={() => setSheet(null)} onSaved={refresh} />}
      {sheet?.type === 'launcher' && <CompetencyLauncher onClose={() => setSheet(null)} onPick={(subject) => setSheet({ type: 'competencies', subject })} />}
      {sheet?.type === 'competencies' && <Competencies subject={sheet.subject} onClose={() => setSheet(null)} />}
      {sheet?.type === 'structure' && <Structure subjectId={sheet.subject.id} onClose={() => setSheet(null)} />}
      {sheet?.type === 'groups' && <SubjectGroups onClose={() => setSheet(null)} />}
    </Page>
  )
}

function SubjectForm({ subject, onClose, onSaved }) {
  const [form, setForm] = useState({ clave: subject?.clave || '', nombre: subject?.nombre || '', descripcion: subject?.descripción || '' })
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    const data = { clave: form.clave.trim() || null, nombre: form.nombre.trim(), descripción: form.descripcion.trim() || null }
    setSaving(true)
    try {
      if (subject) await api.put(`/asignaturas/${subject.id}`, data)
      else await api.post('/asignaturas', data)
      toast.success('Asignatura guardada correctamente')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  return (
    <Sheet open title={subject ? 'Editar asignatura' : 'Nueva asignatura'} onClose={onClose} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="subject-form" icon={FiSave} loading={saving}>Guardar</Button></>}>
      <form id="subject-form" className="stack" onSubmit={submit}>
        <Field label="Clave"><input className="control" maxLength={50} value={form.clave} onChange={(event) => setForm({ ...form, clave: event.target.value })} /></Field>
        <Field label="Nombre"><input className="control" required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
        <Field label="Descripción"><textarea className="control" rows={3} value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
      </form>
    </Sheet>
  )
}

function CompetencyLauncher({ onClose, onPick }) {
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['asignaturas', 'all'], queryFn: allSubjects, staleTime: 30_000 })
  const list = (query.data || []).filter((subject) => matchesSearch(`${subject.clave || ''} ${subject.nombre || ''}`, search))
  return (
    <Sheet open title="Competencias" subtitle="Selecciona una asignatura para consultar sus competencias y entregables." onClose={onClose} size="sm">
      <SearchInput value={search} onChange={setSearch} placeholder="Clave o nombre de la asignatura" autoFocus />
      <div className="option-list mt-3">
        {query.isLoading ? <Loading /> : list.map((subject) => <button type="button" key={subject.id} onClick={() => onPick(subject)}><span><strong>{subject.nombre}</strong><small>{subject.clave || 'Sin clave'}</small></span><FiChevronRight /></button>)}
        {!query.isLoading && !list.length && <Empty message="No se encontraron asignaturas." />}
      </div>
    </Sheet>
  )
}

function Competencies({ subject, onClose }) {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['competencias', subject.id], queryFn: () => api.get('/competencias', { params: { asignatura_id: subject.id, per_page: 100 } }).then((response) => response.data.data || []) })
  return (
    <Sheet open title={`Competencias · ${subject.nombre}`} subtitle="Consulta las competencias de esta asignatura y sus entregables." onClose={onClose} size="lg">
      {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} /> : (
        <DataTable rows={query.data} empty={<Empty message="Esta asignatura no tiene competencias registradas." />}
          columns={[
            { key: 'nombre', label: 'Competencia', primary: true, render: (item) => <strong>{item.nombre}</strong> },
            { key: 'periodo', label: 'Periodo', render: (item) => <small>{dateOnly(item.fecha_inicio) || 'Sin inicio'} – {dateOnly(item.fecha_fin) || 'Sin fin'}</small> },
            { key: 'entregables', label: 'Entregables', render: (item) => <Badge tone="info">{Number(item.deliverables_count || 0)}</Badge> },
            { key: 'estado', label: 'Estado', render: (item) => rangeState(item.fecha_inicio, item.fecha_fin) },
          ]}
          actions={(item) => <IconButton icon={FiFileText} label="Gestionar entregables" onClick={() => navigate(`/deliverables?competencia_id=${item.id}`)} />} />
      )}
    </Sheet>
  )
}

function Structure({ subjectId, onClose }) {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['asignatura', subjectId], queryFn: () => api.get(`/asignaturas/${subjectId}`).then((response) => response.data) })
  const competencies = query.data?.competencias || []
  return (
    <Sheet open title={query.data?.nombre || 'Estructura de asignatura'} onClose={onClose} size="md">
      {query.isLoading ? <Loading /> : !competencies.length ? <Empty message="Esta asignatura aún no tiene competencias asignadas." /> : (
        <div className="stack">
          {competencies.map((competency) => (
            <section key={competency.id} className="card-app tinted">
              <div className="row-wrap"><div className="cell-main"><strong>{competency.nombre}</strong><small>{competency.fecha_inicio || 'Sin inicio'} – {competency.fecha_fin || 'Sin fin'}</small></div><span className="spacer" /><Button size="sm" variant="ghost" icon={FiFileText} onClick={() => navigate(`/deliverables?competencia_id=${competency.id}`)}>Entregables</Button></div>
              {(competency.deliverables || []).length ? <ul className="mt-2">{competency.deliverables.map((item) => <li key={item.id}>{item.nombre} <Badge>{item.estado || 'pendiente'}</Badge></li>)}</ul> : <p className="muted small-text mt-2">Sin entregables registrados.</p>}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  )
}

/** Cargas de asignaturas por semestre y grupo (groupsModal). Los semestres son los del periodo abierto. */
function SubjectGroups({ onClose }) {
  const client = useQueryClient()
  const { user } = useAuth()
  const settings = useQuery({ queryKey: ['settings-current'], queryFn: () => api.get('/settings/current').then((response) => response.data), staleTime: 60_000 })
  const catalog = useQuery({ queryKey: ['asignaturas', 'all'], queryFn: allSubjects, staleTime: 30_000 })
  const period = settings.data?.academic_period_info
  const semesters = period?.semesters || [5, 6, 7, 8, 9]
  const empty = () => ({ id: '', semestre: String(semesters[0] || 5), grupo: '', nombre: '', periodo: period?.code || '', asignaturas: [] })
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  // Al llegar los ajustes, el formulario toma el primer semestre y el periodo abierto.
  const [syncedSettings, setSyncedSettings] = useState(null)
  if (settings.data && syncedSettings !== settings.data) {
    setSyncedSettings(settings.data)
    setForm((current) => ({ ...current, semestre: current.id ? current.semestre : String(semesters[0] || 5), periodo: current.periodo || period?.code || '' }))
  }
  const groups = useQuery({ queryKey: ['subject-groups', form.semestre], queryFn: () => api.get('/subject-groups', { params: { semestre: form.semestre } }).then((response) => response.data) })
  const reload = () => client.invalidateQueries({ queryKey: ['subject-groups'] })
  const toggle = (id) => setForm({ ...form, asignaturas: form.asignaturas.includes(id) ? form.asignaturas.filter((item) => item !== id) : [...form.asignaturas, id] })

  const save = async () => {
    const grupo = form.grupo.trim().toUpperCase()
    if (!grupo) return toast.warning('Ingresa la clave del grupo')
    const data = { nombre: form.nombre.trim() || `${form.semestre}to ${grupo}`, semestre: form.semestre, grupo, periodo: form.periodo.trim() || period?.code || null, asignatura_ids: form.asignaturas }
    setSaving(true)
    try {
      if (form.id) await api.put(`/subject-groups/${form.id}`, data)
      else await api.post('/subject-groups', data)
      toast.success('Carga guardada correctamente')
      setForm({ ...empty(), semestre: form.semestre })
      reload()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
    return undefined
  }
  const remove = async (group) => {
    if (!(await confirmAction({ title: 'Eliminar carga', text: '¿Eliminar esta carga de asignaturas?', confirmText: 'Sí, eliminar', danger: true }))) return
    try { await api.delete(`/subject-groups/${group.id}`); toast.success('Carga eliminada'); reload() } catch (error) { toast.error(apiError(error)) }
  }
  // Las cargas de periodos anteriores se mandan al archivo histórico para que dejen de estorbar.
  const archive = async (group) => {
    if (await sendToArchive({ tipo: 'grupos', ids: [group.id], name: `El grupo ${group.nombre}` })) reload()
  }
  const edit = (group) => setForm({ id: group.id, semestre: String(group.semestre), grupo: group.grupo || '', nombre: group.nombre || '', periodo: group.periodo || period?.code || '', asignaturas: (group.asignaturas || []).map((item) => Number(item.id)) })

  return (
    <Sheet open title="Cargas de asignaturas por semestre y grupo" onClose={onClose} size="xl">
      <div className="split-layout">
        <section className="card-app tinted">
          <h2 className="card-title-sm">{form.id ? 'Editar carga' : 'Nueva carga'}</h2>
          <div className="form-grid">
            <Field label="Semestre"><select className="control" value={form.semestre} onChange={(event) => setForm({ ...form, semestre: event.target.value })}>{semesters.map((value) => <option key={value} value={value}>{value}</option>)}</select></Field>
            <Field label="Grupo"><input className="control upper" maxLength={20} placeholder="A" value={form.grupo} onChange={(event) => setForm({ ...form, grupo: event.target.value })} /></Field>
            <Field label="Nombre visible"><input className="control" placeholder="Ej. 5to A" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
            <Field label="Periodo">
              <select className="control" value={form.periodo} onChange={(event) => setForm({ ...form, periodo: event.target.value })}>
                <option value="">Selecciona un periodo</option>
                {(settings.data?.academic_period_options || []).map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
              </select>
            </Field>
          </div>
          <h3 className="card-title-sm mt-3">Asignaturas del grupo</h3>
          {catalog.isLoading ? <Loading rows={2} /> : (
            <div className="check-grid">
              {(catalog.data || []).map((subject) => (
                <label key={subject.id} className={form.asignaturas.includes(Number(subject.id)) ? 'active' : ''}>
                  <input type="checkbox" checked={form.asignaturas.includes(Number(subject.id))} onChange={() => toggle(Number(subject.id))} /><span><strong>{subject.nombre}</strong><small>{subject.clave}</small></span>
                </label>
              ))}
            </div>
          )}
          <div className="form-actions">{form.id && <Button variant="ghost" onClick={() => setForm({ ...empty(), semestre: form.semestre })}>Cancelar edición</Button>}<Button icon={FiSave} loading={saving} onClick={save}>Guardar</Button></div>
        </section>
        <section>
          <h2 className="card-title-sm">Cargas registradas · {form.semestre}°</h2>
          {groups.isLoading ? <Loading /> : !(groups.data || []).length ? <Empty message="No hay cargas registradas para este semestre." /> : (
            <ul className="list-app">
              {groups.data.map((group) => (
                <li key={group.id} className="list-row">
                  <div><strong>{group.nombre}</strong><small>{[group.periodo, (group.asignaturas || []).map((item) => item.nombre).join(', ')].filter(Boolean).join(' · ') || 'Sin asignaturas'}</small></div>
                  <IconButton icon={FiEdit2} label="Editar" onClick={() => edit(group)} />
                  {isAdmin(user) && <IconButton icon={FiArchive} label="Enviar al archivo histórico" onClick={() => archive(group)} />}
                  <IconButton icon={FiTrash2} className="danger" label="Eliminar" onClick={() => remove(group)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  )
}
