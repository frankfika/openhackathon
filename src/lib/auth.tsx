import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { User } from './types'
import { api } from './api'
import { extractApiErrorMessage } from './api-error'

// Separate storage keys for admin and judge sessions
const ADMIN_USER_KEY = 'openhackathon_admin_user'
const ADMIN_TOKEN_KEY = 'openhackathon_admin_token'
const JUDGE_USER_KEY = 'openhackathon_judge_user'
const JUDGE_TOKEN_KEY = 'openhackathon_judge_token'

// Legacy keys (for migration)
const LEGACY_USER_KEY = 'openhackathon_user'
const LEGACY_TOKEN_KEY = 'openhackathon_token'

export function getTokenKeyForRole(role: 'admin' | 'judge') {
  return role === 'admin' ? ADMIN_TOKEN_KEY : JUDGE_TOKEN_KEY
}

export function getUserKeyForRole(role: 'admin' | 'judge') {
  return role === 'admin' ? ADMIN_USER_KEY : JUDGE_USER_KEY
}

/** Get the active token based on current URL path */
export function getActiveToken(): string | null {
  const isJudgePath = window.location.pathname.startsWith('/judge')
  if (isJudgePath) {
    return localStorage.getItem(JUDGE_TOKEN_KEY)
  }
  // For admin paths and all other API calls, use admin token
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

/** Detect which role's token to clear on 401 */
export function clearAuthForCurrentPath() {
  const isJudgePath = window.location.pathname.startsWith('/judge')
  if (isJudgePath) {
    localStorage.removeItem(JUDGE_TOKEN_KEY)
    localStorage.removeItem(JUDGE_USER_KEY)
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    localStorage.removeItem(ADMIN_USER_KEY)
  }
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function migrateLegacyAuth() {
  const legacyUser = localStorage.getItem(LEGACY_USER_KEY)
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (legacyUser && legacyToken) {
    try {
      const user = JSON.parse(legacyUser) as User
      const role = user.role === 'judge' ? 'judge' : 'admin'
      localStorage.setItem(getUserKeyForRole(role), legacyUser)
      localStorage.setItem(getTokenKeyForRole(role), legacyToken)
    } catch { /* ignore */ }
    localStorage.removeItem(LEGACY_USER_KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }
}

function getStoredUser(): User | null {
  // Determine which user to load based on current path
  const isJudgePath = window.location.pathname.startsWith('/judge')
  const key = isJudgePath ? JUDGE_USER_KEY : ADMIN_USER_KEY
  const saved = localStorage.getItem(key)
  if (!saved) return null
  try {
    return JSON.parse(saved)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    migrateLegacyAuth()
    setUser(getStoredUser())
    setIsLoading(false)
  }, [])

  // Re-check user when path changes (admin <-> judge)
  useEffect(() => {
    const handlePopState = () => setUser(getStoredUser())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const login = async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const loginResult = await api.login(email, password)
      const { token, ...userData } = loginResult
      const role = userData.role === 'judge' ? 'judge' : 'admin'

      setUser(userData)
      localStorage.setItem(getUserKeyForRole(role), JSON.stringify(userData))
      if (token) {
        localStorage.setItem(getTokenKeyForRole(role), token)
      }
      return userData
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Login failed. Please try again.')
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = useCallback(() => {
    const isJudgePath = window.location.pathname.startsWith('/judge')
    if (isJudgePath) {
      localStorage.removeItem(JUDGE_TOKEN_KEY)
      localStorage.removeItem(JUDGE_USER_KEY)
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      localStorage.removeItem(ADMIN_USER_KEY)
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
