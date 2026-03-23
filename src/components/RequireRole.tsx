import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useAdminRoutes } from '../lib/admin-routing'
import { UserRole } from '../lib/types'

type RequireRoleProps = {
  children: React.ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
}

export function RequireRole({
  children,
  allowedRoles,
  redirectTo = '/login',
}: RequireRoleProps) {
  const { user, isLoading, logout } = useAuth()
  const { adminBasePath } = useAdminRoutes()
  const location = useLocation()
  const [tokenExpired, setTokenExpired] = useState(false)

  const isJudgePath = location.pathname.startsWith('/judge')
  const tokenKey = isJudgePath ? 'openhackathon_judge_token' : 'openhackathon_admin_token'

  useEffect(() => {
    if (user && !localStorage.getItem(tokenKey)) {
      logout()
      setTokenExpired(true)
    }
  }, [user, logout, tokenKey])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (tokenExpired || !user) {
    return <Navigate to={redirectTo} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    const fallbackPath = user.role === 'admin' ? adminBasePath : '/judge'
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}
