/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { User } from './types'
import { api } from './api'
import { extractApiErrorMessage, sanitizeUser, USER_PUBLIC_FIELDS } from './api-error'

/**
 * Single token/user storage slot, indexed by role.
 *
 * The legacy implementation used path-based slots (`/admin/*` → admin token,
 * `/judge/*` → judge token) and a third "current path" function that picked
 * the right token on every API call. That design had three failure modes
 * (spec block 1 §1.2 P1-3 / audit §1 §2 §3):
 *   - admin and judge sessions could not be active simultaneously
 *   - `getStoredUser()` could read a judge blob from an admin URL after a
 *     popstate (mismatched role in memory)
 *   - a single 401 redirect cleared only one slot, so the other session
 *     could re-trigger a redirect loop
 *
 * The new design keys storage by `role` (the only dimension the backend
 * actually authorizes on) and keeps both blobs independent. Path-based
 * slot selection is gone.
 */
const STORAGE_KEYS = {
  user: {
    admin: 'openhackathon_admin_user',
    judge: 'openhackathon_judge_user',
  },
  token: {
    admin: 'openhackathon_admin_token',
    judge: 'openhackathon_judge_token',
  },
} as const

// Legacy keys (for one-time migration from earlier releases).
const LEGACY_USER_KEY = 'openhackathon_user'
const LEGACY_TOKEN_KEY = 'openhackathon_token'

type Role = 'admin' | 'judge'

function userKeyFor(role: Role): string {
  return STORAGE_KEYS.user[role]
}
function tokenKeyFor(role: Role): string {
  return STORAGE_KEYS.token[role]
}
function isRole(value: unknown): value is Role {
  return value === 'admin' || value === 'judge'
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  loginWithUser: (loginResult: User & { token?: string }) => User
  logout: () => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Read all `openhackathon_*_user` blobs and sanitize each one. Strips any
 * fields outside the public whitelist (e.g. an old `password` field that
 * may have been cached by 19bf0f3-era clients).
 */
function cleanAllBlobs() {
  for (const role of ['admin', 'judge'] as const) {
    const raw = localStorage.getItem(userKeyFor(role))
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const clean = sanitizeUser(parsed)
      localStorage.setItem(userKeyFor(role), JSON.stringify(clean))
    } catch {
      localStorage.removeItem(userKeyFor(role))
    }
  }
}

/**
 * One-time migration from the very first generation of single-slot storage
 * (`openhackathon_user` / `openhackathon_token`). Copies the blob into the
 * role-specific slot and removes the legacy keys.
 */
function migrateLegacyAuth() {
  const legacyUser = localStorage.getItem(LEGACY_USER_KEY)
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (!legacyUser || !legacyToken) return
  try {
    const parsed = JSON.parse(legacyUser) as { role?: unknown } & Record<string, unknown>
    if (isRole(parsed.role)) {
      const clean = sanitizeUser(parsed)
      localStorage.setItem(userKeyFor(parsed.role), JSON.stringify(clean))
      localStorage.setItem(tokenKeyFor(parsed.role), legacyToken)
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(LEGACY_USER_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

/**
 * Detect if any user blob's role doesn't match the slot it lives in
 * (a likely corruption from older path-based versions). Clears the
 * offending blob and forces the user to log in again.
 */
function clearOrphanedUserBlobs() {
  for (const role of ['admin', 'judge'] as const) {
    const raw = localStorage.getItem(userKeyFor(role))
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as { role?: unknown }
      if (parsed.role !== role) {
        localStorage.removeItem(userKeyFor(role))
        localStorage.removeItem(tokenKeyFor(role))
      }
    } catch {
      localStorage.removeItem(userKeyFor(role))
    }
  }
}

/** Pick which role's user should be considered "active" right now. */
function activeRoleFromUrl(): Role | null {
  if (typeof window === 'undefined') return null
  if (window.location.pathname.startsWith('/judge')) return 'judge'
  return 'admin'
}

function readUserForRole(role: Role): User | null {
  const raw = localStorage.getItem(userKeyFor(role))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const clean = sanitizeUser(parsed) as User
    if (clean.role !== role) return null
    return clean
  } catch {
    return null
  }
}

/** Pick the right user to surface, preferring the role implied by the URL. */
function getStoredUser(): User | null {
  const pathRole = activeRoleFromUrl()
  if (pathRole) {
    const userForPath = readUserForRole(pathRole)
    if (userForPath) return userForPath
  }
  // Fallback: any logged-in user (helps when a deep link lands on the wrong tab).
  return readUserForRole('admin') || readUserForRole('judge')
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mount: migrate, sanitize, load. Re-runs on `storage` events so that
  // logging in or out in one tab updates the others (P1-1 acceptance).
  useEffect(() => {
    migrateLegacyAuth()
    cleanAllBlobs()
    clearOrphanedUserBlobs()
    setUser(getStoredUser())
    setIsLoading(false)

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      const userKeys: ReadonlyArray<string> = Object.values(STORAGE_KEYS.user)
      const tokenKeys: ReadonlyArray<string> = Object.values(STORAGE_KEYS.token)
      if (userKeys.includes(e.key) || tokenKeys.includes(e.key)) {
        setUser(getStoredUser())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Re-pick the active user when the URL changes (e.g. admin -> /judge).
  // Uses popstate (back/forward) and a MutationObserver on the document
  // title/pathname to catch pushState/replaceState, since the platform
  // does not fire popstate for those.
  useEffect(() => {
    const refresh = () => setUser(getStoredUser())
    window.addEventListener('popstate', refresh)
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('popstate', refresh)
      observer.disconnect()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const loginResult = await api.login(email, password)
      const { token, ...userData } = loginResult
      // Trust the server's role for storage slot selection.
      const role: Role = userData.role === 'judge' ? 'judge' : 'admin'

      const cleanUser = sanitizeUser(userData) as User
      setUser(cleanUser)
      localStorage.setItem(userKeyFor(role), JSON.stringify(cleanUser))
      if (token) {
        localStorage.setItem(tokenKeyFor(role), token)
      }
      return cleanUser
    } catch (err: unknown) {
      const message = extractApiErrorMessage(err, 'Login failed. Please try again.')
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Persist a user + token obtained from any login flow (e.g. Web3). */
  const loginWithUser = useCallback((loginResult: User & { token?: string }) => {
    const { token, ...userData } = loginResult
    const role: Role = userData.role === 'judge' ? 'judge' : 'admin'
    const cleanUser = sanitizeUser(userData) as User
    setUser(cleanUser)
    localStorage.setItem(userKeyFor(role), JSON.stringify(cleanUser))
    if (token) {
      localStorage.setItem(tokenKeyFor(role), token)
    }
    return cleanUser
  }, [])

  const logout = useCallback(() => {
    // Clear both slots so the other role (e.g. concurrent admin session)
    // is also signed out — this matches what the user expects when they
    // click "Log out" anywhere in the app.
    localStorage.removeItem(STORAGE_KEYS.token.admin)
    localStorage.removeItem(STORAGE_KEYS.token.judge)
    localStorage.removeItem(STORAGE_KEYS.user.admin)
    localStorage.removeItem(STORAGE_KEYS.user.judge)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({ user, login, loginWithUser, logout, isLoading, error }),
    [user, login, loginWithUser, logout, isLoading, error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Re-export whitelist keys so other modules (e.g. tests) can verify
// "no password in localStorage" without re-importing from api-error.
export { USER_PUBLIC_FIELDS }

// --------------------------------------------------------------------------
// Backward-compat shims
//
// Earlier callers (e.g. the first-time setup wizard) used these helpers
// to read / write the role-specific storage slot directly. They are kept
// so existing imports continue to work; new code should use
// `useAuth().loginWithUser` / `useAuth().logout` instead.
// --------------------------------------------------------------------------

export function getTokenKeyForRole(role: Role): string {
  return tokenKeyFor(role)
}

export function getUserKeyForRole(role: Role): string {
  return userKeyFor(role)
}
