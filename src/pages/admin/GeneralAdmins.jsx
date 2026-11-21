import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiCalendar, FiClock, FiShield, FiUserMinus, FiUserPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Badge, Button, Card, Chips, ErrorState, Field, IconButton, Loading, Page, promptPassword, SearchInput, Sheet, useDebounced } from '../../components/ui'

const localInput = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const remaining = (iso) => {
  const ms = new Date(iso) - new Date()
  const days = Math.floor(ms / 86400000)
  return days >= 1 ? `${days} día${days === 1 ? '' : 's'}` : `${Math.max(1, Math.round(ms / 3600000))} h`
}

const ACTIONS = { otorgado: ['Designado', 'success'], vigencia: ['Cambió la vigencia', 'primary'], retirado: ['Retirado', 'danger'], vencido: ['Venció', 'neutral'] }
const SOON = 7 * 86400000
const when = (iso) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Administradores generales (Frontend_Swgpi/pages/admin/general-admins.php): designar de forma definitiva o temporal,
 * cambiar vigencia, retirar e historial de movimientos.
 */
export default function GeneralAdminsPage() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['general-admins'], queryFn: () => api.get('/admin/general-admins').then((response) => response.data) })
  const admins = query.data?.data || []
  const [filter, setFilter] = useState('all')
  const [text, setText] = useState('')
  const temp = admins.filter((a) => a.hasta)
  const soon = temp.filter((a) => new Date(a.hasta) - new Date() < SOON)
  const shown = admins.filter((a) => (filter === 'all' || (filter === 'forever' ? !a.hasta : filter === 'temp' ? a.hasta : a.hasta && new Date(a.hasta) - new Date() < SOON))
    && (!text || `${a.nombre} ${a.id}`.toLowerCase().includes(text.toLowerCase())))
  const [editing, setEditing] = useState(null) // null cerrado · {} nuevo · admin existente
  const [term, setTerm] = useState('')
  const search = useDebounced(term, 250)
  const [person, setPerson] = useState(null)
  const [kind, setKind] = useState('forever')
  const [until, setUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const candidates = useQuery({
    queryKey: ['ga-candidates', search], enabled: editing !== null && !person && search.trim().length >= 2,
    queryFn: () => api.get('/admin/career-candidates', { params: { search: search.trim() } }).then((response) => response.data.data || []),
  })
  const open = (admin = {}) => {
    setEditing(admin); setTerm('')
    setPerson(admin.id ? { id: admin.id, nombre: admin.nombre } : null)
    setKind(admin.hasta ? 'temp' : 'forever')
    setUntil(admin.hasta ? localInput(new Date(admin.hasta)) : '')
  }
  const days = (n) => setUntil(localInput(new Date(Date.now() + n * 86400000)))
  const save = async () => {
    if (!person) return toast.error('Elige a la persona.')
    if (kind === 'temp' && !until) return toast.error('Indica cuándo termina.')
    const password = await promptPassword({ title: editing?.id ? 'Confirma el cambio de vigencia' : `¿Designar a ${person.nombre}?`, confirmText: 'Confirmar' })
    if (!password) return
    setSaving(true)
    try {
      const response = await api.put(`/users/${encodeURIComponent(person.id)}/general-admin`, { grant: true, admin_password: password, hasta: kind === 'temp' ? new Date(until).toISOString() : null })
      toast.success(response.data.message); setEditing(null); client.invalidateQueries({ queryKey: ['general-admins'] })
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }
  const revoke = async (admin) => {
    const password = await promptPassword({ title: `¿Retirar la administración general a ${admin.nombre}?`, confirmText: 'Retirar' })
    if (!password) return
    try {
      const response = await api.put(`/users/${encodeURIComponent(admin.id)}/general-admin`, { grant: false, admin_password: password })
      toast.success(response.data.message); client.invalidateQueries({ queryKey: ['general-admins'] })
    } catch (error) { toast.error(apiError(error)) }
  }
  return (
    <Page eyebrow="Administración general" title="Administradores generales" subtitle="Designa administradores generales de forma definitiva o temporal, cambia su vigencia o retíralos. No aparecen como jefatura ni personal de ninguna carrera."
      actions={<Button icon={FiUserPlus} onClick={() => open({})}>Designar</Button>}>
      <section className="kpi-grid ga-kpis" aria-label="Resumen">
        {[['all', admins.length, 'Vigentes'], ['forever', admins.length - temp.length, 'Definitivos'], ['temp', temp.length, 'Temporales'], ['soon', soon.length, 'Vencen en 7 días']].map(([key, value, label]) => (
          <button type="button" key={key} className={`kpi ${filter === key ? 'active' : ''} ${key === 'soon' && value ? 'warn' : ''}`} onClick={() => setFilter(key)}><strong>{query.isLoading ? '–' : value}</strong><span>{label}</span></button>
        ))}
      </section>
      <Card>
        <div className="row-wrap mb-2">
          <Chips options={[{ value: 'all', label: 'Todos' }, { value: 'forever', label: 'Definitivos' }, { value: 'temp', label: 'Temporales' }, { value: 'soon', label: 'Por vencer' }]} value={filter} onChange={setFilter} />
          <span className="spacer" />
          <SearchInput value={text} onChange={setText} placeholder="Buscar por nombre o número…" />
        </div>
        {query.isLoading ? <Loading rows={2} /> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <ul className="list-app">
            {shown.map((admin) => (
              <li key={admin.id} className="list-row">
                <div><strong>{admin.nombre}{admin.soy_yo ? ' (tú)' : ''}</strong><small>{admin.id}{admin.designado_por ? ` · designado por ${admin.designado_por}` : ''}</small></div>
                {admin.hasta ? <Badge tone="warning" icon={FiClock}>Temporal · quedan {remaining(admin.hasta)}</Badge> : <Badge tone="primary">Definitiva</Badge>}
                {admin.soy_yo ? <small className="muted">Otro administrador debe cambiarte</small> : <><Button size="sm" variant="ghost" icon={FiCalendar} onClick={() => open(admin)}>Vigencia</Button><IconButton icon={FiUserMinus} className="danger" label="Retirar" onClick={() => revoke(admin)} /></>}
              </li>
            ))}
            {!shown.length && <li className="muted small-text">{admins.length ? 'Nadie coincide con el filtro.' : 'Sin administradores generales.'}</li>}
          </ul>
        )}
      </Card>
      <Card title="Historial" subtitle="Designaciones, cambios de vigencia, retiros y vencimientos más recientes.">
        <ul className="list-app">
          {(query.data?.historial || []).map((item, index) => {
            const [label, tone] = ACTIONS[item.accion] || [item.accion, 'neutral']
            const detail = item.accion === 'vencido' ? 'Terminó su designación temporal' : item.accion === 'retirado' ? '' : item.hasta ? `Temporal hasta el ${when(item.hasta)}` : 'Definitiva'
            return (
              <li key={index} className="list-row">
                <div><strong>{item.persona}</strong><small>{when(item.en)}{item.por ? ` · por ${item.por}` : item.accion === 'vencido' ? ' · automático' : ''}{detail ? ` · ${detail}` : ''}</small></div>
                <Badge tone={tone}>{label}</Badge>
              </li>
            )
          })}
          {!query.isLoading && !(query.data?.historial || []).length && <li className="muted small-text">Sin movimientos registrados.</li>}
        </ul>
      </Card>
      <Sheet open={editing !== null} title={editing?.id ? 'Cambiar vigencia' : 'Designar administrador general'} onClose={() => setEditing(null)} size="sm">
        <div className="stack">
          {person ? (
            <div className="list-row picked-person"><div><strong>{person.nombre}</strong><small>{person.id}</small></div>{!editing?.id && <Button variant="ghost" size="sm" onClick={() => { setPerson(null); setTerm('') }}>Cambiar</Button>}</div>
          ) : (
            <div className="suggest-host">
              <SearchInput value={term} onChange={setTerm} placeholder="Nombre o número de empleado…" />
              {search.trim().length >= 2 && (
                <div className="suggest-list" role="listbox">
                  {candidates.isLoading ? <small className="muted">Buscando…</small> : (candidates.data || []).length ? candidates.data.map((item) => (
                    <button type="button" key={item.id} onClick={() => setPerson(item)}><strong>{item.nombre}</strong><small>{item.id}{item.carreras.length ? ` · ${item.carreras.map((c) => c.clave).join(', ')}` : ''}</small></button>
                  )) : <small className="muted">Sin coincidencias entre el personal.</small>}
                </div>
              )}
            </div>
          )}
          <Field label="Vigencia"><Chips options={[{ value: 'forever', label: 'Definitiva' }, { value: 'temp', label: 'Temporal' }]} value={kind} onChange={(value) => { setKind(value); if (value === 'temp' && !until) days(7) }} /></Field>
          {kind === 'temp' && (
            <>
              <div className="row-wrap">{[[1, '1 día'], [7, '1 semana'], [30, '1 mes'], [180, '6 meses']].map(([n, label]) => <Button key={n} size="sm" variant="ghost" onClick={() => days(n)}>{label}</Button>)}</div>
              <Field label="Termina el" hint="Al vencer se retira sola, se cierran sus sesiones de la app y se le avisa."><input className="control" type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} /></Field>
            </>
          )}
          <Button icon={FiShield} loading={saving} onClick={save}>{editing?.id ? 'Guardar vigencia' : 'Designar'}</Button>
        </div>
      </Sheet>
    </Page>
  )
}
