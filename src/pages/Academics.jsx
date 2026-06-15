import { useState } from 'react'
import api from '../services/api'
import CrudModule from '../components/common/CrudModule'
import { formatDate } from '../utils/formatters'

const semesters = [5, 6, 7, 8, 9].map((value) => ({ value, label: `${value}° semestre` }))

export default function Academics() {
  const [tab, setTab] = useState('subjects')
  return <>
    <div className="module-tabs" role="tablist">
      <button className={tab === 'subjects' ? 'active' : ''} onClick={() => setTab('subjects')}>Asignaturas</button>
      <button className={tab === 'competencies' ? 'active' : ''} onClick={() => setTab('competencies')}>Competencias</button>
      <button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>Cargas y grupos</button>
    </div>
    {tab === 'subjects' && <CrudModule
      resource="asignaturas" endpoint="/asignaturas" title="Asignaturas" eyebrow="Académico"
      description="Catálogo institucional de materias vinculadas a proyectos y competencias."
      createLabel="Nueva asignatura"
      columns={[{ label: 'Clave', key: 'clave' }, { label: 'Asignatura', key: 'nombre' }, { label: 'Competencias', render: (item) => item.competencias_count || 0 }, { label: 'Descripción', key: 'descripcion' }]}
      fields={[{ name: 'clave', label: 'Clave' }, { name: 'nombre', label: 'Nombre', required: true }, { name: 'descripcion', label: 'Descripción', type: 'textarea', full: true }]}
    />}
    {tab === 'competencies' && <CrudModule
      resource="competencias" endpoint="/competencias" title="Competencias" eyebrow="Académico"
      description="Resultados de aprendizaje y periodos de trabajo por asignatura."
      createLabel="Nueva competencia"
      columns={[{ label: 'Competencia', key: 'nombre' }, { label: 'Asignatura', render: (item) => item.asignatura?.nombre || '—' }, { label: 'Inicio', render: (item) => formatDate(item.fecha_inicio) }, { label: 'Fin', render: (item) => formatDate(item.fecha_fin) }]}
      fields={[{ name: 'nombre', label: 'Nombre', required: true, full: true }, { name: 'asignatura_id', label: 'Asignatura', type: 'select', optionsKey: 'subjects', required: true }, { name: 'fecha_inicio', label: 'Fecha de inicio', type: 'date' }, { name: 'fecha_fin', label: 'Fecha final', type: 'date' }]}
      optionLoaders={{ subjects: () => api.get('/asignaturas', { params: { per_page: 100 } }).then((response) => response.data.data.map((item) => ({ value: item.id, label: item.nombre }))) }}
      mapFormToPayload={(form) => ({ ...form, asignatura_id: Number(form.asignatura_id) })}
    />}
    {tab === 'groups' && <CrudModule
      resource="subject-groups" endpoint="/subject-groups" title="Cargas y grupos" eyebrow="Académico"
      description="Configura grupos activos, semestre, periodo y materias asignadas."
      createLabel="Nueva carga"
      responseItems={(payload) => payload || []}
      columns={[{ label: 'Carga', key: 'nombre' }, { label: 'Semestre', key: 'semestre' }, { label: 'Grupo', key: 'grupo' }, { label: 'Periodo', render: (item) => item.academic_period?.nombre || '—' }, { label: 'Asignaturas', render: (item) => item.asignaturas?.map((subject) => subject.nombre).join(', ') || '—' }]}
      fields={[{ name: 'nombre', label: 'Nombre', required: true, full: true }, { name: 'semestre', label: 'Semestre', type: 'select', options: semesters, required: true }, { name: 'grupo', label: 'Grupo', required: true }, { name: 'periodo', label: 'Periodo', placeholder: '2026-1', required: true }, { name: 'asignatura_ids', label: 'IDs de asignaturas', placeholder: 'Separados por coma', full: true }]}
      mapItemToForm={(item) => ({ ...item, periodo: item.academic_period?.nombre || '', asignatura_ids: item.asignaturas?.map((subject) => subject.id).join(', ') || '' })}
      mapFormToPayload={(form) => ({ ...form, semestre: Number(form.semestre), asignatura_ids: String(form.asignatura_ids || '').split(',').map(Number).filter(Boolean) })}
    />}
  </>
}
