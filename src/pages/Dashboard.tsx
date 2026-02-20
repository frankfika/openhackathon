import React from 'react'
import { useAuth } from '@/lib/auth'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { JudgeDashboard } from '@/components/dashboard/JudgeDashboard'

export function Dashboard() {
  const { user } = useAuth()

  if (!user) {
    return <div>Loading...</div>
  }

  if (user.role === 'admin') {
    return <AdminDashboard />
  }

  if (user.role === 'judge') {
    return <JudgeDashboard />
  }

  // Fallback - should not happen as system only has admin and judge roles
  return <div>Unknown user role</div>
}
