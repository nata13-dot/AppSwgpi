import { lazy, Suspense } from 'react'
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import { GuestRoute, ProtectedRoute, Require } from './components/auth/RouteGuards'
import { Loading } from './components/ui'
import { useAuth } from './hooks/useAuth'
import { canManageAcademics, canViewUsers, homePath, isAdmin, mustChangePassword, isGeneralAdmin, isManagementStaff, isTeacher } from './lib/permissions'

const Login = lazy(() => import('./pages/auth/Login'))
const PasswordRecovery = lazy(() => import('./pages/auth/PasswordRecovery'))
const SelfRegister = lazy(() => import('./pages/auth/SelfRegister'))
const ChangePassword = lazy(() => import('./pages/auth/ChangePassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const GeneralPanel = lazy(() => import('./pages/admin/GeneralPanel'))
const Users = lazy(() => import('./pages/users/Users'))
const Projects = lazy(() => import('./pages/projects/Projects'))
const Rooms = lazy(() => import('./pages/rooms/Rooms'))
const EvaluationDocuments = lazy(() => import('./pages/EvaluationDocuments'))
const AcademicWorkflows = lazy(() => import('./pages/AcademicWorkflows'))
const Subjects = lazy(() => import('./pages/Subjects'))
const Deliverables = lazy(() => import('./pages/Deliverables'))
const Proposals = lazy(() => import('./pages/Proposals'))
const Advisors = lazy(() => import('./pages/Advisors'))
const Institutional = (name) => lazy(() => import('./pages/admin/Institutional').then((module) => ({ default: module[name] })))
const Careers = Institutional('CareersPage')
const Operations = Institutional('OperationsPage')
const Audit = Institutional('AuditPage')
const Integrity = Institutional('IntegrityPage')
const Backups = Institutional('BackupsPage')
const SentEmails = Institutional('SentEmailsPage')
const SystemPage = (name) => lazy(() => import('./pages/admin/SystemPages').then((module) => ({ default: module[name] })))
const CareerPage = (name) => lazy(() => import('./pages/admin/CareerPages').then((module) => ({ default: module[name] })))
const SettingsPage = SystemPage('SettingsPage')
const NoticesPage = SystemPage('NoticesPage')
const TagsPage = SystemPage('TagsPage')
const CareerModules = CareerPage('CareerModulesPage')
const CareerSetup = CareerPage('CareerSetupPage')
const Profile = lazy(() => import('./pages/Profile'))
const RegistrationRequests = lazy(() => import('./pages/RegistrationRequests'))
const Companies = lazy(() => import('./pages/Companies'))
const Archive = lazy(() => import('./pages/Archive'))
const PeriodCenter = lazy(() => import('./pages/PeriodCenter'))
const Repository = lazy(() => import('./pages/Repository'))
const RepositoryDetail = lazy(() => import('./pages/Repository').then((module) => ({ default: module.RepositoryDetail })))
const Evaluations = lazy(() => import('./pages/evaluations/Evaluations'))
const ArchivedEvaluations = lazy(() => import('./pages/evaluations/Evaluations').then(({ default: EvaluationsPage }) => ({ default: function ArchivedEvaluationsPage() { return <EvaluationsPage archived /> } })))

/**
 * Rutas planas, una por pantalla del front de PHP. Cada una se protege con el mismo permiso que usa la
 * página PHP equivalente (lib/permissions.js); la API vuelve a validarlo.
 */
const staffOrTeacher = (user) => isManagementStaff(user) || isTeacher(user)

const routes = [
  ['/dashboard', Dashboard],
  ['/general', GeneralPanel, isGeneralAdmin],
  ['/careers', Careers, isGeneralAdmin],
  ['/operations', Operations, isGeneralAdmin],
  ['/audit', Audit, isGeneralAdmin],
  ['/integrity', Integrity, isGeneralAdmin],
  ['/backups', Backups, isGeneralAdmin],
  ['/sent-emails', SentEmails, isGeneralAdmin],
  ['/registration-requests', RegistrationRequests, canManageAcademics],
  ['/users', Users, canViewUsers],
  ['/projects', Projects, staffOrTeacher],
  ['/evaluations', Evaluations, staffOrTeacher],
  ['/evaluation-rooms', Rooms, staffOrTeacher],
  ['/evaluation-documents', EvaluationDocuments],
  ['/academic-workflows', AcademicWorkflows],
  ['/semesters', AcademicWorkflows, canManageAcademics],
  ['/subjects', Subjects, canManageAcademics],
  ['/deliverables', Deliverables],
  ['/proposals', Proposals],
  ['/advisors', Advisors, isManagementStaff],
  ['/settings', SettingsPage, isAdmin],
  ['/notices', NoticesPage, isAdmin],
  ['/tags', TagsPage, isAdmin],
  ['/career-modules', CareerModules, isAdmin],
  ['/career-setup', CareerSetup, isAdmin],
  ['/archive', Archive, isAdmin],
  ['/period-center', PeriodCenter, isManagementStaff],
  ['/evaluations-archived', ArchivedEvaluations, staffOrTeacher],
  ['/companies', Companies, isManagementStaff],
  ['/profile', Profile],
]

/** El repositorio es público: con sesión se muestra dentro del sistema y sin ella en una página abierta. */
function PublicOrApp() {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated && !mustChangePassword(user)) return <AppLayout />
  return (
    <div className="public-shell">
      <header className="public-bar"><Link to="/login" className="public-brand"><img src="/images/itssmt.webp" alt="" /><strong>SGPI ITSSMT</strong></Link><Link className="btn-app primary sm" to="/login">Iniciar sesión</Link></header>
      <main className="content-app"><Outlet /></main>
    </div>
  )
}

function Home() {
  const { user } = useAuth()
  return <Navigate to={homePath(user)} replace />
}

export default function App() {
  return (
    <Suspense fallback={<div className="center-page"><Loading /></div>}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<PasswordRecovery />} />
          <Route path="/register" element={<SelfRegister />} />
        </Route>
        <Route path="/change-password" element={<ChangePassword />} />
        <Route element={<PublicOrApp />}>
          <Route path="/repository" element={<Repository />} />
          <Route path="/repository/:id" element={<RepositoryDetail />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            {routes.map(([path, Component, allow]) => (
              <Route key={path} path={path} element={allow ? <Require allow={allow}><Component /></Require> : <Component />} />
            ))}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
