import axios from 'axios'
import {
  Hackathon,
  Project,
  Assignment,
  User,
  AssignmentStatus,
  SiteSettings,
  HackathonMarkdownDoc,
  HackathonUpsertInput,
  AdminUser,
  ActivityLog,
  GlobalLeaderboardEntry,
  CrossHackathonActivityEntry,
} from './types'

const API_URL = '/api'

// Lazy import to avoid circular dependency — auth.tsx exports these helpers
function getActiveToken(): string | null {
  const isJudgePath = window.location.pathname.startsWith('/judge')
  const key = isJudgePath ? 'openhackathon_judge_token' : 'openhackathon_admin_token'
  return localStorage.getItem(key)
}

if (axios.interceptors?.request?.use) {
  axios.interceptors.request.use((config) => {
    const token = getActiveToken()
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

  let isRedirecting = false
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401 && !isRedirecting) {
        const token = getActiveToken()
        if (token) {
          isRedirecting = true
          const isJudge = window.location.pathname.startsWith('/judge')
          // Clear only the relevant role's auth
          if (isJudge) {
            localStorage.removeItem('openhackathon_judge_token')
            localStorage.removeItem('openhackathon_judge_user')
          } else {
            localStorage.removeItem('openhackathon_admin_token')
            localStorage.removeItem('openhackathon_admin_user')
          }
          window.location.href = isJudge ? '/judge/login' : '/admin/login'
        }
      }
      return Promise.reject(error)
    }
  )
}

export const api = {
  // Site Settings
  getSiteSettings: async () => {
    const res = await axios.get<SiteSettings>(`${API_URL}/site-settings`)
    return res.data
  },
  getAdminSiteSettings: async () => {
    const res = await axios.get<SiteSettings>(`${API_URL}/site-settings/admin`)
    return res.data
  },
  updateSiteSettings: async (data: Partial<SiteSettings> & { smtpPass?: string }) => {
    const res = await axios.put<SiteSettings>(`${API_URL}/site-settings`, data)
    return res.data
  },
  testSubmissionEmail: async (to: string) => {
    const res = await axios.post<{ sent: boolean; messageId?: string; reason?: string; errorCode?: string; errorDetail?: string }>(`${API_URL}/site-settings/email/test`, { to })
    return res.data
  },
  uploadImage: async (file: File) => {
    const buffer = await file.arrayBuffer()
    const res = await axios.post<{ url: string; fileName: string; size: number }>(`${API_URL}/uploads/images`, buffer, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-file-name': encodeURIComponent(file.name || 'image'),
      },
    })
    return res.data
  },

  // Hackathons
  getCurrentHackathon: async () => {
    const res = await axios.get<Hackathon | null>(`${API_URL}/hackathon`)
    return res.data
  },
  getHackathons: async () => {
    const res = await axios.get<Hackathon[]>(`${API_URL}/hackathons`)
    return res.data
  },
  getHackathon: async (id: string) => {
    const res = await axios.get<Hackathon>(`${API_URL}/hackathons/${id}`)
    return res.data
  },
  createHackathon: async (data: HackathonUpsertInput) => {
    const res = await axios.post<Hackathon>(`${API_URL}/hackathons`, data)
    return res.data
  },
  updateHackathon: async (id: string, data: HackathonUpsertInput) => {
    const res = await axios.put<Hackathon>(`${API_URL}/hackathons/${id}`, data)
    return res.data
  },
  getHackathonMarkdownDoc: async (id?: string) => {
    const endpoint = id ? `${API_URL}/hackathons/${id}/markdown-doc` : `${API_URL}/hackathon/markdown-doc`
    const res = await axios.get<HackathonMarkdownDoc>(endpoint)
    return res.data
  },
  saveHackathonMarkdownDoc: async (id: string | undefined, data: { fileName?: string; content: string; isBase64?: boolean }) => {
    const endpoint = id ? `${API_URL}/hackathons/${id}/markdown-doc` : `${API_URL}/hackathon/markdown-doc`
    const res = await axios.put<HackathonMarkdownDoc>(endpoint, data)
    return res.data
  },
  deleteHackathonMarkdownDoc: async (id?: string) => {
    const endpoint = id ? `${API_URL}/hackathons/${id}/markdown-doc` : `${API_URL}/hackathon/markdown-doc`
    const res = await axios.delete(endpoint)
    return res.data
  },

  // Projects
  getProjects: async (params?: { hackathonId?: string; lite?: boolean }) => {
    const res = await axios.get<Project[]>(`${API_URL}/projects`, { params })
    return res.data
  },
  getProjectsPaginated: async (params: {
    hackathonId?: string
    page: number
    pageSize: number
    search?: string
    status?: 'draft' | 'submitted'
    submissionFilters?: Record<string, string>
  }) => {
    const queryParams = {
      hackathonId: params.hackathonId,
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      status: params.status,
      submissionFilters:
        params.submissionFilters && Object.keys(params.submissionFilters).length > 0
          ? JSON.stringify(params.submissionFilters)
          : undefined,
    }

    const res = await axios.get<{ data: Project[]; total: number; page: number; pageSize: number }>(
      `${API_URL}/projects`, { params: queryParams }
    )
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
  getAssignment: async (id: string) => {
    const res = await axios.get<Assignment>(`${API_URL}/assignments/${id}`)
    return res.data
  },
  getAssignments: async (params?: { projectId?: string; judgeId?: string; status?: string; hackathonId?: string; lite?: boolean }) => {
    const res = await axios.get<Assignment[]>(`${API_URL}/assignments`, { params })
    return res.data
  },
  createAssignments: async (assignments: { projectId?: string; judgeId: string }[]) => {
    const res = await axios.post<Assignment[]>(`${API_URL}/assignments`, { assignments })
    return res.data
  },
  updateAssignmentStatus: async (assignmentId: string, status: AssignmentStatus) => {
    const res = await axios.put<Assignment>(`${API_URL}/assignments/${assignmentId}/status`, { status })
    return res.data
  },
  deleteAssignment: async (id: string, force?: boolean) => {
    const res = await axios.delete(`${API_URL}/assignments/${id}`, { params: force ? { force: 'true' } : undefined })
    return res.data
  },
  resetAssignments: async (hackathonId: string) => {
    const res = await axios.delete<{ deleted: number }>(`${API_URL}/assignments/bulk`, { data: { hackathonId } })
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
  getLeaderboard: async (params?: { hackathonId?: string }) => {
    const res = await axios.get<{
      id: string;
      title: string;
      oneLiner: string;
      tags: string[];
      avgScore: number;
      maxPossible: number;
      judgeCount: number;
      submitterName: string;
      submissionData?: Record<string, unknown> | null;
      rank?: number;
      award?: string;
    }[]>(`${API_URL}/leaderboard`, { params })
    return res.data
  },

  getLeaderboardConfig: async (hackathonId?: string) => {
    const endpoint = hackathonId ? `${API_URL}/hackathons/${hackathonId}/leaderboard` : `${API_URL}/hackathon/leaderboard`
    const res = await axios.get<{ leaderboardData: { projectId: string; rank: number; award: string }[] | null; leaderboardPublished: boolean }>(endpoint)
    return res.data
  },

  saveLeaderboard: async (hackathonId: string | undefined, data: { entries: { projectId: string; rank: number; award: string }[]; published: boolean }) => {
    const endpoint = hackathonId ? `${API_URL}/hackathons/${hackathonId}/leaderboard` : `${API_URL}/hackathon/leaderboard`
    const res = await axios.put(endpoint, data)
    return res.data
  },

  // Reports
  getScoringReport: async (params?: { hackathonId?: string }) => {
    const res = await axios.get<{
      assignmentId: string;
      projectId: string;
      projectTitle: string;
      judgeId: string;
      judgeName: string;
      totalScore: number;
      comment: string;
      scores: { criterionId: string; score: number }[];
      createdAt: string;
    }[]>(`${API_URL}/reports/scoring`, { params })
    return res.data
  },
  getProjectScoringReport: async (params?: { hackathonId?: string }) => {
    const res = await axios.get<{
      projectId: string;
      projectTitle: string;
      submitterName?: string | null;
      submitterEmail: string;
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
    const res = await axios.get<AdminUser[]>(`${API_URL}/users`, { params })
    return res.data
  },
  getHackathonJudges: async (hackathonId?: string) => {
    const endpoint = hackathonId ? `${API_URL}/hackathons/${hackathonId}/judges` : `${API_URL}/hackathon/judges`
    const res = await axios.get<AdminUser[]>(endpoint)
    return res.data
  },
  registerHackathonJudges: async (hackathonId: string | undefined, judgeIds: string[]) => {
    const endpoint = hackathonId ? `${API_URL}/hackathons/${hackathonId}/judges` : `${API_URL}/hackathon/judges`
    const res = await axios.post<AdminUser[]>(endpoint, { judgeIds })
    return res.data
  },
  removeHackathonJudge: async (hackathonId: string | undefined, judgeId: string) => {
    const endpoint = hackathonId ? `${API_URL}/hackathons/${hackathonId}/judges/${judgeId}` : `${API_URL}/hackathon/judges/${judgeId}`
    const res = await axios.delete(endpoint)
    return res.data
  },
  createUser: async (data: { email: string; name: string; password: string; role?: string }) => {
    const res = await axios.post<AdminUser>(`${API_URL}/users`, data)
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

  // Web3 authentication
  getWeb3Nonce: async (address: string, chain: string): Promise<{ nonce: string; message: string; address: string }> => {
    const res = await axios.post<{ nonce: string; message: string; address: string }>(
      `${API_URL}/auth/web3/nonce`,
      { address, chain },
    )
    return res.data
  },
  verifyWeb3: async (payload: {
    address: string
    chain: string
    chainId?: number
    signature: string
    message: string
    nonce: string
  }): Promise<User & { token?: string }> => {
    const res = await axios.post<User & { token?: string }>(`${API_URL}/auth/web3/verify`, payload)
    return res.data
  },
  linkWallet: async (payload: {
    address: string
    chain: string
    chainId?: number
    signature: string
    message: string
    nonce: string
  }): Promise<{ success: boolean; user: User }> => {
    const res = await axios.post<{ success: boolean; user: User }>(`${API_URL}/auth/link-wallet`, payload)
    return res.data
  },

  // Cross-hackathon identity & global leaderboard
  getGlobalLeaderboard: async (params?: { chain?: string; limit?: number }) => {
    const res = await axios.get<{ leaderboard: GlobalLeaderboardEntry[]; total: number }>(
      `${API_URL}/leaderboard/global-web3`,
      { params },
    )
    return res.data
  },
  getGlobalProfile: async (userId: string) => {
    const res = await axios.get<{
      user: User
      stats: { globalPoints: number; participationCount: number; judgeCount: number; awardCount: number }
      activities: CrossHackathonActivityEntry[]
    }>(`${API_URL}/users/${userId}/global-profile`)
    return res.data
  },
  getIdentityByWallet: async (address: string, chain: string) => {
    const res = await axios.get(`${API_URL}/identity/${address}`, { params: { chain } })
    return res.data
  },

  // Setup (first-time initialization)
  getSetupStatus: async () => {
    const res = await axios.get<{ needsSetup: boolean }>(`${API_URL}/setup/status`)
    return res.data
  },
  setup: async (data: {
    admin: { email: string; name: string; password: string }
    hackathon: { title: string; tagline: string; city?: string; startAt: string; endAt: string }
  }) => {
    const res = await axios.post<{
      admin: AdminUser & { token?: string }
      hackathon: Hackathon
    }>(`${API_URL}/setup`, data)
    return res.data
  },

  // System Reset
  resetSystem: async (mode: 'hackathon' | 'factory') => {
    const res = await axios.post<{ success: boolean; mode: string }>(`${API_URL}/admin/reset`, { mode, confirm: true })
    return res.data
  },

  // Activity Logs
  getActivityLogs: async (params?: {
    hackathonId?: string
    limit?: number
    offset?: number
    action?: string
    entityType?: string
    actorId?: string
  }) => {
    const res = await axios.get<{
      logs: ActivityLog[]
      total: number
      limit: number
      offset: number
    }>(`${API_URL}/hackathon/activity-logs`, { params })
    return res.data
  },
  getEntityActivityLogs: async (entityType: string, entityId: string, hackathonId?: string) => {
    const res = await axios.get<{ logs: ActivityLog[] }>(
      `${API_URL}/hackathon/activity-logs/${entityType}/${entityId}`,
      { params: hackathonId ? { hackathonId } : undefined }
    )
    return res.data
  },

  // AI Services
  analyzeProject: async (projectId: string) => {
    const res = await axios.post(`${API_URL}/ai/analyze-project/${projectId}`)
    return res.data
  },
  batchAnalyzeProjects: async (params: { projectIds?: string[]; hackathonId?: string }) => {
    const res = await axios.post(`${API_URL}/ai/batch-analyze`, params)
    return res.data
  },
  getScoringConsistency: async (hackathonId: string) => {
    const res = await axios.get(`${API_URL}/ai/scoring-consistency/${hackathonId}`)
    return res.data
  },
  generateContent: async (params: { type: string; context: Record<string, unknown>; language?: string; style?: string }) => {
    const res = await axios.post(`${API_URL}/ai/generate-content`, params)
    return res.data
  },
  optimizeDescription: async (description: string, language?: string, style?: string) => {
    const res = await axios.post(`${API_URL}/ai/optimize-description`, { description, language, style })
    return res.data
  },
  moderateContent: async (content: string, type?: string) => {
    const res = await axios.post(`${API_URL}/ai/moderate-content`, { content, type })
    return res.data
  },
  detectSimilarity: async (text1: string, text2: string) => {
    const res = await axios.post(`${API_URL}/ai/detect-similarity`, { text1, text2 })
    return res.data
  },
  checkPlagiarism: async (projectId: string) => {
    const res = await axios.post(`${API_URL}/ai/check-plagiarism/${projectId}`)
    return res.data
  },
  getJudgeSuggestions: async (assignmentId: string) => {
    const res = await axios.get(`${API_URL}/ai/judge-suggestions/${assignmentId}`)
    return res.data
  },

}
