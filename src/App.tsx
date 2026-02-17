import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { DashboardLayout } from './components/DashboardLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Hackathons } from './pages/Hackathons';
import { Projects } from './pages/Projects';
import { Judging } from './pages/Judging'
import { JudgingDetail } from './pages/JudgingDetail'
import { Leaderboard } from './pages/Leaderboard'
import { Settings } from './pages/Settings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Hackathons />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/hackathons" element={<Hackathons />} />
            <Route path="/projects" element={<Projects />} />
          </Route>

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="hackathons" element={<Hackathons />} />
            <Route path="projects" element={<Projects />} />
            <Route path="judging" element={<Judging />} />
            <Route path="judging/:id" element={<JudgingDetail />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
