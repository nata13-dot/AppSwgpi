import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FiUserCheck } from 'react-icons/fi'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { Button, Field, Sheet, useDebounced } from './ui'

/**
 * Revisión semanal de alumnos irregulares (Frontend_Swgpi/assets/js/irregular-check.js): en las primeras
 * 8 semanas del periodo se pregunta a la jefatura si algún alumno, por materias reprobadas, cursará un
 * semestre distinto al que le corresponde. "Sí" permite moverlo al grupo correcto y deja constancia.
 */
export default function IrregularCheck() {
  const check = useQuery({
    queryKey: ['irregular-check'],
    queryFn: () => api.get('/semester-management/irregular-check').then((response) => response.data),
    staleTime: Infinity,
  })
  const [chosenStep, setStep] = useState(null) // ask | register | done
  const [postponed, setPostponed] = useState(() => sessionStorage.getItem('irregular-check-postponed') === '1')
  const [moved, setMoved] = useState([])
  const [term, setTerm] = useState('')
  const [studentId, setStudentId] = useState('')
  const [groupId, setGroupId] = useState('')
  const debounced = useDebounced(term, 250)
  const data = check.data

  // Mientras la semana esté pendiente y no se haya pospuesto, se pregunta.
  const step = chosenStep ?? (data?.pending && !postponed ? 'ask' : null)

  const students = useQuery({
    queryKey: ['irregular-search', debounced],
    queryFn: () => api.get('/semester-management/search', { params: { q: debounced } }).then((response) => response.data.students || []),
    enabled: step === 'register' && debounced.trim().length >= 2,
  })
  const answer = useMutation({
    mutationFn: (body) => api.post('/semester-management/irregular-check', body),
    onSuccess: (_, body) => {
      toast.success(body.respuesta === 'sin_casos' ? 'Revisión de la semana registrada' : `Revisión registrada con ${moved.length} alumno(s)`)
      setStep('done')
      check.refetch()
    },
    onError: (error) => toast.error(apiError(error)),
  })
  const move = useMutation({
    mutationFn: () => api.post('/academic-operations/enrollments', { student_id: studentId, group_id: Number(groupId) }),
    onSuccess: () => {
      const group = data.groups.find((item) => Number(item.id) === Number(groupId))
      setMoved((current) => [...current, `${studentId} → ${group ? `${group.semestre}° ${group.grupo}` : groupId}`])
      setStudentId('')
      setGroupId('')
      setTerm('')
      toast.success('Alumno movido al grupo elegido.')
    },
    onError: (error) => toast.error(apiError(error)),
  })

  if (!data?.pending) return null
  const postpone = () => { sessionStorage.setItem('irregular-check-postponed', '1'); setPostponed(true); setStep('done') }
  const finish = () => (moved.length ? answer.mutate({ respuesta: 'con_casos', comentario: moved.join('; ').slice(0, 500) }) : setStep('ask'))

  return (
    <>
      <Sheet open={step === 'ask'} title={`Semana ${data.week} de ${data.total_weeks}`} subtitle="Revisión de alumnos irregulares" onClose={postpone} size="sm"
        footer={<>
          <Button variant="ghost" onClick={postpone}>Preguntar después</Button>
          <Button variant="ghost" loading={answer.isPending} onClick={() => answer.mutate({ respuesta: 'sin_casos' })}>No, ninguno</Button>
          <Button onClick={() => setStep('register')}>Sí, registrar</Button>
        </>}>
        <p>¿Hay algún alumno que, por materias reprobadas, cursará en <strong>{data.period?.nombre}</strong> un semestre diferente al que le corresponde?</p>
      </Sheet>
      <Sheet open={step === 'register'} title="Alumno en otro semestre" subtitle={`Busca al alumno y elige el grupo que cursará en ${data.period?.nombre}.`} onClose={finish} size="sm"
        footer={<>
          <Button variant="ghost" onClick={finish} loading={answer.isPending}>{moved.length ? 'Terminar' : 'Cancelar'}</Button>
          <Button icon={FiUserCheck} disabled={!studentId || !groupId} loading={move.isPending} onClick={() => move.mutate()}>Mover alumno</Button>
        </>}>
        <div className="stack">
          <Field label="Alumno" hint="Nombre o matrícula (mínimo 2 letras)">
            <input className="control" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar alumno" autoFocus />
          </Field>
          <select className="control" value={studentId} onChange={(event) => setStudentId(event.target.value)} aria-label="Alumno encontrado">
            <option value="">{students.isFetching ? 'Buscando…' : students.data?.length ? 'Elige al alumno' : 'Escribe para buscar…'}</option>
            {(students.data || []).map((student) => <option key={student.id} value={student.id}>{[student.nombres, student.apellido_paterno].filter(Boolean).join(' ')} · {student.id} · {student.semestre ? `${student.semestre}° ${student.grupo || ''}` : 'sin grupo'}</option>)}
          </select>
          <Field label="Grupo destino">
            <select className="control" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
              <option value="">Elige el grupo</option>
              {(data.groups || []).map((group) => <option key={group.id} value={group.id}>{group.semestre}° {group.grupo} · {group.nombre}</option>)}
            </select>
          </Field>
          {moved.length > 0 && <div className="alert-app success">Registrados: {moved.join(', ')}</div>}
        </div>
      </Sheet>
    </>
  )
}
