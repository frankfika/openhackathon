/**
 * Extract a user-facing error message from an API error response.
 *
 * Priority order (per spec block 2 P1-1):
 *  1. `response.data.code` (server-provided, machine-readable) — preferred
 *  2. `response.data.error` (server-provided, human-readable)
 *  3. `err.message` (fallback for non-Axios errors)
 *  4. `fallback` — caller-supplied default
 *
 * Note: we deliberately do NOT look at `err.code`, because axios sets that
 * to the HTTP status code (e.g. "401"), which is a transport-level signal
 * — the server's `response.data.code` is the semantic one.
 */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') {
    return fallback
  }
  const e = error as {
    response?: { data?: { error?: string; code?: string } }
  }
  const data = e.response?.data
  if (data) {
    if (typeof data.code === 'string' && data.code) {
      return data.code
    }
    if (typeof data.error === 'string' && data.error) {
      return data.error
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

/** Public fields that the backend is allowed to send back in a User object. */
export const USER_PUBLIC_FIELDS = [
  'id',
  'email',
  'name',
  'role',
  'avatarUrl',
  'createdAt',
] as const
export type UserPublicField = (typeof USER_PUBLIC_FIELDS)[number]

/**
 * Strip any non-whitelisted fields from a User object before it is written
 * to localStorage. Defends against:
 *   - older client versions that cached a richer shape
 *   - compromised response payloads (e.g. audit §1: residual `password` field)
 *   - future backend schema additions that the frontend has not been
 *     updated to consume safely
 */
export function sanitizeUser<T extends Record<string, unknown>>(user: T): Partial<T> {
  if (!user || typeof user !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key of USER_PUBLIC_FIELDS) {
    if (key in user) {
      out[key] = user[key as keyof T]
    }
  }
  return out as Partial<T>
}
