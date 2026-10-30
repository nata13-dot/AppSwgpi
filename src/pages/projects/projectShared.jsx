import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { fullName } from '../../utils/formatters'
import { Badge, Loading, Sheet } from '../../components/ui'

/* eslint-disable react-refresh/only-export-components */

export const MODALITIES = {
  integrator: { value: 'proyecto_integrador', label: 'Proyecto integrador' },
  dual: { value: 'dual', label: 'Modalidad Dual' },
  case: { value: 'caso_integrador', label: 'Caso integrador' },
}
export const MODALITY_LABELS = { proyecto_integrador: 'Proyecto integrador', dual: 'Modalidad Dual', caso_integrador: 'Caso integrador' }
export const THESIS_ROLES = [{ key: 'asesor', label: 'Asesor' }, { key: 'revisor_1', label: 'Revisor 1' }, { key: 'revisor_2', label: 'Revisor 2' }]
export const ADVISOR_ROLE_LABELS = { primario: 'Asesor primario', secundario: 'Asesor secundario', asesor: 'Asesor de tesis', revisor_1: 'Revisor 1', revisor_2: 'Revisor 2' }
export const PROJECT_SEMESTERS = [['5', '5 - Propuesta'], ['6', '6 - Avance'], ['7', '7 - Avance'], ['8', '8 - Proyecto integrador'], ['9', '9 - Proyecto integrador']]
export const THESIS_SEMESTERS = [['8', '8 - Titulación'], ['9', '9 - Titulación']]

export const isThesis = (project) => Boolean(project?.is_thesis) || project?.tipo === 'tesis'
export const authors = (project, empty = '—') => (project?.students || []).map(fullName).filter(Boolean).join(', ') || empty
export const advisorForRole = (project, role) => (project?.advisors || []).find((advisor) => advisor.pivot?.rol_asesor === role) || null

/** Detalle de un proyecto o tesis (showProjectDetails de projects.php). */
export function ProjectDetails({ projectId, onClose }) {
  const query = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get(`/projects/${projectId}`).then((response) => response.data) })
  const project = query.data
  return (
    <Sheet open title={project?.title || 'Proyecto'} onClose={onClose} size="lg">
      {query.isLoading ? <Loading /> : query.isError ? <p className="muted">No se pudo cargar el proyecto.</p> : (
        <dl className="detail-list">
          <p className="muted">{project.description || 'Sin descripción'}</p>
          <div><dt>Tipo de registro</dt><dd>{project.is_proposal && project.proposal_status ? <Badge tone="info">{project.proposal_status}</Badge> : <Badge>Proyecto directo</Badge>}</dd></div>
          <div><dt>Modalidad</dt><dd>{isThesis(project) ? 'Tesis' : MODALITY_LABELS[project.modalidad] || 'Proyecto integrador'}</dd></div>
          <div><dt>Integrantes</dt><dd>{authors(project)}</dd></div>
          <div><dt>Grupo / carga</dt><dd>{project.subject_group?.nombre || '—'}</dd></div>
          <div><dt>Asignaturas</dt><dd className="row-wrap">{(project.asignaturas || []).length ? project.asignaturas.map((subject) => <Badge key={subject.id} tone="info">{subject.nombre || subject.name}</Badge>) : 'Sin asignaturas'}</dd></div>
          <div><dt>Empresa</dt><dd>{project.company_name || '—'}</dd></div>
          <div><dt>Responsable de la empresa</dt><dd>{[project.company_contact_name, project.company_contact_position].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt>Asesores</dt><dd className="stack-tight">{(project.advisors || []).length ? project.advisors.map((advisor) => <span key={advisor.id}>{fullName(advisor)} <Badge>{ADVISOR_ROLE_LABELS[advisor.pivot?.rol_asesor] || advisor.pivot?.rol_asesor || 'Sin rol'}</Badge></span>) : 'Sin asesores'}</dd></div>
          {project.proposal_review_comment && <div className="alert-app"><strong>Observaciones:</strong> {project.proposal_review_comment}</div>}
        </dl>
      )}
    </Sheet>
  )
}
