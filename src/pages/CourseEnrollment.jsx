import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiBookOpen, FiKey } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { roleFromUser, useAuth } from '../hooks/useAuth'
import { Empty, ErrorState, Loading, PageHeader, StatusBadge } from '../components/common/Ui'

export default function CourseEnrollment() {
  const { user } = useAuth()
  const role = roleFromUser(user)
  const client = useQueryClient()
  const [passwords, setPasswords] = useState({})
  const query = useQuery({ queryKey: ['course-enrollments'], queryFn: () => api.get('/course-enrollments').then((response) => response.data.data) })
  const mutation = useMutation({
    mutationFn: ({ course, configure = false }) => configure
      ? api.put(`/courses/${course.id}/self-enrollment`, { enabled: true, password: passwords[course.id], password_confirmation: passwords[course.id] })
      : api.post(`/course-enrollments/${course.id}`, { password: passwords[course.id] }),
    onSuccess: ({ data }) => { toast.success(data.message); setPasswords({}); client.invalidateQueries({ queryKey: ['course-enrollments'] }) },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  return <>
    <PageHeader eyebrow="Seguimiento académico" title={role === 'student' ? 'Autoregistro a materias' : 'Claves de autoregistro'} description={role === 'student' ? 'Inscríbete con la contraseña proporcionada por tu docente.' : 'Cambia la contraseña de acceso de las materias de seguimiento que impartes.'} />
    {!query.data?.length ? <Empty title="Sin materias disponibles" message="No hay materias de seguimiento habilitadas para tu carrera." /> : <section className="proposal-grid">{query.data.map((course) => <article className="panel proposal-card" key={course.id}>
      <div><StatusBadge value={course.inscrito ? 'inscrito' : 'disponible'} /><small>{course.group?.semestre}° {course.group?.grupo}</small></div>
      <h2><FiBookOpen /> {course.subject?.nombre}</h2><p>{course.subject?.clave} · {course.group?.nombre}</p>
      {role === 'student' && course.inscrito ? <small>Ya formas parte de esta materia.</small> : <form onSubmit={(event) => { event.preventDefault(); mutation.mutate({ course, configure: role !== 'student' }) }}>
        <label>{role === 'student' ? 'Contraseña del curso' : 'Nueva contraseña'}<input required minLength="6" type="password" value={passwords[course.id] || ''} onChange={(event) => setPasswords({ ...passwords, [course.id]: event.target.value })} /></label>
        <button className="btn-primary-app compact" disabled={mutation.isPending}><FiKey /> {role === 'student' ? 'Inscribirme' : 'Actualizar clave'}</button>
      </form>}
    </article>)}</section>}
  </>
}
