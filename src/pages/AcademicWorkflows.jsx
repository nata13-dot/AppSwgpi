import { useEffect, useRef } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { mountAcademicConsole } from '../shared/academicConsole'

export default function AcademicWorkflows({ initialTab = 'periods' }) {
  const root = useRef(null)
  const { user } = useAuth()
  useEffect(() => mountAcademicConsole(root.current, async (method, url, data) => {
    if (method === 'DOWNLOAD') {
      const response = await api.get(url, { responseType: 'blob' })
      const href = URL.createObjectURL(response.data)
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = data.name; anchor.click()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
      return
    }
    const response = await api.request({ method, url, data })
    return response.data
  }, user, initialTab), [user, initialTab])
  return <><h1>Seguimiento académico</h1><div ref={root} /></>
}
