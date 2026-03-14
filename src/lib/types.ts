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
  type: 'text' | 'textarea' | 'url' | 'select'
  required: boolean
  placeholder?: string
  options?: string[]
  filterable?: boolean
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

export type HackathonSessionInput = {
  id?: string
  name: string
  type: SessionType
  region?: string | null
  status?: SessionStatus
  startAt: string
  endAt: string
}

export type HackathonUpsertInput = Partial<Omit<Hackathon, 'submissionSchema' | 'sessions' | 'scoringCriteria'>> & {
  submissionSchema?: { fields: SubmissionField[] }
  scoringCriteria?: ScoringCriterion[]
  sessions?: HackathonSessionInput[]
}

export type Session = {
  id: string
  hackathonId: string
  name: string
  type: SessionType
  region?: string | null
  status: SessionStatus
  startAt: string
  endAt: string
}

export type SiteSettings = {
  id?: string
  key?: string
  siteName: string
  logoUrl?: string | null
  tabTitle: string
  seoTitle: string
  seoDescription: string
  faviconUrl: string
  showPoweredBy: boolean
  poweredByText: string
  poweredByUrl: string
}

export type HackathonMarkdownDoc = {
  fileName: string
  content: string
  updatedAt: string
}

export type Project = {
  id: string
  hackathonId: string
  sessionId?: string | null
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
  submissionData?: Record<string, unknown>
  projectRounds?: ProjectRound[]
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

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed'

export type Assignment = {
  id: string
  sessionId: string
  projectId: string
  projectRoundId?: string | null
  judgeId: string
  status: AssignmentStatus
  isLocked?: boolean
  scores?: AssignmentScore[] | Record<string, number>
  comment?: string
  totalScore?: number
  // API response includes related objects
  session?: Session
  project?: Project
  judge?: User
  projectRound?: ProjectRound
}

export type PromotionStatus = 'pending' | 'advanced' | 'eliminated'

export type ProjectRound = {
  id: string
  projectId: string
  sessionId: string
  sourceRoundId?: string | null
  promotionStatus: PromotionStatus
  nextSessionId?: string | null
  decisionNote?: string | null
  decidedById?: string | null
  decidedAt?: string | null
  averageScore?: number
  totalAssignments?: number
  completedAssignments?: number
  pendingAssignments?: number
  inProgressAssignments?: number
  session?: Session
  nextSession?: Session | null
  project?: Project
  assignments?: Assignment[]
}

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

export function formatCalendarDate(value: string) {
  if (!value) return ''

  const isoMatch = value.match(ISO_DATE_PREFIX)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${year}/${month}/${day}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

export function formatDateRange(startAt: string, endAt: string) {
  return `${formatCalendarDate(startAt)} – ${formatCalendarDate(endAt)}`
}
