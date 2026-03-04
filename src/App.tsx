import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { ActiveHackathonProvider } from './lib/active-hackathon';
import { SiteBrandingProvider } from './lib/site-branding';
import { DashboardLayout } from './components/DashboardLayout';
import { JudgeLayout } from './components/JudgeLayout';
import { RequireRole } from './components/RequireRole';

const Login = lazy(() => import('./pages/Login').then((mod) => ({ default: mod.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((mod) => ({ default: mod.Dashboard })));
const Hackathons = lazy(() => import('./pages/Hackathons').then((mod) => ({ default: mod.Hackathons })));
const Projects = lazy(() => import('./pages/Projects').then((mod) => ({ default: mod.Projects })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then((mod) => ({ default: mod.ProjectDetail })));
const Judging = lazy(() => import('./pages/Judging').then((mod) => ({ default: mod.Judging })));
const JudgingDetail = lazy(() => import('./pages/JudgingDetail').then((mod) => ({ default: mod.JudgingDetail })));
const HackathonSettings = lazy(() => import('./pages/HackathonSettings').then((mod) => ({ default: mod.HackathonSettings })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then((mod) => ({ default: mod.Leaderboard })));
const PublicSubmit = lazy(() => import('./pages/PublicSubmit').then((mod) => ({ default: mod.PublicSubmit })));
const SubmitSuccess = lazy(() => import('./pages/SubmitSuccess').then((mod) => ({ default: mod.SubmitSuccess })));
const AssignmentManager = lazy(() => import('./pages/AssignmentManager').then((mod) => ({ default: mod.AssignmentManager })));
const ScoringReport = lazy(() => import('./pages/ScoringReport').then((mod) => ({ default: mod.ScoringReport })));
const PromotionManager = lazy(() => import('./pages/PromotionManager').then((mod) => ({ default: mod.PromotionManager })));
const Landing = lazy(() => import('./pages/Landing').then((mod) => ({ default: mod.Landing })));
const Docs = lazy(() => import('./pages/Docs').then((mod) => ({ default: mod.Docs })));
const Settings = lazy(() => import('./pages/Settings').then((mod) => ({ default: mod.Settings })));

const queryClient = new QueryClient();
const RouteLoader = () => <div className="py-16 text-center text-muted-foreground">Loading...</div>;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteBrandingProvider>
        <AuthProvider>
          <ActiveHackathonProvider>
            <BrowserRouter>
            <Toaster position="top-center" richColors />
            <Suspense fallback={<RouteLoader />}>
              <Routes>
              {/* Public Routes */}
              <Route element={<Layout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/submit" element={<PublicSubmit />} />
                <Route path="/submit/success" element={<SubmitSuccess />} />
                <Route path="/projects" element={<Navigate to="/" replace />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
              </Route>

              {/* Admin Dashboard */}
              <Route
                path="/dashboard"
                element={
                  <RequireRole allowedRoles={['admin']}>
                    <DashboardLayout />
                  </RequireRole>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="hackathons" element={<Hackathons />} />
                <Route path="hackathons/:id/settings" element={<HackathonSettings />} />
                <Route path="projects" element={<Projects />} />
                <Route path="projects/:id" element={<ProjectDetail />} />
                <Route path="judging" element={<Judging />} />
                <Route path="judging/:id" element={<JudgingDetail />} />
                <Route path="assignments" element={<AssignmentManager />} />
                <Route path="promotions" element={<PromotionManager />} />
                <Route path="reports" element={<ScoringReport />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Judge Interface */}
              <Route
                path="/judge"
                element={
                  <RequireRole allowedRoles={['judge']}>
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
        </ActiveHackathonProvider>
      </AuthProvider>
    </SiteBrandingProvider>
    </QueryClientProvider>
  );
}

export default App;
