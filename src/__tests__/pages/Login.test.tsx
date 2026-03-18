import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Login } from '@/pages/Login'

const mockLogin = vi.fn()

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}))

vi.mock('@/lib/admin-routing', () => ({
  useAdminRoutes: () => ({
    adminBasePath: '/admin',
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to the authenticated role home instead of the selected tab', async () => {
    mockLogin.mockResolvedValue({
      id: '1',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin',
    })

    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/" element={<div>Public Home</div>} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<div data-testid="admin-page">Admin Page</div>} />
          <Route path="/judge" element={<div data-testid="judge-page">Judge Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('tab', { name: 'auth.judge' }))
    await user.type(screen.getByLabelText('auth.email'), 'admin@test.com')
    await user.type(screen.getByLabelText('auth.password'), 'password')
    await user.click(screen.getByRole('button', { name: 'auth.sign_in' }))

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('judge-page')).not.toBeInTheDocument()
  })
})
