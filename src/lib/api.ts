import axios from 'axios'
import { Hackathon, Project, Assignment } from './mock-data'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = {
  // Hackathons
  getHackathons: async () => {
    const res = await axios.get<Hackathon[]>(`${API_URL}/hackathons`)
    return res.data
  },
  getHackathon: async (id: string) => {
    const res = await axios.get<Hackathon>(`${API_URL}/hackathons/${id}`)
    return res.data
  },
  createHackathon: async (data: Partial<Hackathon>) => {
    const res = await axios.post<Hackathon>(`${API_URL}/hackathons`, data)
    return res.data
  },
  updateHackathon: async (id: string, data: Partial<Hackathon>) => {
    const res = await axios.put<Hackathon>(`${API_URL}/hackathons/${id}`, data)
    return res.data
  },

  // Projects
  getProjects: async (params?: { hackathonId?: string; sessionId?: string }) => {
    const res = await axios.get<Project[]>(`${API_URL}/projects`, { params })
    return res.data
  },
  getProject: async (id: string) => {
    const res = await axios.get<Project>(`${API_URL}/projects/${id}`)
    return res.data
  },
  createProject: async (data: Partial<Project>) => {
    const res = await axios.post<Project>(`${API_URL}/projects`, data)
    return res.data
  },
  updateProject: async (id: string, data: Partial<Project>) => {
    const res = await axios.put<Project>(`${API_URL}/projects/${id}`, data)
    return res.data
  },
  deleteProject: async (id: string) => {
    const res = await axios.delete(`${API_URL}/projects/${id}`)
    return res.data
  },

  // Assignments
  getAssignments: async (params?: { sessionId?: string; projectId?: string; judgeId?: string; status?: string }) => {
    const res = await axios.get<Assignment[]>(`${API_URL}/assignments`, { params })
    return res.data
  },
  createAssignments: async (assignments: { sessionId: string; projectId: string; judgeId: string }[]) => {
    const res = await axios.post<Assignment[]>(`${API_URL}/assignments`, { assignments })
    return res.data
  },
  deleteAssignment: async (id: string) => {
    const res = await axios.delete(`${API_URL}/assignments/${id}`)
    return res.data
  },

  // Scores
  submitScores: async (assignmentId: string, data: { scores: { criterionId: string; score: number }[]; comment?: string; status?: string }) => {
    const res = await axios.post<Assignment>(`${API_URL}/assignments/${assignmentId}/scores`, data)
    return res.data
  },

  // Dashboard
  getDashboardStats: async (params: { hackathonId?: string; userId?: string; role?: string }) => {
    const res = await axios.get<{
      totalProjects?: number;
      totalJudges?: number;
      totalAssignments?: number;
      completedAssignments?: number;
      pendingReviews?: number;
      myAssignments?: number;
      completed?: number;
      pending?: number;
    }>(`${API_URL}/dashboard/stats`, { params })
    return res.data
  },

  // Leaderboard
  getLeaderboard: async (params?: { hackathonId?: string; sessionId?: string }) => {
    const res = await axios.get<{
      id: string;
      title: string;
      oneLiner: string;
      tags: string[];
      avgScore: number;
      maxPossible: number;
      judgeCount: number;
      submitterName: string;
    }[]>(`${API_URL}/leaderboard`, { params })
    return res.data
  },

  // Reports
  getScoringReport: async (params?: { hackathonId?: string; sessionId?: string }) => {
    const res = await axios.get<{
      assignmentId: string;
      projectId: string;
      projectTitle: string;
      judgeId: string;
      judgeName: string;
      sessionName: string;
      totalScore: number;
      comment: string;
      scores: { criterionId: string; score: number }[];
      createdAt: string;
    }[]>(`${API_URL}/reports/scoring`, { params })
    return res.data
  },

  // Users
  getUsers: async (params?: { role?: string }) => {
    const res = await axios.get<{ id: string; email: string; name: string; role: string; avatarUrl?: string }[]>(`${API_URL}/users`, { params })
    return res.data
  },
}
