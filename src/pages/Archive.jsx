import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArchive, FiRotateCcw, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { ARCHIVE_TYPES } from '../services/archive'
import { formatDateTime } from '../utils/formatters'
import { Button, Card, confirmAction, DataTable, Empty, ErrorState, IconButton, Loading, Page, Pager, SearchInput, Tabs, useDebounced, useSelection } from '../components/ui'

const NOUNS = { usuarios: ['usuario', 'usuarios'], proyectos: ['proyecto', 'proyectos'], propuestas: ['propuesta', 'propuestas'], grupos: ['grupo', 'grupos'] }

/**
 * Archivo histórico de la carrera: lo archivado no aparece en el resto del sistema hasta restaurarlo.
 * El repositorio público no depende de esto.
 */
export default function Archive() {
  const client = useQueryClient()
  const [type, setType] = useState('usuarios')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const selection = useSelection()
  const debounced = useDebounced(search)
  const params = { tipo: type, page, ...(debounced.trim() ? { buscar: debounced.trim() } : {}) }
  const query = useQuery({ queryKey: ['archive', params], queryFn: () => api.get('/archive', { params }).then((response) => response.data), placeholderData: (previous) => previous })
  const rows = query.data?.data || []
  const [one, many] = NOUNS[type]

  const changeType = (next) => { setType(next); setPage(1); selection.clear() }
  const restore = async (ids) => {
    const text = ids.length === 1 ? `El ${one} volverá a aparecer en el sistema.` : `${ids.length} ${many} volverán a aparecer en el sistema.`
    if (!(await confirmAction({ title: 'Restaurar del archivo histórico', text, confirmText: 'Sí, restaurar', icon: 'question' }))) return
    try {
      const { data } = await api.post('/archive/restore', { tipo: type, ids: ids.map(String) })
      toast.success(data.message)
      selection.clear()
      client.invalidateQueries()
    } catch (error) { toast.error(apiError(error)) }
  }

  const columns = [
    { key: 'name', label: one.charAt(0).toUpperCase() + one.slice(1), primary: true, render: (row) => <span className="cell-main"><strong>{row.name}</strong><small>{[type === 'usuarios' ? row.id : null, row.detail].filter(Boolean).join(' · ') || '—'}</small></span> },
    { key: 'archived_at', label: 'Archivado', render: (row) => <span className="cell-main"><strong>{formatDateTime(row.archived_at)}</strong>{row.archived_by && <small>por {row.archived_by}</small>}</span> },
    { key: 'reason', label: 'Motivo', hideOnMobile: true, render: (row) => row.reason || <span className="muted">Sin motivo</span> },
  ]

  return (
    <Page title="Archivo histórico" subtitle="Lo archivado no aparece en el sistema hasta que lo restauras. El repositorio público sigue igual.">
      <Tabs value={type} onChange={changeType} items={ARCHIVE_TYPES} />
      <div className="toolbar">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder={type === 'usuarios' ? 'Número, nombre o apellido' : 'Buscar por nombre'} />
      </div>
      {selection.selected.size > 0 && (
        <div className="selection-bar" role="status">
          <span>{selection.selected.size} {selection.selected.size === 1 ? one : many} seleccionado(s)</span>
          <Button size="sm" icon={FiRotateCcw} onClick={() => restore([...selection.selected])}>Restaurar</Button>
          <IconButton icon={FiX} label="Limpiar selección" onClick={selection.clear} />
        </div>
      )}
      <Card flush>
        {query.isLoading ? <div className="card-pad"><Loading /></div> : query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : (
          <DataTable columns={columns} rows={rows}
            empty={<Empty icon={FiArchive} title={`Sin ${many} archivados`} message={`Los ${many} que mandes al archivo histórico aparecerán aquí.`} />}
            actions={(row) => <IconButton icon={FiRotateCcw} label="Restaurar" onClick={() => restore([row.id])} />}
            selected={selection.selected} onToggle={selection.toggle} onToggleAll={(on) => selection.setAll(rows.map((row) => row.id), on)} />
        )}
        <Pager meta={query.data} onPage={setPage} />
      </Card>
    </Page>
  )
}
