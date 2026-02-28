import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import React from 'react'
import { RequireRole } from '@/components/RequireRole'

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

function renderWithRouter(
  ui: React.ReactElement,
  { initialEntries = ['/protected'] } = {}
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        <Route path="/" element={<div data-testid="home-page">Home Page</div>} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects to / when user role is not allowed', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'judge@test.com', name: 'Judge', role: 'judge' },
      isLoading: false,
    })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('home-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children when user has allowed role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
      isLoading: false,
    })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('supports multiple allowed roles', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'judge@test.com', name: 'Judge', role: 'judge' },
      isLoading: false,
    })

    renderWithRouter(
      <RequireRole allowedRoles={['admin', 'judge']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('redirects to custom path via redirectTo prop', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
          <Route
            path="/protected"
            element={
              <RequireRole allowedRoles={['admin']} redirectTo="/">
                <div>Protected</div>
              </RequireRole>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('home-page')).toBeInTheDocument()
  })
})
