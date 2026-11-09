import { toast } from 'react-toastify'
import api, { apiError } from './api'
import { promptText } from '../components/ui'

export const ARCHIVE_TYPES = [
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'proyectos', label: 'Proyectos' },
  { key: 'propuestas', label: 'Propuestas' },
  { key: 'grupos', label: 'Grupos' },
]

/**
 * Manda registros al archivo histórico: dejan de verse en el sistema hasta restaurarlos desde
 * Sistema › Archivo histórico. Devuelve true si se archivaron.
 */
export async function sendToArchive({ tipo, ids, name }) {
  const motivo = await promptText({
    title: 'Enviar al archivo histórico',
    text: `${name} dejará de aparecer en el sistema hasta que lo restaures desde el archivo histórico. Lo publicado en el repositorio público sigue disponible.`,
    placeholder: 'Motivo (opcional), por ejemplo: generación 2026 egresada',
    confirmText: 'Archivar',
    required: false,
  })
  if (motivo === null) return false
  try {
    const { data } = await api.post('/archive', { tipo, ids: ids.map(String), motivo: motivo || null })
    toast.success(data.message)
    return true
  } catch (error) {
    toast.error(apiError(error))
    return false
  }
}
