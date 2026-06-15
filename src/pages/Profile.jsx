import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import api, { apiError } from '../services/api'
import { roleLabel, useAuth } from '../hooks/useAuth'
import { ErrorState, Loading, PageHeader } from '../components/common/Ui'

export default function Profile() {
  const { refreshUser } = useAuth()
  const query = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then((r) => r.data.user || r.data) })
  const { register, handleSubmit, reset } = useForm()
  useEffect(() => { if (query.data) reset(query.data) }, [query.data, reset])
  const mutation = useMutation({
    mutationFn: (values) => api.post('/profile', values),
    onSuccess: async () => { await refreshUser(); toast.success('Perfil actualizado.') },
    onError: (error) => toast.error(apiError(error)),
  })
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState message={apiError(query.error)} onRetry={query.refetch} />
  const user = query.data
  return (
    <>
      <PageHeader eyebrow="Cuenta personal" title="Mi perfil" description="Mantén actualizados tus datos de contacto." />
      <section className="profile-layout">
        <aside className="profile-card"><div className="profile-avatar">{user.nombres?.charAt(0)}</div><h2>{[user.nombres, user.apa, user.ama].filter(Boolean).join(' ')}</h2><span>{roleLabel(user)}</span><small>{user.id}</small></aside>
        <form className="panel profile-form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div className="form-grid">
            <label>Nombre(s)<input {...register('nombres')} /></label>
            <label>Apellido paterno<input {...register('apa')} /></label>
            <label>Apellido materno<input {...register('ama')} /></label>
            <label>Correo electrónico<input type="email" {...register('email')} /></label>
            <label>Teléfonos<input {...register('telefonos')} /></label>
            <label>Dirección<input {...register('direccion')} /></label>
          </div>
          <button className="btn-primary-app compact" disabled={mutation.isPending}>Guardar cambios</button>
        </form>
      </section>
    </>
  )
}
