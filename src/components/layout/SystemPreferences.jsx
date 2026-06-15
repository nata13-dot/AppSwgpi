import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api from '../../services/api'

export default function SystemPreferences() {
  const query = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.get('/settings/public').then((response) => response.data),
    staleTime: 300_000,
  })
  const settings = query.data

  useEffect(() => {
    if (!settings) return
    document.documentElement.style.fontSize = `${Number(settings.font_scale || 100)}%`
    document.documentElement.classList.toggle('grayscale-mode', Boolean(settings.grayscale_mode))
    const shown = new Set(JSON.parse(sessionStorage.getItem('shown_system_notices') || '[]'))
    settings.system_notices?.forEach((notice) => {
      if (shown.has(notice.id)) return
      toast(notice.message, { type: notice.type === 'danger' ? 'error' : notice.type, autoClose: Number(notice.duration_seconds || 4) * 1000 })
      shown.add(notice.id)
    })
    sessionStorage.setItem('shown_system_notices', JSON.stringify([...shown]))
  }, [settings])

  return settings?.global_notice ? <div className="global-notice">{settings.global_notice}</div> : null
}
