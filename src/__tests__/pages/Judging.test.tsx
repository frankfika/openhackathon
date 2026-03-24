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
const mockGetHackathon = vi.fn()
const mockUpdateAssignmentStatus = vi.fn()

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
    getHackathon: (...args: unknown[]) => mockGetHackathon(...args),
    updateAssignmentStatus: (...args: unknown[]) => mockUpdateAssignmentStatus(...args),
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
        submitterName: 'Team Atlas',
        submitterEmail: 'atlas@example.com',
        submissionData: {
          track: 'AI',
          _receipt: { id: 'SUB-20260324-ABC123' },
        },
      },
    ])
    mockGetHackathon.mockResolvedValue({
      id: 'hack-1',
      scoringCriteria: [],
      submissionSchema: {
        fields: [
          { id: 'track', label: 'Track', type: 'text', required: false },
        ],
      },
    })
    mockUpdateAssignmentStatus.mockResolvedValue({})
  })

  it('shows admin-safe copy in the admin progress view', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', role: 'admin' },
    })

    renderJudgingPage()

    await waitFor(() => {
      expect(screen.getByText('Judging Progress')).toBeInTheDocument()
    })
    expect(screen.getByText('Judging Progress')).toBeInTheDocument()
    expect(screen.getByText('Track judging progress across judges. Admins can inspect results here, but not score.')).toBeInTheDocument()
    expect(screen.getByText('Review Materials')).toBeInTheDocument()
    expect(screen.getByText('Score Submission')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit Scores' })).not.toBeInTheDocument()
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
      expect(screen.getByText('My Review Queue')).toBeInTheDocument()
    })
    expect(screen.getByText('My Review Queue')).toBeInTheDocument()
    expect(screen.getByText('Review your assigned projects and submit scores.')).toBeInTheDocument()
    expect(screen.getByText('Review Materials')).toBeInTheDocument()
    expect(screen.getByText('Score Submission')).toBeInTheDocument()
  })

  it('shows only pending and completed buckets for judges', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'judge-1', role: 'judge' },
    })
    mockGetAssignments.mockResolvedValue([
      {
        id: 'assignment-1',
        projectId: 'project-1',
        judgeId: 'judge-1',
        status: 'in_progress',
        judge: { id: 'judge-1', name: 'Judge Judy' },
      },
      {
        id: 'assignment-2',
        projectId: 'project-1',
        judgeId: 'judge-1',
        status: 'completed',
        judge: { id: 'judge-1', name: 'Judge Judy' },
        totalScore: 88,
      },
    ])

    renderJudgingPage()

    await waitFor(() => {
      expect(screen.getAllByText(/judging\.status\.pending/).length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText(/judging\.status\.completed/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/judging\.status\.in_progress/)).toHaveLength(0)
  })

  it('shows submission data to judges and hides internal receipt payload', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'judge-1', role: 'judge' },
    })

    renderJudgingPage()

    await waitFor(() => {
      expect(screen.getByText('Submission Data')).toBeInTheDocument()
    })

    expect(screen.getByText('Track')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('projects.project_id')).toBeInTheDocument()
    expect(screen.queryByText('_receipt')).not.toBeInTheDocument()
    expect(screen.queryByText('SUB-20260324-ABC123')).not.toBeInTheDocument()
  })
})
