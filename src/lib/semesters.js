import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

/**
 * Política de semestres de la carrera activa (GET /semester-management/policy), igual que SGPISemesters en el
 * front de PHP. En la primera mitad del año sólo existen 2°, 4°, 6° y 8°; en la segunda 1°, 3°, 5°, 7° y 9°.
 * 1° a 4° sólo si la carrera tiene habilitados los casos integradores.
 *   scope 'period' → semestres del periodo abierto (altas, grupos, salas)
 *   scope 'career' → todos los de la carrera (filtros de consulta)
 */
export function useSemesters(scope = 'career', { min = 1, max = 9 } = {}) {
  const query = useQuery({
    queryKey: ['semester-policy'],
    queryFn: () => api.get('/semester-management/policy').then((response) => response.data),
    staleTime: 60_000,
  })
  const source = query.data?.[scope === 'period' ? 'period_semesters' : 'career_semesters']
  const fallback = Array.from({ length: max - min + 1 }, (_, index) => min + index)
  const semesters = (source || fallback).map(Number).filter((semester) => semester >= min && semester <= max)
  return { semesters, policy: query.data, isLoading: query.isLoading }
}

export const ordinal = (semester) => ({ 1: '1°', 2: '2°', 3: '3°', 4: '4°', 5: '5°', 6: '6°', 7: '7°', 8: '8°', 9: '9°', 10: '10°' })[Number(semester)] || `${semester}°`
