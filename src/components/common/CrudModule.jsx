import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { confirmAction, Empty, ErrorState, Loading, Modal, PageHeader, Pagination, SearchField, useDebounced } from './Ui'

const valueAt = (item, path) => path.split('.').reduce((value, key) => value?.[key], item)

function Field({ field, value, onChange, options }) {
  const common = {
    id: field.name,
    name: field.name,
    value: value ?? '',
    required: field.required,
    disabled: field.disabled,
    placeholder: field.placeholder,
    onChange: (event) => onChange(field.type === 'checkbox' ? event.target.checked : event.target.value),
  }
  if (field.type === 'textarea') return <textarea {...common} rows={field.rows || 3} />
  if (field.type === 'select') return (
    <select {...common}>
      <option value="">Selecciona una opción</option>
      {(options || field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
  if (field.type === 'checkbox') return <label className="switch-field"><input {...common} type="checkbox" checked={Boolean(value)} value="" /><span>{field.checkLabel || field.label}</span></label>
  return <input {...common} type={field.type || 'text'} min={field.min} max={field.max} />
}

export default function CrudModule({
  resource, endpoint, readEndpoint = endpoint, title, eyebrow, description, columns, fields,
  createLabel = 'Nuevo registro', mapItemToForm, mapFormToPayload,
  canCreate = true, canEdit = true, canDelete = true, queryParams = {},
  responseItems, optionLoaders = {}, extraActions,
}) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const debounced = useDebounced(search)
  const query = useQuery({
    queryKey: [resource, page, debounced, queryParams],
    queryFn: () => api.get(readEndpoint, { params: { ...queryParams, page, q: debounced, per_page: 15 } }).then((response) => response.data),
  })
  const optionsQuery = useQuery({
    queryKey: [resource, 'form-options'],
    queryFn: async () => Object.fromEntries(await Promise.all(Object.entries(optionLoaders).map(async ([key, loader]) => [key, await loader()]))),
    enabled: Object.keys(optionLoaders).length > 0,
    staleTime: 120_000,
  })
  const payload = query.data
  const rows = responseItems ? responseItems(payload) : Array.isArray(payload) ? payload : payload?.data || []
  const visibleFields = useMemo(() => fields.filter((field) => !field.when || field.when(form)), [fields, form])

  const close = () => { setEditing(null); setForm({}) }
  const openCreate = () => {
    setEditing({ __new: true })
    setForm(Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? (field.type === 'checkbox' ? false : '')])))
  }
  const openEdit = (item) => {
    setEditing(item)
    setForm(mapItemToForm ? mapItemToForm(item) : Object.fromEntries(fields.map((field) => [field.name, valueAt(item, field.source || field.name) ?? field.defaultValue ?? ''])))
  }
  const save = useMutation({
    mutationFn: () => {
      const body = mapFormToPayload ? mapFormToPayload(form, editing) : form
      return editing.__new ? api.post(endpoint, body) : api.put(`${endpoint}/${editing.id}`, body)
    },
    onSuccess: () => {
      toast.success(editing.__new ? 'Registro creado correctamente.' : 'Cambios guardados correctamente.')
      client.invalidateQueries({ queryKey: [resource] })
      close()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  const remove = useMutation({
    mutationFn: (item) => api.delete(`${endpoint}/${item.id}`),
    onSuccess: () => { toast.success('Registro eliminado.'); client.invalidateQueries({ queryKey: [resource] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  const requestDelete = async (item) => {
    if (await confirmAction({ title: 'Eliminar registro', text: 'El registro dejará de estar disponible.', confirmText: 'Sí, eliminar' })) remove.mutate(item)
  }

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={canCreate && <button className="btn-primary-app compact" onClick={openCreate}><FiPlus /> {createLabel}</button>} />
      <section className="panel">
        <div className="table-toolbar"><SearchField value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder={`Buscar en ${title.toLowerCase()}...`} />{extraActions}</div>
        {query.isLoading ? <Loading /> : query.isError ? <ErrorState message={apiError(query.error)} onRetry={query.refetch} /> : rows.length === 0 ? <Empty /> : (
          <div className="table-responsive"><table className="data-table responsive-cards">
            <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}{(canEdit || canDelete) && <th>Acciones</th>}</tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id}>{columns.map((column, index) => <td className={index === 0 ? 'mobile-primary-cell' : ''} key={column.label} data-label={column.label}>{column.render ? column.render(item) : valueAt(item, column.key) ?? '—'}</td>)}
              {(canEdit || canDelete) && <td className="row-actions" data-label="Acciones">
                {canEdit && <button title="Editar" onClick={() => openEdit(item)}><FiEdit2 /><span>Editar</span></button>}
                {canDelete && <button className="danger" title="Eliminar" onClick={() => requestDelete(item)}><FiTrash2 /><span>Eliminar</span></button>}
              </td>}
            </tr>)}</tbody>
          </table></div>
        )}
        <Pagination meta={payload} onPage={setPage} />
      </section>
      <Modal open={Boolean(editing)} title={editing?.__new ? createLabel : `Editar ${title.toLowerCase()}`} onClose={close}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
          <div className="form-grid">{visibleFields.map((field) => <label key={field.name} className={field.full ? 'full-field' : ''} htmlFor={field.name}>{field.type !== 'checkbox' && field.label}
            <Field field={{ ...field, disabled: field.disabled || (!editing?.__new && field.createOnly) }} value={form[field.name]} options={optionsQuery.data?.[field.optionsKey]} onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))} />
          </label>)}</div>
          <div className="modal-actions"><button type="button" onClick={close}>Cancelar</button><button className="btn-primary-app compact" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar'}</button></div>
        </form>
      </Modal>
    </>
  )
}
