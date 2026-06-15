import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { GuestRoute, ProtectedRoute, RoleRoute } from './components/auth/RouteGuards'
import { Loading } from './components/common/Ui'

const Login = lazy(() => import('./pages/auth/Login'))
const PasswordRecovery = lazy(() => import('./pages/auth/PasswordRecovery'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ResourceList = lazy(() => import('./pages/ResourceList'))
const Deliverables = lazy(() => import('./pages/Deliverables'))
const Repository = lazy(() => import('./pages/Repository'))
const Profile = lazy(() => import('./pages/Profile'))
const InfoPage = lazy(() => import('./pages/InfoPage'))

const commonRoutes = (role) => <>
  <Route index element={<Dashboard />} />
  <Route path="deliverables" element={<Deliverables />} />
  <Route path="evaluations" element={<ResourceList type="evaluations" />} />
  <Route path="repository" element={<Repository />} />
  <Route path="profile" element={<Profile />} />
  {role !== 'student' && <Route path="projects" element={<ResourceList type="projects" />} />}
</>

export default function App() {
  return <Suspense fallback={<Loading />}><Routes>
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<PasswordRecovery />} />
    </Route>
    <Route path="/repository" element={<Repository publicView />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route element={<RoleRoute role="admin" />}><Route path="/admin"><Route index element={<Dashboard />} /><Route path="users" element={<ResourceList type="users" />} /><Route path="projects" element={<ResourceList type="projects" />} /><Route path="deliverables" element={<Deliverables />} /><Route path="evaluations" element={<ResourceList type="evaluations" />} /><Route path="academics" element={<ResourceList type="academics" />} /><Route path="repository" element={<Repository />} /><Route path="settings" element={<InfoPage title="Ajustes del sistema" description="Configuración, avisos, etiquetas y parámetros institucionales." />} /><Route path="profile" element={<Profile />} /></Route></Route>
        <Route element={<RoleRoute role="teacher" />}><Route path="/teacher">{commonRoutes('teacher')}<Route path="proposals" element={<InfoPage title="Revisión de propuestas" description="Consulta, aprueba o solicita cambios a las propuestas asignadas." />} /></Route></Route>
        <Route element={<RoleRoute role="student" />}><Route path="/student">{commonRoutes('student')}<Route path="proposal" element={<InfoPage title="Registrar tesis o propuesta" description="Captura la propuesta y conforma el equipo del proyecto." />} /></Route></Route>
      </Route>
    </Route>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>
}
