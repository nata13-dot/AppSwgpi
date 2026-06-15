import { useState } from 'react'
import api from '../services/api'
import CrudModule from '../components/common/CrudModule'
import { StatusBadge } from '../components/common/Ui'
import { formatDate, fullName } from '../utils/formatters'

const semesters = [5, 6, 7, 8].map((value) => ({ value, label: `${value}° semestre` }))
const idList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

export default function Evaluations() {
  const [tab, setTab] = useState('evaluations')
  return <>
    <div className="module-tabs">
      <button className={tab === 'evaluations' ? 'active' : ''} onClick={() => setTab('evaluations')}>Evaluaciones</button>
      <button className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>Salas</button>
      <button className={tab === 'rubric' ? 'active' : ''} onClick={() => setTab('rubric')}>Rúbrica</button>
    </div>
    {tab === 'evaluations' && <CrudModule
      resource="evaluations" endpoint="/evaluations" title="Evaluaciones" eyebrow="Evaluación"
      description="Programa evaluaciones, asigna proyectos y consulta resultados."
      createLabel="Nueva evaluación"
      columns={[
        { label: 'Proyecto', render: (item) => item.project?.title || item.project_title || `Proyecto #${item.project_id}` },
        { label: 'Semestre', key: 'semestre' },
        { label: 'Sala', render: (item) => item.room?.nombre || item.sala || 'Sin sala' },
        { label: 'Fecha', render: (item) => formatDate(item.fecha_exposicion) },
        { label: 'Estado', render: (item) => <StatusBadge value={item.estado || 'programada'} /> },
        { label: 'Resultado', render: (item) => <StatusBadge value={item.resultado || 'pendiente'} /> },
      ]}
      fields={[
        { name: 'project_id', label: 'Proyecto', type: 'select', optionsKey: 'projects', required: true, full: true },
        { name: 'evaluation_room_id', label: 'Sala', type: 'select', optionsKey: 'rooms' },
        { name: 'semestre', label: 'Semestre', type: 'select', options: semesters, required: true },
        { name: 'sala', label: 'Nombre alterno de sala' },
        { name: 'fecha_exposicion', label: 'Fecha de exposición', type: 'datetime-local' },
        { name: 'estado', label: 'Estado', type: 'select', options: [{ value: 'programada', label: 'Programada' }, { value: 'en_evaluacion', label: 'En evaluación' }, { value: 'finalizada', label: 'Finalizada' }] },
        { name: 'resultado', label: 'Resultado', type: 'select', options: [{ value: 'pendiente', label: 'Pendiente' }, { value: 'viable', label: 'Viable' }, { value: 'no_viable', label: 'No viable' }] },
        { name: 'apto_titulacion', label: 'Apto para titulación', type: 'checkbox' },
      ]}
      optionLoaders={{
        projects: () => api.get('/evaluations/projects').then((response) => (response.data.data || response.data).map((item) => ({ value: item.id, label: item.title }))),
        rooms: () => api.get('/evaluations/rooms').then((response) => response.data.map((item) => ({ value: item.id, label: item.nombre }))),
      }}
      mapFormToPayload={(form) => ({ ...form, project_id: Number(form.project_id), evaluation_room_id: form.evaluation_room_id ? Number(form.evaluation_room_id) : null, semestre: Number(form.semestre) })}
    />}
    {tab === 'rooms' && <CrudModule
      resource="evaluation-rooms" endpoint="/evaluations/rooms" title="Salas de evaluación" eyebrow="Evaluación"
      description="Organiza jurados, tiempos, proyectos y secuencia de presentación."
      createLabel="Nueva sala"
      responseItems={(payload) => payload || []}
      columns={[
        { label: 'Sala', render: (item) => <><strong>{item.nombre}</strong><small className="cell-subtitle">{item.salon || 'Sin salón'}</small></> },
        { label: 'Semestre', key: 'semestre' },
        { label: 'Fecha', render: (item) => formatDate(item.fecha_evaluacion) },
        { label: 'Docentes', render: (item) => item.teachers?.map(fullName).join(', ') || 'Sin asignar' },
        { label: 'Proyectos', render: (item) => item.projects?.length || 0 },
      ]}
      fields={[
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'salon', label: 'Salón' },
        { name: 'semestre', label: 'Semestre', type: 'select', options: semesters, required: true },
        { name: 'responsible_teacher_id', label: 'Docente responsable', type: 'select', optionsKey: 'teachers' },
        { name: 'fecha_evaluacion', label: 'Inicio', type: 'datetime-local', required: true },
        { name: 'fecha_fin_evaluacion', label: 'Fin', type: 'datetime-local', required: true },
        { name: 'teacher_evaluation_minutes', label: 'Minutos para evaluar', type: 'number', min: 1, defaultValue: 10, required: true },
        { name: 'project_presentation_minutes', label: 'Minutos de exposición', type: 'number', min: 1, defaultValue: 20, required: true },
        { name: 'max_attempts', label: 'Intentos máximos', type: 'number', min: 1, max: 10, defaultValue: 1, required: true },
        { name: 'teacher_ids', label: 'IDs de docentes', placeholder: 'Separados por coma', full: true },
        { name: 'project_ids', label: 'IDs de proyectos', placeholder: 'Separados por coma', full: true },
      ]}
      optionLoaders={{ teachers: () => api.get('/users', { params: { perfil_ids: '1,2', compact: 1, per_page: 500 } }).then((response) => response.data.data.map((item) => ({ value: item.id, label: fullName(item) }))) }}
      mapItemToForm={(item) => ({ ...item, teacher_ids: item.teachers?.map((teacher) => teacher.id).join(', ') || '', project_ids: item.projects?.map((project) => project.id).join(', ') || '' })}
      mapFormToPayload={(form) => ({ ...form, semestre: Number(form.semestre), teacher_evaluation_minutes: Number(form.teacher_evaluation_minutes), project_presentation_minutes: Number(form.project_presentation_minutes), max_attempts: Number(form.max_attempts), teacher_ids: idList(form.teacher_ids), project_ids: idList(form.project_ids).map(Number) })}
    />}
    {tab === 'rubric' && <CrudModule
      resource="rubric-criteria" endpoint="/evaluations/rubric-criteria" readEndpoint="/evaluations/criteria" title="Criterios de rúbrica" eyebrow="Evaluación"
      description="Configura las preguntas utilizadas para calificar por semestre."
      createLabel="Nuevo criterio"
      responseItems={(payload) => payload?.criteria || payload?.data || payload || []}
      columns={[{ label: 'Pregunta', key: 'pregunta' }, { label: 'Semestre', key: 'semestre' }, { label: 'Proyecto', render: (item) => item.project?.title || 'Criterio general' }, { label: 'Orden', key: 'orden' }]}
      fields={[{ name: 'pregunta', label: 'Pregunta', required: true, full: true }, { name: 'semestre', label: 'Semestre', type: 'select', options: semesters, required: true }, { name: 'project_id', label: 'Proyecto personalizado (8°)', type: 'number' }, { name: 'orden', label: 'Orden', type: 'number', min: 0 }]}
      mapFormToPayload={(form) => ({ ...form, semestre: Number(form.semestre), project_id: form.project_id ? Number(form.project_id) : null, orden: form.orden ? Number(form.orden) : 0 })}
    />}
  </>
}
