import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { mountAcademicConsole } from '../shared/academicConsole'
import { downloadApiFile } from '../utils/downloads'
import { confirmAction, Page } from '../components/ui'

/**
 * Seguimiento académico (Frontend_Swgpi/pages/academic-workflows.php): periodos, promoción y grupos, matrícula,
 * autorizaciones, residencias y conciliación. La consola es el mismo módulo que usa el front de PHP.
 */
export default function AcademicWorkflows() {
  const root = useRef(null)
  const { user } = useAuth()
  const [params] = useSearchParams()
  const initialTab = params.get('tab') || 'periods'
  useEffect(() => mountAcademicConsole(root.current, async (method, url, data) => {
    if (method === 'DOWNLOAD') return downloadApiFile(url, data.name)
    const response = await api.request({ method, url, data })
    return response.data
  }, user, initialTab, { confirm: (text) => confirmAction({ title: 'Confirmar', text, confirmText: 'Sí, continuar' }) }), [user, initialTab])
  return (
    <Page title="Seguimiento académico" subtitle="Periodos, semestres y grupos, matrícula, autorizaciones y residencias.">
      <div ref={root} className="academic-console" />
    </Page>
  )
}
