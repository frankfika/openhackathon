import axios from 'axios'
import { Hackathon, Project, Assignment, User, AssignmentStatus, ProjectRound, PromotionStatus, SiteSettings } from './types'

const API_URL = '/api'
const AUTH_TOKEN_KEY = 'openhackathon_token'

if (axios.interceptors?.request?.use) {
  axios.interceptors.request.use((config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) {
      if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
        (config.headers as { set: (key: string, value: string) => void }).set('Authorization', `Bearer ${token}`)
      } else {
        (config as { headers: Record<string, string> }).headers = {
          ...((config.headers || {}) as Record<string, string>),
          Authorization: `Bearer ${token}`,
        }
      }
    }
    return config
  })
}

export const api = {
  // Site Settings
  getSiteSettings: async () => {
    const res = await axios.get<SiteSettings>(`${API_URL}/site-settings`)
    return res.data
  },
  updateSiteSettings: async (data: Partial<SiteSettings>) => {
    const res = await axios.put<SiteSettings>(`${API_URL}/site-settings`, data)
    return res.data
  },

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
  getAssignments: async (params?: { sessionId?: string; projectId?: string; projectRoundId?: string; judgeId?: string; status?: string; hackathonId?: string }) => {
    const res = await axios.get<Assignment[]>(`${API_URL}/assignments`, { params })
    return res.data
  },
  createAssignments: async (assignments: { sessionId?: string; projectId?: string; judgeId: string; projectRoundId?: string }[]) => {
    const res = await axios.post<Assignment[]>(`${API_URL}/assignments`, { assignments })
    return res.data
  },
  updateAssignmentStatus: async (assignmentId: string, status: AssignmentStatus) => {
    const res = await axios.put<Assignment>(`${API_URL}/assignments/${assignmentId}/status`, { status })
    return res.data
  },
  deleteAssignment: async (id: string) => {
    const res = await axios.delete(`${API_URL}/assignments/${id}`)
    return res.data
  },

  // Project Rounds / Promotions
  getProjectRounds: async (params?: { hackathonId?: string; sessionId?: string; projectId?: string; promotionStatus?: PromotionStatus }) => {
    const res = await axios.get<ProjectRound[]>(`${API_URL}/project-rounds`, { params })
    return res.data
  },
  initializeProjectRounds: async (data: { sessionId: string; sourceSessionId?: string; projectIds?: string[] }) => {
    const res = await axios.post<{ sessionId: string; initializedCount: number; rounds: ProjectRound[] }>(`${API_URL}/project-rounds/initialize`, data)
    return res.data
  },
  updateProjectRoundPromotion: async (
    projectRoundId: string,
    data: { decision: PromotionStatus; nextSessionId?: string; note?: string; decidedById?: string; judgeIds?: string[] }
  ) => {
    const res = await axios.put<ProjectRound>(`${API_URL}/project-rounds/${projectRoundId}/promotion`, data)
    return res.data
  },
  bulkUpdateProjectRoundPromotions: async (data: {
    decisions: { projectRoundId: string; decision: PromotionStatus; nextSessionId?: string; note?: string; decidedById?: string }[];
    nextSessionId?: string;
    decidedById?: string;
    judgeIds?: string[];
  }) => {
    const res = await axios.post(`${API_URL}/project-rounds/promotions/bulk`, data)
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
      rank?: number;
      award?: string;
    }[]>(`${API_URL}/leaderboard`, { params })
    return res.data
  },

  getLeaderboardConfig: async (hackathonId: string) => {
    const res = await axios.get<{ leaderboardData: { projectId: string; rank: number; award: string }[] | null; leaderboardPublished: boolean }>(`${API_URL}/hackathons/${hackathonId}/leaderboard`)
    return res.data
  },

  saveLeaderboard: async (hackathonId: string, data: { entries: { projectId: string; rank: number; award: string }[]; published: boolean }) => {
    const res = await axios.put(`${API_URL}/hackathons/${hackathonId}/leaderboard`, data)
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
  getProjectScoringReport: async (params?: { hackathonId?: string; sessionId?: string }) => {
    const res = await axios.get<{
      projectRoundId?: string | null;
      projectId: string;
      projectTitle: string;
      submitterName?: string | null;
      submitterEmail: string;
      sessionId?: string | null;
      sessionName?: string | null;
      promotionStatus?: PromotionStatus;
      nextSessionId?: string | null;
      nextSessionName?: string | null;
      averageScore: number;
      totalAssignments: number;
      completedAssignments: number;
      pendingAssignments: number;
      inProgressAssignments: number;
      judges: {
        assignmentId: string;
        judgeId: string;
        judgeName: string;
        judgeEmail: string;
        status: AssignmentStatus;
        totalScore?: number | null;
        comment?: string | null;
        scores?: { criterionId: string; score: number }[];
        scoredAt: string;
      }[];
    }[]>(`${API_URL}/reports/projects`, { params })
    return res.data
  },

  // Users
  getUsers: async (params?: { role?: string }) => {
    const res = await axios.get<{ id: string; email: string; name: string; role: string; avatarUrl?: string; createdAt?: string }[]>(`${API_URL}/users`, { params })
    return res.data
  },
  createUser: async (data: { email: string; name: string; password: string; role?: string }) => {
    const res = await axios.post<{ id: string; email: string; name: string; role: string }>(`${API_URL}/users`, data)
    return res.data
  },
  deleteUser: async (id: string) => {
    const res = await axios.delete(`${API_URL}/users/${id}`)
    return res.data
  },

  // Auth
  login: async (email: string, password: string): Promise<User & { token?: string }> => {
    const res = await axios.post<User & { token?: string }>(`${API_URL}/auth/login`, { email, password })
    return res.data
  },
}
