import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
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
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
