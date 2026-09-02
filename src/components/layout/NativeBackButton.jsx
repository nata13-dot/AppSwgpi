import { useEffect, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import Swal from 'sweetalert2'
import { handleRegisteredBack } from '../../utils/backNavigation'

const roleRoots = new Set(['admin', 'teacher', 'student', 'assistant', 'coordinator'])

function homeForPath(pathname) {
  const segment = pathname.split('/').filter(Boolean)[0]
  if (roleRoots.has(segment)) return `/${segment}`
  if (pathname === '/forgot-password') return '/login'
  return '/login'
}

export default function NativeBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationRef = useRef(location)

  useEffect(() => { locationRef.current = location }, [location])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let listener
    let cancelled = false
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (Swal.isVisible()) {
        Swal.close()
        return
      }
      if (handleRegisteredBack()) return

      const { pathname } = locationRef.current
      const home = homeForPath(pathname)
      if (pathname !== home) {
        if (canGoBack) navigate(-1)
        else navigate(home, { replace: true })
        return
      }

      toast.info('Ya estás en la pantalla inicial.', { toastId: 'native-back-home' })
    }).then((handle) => {
      if (cancelled) handle.remove()
      else listener = handle
    })

    return () => {
      cancelled = true
      listener?.remove()
    }
  }, [navigate])

  return null
}
