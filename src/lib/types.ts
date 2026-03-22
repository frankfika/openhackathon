export type HackathonStatus = 'draft' | 'upcoming' | 'active' | 'judging' | 'completed'
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

export type SubmissionSchemaConfig = {
  fields?: SubmissionField[]
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
  submissionSchema?: SubmissionField[] | SubmissionSchemaConfig
  scoringCriteria?: ScoringCriterion[]
  docsUrl?: string
  prizePool?: string
  judgesPerProject?: number
}

export type HackathonUpsertInput = Partial<Omit<Hackathon, 'submissionSchema' | 'scoringCriteria'>> & {
  submissionSchema?: SubmissionSchemaConfig
  scoringCriteria?: ScoringCriterion[]
}

export type SiteSettings = {
  id?: string
  key?: string
  siteName: string
  adminBasePath: string
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

export type AdminUser = {
  id: string
  email: string
  name: string
  role: 'admin' | 'judge'
  avatarUrl?: string
  createdAt?: string
}

export type Project = {
  id: string
  hackathonId: string
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
  projectId: string
  judgeId: string
  status: AssignmentStatus
  scores?: AssignmentScore[] | Record<string, number>
  comment?: string
  totalScore?: number
  // API response includes related objects
  project?: Project
  judge?: User
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

export type ActivityAction =
  | 'create' | 'update' | 'delete'
  | 'submit' | 'assign' | 'unassign'
  | 'score' | 'update_score' | 'complete_review'
  | 'login' | 'logout' | 'invite'

export type ActivityEntityType =
  | 'project' | 'assignment' | 'score' | 'hackathon'
  | 'judge' | 'user' | 'session' | 'setting'

export type ActivityLog = {
  id: string
  hackathonId?: string
  actorId?: string
  actorRole: 'admin' | 'judge' | 'user' | 'system'
  actorName: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  createdAt: string
}

export type ActivityStats = {
  totalActions: number
  recentActions: number
  byRole: Record<string, number>
  byEntity: Record<string, number>
}
