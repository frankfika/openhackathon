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
  })

  describe('hackathons', () => {
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
  })

  describe('projects', () => {
    it('getProjects calls GET /api/projects with params', async () => {
      const data = [{ id: 'p1' }]
      mockedAxios.get.mockResolvedValue({ data })

      const result = await api.getProjects({ hackathonId: 'h1' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects', { params: { hackathonId: 'h1' } })
      expect(result).toEqual(data)
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
      const assignments = [{ sessionId: 's1', projectId: 'p1', judgeId: 'j1' }]
      mockedAxios.post.mockResolvedValue({ data: assignments })

      await api.createAssignments(assignments)
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/assignments', { assignments })
    })
  })

  describe('project rounds', () => {
    it('getProjectRounds calls GET /api/project-rounds with params', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] })

      await api.getProjectRounds({ sessionId: 's1', hackathonId: 'h1' })
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/project-rounds', {
        params: { sessionId: 's1', hackathonId: 'h1' },
      })
    })

    it('updateProjectRoundPromotion calls PUT /api/project-rounds/:id/promotion', async () => {
      const payload = { decision: 'advanced' as const, nextSessionId: 's2', judgeIds: ['j1'] }
      mockedAxios.put.mockResolvedValue({ data: { id: 'r1' } })

      await api.updateProjectRoundPromotion('r1', payload)
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/project-rounds/r1/promotion', payload)
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
})
