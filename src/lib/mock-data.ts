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
    name: 'Sarah Admin',
    role: 'admin',
  },
  {
    id: 'usr-judge-alice',
    email: 'alice@techgiants.com',
    name: 'Alice Chen',
    role: 'judge',
  },
  {
    id: 'usr-judge-bob',
    email: 'bob@venturecap.com',
    name: 'Bob Li',
    role: 'judge',
  },
  {
    id: 'usr-judge-charlie',
    email: 'charlie@designstudio.io',
    name: 'Charlie Kim',
    role: 'judge',
  },
  {
    id: 'usr-hacker-dave',
    email: 'dave@indiehacker.com',
    name: 'Dave Builder',
    role: 'user',
  },
  {
    id: 'usr-hacker-eve',
    email: 'eve@student.edu',
    name: 'Eve Coder',
    role: 'user',
  },
  {
    id: 'usr-hacker-frank',
    email: 'frank@startup.io',
    name: 'Frank Founder',
    role: 'user',
  },
]

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
  submissionSchema?: SubmissionField[]
  rulesUrl?: string
  detailsUrl?: string
  gitbookUrl?: string
  prizePool?: string
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
  description?: string
  tags: string[]
  demoUrl?: string
  repoUrl?: string
  score: number
  status: 'draft' | 'submitted'
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
    id: 'hk-global-ai-2026',
    title: 'Global AI Challenge 2026',
    tagline: 'Redefining the future with Generative AI.',
    city: 'San Francisco',
    startAt: '2026-03-15',
    endAt: '2026-03-17',
    status: 'active',
    coverGradient: 'from-violet-600/20 via-fuchsia-500/10 to-indigo-600/20',
    rulesUrl: 'https://github.com/example/rules',
    detailsUrl: 'https://github.com/example/details',
    gitbookUrl: 'https://yamfarm.gitbook.io/hashkeyns-user-guide/',
    prizePool: '$50,000+',
    submissionSchema: [
      { id: 'title', label: 'Project Name', type: 'text', required: true, placeholder: 'e.g. MindMeld' },
      { id: 'oneLiner', label: 'One Liner', type: 'text', required: true, placeholder: 'Describe your project in one sentence' },
      { id: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Detailed description...' },
      { id: 'model_used', label: 'AI Model Used', type: 'text', required: true, placeholder: 'e.g. GPT-4, Llama 3' },
      { id: 'repoUrl', label: 'Repository URL', type: 'url', required: true, placeholder: 'https://github.com/...' },
    ]
  },
  {
    id: 'hk-fintech-asia',
    title: 'FinTech Asia Summit',
    tagline: 'Innovating financial services for the next billion users.',
    city: 'Singapore',
    startAt: '2026-04-10',
    endAt: '2026-04-12',
    status: 'upcoming',
    coverGradient: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20',
  },
  {
    id: 'hk-green-earth',
    title: 'Green Earth Hackathon',
    tagline: 'Sustainable solutions for a better planet.',
    city: 'Berlin',
    startAt: '2026-05-20',
    endAt: '2026-05-22',
    status: 'draft',
    coverGradient: 'from-green-500/20 via-lime-500/10 to-emerald-600/20',
  },
  {
    id: 'hk-web3-world',
    title: 'Web3 World Championship',
    tagline: 'Decentralize everything.',
    city: 'Dubai',
    startAt: '2026-01-10',
    endAt: '2026-01-12',
    status: 'completed',
    coverGradient: 'from-orange-500/20 via-amber-500/10 to-yellow-500/20',
  },
  {
    id: 'hk-edtech-remote',
    title: 'EdTech Remote Jam',
    tagline: 'Building the classroom of tomorrow, today.',
    city: 'Remote',
    startAt: '2026-03-01',
    endAt: '2026-03-03',
    status: 'judging',
    coverGradient: 'from-blue-500/20 via-sky-500/10 to-indigo-500/20',
  }
]

export const sessions: Session[] = [
  {
    id: 'ss-ai-prelim',
    hackathonId: 'hk-global-ai-2026',
    name: 'Preliminary Round',
    type: 'preliminary',
    status: 'active',
    startAt: '2026-03-15',
    endAt: '2026-03-16',
  },
  {
    id: 'ss-edtech-final',
    hackathonId: 'hk-edtech-remote',
    name: 'Final Demo Day',
    type: 'final',
    status: 'judging',
    startAt: '2026-03-03',
    endAt: '2026-03-03',
  },
]

export const projects: Project[] = [
  // Global AI Challenge Projects
  {
    id: 'pj-smart-doc',
    hackathonId: 'hk-global-ai-2026',
    sessionId: 'ss-ai-prelim',
    title: 'SmartDoc Assistant',
    oneLiner: 'AI-powered medical documentation for busy doctors.',
    description: 'SmartDoc listens to patient consultations and automatically generates structured medical notes, prescriptions, and follow-up recommendations. It integrates with existing EHR systems and ensures HIPAA compliance.',
    tags: ['Healthcare', 'AI', 'Productivity'],
    repoUrl: 'https://github.com/example/smart-doc',

    score: 8.9,
    status: 'submitted'
  },
  {
    id: 'pj-code-genie',
    hackathonId: 'hk-global-ai-2026',
    sessionId: 'ss-ai-prelim',
    title: 'CodeGenie',
    oneLiner: 'Turn Figma designs into production-ready React code instantly.',
    description: 'CodeGenie analyzes Figma nodes and generates clean, accessible React components using Tailwind CSS. It understands design tokens and auto-generates responsive layouts.',
    tags: ['DevTools', 'AI', 'Design'],
    repoUrl: 'https://github.com/example/code-genie',

    score: 9.2,
    status: 'submitted'
  },
  {
    id: 'pj-legal-eagle',
    hackathonId: 'hk-global-ai-2026',
    sessionId: 'ss-ai-prelim',
    title: 'LegalEagle',
    oneLiner: 'Automated contract review and risk analysis.',
    tags: ['Legal', 'AI', 'SaaS'],

    score: 7.5,
    status: 'submitted'
  },
  {
    id: 'pj-voice-clone',
    hackathonId: 'hk-global-ai-2026',
    sessionId: 'ss-ai-prelim',
    title: 'VoiceClone',
    oneLiner: 'Real-time voice changing for content creators.',
    tags: ['Audio', 'AI', 'Creator'],

    score: 8.1,
    status: 'submitted'
  },
  // EdTech Projects (Judging)
  {
    id: 'pj-class-vr',
    hackathonId: 'hk-edtech-remote',
    sessionId: 'ss-edtech-final',
    title: 'ClassroomVR',
    oneLiner: 'Immersive history lessons in Virtual Reality.',
    description: 'Students can walk through ancient Rome or visit the moon landing. ClassroomVR brings textbooks to life with interactive 3D experiences.',
    tags: ['VR', 'Education', 'History'],

    score: 9.5,
    status: 'submitted'
  },
  {
    id: 'pj-math-buddy',
    hackathonId: 'hk-edtech-remote',
    sessionId: 'ss-edtech-final',
    title: 'MathBuddy',
    oneLiner: 'Personalized math tutoring with adaptive learning paths.',
    tags: ['Education', 'AI', 'Math'],

    score: 8.8,
    status: 'submitted'
  },
  // User Drafts (Mocking for Hacker Dashboard)
  {
    id: 'pj-draft-1',
    hackathonId: 'hk-fintech-asia',
    sessionId: '',
    title: 'CryptoWallet X',
    oneLiner: 'Next gen wallet for SEA market.',
    tags: ['FinTech', 'Crypto'],

    score: 0,
    status: 'draft'
  }
]

export const judges: Judge[] = [
  {
    id: 'jd-alice',
    name: 'Alice Chen',
    title: 'VP of Product @ TechCorp',
    expertise: ['Product', 'UX', 'Growth'],
  },
  {
    id: 'jd-bob',
    name: 'Bob Li',
    title: 'CTO @ StartupInc',
    expertise: ['Engineering', 'Scalability', 'Cloud'],
  },
  {
    id: 'jd-charlie',
    name: 'Charlie Kim',
    title: 'Design Partner @ VC',
    expertise: ['Design', 'Brand', 'Mobile'],
  },
  {
    id: 'jd-ai-tech',
    name: 'AI Judge · Tech',
    title: 'Automated Code Analysis',
    expertise: ['Code Quality', 'Security', 'Performance'],
    isAi: true,
  },
]

export const assignments: Assignment[] = [
  // Active Assignments for Alice (Judge Dashboard)
  {
    id: 'as-1',
    sessionId: 'ss-edtech-final',
    projectId: 'pj-class-vr',
    judgeId: 'jd-alice',
    status: 'pending',
  },
  {
    id: 'as-2',
    sessionId: 'ss-edtech-final',
    projectId: 'pj-math-buddy',
    judgeId: 'jd-alice',
    status: 'in_progress',
  },
  {
    id: 'as-3',
    sessionId: 'ss-ai-prelim',
    projectId: 'pj-smart-doc',
    judgeId: 'jd-alice',
    status: 'completed',
  },
  // Assignments for Bob
  {
    id: 'as-4',
    sessionId: 'ss-ai-prelim',
    projectId: 'pj-code-genie',
    judgeId: 'jd-bob',
    status: 'pending',
  },
  {
    id: 'as-5',
    sessionId: 'ss-ai-prelim',
    projectId: 'pj-legal-eagle',
    judgeId: 'jd-bob',
    status: 'completed',
  },
]

export function formatDateRange(startAt: string, endAt: string) {
  return `${startAt} – ${endAt}`
}
