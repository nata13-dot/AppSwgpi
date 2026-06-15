import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiPlus, FiSave, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { confirmAction, ErrorState, Loading, PageHeader } from '../components/common/Ui'
import { TagsModule } from './AdminModules'

const fileTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'txt', 'jpg', 'jpeg', 'png', 'webp']

export default function SystemManagement({ initialTab = 'settings' }) {
  const [tab, setTab] = useState(initialTab)
  return <>
    <div className="module-tabs">
      <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Ajustes</button>
      <button className={tab === 'notices' ? 'active' : ''} onClick={() => setTab('notices')}>Avisos</button>
      <button className={tab === 'tags' ? 'active' : ''} onClick={() => setTab('tags')}>Etiquetas</button>
    </div>
    {tab === 'settings' && <Settings />}
    {tab === 'notices' && <Notices />}
    {tab === 'tags' && <TagsModule />}
  </>
}

function Settings() {
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then((response) => response.data) })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  return <SettingsForm key={query.data.updated_at || 'settings'} initial={query.data} />
}

function SettingsForm({ initial }) {
  const [form, setForm] = useState(initial)
  const mutation = useMutation({
    mutationFn: () => api.put('/settings', form),
    onSuccess: ({ data }) => { setForm(data.settings); toast.success('Ajustes guardados.') },
    onError: (error) => toast.error(apiError(error)),
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const toggleType = (type) => update('allowed_file_types', form.allowed_file_types.includes(type) ? form.allowed_file_types.filter((item) => item !== type) : [...form.allowed_file_types, type])
  return <>
    <PageHeader eyebrow="Sistema" title="Ajustes generales" description="Configura sesión, apariencia, archivos y reglas generales del SGPI." />
    <form className="panel settings-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
      <div className="form-grid">
        <label>Tiempo de sesión (minutos)<input type="number" min="1" max="480" value={form.session_timeout_minutes} onChange={(event) => update('session_timeout_minutes', Number(event.target.value))} /></label>
        <label>Tema predeterminado<select value={form.default_theme} onChange={(event) => update('default_theme', event.target.value)}><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Sistema</option></select></label>
        <label>Tamaño máximo de archivo (MB)<input type="number" min="1" max="200" value={form.max_file_size_mb} onChange={(event) => update('max_file_size_mb', Number(event.target.value))} /></label>
        <label>Integrantes máximos por proyecto<input type="number" min="1" max="10" value={form.max_project_members} onChange={(event) => update('max_project_members', Number(event.target.value))} /></label>
        <label>Escala tipográfica (%)<input type="range" min="85" max="125" value={form.font_scale} onChange={(event) => update('font_scale', Number(event.target.value))} /><small>{form.font_scale}%</small></label>
        <label className="full-field">Aviso global<textarea rows="3" value={form.global_notice || ''} onChange={(event) => update('global_notice', event.target.value)} /></label>
        <fieldset className="full-field"><legend>Tipos de archivo permitidos</legend><div className="check-grid">{fileTypes.map((type) => <label key={type}><input type="checkbox" checked={form.allowed_file_types.includes(type)} onChange={() => toggleType(type)} /> {type.toUpperCase()}</label>)}</div></fieldset>
        <label className="switch-field"><input type="checkbox" checked={Boolean(form.proposal_registration_enabled)} onChange={(event) => update('proposal_registration_enabled', event.target.checked)} /><span>Registro de propuestas habilitado</span></label>
        <label className="switch-field"><input type="checkbox" checked={Boolean(form.grayscale_mode)} onChange={(event) => update('grayscale_mode', event.target.checked)} /><span>Modo escala de grises</span></label>
      </div>
      <button className="btn-primary-app compact" disabled={mutation.isPending}><FiSave /> Guardar ajustes</button>
    </form>
  </>
}

function Notices() {
  const query = useQuery({ queryKey: ['notices'], queryFn: () => api.get('/notices').then((response) => response.data.data || []) })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  return <NoticesEditor key={JSON.stringify(query.data.map((notice) => notice.id))} initial={query.data} />
}

function NoticesEditor({ initial }) {
  const client = useQueryClient()
  const [notices, setNotices] = useState(initial)
  const mutation = useMutation({
    mutationFn: () => api.put('/notices', { notices }),
    onSuccess: () => { toast.success('Avisos guardados.'); client.invalidateQueries({ queryKey: ['notices'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const add = () => setNotices((current) => [...current, { id: `notice_${Date.now()}`, title: '', message: '', audience: 'all', type: 'info', duration_seconds: 4, starts_at: '', ends_at: '', active: true }])
  const update = (index, key, value) => setNotices((current) => current.map((notice, itemIndex) => itemIndex === index ? { ...notice, [key]: value } : notice))
  const remove = async (index) => {
    if (await confirmAction({ title: 'Eliminar aviso', text: 'El aviso se quitará de la publicación.' })) setNotices((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }
  return <>
    <PageHeader eyebrow="Comunicación" title="Avisos del sistema" description="Publica mensajes segmentados por audiencia y periodo." actions={<button className="btn-primary-app compact" onClick={add}><FiPlus /> Nuevo aviso</button>} />
    <section className="notice-editor-list">{notices.map((notice, index) => <article className="panel notice-editor" key={notice.id || index}>
      <div className="form-grid">
        <label>Título<input value={notice.title || ''} onChange={(event) => update(index, 'title', event.target.value)} /></label>
        <label>Tipo<select value={notice.type} onChange={(event) => update(index, 'type', event.target.value)}><option value="info">Información</option><option value="success">Éxito</option><option value="warning">Advertencia</option><option value="danger">Urgente</option></select></label>
        <label>Audiencia<select value={notice.audience} onChange={(event) => update(index, 'audience', event.target.value)}><option value="all">Todos</option><option value="authenticated">Usuarios autenticados</option><option value="admin">Administradores</option><option value="teacher">Docentes</option><option value="student">Estudiantes</option><option value="index">Página pública</option></select></label>
        <label>Duración (segundos)<input type="number" min="2" max="30" value={notice.duration_seconds} onChange={(event) => update(index, 'duration_seconds', Number(event.target.value))} /></label>
        <label>Inicia<input type="date" value={notice.starts_at || ''} onChange={(event) => update(index, 'starts_at', event.target.value)} /></label>
        <label>Finaliza<input type="date" value={notice.ends_at || ''} onChange={(event) => update(index, 'ends_at', event.target.value)} /></label>
        <label className="full-field">Mensaje<textarea required rows="3" value={notice.message} onChange={(event) => update(index, 'message', event.target.value)} /></label>
      </div>
      <footer><label className="switch-field"><input type="checkbox" checked={notice.active} onChange={(event) => update(index, 'active', event.target.checked)} /><span>Activo</span></label><button className="danger-button" onClick={() => remove(index)}><FiTrash2 /> Eliminar</button></footer>
    </article>)}</section>
    <button className="btn-primary-app compact" disabled={mutation.isPending} onClick={() => mutation.mutate()}><FiSave /> Guardar avisos</button>
  </>
}
