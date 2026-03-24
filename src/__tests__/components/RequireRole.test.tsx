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

vi.mock('@/lib/admin-routing', () => ({
  useAdminRoutes: () => ({
    adminBasePath: '/admin',
  }),
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
        <Route path="/admin" element={<div data-testid="admin-page">Admin Page</div>} />
        <Route path="/judge" element={<div data-testid="judge-page">Judge Page</div>} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows loading spinner while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true, logout: vi.fn() })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: vi.fn() })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects judges away from admin-only routes to /judge', () => {
    // Set token so the useEffect doesn't trigger logout
    localStorage.setItem('openhackathon_admin_token', 'fake-token')
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'judge@test.com', name: 'Judge', role: 'judge' },
      isLoading: false,
      logout: vi.fn(),
    })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('judge-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects admins away from judge-only routes to /admin', () => {
    localStorage.setItem('openhackathon_admin_token', 'fake-token')
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
      isLoading: false,
      logout: vi.fn(),
    })

    renderWithRouter(
      <RequireRole allowedRoles={['judge']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('admin-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children when user has allowed role', () => {
    localStorage.setItem('openhackathon_admin_token', 'fake-token')
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
      isLoading: false,
      logout: vi.fn(),
    })

    renderWithRouter(
      <RequireRole allowedRoles={['admin']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('supports multiple allowed roles', () => {
    localStorage.setItem('openhackathon_admin_token', 'fake-token')
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'judge@test.com', name: 'Judge', role: 'judge' },
      isLoading: false,
      logout: vi.fn(),
    })

    renderWithRouter(
      <RequireRole allowedRoles={['admin', 'judge']}>
        <div data-testid="protected-content">Protected</div>
      </RequireRole>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('redirects to custom path via redirectTo prop', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: vi.fn() })

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
