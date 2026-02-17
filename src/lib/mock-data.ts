export type HackathonStatus = 'draft' | 'upcoming' | 'active' | 'judging' | 'completed'
export type SessionType = 'preliminary' | 'semi_final' | 'final'
export type SessionStatus = 'draft' | 'active' | 'judging' | 'completed'
export type UserRole = 'admin' | 'judge' | 'user'

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
}

export const users: User[] = [
  {
    id: 'usr-admin',
    email: 'admin@openhackathon.com',
    name: 'Admin User',
    role: 'admin',
  },
  {
    id: 'usr-judge',
    email: 'judge@openhackathon.com',
    name: 'Alice Judge',
    role: 'judge',
  },
  {
    id: 'usr-hacker',
    email: 'hacker@openhackathon.com',
    name: 'Hacker Bob',
    role: 'user',
  },
]

export type Hackathon = {
  id: string
  title: string
  tagline: string
  city?: string
  startAt: string
  endAt: string
  status: HackathonStatus
  coverGradient: string
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
  title: string
  oneLiner: string
  tags: string[]
  demoUrl?: string
  repoUrl?: string
  votes: number
  score: number
}

export type Judge = {
  id: string
  name: string
  title: string
  expertise: string[]
  isAi?: boolean
}

export type Assignment = {
  id: string
  sessionId: string
  projectId: string
  judgeId: string
  status: 'pending' | 'in_progress' | 'completed'
}

export const hackathons: Hackathon[] = [
  {
    id: 'hk-apple-ai-2026',
    title: 'Apple-Style AI Hackathon',
    tagline: 'Build human-first AI products in 48 hours.',
    city: 'Shanghai',
    startAt: '2026-03-15',
    endAt: '2026-03-17',
    status: 'active',
    coverGradient: 'from-sky-500/20 via-indigo-500/10 to-fuchsia-500/20',
  },
  {
    id: 'hk-open-source-2026',
    title: 'Open Source Sprint',
    tagline: 'Ship meaningful OSS with mentors and judges.',
    city: 'Beijing',
    startAt: '2026-04-09',
    endAt: '2026-04-12',
    status: 'upcoming',
    coverGradient: 'from-emerald-500/15 via-cyan-500/10 to-sky-500/15',
  },
]

export const sessions: Session[] = [
  {
    id: 'ss-pre-apple-ai',
    hackathonId: 'hk-apple-ai-2026',
    name: 'Preliminary',
    type: 'preliminary',
    status: 'active',
    startAt: '2026-03-15',
    endAt: '2026-03-16',
  },
  {
    id: 'ss-final-apple-ai',
    hackathonId: 'hk-apple-ai-2026',
    name: 'Final',
    type: 'final',
    status: 'draft',
    startAt: '2026-03-16',
    endAt: '2026-03-17',
  },
  {
    id: 'ss-pre-oss',
    hackathonId: 'hk-open-source-2026',
    name: 'Preliminary',
    type: 'preliminary',
    status: 'draft',
    startAt: '2026-04-09',
    endAt: '2026-04-10',
  },
]

export const projects: Project[] = [
  {
    id: 'pj-vision-notes',
    hackathonId: 'hk-apple-ai-2026',
    sessionId: 'ss-pre-apple-ai',
    title: 'Vision Notes',
    oneLiner: 'Turn screenshots into structured meeting notes with citations.',
    tags: ['AI', 'Product', 'UX'],
    demoUrl: 'https://example.com/demo',
    repoUrl: 'https://github.com/example/vision-notes',
    votes: 328,
    score: 8.7,
  },
  {
    id: 'pj-judge-os',
    hackathonId: 'hk-apple-ai-2026',
    sessionId: 'ss-pre-apple-ai',
    title: 'JudgeOS',
    oneLiner: 'Confidential, role-based judging workspace with AI pre-scores.',
    tags: ['Security', 'AI', 'Infra'],
    repoUrl: 'https://github.com/example/judge-os',
    votes: 214,
    score: 8.2,
  },
  {
    id: 'pj-glass-submit',
    hackathonId: 'hk-apple-ai-2026',
    sessionId: 'ss-pre-apple-ai',
    title: 'GlassSubmit',
    oneLiner: 'A submission flow that feels instant: autosave, previews, and sanity checks.',
    tags: ['UX', 'Forms', 'Performance'],
    repoUrl: 'https://github.com/example/glass-submit',
    votes: 156,
    score: 7.9,
  },
  {
    id: 'pj-vote-guard',
    hackathonId: 'hk-apple-ai-2026',
    sessionId: 'ss-pre-apple-ai',
    title: 'VoteGuard',
    oneLiner: 'Public voting with abuse signals, rate limits, and audit trails.',
    tags: ['Voting', 'Security', 'Analytics'],
    repoUrl: 'https://github.com/example/vote-guard',
    votes: 512,
    score: 8.1,
  },
  {
    id: 'pj-mentor-loop',
    hackathonId: 'hk-apple-ai-2026',
    sessionId: 'ss-pre-apple-ai',
    title: 'MentorLoop',
    oneLiner: 'Office-hours scheduling with lightweight matchmaking and reminders.',
    tags: ['Community', 'Scheduling'],
    votes: 98,
    score: 7.4,
  },
  {
    id: 'pj-teamflow',
    hackathonId: 'hk-open-source-2026',
    sessionId: 'ss-pre-oss',
    title: 'TeamFlow',
    oneLiner: 'Match teammates by skills, timezones, and goals.',
    tags: ['Matching', 'Community'],
    votes: 0,
    score: 0,
  },
  {
    id: 'pj-oss-scorecard',
    hackathonId: 'hk-open-source-2026',
    sessionId: 'ss-pre-oss',
    title: 'OSS Scorecard',
    oneLiner: 'Automatic repo hygiene checks for maintainability and security.',
    tags: ['OSS', 'Quality', 'Security'],
    votes: 0,
    score: 0,
  },
]

export const judges: Judge[] = [
  {
    id: 'jd-alice',
    name: 'Alice Chen',
    title: 'Product Lead',
    expertise: ['Product', 'Storytelling', 'UX'],
  },
  {
    id: 'jd-bob',
    name: 'Bob Li',
    title: 'Staff Engineer',
    expertise: ['Architecture', 'Security', 'Scalability'],
  },
  {
    id: 'jd-ai-tech',
    name: 'AI Judge · Tech',
    title: 'OpenAI-compatible',
    expertise: ['Code Review', 'Tech Depth', 'Reliability'],
    isAi: true,
  },
]

export const assignments: Assignment[] = [
  {
    id: 'as-1',
    sessionId: 'ss-pre-apple-ai',
    projectId: 'pj-vision-notes',
    judgeId: 'jd-alice',
    status: 'in_progress',
  },
  {
    id: 'as-2',
    sessionId: 'ss-pre-apple-ai',
    projectId: 'pj-vision-notes',
    judgeId: 'jd-ai-tech',
    status: 'completed',
  },
  {
    id: 'as-3',
    sessionId: 'ss-pre-apple-ai',
    projectId: 'pj-judge-os',
    judgeId: 'jd-bob',
    status: 'pending',
  },
  {
    id: 'as-4',
    sessionId: 'ss-pre-apple-ai',
    projectId: 'pj-vote-guard',
    judgeId: 'jd-bob',
    status: 'in_progress',
  },
  {
    id: 'as-5',
    sessionId: 'ss-pre-apple-ai',
    projectId: 'pj-glass-submit',
    judgeId: 'jd-alice',
    status: 'pending',
  },
  {
    id: 'as-6',
    sessionId: 'ss-pre-apple-ai',
    projectId: 'pj-mentor-loop',
    judgeId: 'jd-ai-tech',
    status: 'completed',
  },
]

export function formatDateRange(startAt: string, endAt: string) {
  return `${startAt} – ${endAt}`
}
