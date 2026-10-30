import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiSave } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../../services/api'
import { Button, Empty, Loading, Sheet } from '../../components/ui'

/** Ajuste de materias de un proyecto (projectSubjectsModal de projects.php). */
export default function ProjectSubjects({ projectId, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get(`/projects/${projectId}`).then((response) => response.data) })
  const catalog = useQuery({ queryKey: ['asignaturas', 'all'], queryFn: () => api.get('/asignaturas', { params: { per_page: 100 } }).then((response) => response.data.data || response.data || []), staleTime: 60_000 })

  const [syncedFrom, setSyncedFrom] = useState(null)
  if (project.data && syncedFrom !== project.data) {
    setSyncedFrom(project.data)
    setSelected(new Set((project.data.asignaturas || []).map((subject) => Number(subject.id))))
  }

  const toggle = (id) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/projects/${projectId}/asignaturas`, { asignatura_ids: [...selected] })
      toast.success('Materias del proyecto actualizadas')
      onSaved()
      onClose()
    } catch (error) { toast.error(apiError(error)) } finally { setSaving(false) }
  }

  return (
    <Sheet open title="Materias del proyecto" subtitle={project.data?.title} onClose={onClose} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon={FiSave} loading={saving} onClick={save}>Guardar materias</Button></>}>
      <div className="alert-app">Las materias del grupo se copian automáticamente al proyecto. Usa esta opción para ajustar casos especiales sin ligar entregables uno por uno.</div>
      {project.isLoading || catalog.isLoading ? <Loading /> : !(catalog.data || []).length ? <Empty title="Sin materias" message="No hay materias registradas." /> : (
        <div className="check-grid mt-3">
          {catalog.data.map((subject) => (
            <label key={subject.id} className={selected.has(Number(subject.id)) ? 'active' : ''}>
              <input type="checkbox" checked={selected.has(Number(subject.id))} onChange={() => toggle(Number(subject.id))} />
              <span><strong>{subject.nombre}</strong><small>{subject.clave}</small></span>
            </label>
          ))}
        </div>
      )}
    </Sheet>
  )
}
