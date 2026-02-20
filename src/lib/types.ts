export type HackathonStatus = 'draft' | 'upcoming' | 'active' | 'judging' | 'completed'
export type SessionType = 'preliminary' | 'semi_final' | 'final'
export type SessionStatus = 'draft' | 'active' | 'judging' | 'completed'
export type UserRole = 'admin' | 'judge'

export type ScoringCriterion = {
  id: string
  name: string
  maxScore: number
}

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
  judgeId?: string // Link to Judge record
}

export type SubmissionField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'url'
  required: boolean
  placeholder?: string
}

export type Hackathon = {
  id: string
  title: string
  tagline: string
  city?: string
  startAt: string
  endAt: string
  status: HackathonStatus
  coverGradient: string
  submissionSchema?: SubmissionField[] | { fields?: SubmissionField[] }
  scoringCriteria?: ScoringCriterion[]
  rulesUrl?: string
  detailsUrl?: string
  gitbookUrl?: string
  prizePool?: string
  sessions?: Session[]
}

export type Session = {
  id: string
  hackathonId: string
  name: string
  type: SessionType
  status: SessionStatus
  startAt: string
  endAt: string
}

export type Project = {
  id: string
  hackathonId: string
  sessionId: string
  userId?: string
  submitterEmail: string
  submitterName?: string
  title: string
  oneLiner: string
  description?: string
  tags: string[]
  demoUrl?: string
  repoUrl?: string
  status: 'draft' | 'submitted'
  submissionData?: Record<string, any>
}

export type Judge = {
  id: string
  userId: string
  name: string
  title: string
  expertise: string[]
  isAi?: boolean
}

export type AssignmentScore = {
  criterionId: string
  score: number
}

export type Assignment = {
  id: string
  sessionId: string
  projectId: string
  judgeId: string
  status: 'pending' | 'in_progress' | 'completed'
  scores?: AssignmentScore[] | Record<string, number>
  comment?: string
  totalScore?: number
  // API response includes related objects
  session?: Session
  project?: Project
  judge?: User
}

export function formatDateRange(startAt: string, endAt: string) {
  const fmt = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  return `${fmt(startAt)} – ${fmt(endAt)}`
}
