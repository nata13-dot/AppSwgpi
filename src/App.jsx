import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { GuestRoute, ProtectedRoute, RoleRoute } from './components/auth/RouteGuards'
import { Loading } from './components/common/Ui'
import { AdvisorsModule, ProjectsModule, UsersModule } from './pages/AdminModules'

const Login = lazy(() => import('./pages/auth/Login'))
const PasswordRecovery = lazy(() => import('./pages/auth/PasswordRecovery'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Deliverables = lazy(() => import('./pages/Deliverables'))
const Repository = lazy(() => import('./pages/Repository'))
const Profile = lazy(() => import('./pages/Profile'))
const Academics = lazy(() => import('./pages/Academics'))
const SystemManagement = lazy(() => import('./pages/SystemManagement'))
const Semesters = lazy(() => import('./pages/Semesters'))
const Proposals = lazy(() => import('./pages/Proposals'))
const Evaluations = lazy(() => import('./pages/Evaluations'))
const StudentEvaluations = lazy(() => import('./pages/StudentEvaluations'))
const EvaluationDocuments = lazy(() => import('./pages/EvaluationDocuments'))

const commonRoutes = (role) => <>
  <Route index element={<Dashboard />} />
  <Route path="deliverables" element={<Deliverables />} />
  <Route path="evaluations" element={role === 'student' ? <StudentEvaluations /> : <Evaluations />} />
  {role !== 'student' && <Route path="evaluation-rooms" element={<Evaluations initialTab="rooms" />} />}
  {role !== 'student' && <Route path="evaluations-archived" element={<Evaluations initialArchived />} />}
  <Route path="evaluation-documents" element={<EvaluationDocuments />} />
  <Route path="repository" element={<Repository />} />
  <Route path="profile" element={<Profile />} />
  {role !== 'student' && <Route path="projects" element={<ProjectsModule readOnly={role === 'teacher'} />} />}
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
        <Route element={<RoleRoute role="admin" />}><Route path="/admin"><Route index element={<Dashboard />} /><Route path="users" element={<UsersModule />} /><Route path="advisors" element={<AdvisorsModule />} /><Route path="projects" element={<ProjectsModule />} /><Route path="proposals" element={<Proposals />} /><Route path="deliverables" element={<Deliverables />} /><Route path="evaluations" element={<Evaluations />} /><Route path="evaluation-rooms" element={<Evaluations initialTab="rooms" />} /><Route path="evaluations-archived" element={<Evaluations initialArchived />} /><Route path="evaluation-rubric" element={<Evaluations initialTab="rubric" />} /><Route path="evaluation-managers" element={<Evaluations initialTab="managers" />} /><Route path="evaluation-documents" element={<EvaluationDocuments />} /><Route path="academics" element={<Academics />} /><Route path="semesters" element={<Semesters />} /><Route path="repository" element={<Repository />} /><Route path="tags" element={<SystemManagement key="tags" initialTab="tags" />} /><Route path="notices" element={<SystemManagement key="notices" initialTab="notices" />} /><Route path="settings" element={<SystemManagement key="settings" />} /><Route path="profile" element={<Profile />} /></Route></Route>
        <Route element={<RoleRoute role="teacher" />}><Route path="/teacher">{commonRoutes('teacher')}<Route path="proposals" element={<Proposals />} /></Route></Route>
        <Route element={<RoleRoute role="student" />}><Route path="/student">{commonRoutes('student')}<Route path="proposal" element={<Proposals />} /></Route></Route>
      </Route>
    </Route>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense>
}
