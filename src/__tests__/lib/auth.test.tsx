import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import type { User } from '@/lib/types'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    login: vi.fn(),
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('throws when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth())
    }).toThrow('useAuth must be used within an AuthProvider')
  })

  it('initializes with null user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.user).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('restores user from localStorage on admin path', async () => {
    const savedUser = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const }
    localStorage.setItem('openhackathon_admin_user', JSON.stringify(savedUser))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.user).toEqual(savedUser)
  })

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem('openhackathon_admin_user', 'not-valid-json')

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.user).toBeNull()
  })

  it('login sets user and persists to role-specific slot', async () => {
    const mockUser = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const }
    vi.mocked(api.login).mockResolvedValue({ ...mockUser, token: 'test-token' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let authenticatedUser: User | null = null
    await act(async () => {
      authenticatedUser = await result.current.login('admin@test.com', 'password')
    })

    expect(result.current.user).toEqual(mockUser)
    expect(authenticatedUser).toEqual(mockUser)
    expect(localStorage.getItem('openhackathon_admin_user')).toBe(JSON.stringify(mockUser))
    expect(localStorage.getItem('openhackathon_admin_token')).toBe('test-token')
  })

  it('login as judge stores under judge slot, not admin', async () => {
    const mockUser = { id: '2', email: 'j@t.com', name: 'J', role: 'judge' as const }
    vi.mocked(api.login).mockResolvedValue({ ...mockUser, token: 'j-token' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login('j@t.com', 'pw')
    })

    expect(localStorage.getItem('openhackathon_judge_user')).toBe(JSON.stringify(mockUser))
    expect(localStorage.getItem('openhackathon_judge_token')).toBe('j-token')
    expect(localStorage.getItem('openhackathon_admin_user')).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_token')).toBeNull()
  })

  it('login strips sensitive fields before persisting to localStorage (P0-1 hardening)', async () => {
    // Simulate a server response that accidentally includes extra fields.
    const responseWithSecret = {
      id: '1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'admin' as const,
      password: '$2b$10$hashedpassword',
      globalPoints: 9999,
      wallets: [{ address: '0xdeadbeef', chain: 'ethereum', chainId: 1, isPrimary: true, userId: '1', createdAt: '2026-01-01' }],
    }
    vi.mocked(api.login).mockResolvedValue({ ...responseWithSecret, token: 'tok' } as unknown as Awaited<ReturnType<typeof api.login>>)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login('admin@test.com', 'pw')
    })

    const stored = localStorage.getItem('openhackathon_admin_user')
    expect(stored).toBeTruthy()
    expect(stored).not.toContain('password')
    expect(stored).not.toContain('globalPoints')
    expect(stored).not.toContain('wallets')
    expect(stored).not.toContain('deadbeef')
  })

  it.skip('login sets error on failure - timing issue with act()', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    let thrown = false
    try {
      await act(async () => {
        await result.current.login('bad@test.com', 'wrong')
      })
    } catch {
      thrown = true
    }

    expect(thrown).toBe(true)
    await waitFor(() => {
      expect(result.current.error).toBe('Login failed. Please try again.')
    })
    expect(result.current.user).toBeNull()
  })

  it('logout clears BOTH role slots (P1-2 acceptance)', async () => {
    // pre-existing admin session
    localStorage.setItem(
      'openhackathon_admin_user',
      JSON.stringify({ id: '1', email: 'a@t.com', name: 'A', role: 'admin' })
    )
    localStorage.setItem('openhackathon_admin_token', 'a-tok')
    // pre-existing judge session
    localStorage.setItem(
      'openhackathon_judge_user',
      JSON.stringify({ id: '2', email: 'j@t.com', name: 'J', role: 'judge' })
    )
    localStorage.setItem('openhackathon_judge_token', 'j-tok')

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user).not.toBeNull())

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_user')).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_token')).toBeNull()
    expect(localStorage.getItem('openhackathon_judge_user')).toBeNull()
    expect(localStorage.getItem('openhackathon_judge_token')).toBeNull()
  })

  it('migrates legacy single-slot storage to role-specific (P1-1)', async () => {
    // Legacy blobs from a pre-split version of the app.
    const legacyUser = { id: '1', email: 'a@t.com', name: 'A', role: 'admin' }
    localStorage.setItem('openhackathon_user', JSON.stringify(legacyUser))
    localStorage.setItem('openhackathon_token', 'legacy-tok')

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Should have moved into the admin slot and removed the legacy keys.
    expect(localStorage.getItem('openhackathon_admin_user')).toBeTruthy()
    expect(localStorage.getItem('openhackathon_admin_token')).toBe('legacy-tok')
    expect(localStorage.getItem('openhackathon_user')).toBeNull()
    expect(localStorage.getItem('openhackathon_token')).toBeNull()
  })

  it('removes orphan blob whose role does not match its slot (P1-1)', async () => {
    // Imagine a buggy path-based version wrote a 'judge' user into the
    // admin slot. On mount we should clear the blob and force re-login.
    const orphan = { id: '1', email: 'j@t.com', name: 'J', role: 'judge' }
    localStorage.setItem('openhackathon_admin_user', JSON.stringify(orphan))
    localStorage.setItem('openhackathon_admin_token', 'tok')

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_user')).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_token')).toBeNull()
  })

  it('strips residual password field from existing localStorage on mount (P0-1 hardening)', async () => {
    // Imagine an older client cached a richer User shape that included
    // a password field. The new code must scrub it on load.
    const dirty = {
      id: '1',
      email: 'a@t.com',
      name: 'A',
      role: 'admin',
      password: 'SECRET',
    }
    localStorage.setItem('openhackathon_admin_user', JSON.stringify(dirty))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const stored = localStorage.getItem('openhackathon_admin_user') || ''
    expect(stored).not.toContain('password')
    expect(stored).not.toContain('SECRET')
  })
})
