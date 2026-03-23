import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { AuthProvider } from './lib/auth'
import { ActiveHackathonProvider } from './lib/active-hackathon'
import { SiteBrandingProvider, useSiteBranding } from './lib/site-branding'
import { DashboardLayout } from './components/DashboardLayout'
import { JudgeLayout } from './components/JudgeLayout'
import { RequireRole } from './components/RequireRole'
import { buildAdminPath, getAdminBasePath } from './lib/admin-routing'

const Login = lazy(() => import('./pages/Login').then((mod) => ({ default: mod.Login })))
const JudgeLogin = lazy(() => import('./pages/JudgeLogin').then((mod) => ({ default: mod.JudgeLogin })))
const AdminDashboard = lazy(() => import('./components/dashboard/AdminDashboard').then((mod) => ({ default: mod.AdminDashboard })))
const Projects = lazy(() => import('./pages/Projects').then((mod) => ({ default: mod.Projects })))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then((mod) => ({ default: mod.ProjectDetail })))
const JudgingDetail = lazy(() => import('./pages/JudgingDetail').then((mod) => ({ default: mod.JudgingDetail })))
const Judging = lazy(() => import('./pages/Judging').then((mod) => ({ default: mod.Judging })))
const AssignmentManager = lazy(() => import('./pages/AssignmentManager').then((mod) => ({ default: mod.AssignmentManager })))
const JudgeManagement = lazy(() => import('./pages/JudgeManagement').then((mod) => ({ default: mod.JudgeManagement })))
const HackathonSettings = lazy(() => import('./pages/HackathonSettings').then((mod) => ({ default: mod.HackathonSettings })))
const Leaderboard = lazy(() => import('./pages/Leaderboard').then((mod) => ({ default: mod.Leaderboard })))
const PublicSubmit = lazy(() => import('./pages/PublicSubmit').then((mod) => ({ default: mod.PublicSubmit })))
const SubmitSuccess = lazy(() => import('./pages/SubmitSuccess').then((mod) => ({ default: mod.SubmitSuccess })))
const Landing = lazy(() => import('./pages/Landing').then((mod) => ({ default: mod.Landing })))
const Docs = lazy(() => import('./pages/Docs').then((mod) => ({ default: mod.Docs })))
const Settings = lazy(() => import('./pages/Settings').then((mod) => ({ default: mod.Settings })))
const ActivityLog = lazy(() => import('./pages/ActivityLog').then((mod) => ({ default: mod.ActivityLogPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
const RouteLoader = () => <div className="py-16 text-center text-muted-foreground">Loading...</div>

function LegacyDashboardRedirect({ adminBasePath }: { adminBasePath: string }) {
  const location = useLocation()
  const suffix = location.pathname.replace(/^\/dashboard/, '')
  return <Navigate to={`${buildAdminPath(adminBasePath, suffix)}${location.search}${location.hash}`} replace />
}

/** Redirect old judging hub URL to assignments */
function LegacyJudgingHubRedirect({ adminBasePath }: { adminBasePath: string }) {
  return <Navigate to={buildAdminPath(adminBasePath, 'assignments')} replace />
}

function AppRoutes() {
  const { settings, isLoading } = useSiteBranding()

  if (isLoading) {
    return <RouteLoader />
  }

  const adminBasePath = getAdminBasePath(settings)
  const adminLoginPath = buildAdminPath(adminBasePath, 'login')

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/submit" element={<PublicSubmit />} />
            <Route path="/submit/success" element={<SubmitSuccess />} />
            <Route path="/projects" element={<Navigate to="/" replace />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Route>

          <Route path="/login" element={<Navigate to={adminLoginPath} replace />} />
          <Route path="/dashboard/*" element={<LegacyDashboardRedirect adminBasePath={adminBasePath} />} />

          <Route path={adminLoginPath} element={<Login />} />
          <Route path="/judge/login" element={<JudgeLogin />} />

          <Route
            path={adminBasePath}
            element={
              <RequireRole allowedRoles={['admin']} redirectTo={adminLoginPath}>
                <DashboardLayout />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="hackathons" element={<Navigate to={adminBasePath} replace />} />
            <Route path="hackathons/:id" element={<Navigate to={adminBasePath} replace />} />
            <Route path="hackathons/:id/settings" element={<HackathonSettings />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="judging" element={<LegacyJudgingHubRedirect adminBasePath={adminBasePath} />} />
            <Route path="reviews" element={<Navigate to={buildAdminPath(adminBasePath, 'assignments')} replace />} />
            <Route path="assignments" element={<AssignmentManager />} />
            <Route path="reports" element={<Navigate to={buildAdminPath(adminBasePath, 'assignments')} replace />} />
            <Route path="judging/:id" element={<JudgingDetail />} />
            <Route path="judges" element={<JudgeManagement />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="activity" element={<ActivityLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route
            path="/judge"
            element={
              <RequireRole allowedRoles={['judge']} redirectTo="/judge/login">
                <JudgeLayout />
              </RequireRole>
            }
          >
            <Route index element={<Judging />} />
            <Route path="review/:id" element={<JudgingDetail />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteBrandingProvider>
        <AuthProvider>
          <ActiveHackathonProvider>
            <AppRoutes />
          </ActiveHackathonProvider>
        </AuthProvider>
      </SiteBrandingProvider>
    </QueryClientProvider>
  )
}

export default App
