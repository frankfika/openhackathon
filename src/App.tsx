import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { ActiveHackathonProvider } from './lib/active-hackathon';
import { DashboardLayout } from './components/DashboardLayout';
import { PoweredByBadge } from './components/PoweredByBadge';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Hackathons } from './pages/Hackathons';
import { Projects } from './pages/Projects';
import { Judging } from './pages/Judging'
import { JudgingDetail } from './pages/JudgingDetail'
import { HackathonSettings } from './pages/HackathonSettings'
import { Leaderboard } from './pages/Leaderboard'
import { SubmitProject } from './pages/SubmitProject'
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
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
            </Route>

            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="hackathons" element={<Hackathons />} />
              <Route path="hackathons/:id/settings" element={<HackathonSettings />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/submit" element={<SubmitProject />} />
              <Route path="judging" element={<Judging />} />
              <Route path="judging/:id" element={<JudgingDetail />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ActiveHackathonProvider>
    </AuthProvider>
  );
}

export default App;
