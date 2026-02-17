import React from 'react'
import { useAuth } from '@/lib/auth'
import { AdminDashboard } from '@/components/dashboard/AdminDashboard'
import { JudgeDashboard } from '@/components/dashboard/JudgeDashboard'
import { HackerDashboard } from '@/components/dashboard/HackerDashboard'

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

  return <HackerDashboard />
}
