import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { ActiveHackathonProvider } from './lib/active-hackathon';
import { DashboardLayout } from './components/DashboardLayout';
import { JudgeLayout } from './components/JudgeLayout';
import { RequireRole } from './components/RequireRole';
import { PoweredByBadge } from './components/PoweredByBadge';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Hackathons } from './pages/Hackathons';
import { Projects } from './pages/Projects';
import { Judging } from './pages/Judging'
import { JudgingDetail } from './pages/JudgingDetail'
import { HackathonSettings } from './pages/HackathonSettings'
import { Leaderboard } from './pages/Leaderboard'
import { PublicSubmit } from './pages/PublicSubmit'
import { SubmitSuccess } from './pages/SubmitSuccess'
import { AssignmentManager } from './pages/AssignmentManager'
import { ScoringReport } from './pages/ScoringReport'
import { Landing } from './pages/Landing'
import { Docs } from './pages/Docs'
import { Settings } from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <ActiveHackathonProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <PoweredByBadge />
          <Routes>
            {/* Public Routes */}
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/submit" element={<PublicSubmit />} />
              <Route path="/submit/success" element={<SubmitSuccess />} />
              <Route path="/projects" element={<Projects />} />
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
              <Route path="judging" element={<Judging />} />
              <Route path="judging/:id" element={<JudgingDetail />} />
              <Route path="assignments" element={<AssignmentManager />} />
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
        </BrowserRouter>
      </ActiveHackathonProvider>
    </AuthProvider>
  );
}

export default App;
