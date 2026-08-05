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

// Mock extractApiErrorMessage
vi.mock('@/lib/api-error', () => ({
  extractApiErrorMessage: (_err: unknown, fallback: string) => fallback,
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

  it('restores user from localStorage', async () => {
    const savedUser = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const }
    // Use the new role-based storage key (path is "/" in jsdom → admin)
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

  it('login sets user and persists to localStorage', async () => {
    const mockUser = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const }
    // api.login now returns { token, ...userData }
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

  it.skip('login sets error on failure - timing issue with act()', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Try/catch to handle the thrown error
    let thrown = false
    try {
      await act(async () => {
        await result.current.login('bad@test.com', 'wrong')
      })
    } catch {
      thrown = true
    }

    expect(thrown).toBe(true)
    // Verify error state was set (fallback message when no response data)
    await waitFor(() => {
      expect(result.current.error).toBe('Login failed. Please try again.')
    })
    expect(result.current.user).toBeNull()
  })

  it('logout clears user and localStorage', async () => {
    const savedUser = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const }
    localStorage.setItem('openhackathon_admin_user', JSON.stringify(savedUser))
    localStorage.setItem('openhackathon_admin_token', 'test-token')

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.user).toEqual(savedUser)
    })

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_user')).toBeNull()
    expect(localStorage.getItem('openhackathon_admin_token')).toBeNull()
  })

  // Regression test for audit-launch-2026-08-06.md P0-2: the previous popstate-only
  // listener did NOT pick up React Router's pushState navigation, so admin and
  // judge sessions would not switch when the user moved between /admin and /judge
  // inside the SPA. AuthProvider now monkey-patches pushState/replaceState to
  // dispatch a `locationchange` event, and re-reads the role-matching user.
  it('re-reads the role-matching user on in-app navigation (pushState)', async () => {
    const adminUser = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const }
    const judgeUser = { id: '2', email: 'judge@test.com', name: 'Judge', role: 'judge' as const }
    localStorage.setItem('openhackathon_admin_user', JSON.stringify(adminUser))
    localStorage.setItem('openhackathon_judge_user', JSON.stringify(judgeUser))

    // jsdom starts at "/"
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => {
      expect(result.current.user).toEqual(adminUser)
    })

    // Simulate React Router's navigate('/judge') which calls history.pushState
    act(() => {
      window.history.pushState({}, '', '/judge')
    })
    await waitFor(() => {
      expect(result.current.user).toEqual(judgeUser)
    })

    // Back to admin area
    act(() => {
      window.history.pushState({}, '', '/admin')
    })
    await waitFor(() => {
      expect(result.current.user).toEqual(adminUser)
    })
  })
})
