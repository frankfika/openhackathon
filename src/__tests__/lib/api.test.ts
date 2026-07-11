import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { api } from '@/lib/api'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

describe('api client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('site settings', () => {
    it('getSiteSettings calls GET /api/site-settings', async () => {
      mockedAxios.get.mockResolvedValue({ data: { siteName: 'OpenHackathon' } })

      const result = await api.getSiteSettings()
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/site-settings')
      expect(result).toEqual({ siteName: 'OpenHackathon' })
    })

    it('updateSiteSettings calls PUT /api/site-settings', async () => {
      const payload = { siteName: 'Custom Name', tabTitle: 'Custom Tab' }
      mockedAxios.put.mockResolvedValue({ data: payload })

      const result = await api.updateSiteSettings(payload)
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/site-settings', payload)
      expect(result).toEqual(payload)
    })

    it('uploadImage calls POST /api/uploads/images with binary payload', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
      mockedAxios.post.mockResolvedValue({ data: { url: '/uploads/images/logo.png', fileName: 'logo.png', size: 3 } })

      const result = await api.uploadImage(file)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/uploads/images',
        expect.any(ArrayBuffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'image/png',
            'x-file-name': 'logo.png',
          }),
        })
      )
      expect(result.url).toBe('/uploads/images/logo.png')
    })
  })

  describe('hackathons', () => {
    it('getCurrentHackathon calls GET /api/hackathon', async () => {
      const data = { id: 'h1', title: 'Current Hack' }
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getCurrentHackathon()
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathon')
      expect(result).toEqual(data)
    })

    it('getHackathons calls GET /api/hackathons', async () => {
      const data = [{ id: 'h1', title: 'Hack 1' }]
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getHackathons()
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathons')
      expect(result).toEqual(data)
    })

    it('getHackathon calls GET /api/hackathons/:id', async () => {
      const data = { id: 'h1', title: 'Hack 1' }
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getHackathon('h1')
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathons/h1')
      expect(result).toEqual(data)
    })

    it('createHackathon calls POST /api/hackathons', async () => {
      const payload = { title: 'New Hack' }
      const data = { id: 'h2', ...payload }
      mockedAxios.post.mockResolvedValue({ data })

      const result = await api.createHackathon(payload)
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/hackathons', payload)
      expect(result).toEqual(data)
    })

    it('updateHackathon calls PUT /api/hackathons/:id', async () => {
      const payload = { title: 'Updated' }
      const data = { id: 'h1', ...payload }
      mockedAxios.put.mockResolvedValue({ data })

      const result = await api.updateHackathon('h1', payload)
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/hackathons/h1', payload)
      expect(result).toEqual(data)
    })

    it('getHackathonMarkdownDoc calls GET /api/hackathons/:id/markdown-doc', async () => {
      const data = { fileName: 'README.md', content: '# Doc', updatedAt: '2026-03-14T00:00:00.000Z' }
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getHackathonMarkdownDoc('h1')
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathons/h1/markdown-doc')
      expect(result).toEqual(data)
    })

    it('saveHackathonMarkdownDoc calls PUT /api/hackathons/:id/markdown-doc', async () => {
      const payload = { fileName: 'guide.md', content: '# Guide' }
      mockedAxios.put.mockResolvedValue({ data: payload })

      const result = await api.saveHackathonMarkdownDoc('h1', payload)
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/hackathons/h1/markdown-doc', payload)
      expect(result).toEqual(payload)
    })

    it('deleteHackathonMarkdownDoc calls DELETE /api/hackathons/:id/markdown-doc', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } })

      await api.deleteHackathonMarkdownDoc('h1')
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/hackathons/h1/markdown-doc')
    })

    it('getHackathonMarkdownDoc falls back to single-hackathon endpoint without id', async () => {
      mockedAxios.get.mockResolvedValue({ data: { fileName: 'README.md', content: '# Doc' } })

      await api.getHackathonMarkdownDoc()
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathon/markdown-doc')
    })
  })

  describe('projects', () => {
    it('getProjects calls GET /api/projects with params', async () => {
      const data = [{ id: 'p1' }]
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getProjects({ hackathonId: 'h1' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects', { params: { hackathonId: 'h1' } })
      expect(result).toEqual(data)
    })

    it('getProjectsPaginated calls GET /api/projects with pagination and status filters', async () => {
      const data = { data: [{ id: 'p1' }], total: 1, page: 1, pageSize: 50 }
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getProjectsPaginated({
        hackathonId: 'h1',
        page: 1,
        pageSize: 50,
        search: 'vision',
        status: 'submitted',
      })

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects', {
        params: {
          hackathonId: 'h1',
          page: 1,
          pageSize: 50,
          search: 'vision',
          status: 'submitted',
        },
      })
      expect(result).toEqual(data)
    })

    it('getProjectsPaginated serializes submission field filters', async () => {
      const data = { data: [{ id: 'p1' }], total: 1, page: 1, pageSize: 50 }
      mockedAxios.get.mockResolvedValue({ data })

      await api.getProjectsPaginated({
        hackathonId: 'h1',
        page: 1,
        pageSize: 50,
        submissionFilters: {
          category: 'AI',
          className: '2026',
        },
      })

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects', {
        params: {
          hackathonId: 'h1',
          page: 1,
          pageSize: 50,
          search: undefined,
          status: undefined,
          submissionFilters: JSON.stringify({
            category: 'AI',
            className: '2026',
          }),
        },
      })
    })

    it('createProject calls POST /api/projects', async () => {
      const payload = { title: 'My Project', hackathonId: 'h1' }
      mockedAxios.post.mockResolvedValue({ data: { id: 'p1', ...payload } })

      await api.createProject(payload)
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/projects', payload)
    })

    it('deleteProject calls DELETE /api/projects/:id', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } })

      await api.deleteProject('p1')
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/projects/p1')
    })
  })

  describe('assignments', () => {
    it('getAssignments calls GET /api/assignments with params', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getAssignments({ judgeId: 'j1', status: 'pending' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/assignments', {
        params: { judgeId: 'j1', status: 'pending' },
      })
    })

    it('createAssignments calls POST /api/assignments', async () => {
      const assignments = [{ projectId: 'p1', judgeId: 'j1' }]
      mockedAxios.post.mockResolvedValue({ data: assignments })

      await api.createAssignments(assignments)
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/assignments', { assignments })
    })
  })

  describe('scores', () => {
    it('submitScores calls POST /api/assignments/:id/scores', async () => {
      const payload = {
        scores: [{ criterionId: 'c1', score: 80 }],
        comment: 'Great work',
        status: 'completed',
      }
      mockedAxios.post.mockResolvedValue({ data: { id: 'a1' } })

      await api.submitScores('a1', payload)
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/assignments/a1/scores', payload)
    })
  })

  describe('auth', () => {
    it('login calls POST /api/auth/login', async () => {
      const user = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' }
      mockedAxios.post.mockResolvedValue({ data: user })

      const result = await api.login('admin@test.com', 'password')
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'admin@test.com',
        password: 'password',
      })
      expect(result).toEqual(user)
    })
  })

  describe('users', () => {
    it('getUsers calls GET /api/users with role filter', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getUsers({ role: 'judge' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/users', { params: { role: 'judge' } })
    })

    it('createUser calls POST /api/users', async () => {
      const payload = { email: 'new@test.com', name: 'New User', password: 'pass123', role: 'judge' }
      mockedAxios.post.mockResolvedValue({ data: { id: '2', ...payload } })

      await api.createUser(payload)
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/users', payload)
    })

    it('deleteUser calls DELETE /api/users/:id', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } })

      await api.deleteUser('u1')
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/users/u1')
    })

    it('getHackathonJudges calls GET /api/hackathons/:id/judges', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getHackathonJudges('h1')
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathons/h1/judges')
    })

    it('registerHackathonJudges calls POST /api/hackathons/:id/judges', async () => {
      mockedAxios.post.mockResolvedValue({ data: [] })

      await api.registerHackathonJudges('h1', ['j1', 'j2'])
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/hackathons/h1/judges', { judgeIds: ['j1', 'j2'] })
    })

    it('removeHackathonJudge calls DELETE /api/hackathons/:id/judges/:judgeId', async () => {
      mockedAxios.delete.mockResolvedValue({ data: { success: true } })

      await api.removeHackathonJudge('h1', 'j1')
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/hackathons/h1/judges/j1')
    })

    it('getHackathonJudges falls back to /api/hackathon/judges without id', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getHackathonJudges()
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/hackathon/judges')
    })
  })

  describe('leaderboard', () => {
    it('getLeaderboard calls GET /api/leaderboard', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getLeaderboard({ hackathonId: 'h1' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/leaderboard', { params: { hackathonId: 'h1' } })
    })

    it('saveLeaderboard calls PUT /api/hackathons/:id/leaderboard', async () => {
      const payload = { entries: [{ projectId: 'p1', rank: 1, award: 'Gold' }], published: true }
      mockedAxios.put.mockResolvedValue({ data: {} })

      await api.saveLeaderboard('h1', payload)
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/hackathons/h1/leaderboard', payload)
    })

    it('saveLeaderboard falls back to /api/hackathon/leaderboard without id', async () => {
      const payload = { entries: [{ projectId: 'p1', rank: 1, award: 'Gold' }], published: true }
      mockedAxios.put.mockResolvedValue({ data: {} })

      await api.saveLeaderboard(undefined, payload)
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/hackathon/leaderboard', payload)
    })
  })

  describe('dashboard', () => {
    it('getDashboardStats calls GET /api/dashboard/stats', async () => {
      mockedAxios.get.mockResolvedValue({ data: { totalProjects: 5 } })

      await api.getDashboardStats({ hackathonId: 'h1', role: 'admin' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/dashboard/stats', {
        params: { hackathonId: 'h1', role: 'admin' },
      })
    })
  })

  describe('reports', () => {
    it('getScoringReport calls GET /api/reports/scoring', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getScoringReport({ hackathonId: 'h1' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/reports/scoring', {
        params: { hackathonId: 'h1' },
      })
    })
  })

  describe('AI document generation (block 3 §3.2)', () => {
    it('generateHackathonDescription posts to /api/ai/hackathons/:id/generate-description', async () => {
      mockedAxios.post.mockResolvedValue({ data: { draft: { zh: 'x', en: 'y' } } })

      const result = await api.generateHackathonDescription({
        hackathonId: 'h1',
        theme: 'web3',
        tracks: ['DePIN'],
        prizePool: '50,000 USDC',
        tone: 'professional',
        language: 'both',
      })

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/ai/hackathons/h1/generate-description',
        expect.objectContaining({
          theme: 'web3',
          tracks: ['DePIN'],
          prizePool: '50,000 USDC',
          tone: 'professional',
          language: 'both',
        })
      )
      expect(result.draft.zh).toBe('x')
      expect(result.draft.en).toBe('y')
    })

    it('generateHackathonNews posts to /api/ai/hackathons/:id/generate-news', async () => {
      mockedAxios.post.mockResolvedValue({ data: { draft: {}, projects: ['p1'] } })

      await api.generateHackathonNews({
        hackathonId: 'h1',
        language: 'both',
        tone: 'professional',
        includeRunnerUps: true,
      })

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/ai/hackathons/h1/generate-news',
        expect.objectContaining({ includeRunnerUps: true })
      )
    })

    it('suggestHackathonCriteria posts to /api/ai/hackathons/:id/suggest-criteria', async () => {
      mockedAxios.post.mockResolvedValue({ data: { suggestions: [] } })

      await api.suggestHackathonCriteria({
        hackathonId: 'h1',
        theme: 't',
        focus: 'f',
        criterionCount: 6,
      })

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/ai/hackathons/h1/suggest-criteria',
        expect.objectContaining({ criterionCount: 6 })
      )
    })
  })
})
