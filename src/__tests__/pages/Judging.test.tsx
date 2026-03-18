import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Judging } from '@/pages/Judging'

const mockUseAuth = vi.fn()
const mockUseActiveHackathon = vi.fn()
const mockGetAssignments = vi.fn()
const mockGetProjects = vi.fn()

vi.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/lib/active-hackathon', () => ({
  useActiveHackathon: () => mockUseActiveHackathon(),
}))

vi.mock('@/lib/admin-routing', () => ({
  useAdminRoutes: () => ({
    adminBasePath: '/admin',
  }),
  buildAdminPath: (_basePath: string, suffix = '') => `/admin/${suffix}`.replace(/\/+/g, '/'),
}))

vi.mock('@/lib/api', () => ({
  api: {
    getAssignments: (...args: unknown[]) => mockGetAssignments(...args),
    getProjects: (...args: unknown[]) => mockGetProjects(...args),
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
  }),
}))

function renderJudgingPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/judging']}>
        <Routes>
          <Route path="/admin/judging" element={<Judging />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Judging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveHackathon.mockReturnValue({
      activeHackathon: {
        id: 'hack-1',
      },
    })
    mockGetAssignments.mockResolvedValue([
      {
        id: 'assignment-1',
        projectId: 'project-1',
        judgeId: 'judge-1',
        status: 'in_progress',
        judge: { id: 'judge-1', name: 'Judge Judy' },
      },
    ])
    mockGetProjects.mockResolvedValue([
      {
        id: 'project-1',
        title: 'Project Atlas',
        oneLiner: 'One project summary',
      },
    ])
  })

  it('shows admin-safe copy in the admin progress view', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', role: 'admin' },
    })

    renderJudgingPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'View details' })).toBeInTheDocument()
    })
    expect(screen.getByText('Judging Progress')).toBeInTheDocument()
    expect(screen.getByText('Track judging progress across judges. Admins do not submit scores here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open review' })).not.toBeInTheDocument()
  })

  it('keeps scoring language for judges only', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'judge-1', role: 'judge' },
    })
    mockGetAssignments.mockResolvedValue([
      {
        id: 'assignment-1',
        projectId: 'project-1',
        judgeId: 'judge-1',
        status: 'pending',
        judge: { id: 'judge-1', name: 'Judge Judy' },
      },
    ])

    renderJudgingPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'judging.open_review' })).toBeInTheDocument()
    })
    expect(screen.getByText('My Review Queue')).toBeInTheDocument()
    expect(screen.getByText('Review your assigned projects and submit scores.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View details' })).not.toBeInTheDocument()
  })
})
