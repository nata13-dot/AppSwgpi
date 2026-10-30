import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiMail, FiPlus, FiShield, FiToggleLeft, FiToggleRight, FiUploadCloud, FiUsers, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import { canGovernUsers, isGeneralAdmin, profileLabel } from '../../lib/permissions'
import { ordinal, useSemesters } from '../../lib/semesters'
import { fullName } from '../../utils/formatters'
import { Badge, Button, Card, Chips, DataTable, ErrorState, IconButton, Loading, Page, Pager, promptPassword, SearchInput, useDebounced, useSelection } from '../../components/ui'
import UserForm from './UserForm'
import UsersImport from './UsersImport'
import CredentialsSheet from './CredentialsSheet'
import GroupControl from './GroupControl'

const STATUS = [{ value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }, { value: 'all', label: 'Todos' }]
const PROFILES = [{ value: 'all', label: 'Todos los perfiles' }, { value: '3', label: 'Estudiantes' }, { value: '2', label: 'Docentes' }, { value: 'staff', label: 'Jefatura y coordinación' }]

/** Gestión de usuarios de la carrera (Frontend_Swgpi/pages/admin/users.php). */
export default function Users() {
  const { user } = useAuth()
  const client = useQueryClient()
  const [params] = useSearchParams()
  const govern = canGovernUsers(user)
  const generalAdmin = isGeneralAdmin(user)
  const [status, setStatus] = useState('active')
  const [profile, setProfile] = useState('all')
  const [search, setSearch] = useState(params.get('q') || '')
  const [semester, setSemester] = useState('')
  const [group, setGroup] = useState('')
  const [page, setPage] = useState(1)
  const [sheet, setSheet] = useState(null) // { type: 'form', id } | 'import' | 'credentials' | 'groups'
  const [selecting, setSelecting] = useState(false)
  const selection = useSelection()
  const debounced = useDebounced(search)
  const { semesters } = useSemesters('career')

  const filters = { status: status === 'all' ? undefined : status, q: debounced.trim() || undefined }
  if (profile === 'staff') filters.perfil_ids = '5,6,7'
  else if (profile !== 'all') filters.perfil_id = profile
  if (profile === '3') { if (semester) filters.semestre = semester; if (group) filters.grupo = group }
  const query = useQuery({ queryKey: ['users', filters, page], queryFn: () => api.get('/users', { params: { ...filters, page, per_page: 12 } }).then((response) => response.data), placeholderData: (previous) => previous })
  const groups = useQuery({ queryKey: ['subject-groups', semester], queryFn: () => api.get('/subject-groups', { params: semester ? { semestre: semester } : {} }).then((response) => response.data), enabled: profile === '3', staleTime: 60_000 })
  const rows = query.data?.data || []
  const refresh = () => client.invalidateQueries({ queryKey: ['users'] })
  const changeFilter = (setter) => (value) => { setter(value); setPage(1) }

  const toggleStatus = async (row, adminPassword = null) => {
    try {
      await api.post(`/users/${row.id}/toggle-active`, adminPassword ? { admin_password: adminPassword } : {})
      toast.success('Estado actualizado.')
      refresh()
    } catch (error) { toast.error(apiError(error)) }
  }
  const protectedToggle = async (row) => {
    const password = await promptPassword({ title: 'Autorizar desactivación' })
    if (password) toggleStatus(row, password)
  }
  const openCredentials = () => {
    if (!selecting) {
      setSelecting(true)
      toast.info('Selecciona usuarios en la tabla o presiona "Continuar envío" para usar filtros por perfil.')
      return
    }
    setSheet('credentials')
  }
  const cancelSelection = () => { setSelecting(false); selection.clear() }

  const statusDescription = { active: 'Mostrando perfiles activos', inactive: 'Mostrando perfiles inactivos', all: 'Mostrando todos los perfiles' }[status]
  const columns = [
    { key: 'name', label: 'Nombre', primary: true, render: (row) => <span className="cell-main"><strong>{fullName(row)}</strong><small>{[row.id, row.email || row.correo].filter(Boolean).join(' · ')}</small></span> },
    { key: 'perfil', label: 'Perfil', render: (row) => <Badge>{profileLabel(row.perfil_id)}</Badge> },
    { key: 'grupo', label: 'Grupo', render: (row) => (Number(row.perfil_id) === 3 ? <Badge tone="info">{row.semestre ? `${ordinal(row.semestre)} ${row.grupo || ''}` : 'Sin grupo'}</Badge> : '—') },
    { key: 'proyecto', label: 'Proyecto', render: (row) => {
      if (Number(row.perfil_id) === 2) return <Badge tone="info">{Number(row.advising_projects_count || 0)} asesorías</Badge>
      if (Number(row.perfil_id) === 3) return Number(row.student_projects_count || 0) > 0 ? <Badge tone="success">Con proyecto</Badge> : <Badge tone="warning">Sin proyecto</Badge>
      return '—'
    } },
    { key: 'estado', label: 'Estado', render: (row) => (row.activo ? <Badge tone="success">Activo</Badge> : <Badge>Inactivo</Badge>) },
  ]
  const actions = govern ? (row) => {
    // Jefatura y asistencia sólo las modifica el administrador general.
    const protectedUser = [5, 6].includes(Number(row.perfil_id))
    if (protectedUser && !generalAdmin) return <Badge icon={FiShield}>Protegido</Badge>
    return <>
      <IconButton icon={FiEdit2} label="Editar" onClick={() => setSheet({ type: 'form', id: row.id })} />
      {protectedUser
        ? <IconButton icon={FiShield} label="Acción protegida: cambiar estado" onClick={() => protectedToggle(row)} />
        : <IconButton icon={row.activo ? FiToggleRight : FiToggleLeft} className={row.activo ? 'success' : 'danger'} label={row.activo ? 'Activo. Toca para desactivar' : 'Inactivo. Toca para activar'} onClick={() => toggleStatus(row)} />}
    </>
  } : null

  return (
    <Page title="Gestión de usuarios" subtitle={statusDescription}
      actions={govern && <>
        <Button icon={FiPlus} onClick={() => setSheet({ type: 'form', id: null })}>Nuevo usuario</Button>
        <Button variant="ghost" icon={FiUploadCloud} onClick={() => setSheet('import')}>Excel</Button>
        <Button variant={selecting ? 'warning' : 'ghost'} icon={FiMail} onClick={openCredentials}>{selecting ? 'Continuar envío' : 'Credenciales'}</Button>
      </>}>
      <Card>
        <div className="stack">
          <SearchInput value={search} onChange={changeFilter(setSearch)} placeholder="No. de control, empleado, nombre, correo o teléfono" />
          <Chips options={STATUS} value={status} onChange={changeFilter(setStatus)} />
          <Chips options={PROFILES} value={profile} onChange={changeFilter(setProfile)} />
          {profile === '3' && (
            <div className="toolbar">
              <select className="control" aria-label="Semestre" value={semester} onChange={(event) => { setSemester(event.target.value); setGroup(''); setPage(1) }}>
                <option value="">Todos los semestres</option>
                {semesters.map((value) => <option key={value} value={value}>{ordinal(value)}</option>)}
              </select>
              <select className="control" aria-label="Grupo" value={group} onChange={changeFilter(setGroup)}>
                <option value="">Todos los grupos</option>
                {(groups.data || []).map((item) => <option key={item.id} value={item.grupo}>{item.semestre} {item.grupo} - {item.nombre}</option>)}
              </select>
              {govern && <Button variant="soft" icon={FiUsers} onClick={() => setSheet('groups')}>Control de grupos</Button>}
            </div>
          )}
        </div>
      </Card>
      {selecting && (
        <div className="selection-bar" role="status">
          <span>{selection.selected.size} usuario{selection.selected.size === 1 ? '' : 's'} seleccionado{selection.selected.size === 1 ? '' : 's'}</span>
          <Button size="sm" variant="ghost" onClick={() => selection.setAll(rows.map((row) => row.id), true)}>Seleccionar página</Button>
          <Button size="sm" variant="ghost" onClick={selection.clear}>Limpiar</Button>
          <IconButton icon={FiX} label="Cancelar selección" onClick={cancelSelection} />
        </div>
      )}
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable columns={columns} rows={rows} actions={actions}
            selected={selecting ? selection.selected : null} onToggle={selection.toggle} onToggleAll={(on) => selection.setAll(rows.map((row) => row.id), on)} />
        )}
        <Pager meta={query.data} onPage={setPage} />
      </Card>

      {sheet?.type === 'form' && <UserForm userId={sheet.id} onClose={() => setSheet(null)} onSaved={refresh} />}
      {sheet === 'import' && <UsersImport onClose={() => setSheet(null)} onImported={refresh} />}
      {sheet === 'credentials' && <CredentialsSheet onClose={() => setSheet(null)} selected={selection.selected} filters={{ status, q: debounced.trim(), semester: profile === '3' ? semester : '', group: profile === '3' ? group : '' }} profile={profile} />}
      {sheet === 'groups' && <GroupControl initialSemester={semester} onClose={() => setSheet(null)} onEditStudent={(id) => setSheet({ type: 'form', id })} onChanged={() => { refresh(); client.invalidateQueries({ queryKey: ['subject-groups'] }) }} />}
    </Page>
  )
}
