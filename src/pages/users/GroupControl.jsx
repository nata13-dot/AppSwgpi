import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit2, FiPlus, FiSave, FiTrash2, FiUserMinus, FiUserPlus } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { ordinal, useSemesters } from '../../lib/semesters'
import { fullName } from '../../utils/formatters'
import { Badge, Button, confirmAction, Empty, Field, IconButton, Loading, Sheet } from '../../components/ui'

/** Control de grupos de estudiantes por semestre (groupControlModal de users.php). */
export default function GroupControl({ initialSemester, onClose, onChanged, onEditStudent }) {
  const client = useQueryClient()
  const { semesters } = useSemesters('period')
  const [semester, setSemester] = useState(initialSemester || '')
  const current = semester || String(semesters[0] || '')
  const [editing, setEditing] = useState(null) // null | {} (nuevo) | grupo
  const groups = useQuery({ queryKey: ['subject-groups', current], queryFn: () => api.get('/subject-groups', { params: { semestre: current } }).then((response) => response.data), enabled: Boolean(current) })
  const students = useQuery({
    queryKey: ['users', 'group-control'],
    queryFn: () => api.get('/users', { params: { perfil_id: 3, status: 'active', compact: 1, per_page: 500 } }).then((response) => response.data.data || []),
    staleTime: 30_000,
  })
  const semesterStudents = (students.data || []).filter((student) => String(student.semestre || '') === String(current))
  const sameGroup = (student, group) => String(student.grupo || '').toUpperCase() === String(group.grupo || '').toUpperCase()
  const reload = () => {
    client.invalidateQueries({ queryKey: ['subject-groups'] })
    client.invalidateQueries({ queryKey: ['users'] })
    onChanged()
  }

  const assign = async (groupId, studentId) => {
    if (!studentId) return
    try {
      await api.post(`/subject-groups/${groupId}/students`, { student_ids: [studentId] })
      toast.success('Alumno agregado al grupo')
      reload()
    } catch (error) { toast.error(apiError(error)) }
  }
  const removeStudent = async (studentId) => {
    if (!(await confirmAction({ title: 'Quitar alumno del grupo', text: 'El alumno quedará sin semestre y grupo asignado hasta que lo reasignes.', confirmText: 'Sí, quitar' }))) return
    try {
      await api.put(`/users/${studentId}`, { semestre: null, grupo: null })
      toast.success('Alumno removido del grupo')
      reload()
    } catch (error) { toast.error(apiError(error)) }
  }
  const removeGroup = async (group, members) => {
    const text = members > 0 ? `El grupo se eliminará y ${members} alumno(s) quedarán sin semestre/grupo asignado. No se elimina ningún alumno.` : 'El grupo se eliminará. No se elimina ningún alumno.'
    if (!(await confirmAction({ title: 'Eliminar grupo', text, confirmText: 'Sí, eliminar', danger: true }))) return
    try {
      await api.delete(`/subject-groups/${group.id}`)
      toast.success('Grupo eliminado')
      reload()
    } catch (error) { toast.error(apiError(error)) }
  }

  return (
    <>
      <Sheet open={!editing} title="Control de grupos de estudiantes" onClose={onClose} size="xl">
        <div className="toolbar">
          <select className="control" aria-label="Semestre" value={current} onChange={(event) => setSemester(event.target.value)}>
            {semesters.map((value) => <option key={value} value={value}>{ordinal(value)} semestre</option>)}
          </select>
          <span className="spacer" />
          <Button icon={FiPlus} onClick={() => setEditing({})}>Nuevo grupo</Button>
        </div>
        {groups.isLoading || students.isLoading ? <Loading /> : !(groups.data || []).length ? <Empty title="Sin grupos" message="No hay grupos creados para este semestre." /> : (
          <div className="grid-2">
            {groups.data.map((group) => {
              const members = semesterStudents.filter((student) => sameGroup(student, group))
              const available = semesterStudents.filter((student) => !sameGroup(student, group))
              return (
                <section key={group.id} className="card-app">
                  <header className="card-head">
                    <div><h2>{group.semestre} {group.grupo} · {group.nombre}</h2>{group.periodo && <p>{group.periodo}</p>}</div>
                    <div className="card-actions"><Badge tone="info">{members.length} alumnos</Badge><IconButton icon={FiEdit2} label="Editar grupo" onClick={() => setEditing(group)} /><IconButton icon={FiTrash2} className="danger" label="Eliminar grupo" onClick={() => removeGroup(group, members.length)} /></div>
                  </header>
                  <label className="inline-add">
                    <FiUserPlus aria-hidden="true" />
                    <select className="control" value="" onChange={(event) => assign(group.id, event.target.value)} aria-label="Agregar alumno al grupo">
                      <option value="">Agregar alumno al grupo</option>
                      {available.map((student) => <option key={student.id} value={student.id}>{student.id} - {fullName(student)} {student.grupo ? `(actual: ${student.grupo})` : '(sin grupo)'}</option>)}
                    </select>
                  </label>
                  <ul className="list-app">
                    {members.map((student) => (
                      <li key={student.id} className="list-row">
                        <div><strong>{fullName(student)}</strong><small>{student.id}</small></div>
                        <IconButton icon={FiEdit2} label="Editar alumno" onClick={() => onEditStudent(student.id)} />
                        <IconButton icon={FiUserMinus} className="danger" label="Quitar del grupo" onClick={() => removeStudent(student.id)} />
                      </li>
                    ))}
                    {!members.length && <li className="muted small-text">Sin alumnos en este grupo.</li>}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </Sheet>
      {editing && <GroupForm group={editing.id ? editing : null} semester={current} semesters={semesters} existing={groups.data || []} onClose={() => setEditing(null)} onSaved={(saved) => { setSemester(String(saved)); reload() }} />}
    </>
  )
}

function GroupForm({ group, semester, semesters, existing, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: group?.nombre || '', semestre: String(group?.semestre || semester), grupo: group?.grupo || '', periodo: group?.periodo || '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value })
  const submit = async (event) => {
    event.preventDefault()
    const data = { nombre: form.nombre.trim(), semestre: Number(form.semestre), grupo: form.grupo.trim().toUpperCase(), periodo: form.periodo.trim(), asignatura_ids: (group?.asignaturas || []).map((subject) => subject.id) }
    if (!data.nombre || !data.grupo) return setError('Nombre y grupo son obligatorios.')
    setSaving(true)
    setError('')
    try {
      const pool = String(data.semestre) === String(semester) ? existing : (await api.get('/subject-groups', { params: { semestre: data.semestre } })).data
      const duplicate = pool.find((item) => String(item.semestre) === String(data.semestre) && String(item.grupo || '').toUpperCase() === data.grupo && Number(item.id) !== Number(group?.id))
      if (duplicate) { setError(`Ya existe el grupo ${data.semestre} ${data.grupo}: ${duplicate.nombre}.`); return undefined }
      if (group) await api.put(`/subject-groups/${group.id}`, data)
      else await api.post('/subject-groups', data)
      toast.success(group ? 'Grupo actualizado' : 'Grupo creado')
      onSaved(data.semestre)
      onClose()
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setSaving(false)
    }
    return undefined
  }
  return (
    <Sheet open title={group ? 'Editar grupo' : 'Nuevo grupo'} onClose={onClose} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="group-form" icon={group ? FiSave : FiPlus} loading={saving}>{group ? 'Guardar cambios' : 'Crear grupo'}</Button></>}>
      <form id="group-form" className="form-grid" onSubmit={submit}>
        {error && <div className="alert-app warning full">{error}</div>}
        <Field label="Nombre" full><input className="control" required maxLength={255} placeholder="Ej. Desarrollo de proyectos 5C" value={form.nombre} onChange={set('nombre')} /></Field>
        <Field label="Semestre"><select className="control" value={form.semestre} onChange={set('semestre')}>{semesters.map((value) => <option key={value} value={value}>{ordinal(value)}</option>)}</select></Field>
        <Field label="Grupo"><input className="control" required maxLength={20} placeholder="Ej. C" value={form.grupo} onChange={set('grupo')} /></Field>
        <Field label="Periodo" full><input className="control" maxLength={100} placeholder="Ej. Enero-Junio 2026" value={form.periodo} onChange={set('periodo')} /></Field>
        {group && <p className="muted small-text full">Los alumnos asignados se moverán al nuevo semestre/grupo si cambias esos datos.</p>}
      </form>
    </Sheet>
  )
}
