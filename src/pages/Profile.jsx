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
    mutationFn: (values) => {
      const body = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        if (key === 'photo') {
          if (value?.[0]) body.append('photo', value[0])
        } else if (value !== undefined && value !== null && value !== '') body.append(key, value)
      })
      return api.post('/profile', body)
    },
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
            <label>Teléfonos<input {...register('telefonos')} /></label>
            <label>Fotografía<input type="file" accept=".jpg,.jpeg,.png,.webp" {...register('photo')} /></label>
            {Number(user.perfil_id) === 3 && <><label>Semestre<select {...register('semestre')}><option value="">Selecciona</option>{[5,6,7,8,9].map((semester) => <option key={semester} value={semester}>{semester}°</option>)}</select></label><label>Grupo<input {...register('grupo')} /></label></>}
            <label className="full-field">Dirección<input {...register('direccion')} /></label>
            <h3 className="full-field profile-section-title">Cambiar contraseña</h3>
            <label>Contraseña actual<input type="password" {...register('current_password')} /></label>
            <label>Nueva contraseña<input type="password" minLength="6" {...register('password')} /></label>
            <label>Confirmar contraseña<input type="password" {...register('password_confirmation')} /></label>
          </div>
          <button className="btn-primary-app compact" disabled={mutation.isPending}>Guardar cambios</button>
        </form>
      </section>
    </>
  )
}
