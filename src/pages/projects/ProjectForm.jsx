import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSave, FiUserPlus, FiX } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { useSemesters } from '../../lib/semesters'
import { fullName } from '../../utils/formatters'
import { Button, Field, Loading, Sheet } from '../../components/ui'
import { PROJECT_SEMESTERS, THESIS_SEMESTERS } from './projectShared'

const EMPTY = {
  title: '', description: '', company_name: '', company_rfc: '', company_giro: '', company_contact_name: '',
  company_contact_position: '', company_address: '', modalidad: 'proyecto_integrador', semestre: '', subject_group_id: '', year: String(new Date().getFullYear()),
}

/** Alta y edición de proyecto o tesis (projectFormModal de projects.php). */
export default function ProjectForm({ projectId, asThesis, defaultModality, onClose, onSaved }) {
  const editing = Boolean(projectId)
  const [form, setForm] = useState({ ...EMPTY, modalidad: defaultModality })
  const [thesis, setThesis] = useState(Boolean(asThesis))
  const [members, setMembers] = useState([])
  const [candidate, setCandidate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const { semesters } = useSemesters('period')

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get(`/projects/${projectId}`).then((response) => response.data), enabled: editing, gcTime: 0 })
  const students = useQuery({ queryKey: ['users', 'active-students'], queryFn: () => api.get('/users', { params: { perfil_id: 3, status: 'active', compact: 1, per_page: 500 } }).then((response) => response.data.data || []), staleTime: 60_000 })
  const allProjects = useQuery({ queryKey: ['projects', 'compact-all'], queryFn: () => api.get('/projects', { params: { compact: 1, per_page: 500 } }).then((response) => response.data.data || []), staleTime: 30_000 })
  const groups = useQuery({ queryKey: ['subject-groups', form.semestre], queryFn: () => api.get('/subject-groups', { params: { semestre: form.semestre } }).then((response) => response.data), enabled: Boolean(form.semestre), staleTime: 60_000 })

  const [syncedFrom, setSyncedFrom] = useState(null)
  const data = project.data
  if (data && syncedFrom !== data) {
    setSyncedFrom(data)
    setThesis(Boolean(data.is_thesis))
    setForm({
      title: data.title || '', description: data.description || '', company_name: data.company_name || '', company_rfc: data.company_rfc || '',
      company_giro: data.company_giro || '', company_contact_name: data.company_contact_name || '', company_contact_position: data.company_contact_position || '',
      company_address: data.company_address || '', modalidad: data.modalidad || 'proyecto_integrador', semestre: data.semestre ? String(data.semestre) : '',
      subject_group_id: data.subject_group_id ? String(data.subject_group_id) : '', year: String(data.year || new Date().getFullYear()),
    })
    setMembers(data.students || [])
  }

  // Alumnos activos que no están en otro proyecto ni ya agregados.
  const available = useMemo(() => {
    const taken = new Set()
    ;(allProjects.data || []).forEach((item) => { if (String(item.id) !== String(projectId || '')) (item.students || []).forEach((student) => taken.add(String(student.id))) })
    const chosen = new Set(members.map((student) => String(student.id)))
    return (students.data || []).filter((student) => !taken.has(String(student.id)) && !chosen.has(String(student.id)))
  }, [allProjects.data, members, projectId, students.data])

  // Semestres del modo (proyecto o tesis) que existen en el periodo abierto.
  const semesterOptions = (thesis ? THESIS_SEMESTERS : PROJECT_SEMESTERS).filter(([value]) => semesters.includes(Number(value)) || value === form.semestre)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value, ...(key === 'semestre' ? { subject_group_id: '' } : {}) }))
  const add = () => {
    const student = available.find((item) => String(item.id) === candidate)
    if (!student) return toast.warning('Selecciona un estudiante activo disponible de la lista.')
    setMembers((current) => [...current, student])
    setCandidate('')
    return undefined
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!members.length) return setError('Selecciona al menos un estudiante sin proyecto asignado.')
    const payload = {
      ...form, title: form.title.trim(), description: form.description.trim(), semestre: form.semestre || null, subject_group_id: form.subject_group_id || null,
      year: Number(form.year), company_rfc: form.company_rfc.trim().toUpperCase(), request_company_registration: true, is_thesis: thesis,
      student_ids: members.map((student) => student.id),
    }
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/projects/${projectId}`, payload)
      else await api.post('/projects', payload)
      toast.success(thesis ? (editing ? 'Tesis actualizada' : 'Tesis creada') : (editing ? 'Proyecto actualizado' : 'Proyecto creado'))
      onSaved()
      onClose()
    } catch (requestError) {
      setError(apiError(requestError))
    } finally {
      setSaving(false)
    }
    return undefined
  }

  const noun = thesis ? 'tesis' : 'proyecto'
  return (
    <Sheet open title={editing ? `Editar ${noun}` : thesis ? 'Nueva tesis' : 'Nuevo proyecto'} onClose={onClose} size="xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" form="project-form" icon={FiSave} loading={saving}>{editing ? 'Guardar cambios' : 'Guardar'}</Button></>}>
      {editing && project.isLoading ? <Loading /> : (
        <form id="project-form" className="form-grid" onSubmit={submit}>
          {error && <div className="alert-app danger full">{error}</div>}
          <Field label={thesis ? "Título de la tesis" : "Título del proyecto"} full><input className="control" required value={form.title} onChange={set('title')} /></Field>
          <Field label="Descripción" full><textarea className="control" rows={4} required value={form.description} onChange={set('description')} /></Field>
          <h3 className="form-section full">Empresa</h3>
          <Field label="Empresa o negocio"><input className="control" required maxLength={255} value={form.company_name} onChange={set('company_name')} /></Field>
          <Field label="RFC de la empresa"><input className="control upper" required maxLength={13} pattern="[A-Za-z&Ññ]{3,4}[0-9]{6}[A-Za-z0-9]{3}" title="RFC de 12 o 13 caracteres" value={form.company_rfc} onChange={set('company_rfc')} /></Field>
          <Field label="Giro"><input className="control" required maxLength={255} value={form.company_giro} onChange={set('company_giro')} /></Field>
          <Field label="Persona a cargo"><input className="control" required maxLength={255} value={form.company_contact_name} onChange={set('company_contact_name')} /></Field>
          <Field label="Puesto"><input className="control" required maxLength={255} value={form.company_contact_position} onChange={set('company_contact_position')} /></Field>
          <Field label="Dirección de la empresa" hint="Separa calle, número, colonia y municipio con comas (,)." full><textarea className="control" rows={2} required maxLength={1000} value={form.company_address} onChange={set('company_address')} /></Field>
          <h3 className="form-section full">Registro académico</h3>
          {!thesis && (
            <Field label="Modalidad">
              <select className="control" value={form.modalidad} onChange={set('modalidad')}>
                <option value="proyecto_integrador">Proyecto integrador</option><option value="dual">Modalidad Dual</option><option value="caso_integrador">Caso integrador</option>
              </select>
            </Field>
          )}
          <Field label="Semestre" hint="Sólo los semestres del periodo abierto.">
            <select className="control" required value={form.semestre} onChange={set('semestre')}>
              <option value="">Seleccionar...</option>
              {semesterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Año"><input className="control" type="number" required min={2000} max={2100} value={form.year} onChange={set('year')} /></Field>
          <Field label="Grupo / carga de asignaturas">
            <select className="control" required value={form.subject_group_id} onChange={set('subject_group_id')} disabled={!form.semestre}>
              <option value="">{form.semestre ? 'Seleccionar grupo...' : 'Selecciona primero un semestre'}</option>
              {(groups.data || []).map((group) => {
                const subjects = (group.asignaturas || []).map((item) => item.nombre).join(', ')
                return <option key={group.id} value={group.id}>{group.nombre}{group.periodo ? ` - ${group.periodo}` : ''}{subjects ? ` (${subjects})` : ''}</option>
              })}
            </select>
          </Field>
          <h3 className="form-section full">Integrantes</h3>
          <div className="inline-add full">
            <select className="control" aria-label="Estudiante sin proyecto" value={candidate} onChange={(event) => setCandidate(event.target.value)}>
              <option value="">{students.isLoading ? 'Cargando estudiantes...' : 'Selecciona un estudiante disponible'}</option>
              {available.map((student) => <option key={student.id} value={student.id}>{student.id} - {fullName(student)}</option>)}
            </select>
            <Button variant="soft" icon={FiUserPlus} onClick={add}>Agregar</Button>
          </div>
          <div className="row-wrap full">
            {members.length ? members.map((student) => (
              <span key={student.id} className="chip-removable">{student.id} - {fullName(student)}<button type="button" aria-label={`Quitar a ${fullName(student)}`} onClick={() => setMembers((current) => current.filter((item) => String(item.id) !== String(student.id)))}><FiX /></button></span>
            )) : <span className="muted small-text">No hay integrantes agregados.</span>}
          </div>
        </form>
      )}
    </Sheet>
  )
}
