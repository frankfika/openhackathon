import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { DEV_USERS, DEV_USER_PASSWORD } from './dev-users'

const prisma = new PrismaClient()
const hashedPassword = bcrypt.hashSync(DEV_USER_PASSWORD, 10)

const HACKATHON_ID = 'hk-openhack-2026'

type AssignmentSeed = {
  id: string
  projectId: string
  judgeId: string
  status: 'pending' | 'in_progress' | 'completed'
  totalScore?: number
  comment?: string
  scores?: Record<string, number>
}

async function createAssignment(seed: AssignmentSeed) {
  const assignment = await prisma.assignment.create({
    data: {
      id: seed.id,
      projectId: seed.projectId,
      judgeId: seed.judgeId,
      status: seed.status,
      totalScore: seed.totalScore,
      comment: seed.comment,
    },
  })

  if (seed.scores && Object.keys(seed.scores).length > 0) {
    await prisma.score.createMany({
      data: Object.entries(seed.scores).map(([criterionId, score]) => ({
        assignmentId: assignment.id,
        criterionId,
        score,
      })),
    })
  }
}

async function main() {
  console.log('Start single-hackathon seeding...')

  await prisma.score.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.hackathonJudge.deleteMany()
  await prisma.project.deleteMany()
  await prisma.scoringCriterion.deleteMany()
  await prisma.hackathon.deleteMany()
  await prisma.siteSetting.deleteMany()
  await prisma.user.deleteMany()

  const users = await Promise.all(
    DEV_USERS.map((user) =>
      prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          password: hashedPassword,
        },
      }),
    ),
  )
  console.log(`Created ${users.length} users`)

  const hackathon = await prisma.hackathon.create({
    data: {
      id: HACKATHON_ID,
      title: 'OpenHackathon 2026',
      tagline: 'Build practical AI products in 48 hours.',
      city: 'San Francisco',
      startAt: new Date('2026-03-15'),
      endAt: new Date('2026-03-17'),
      status: 'active',
      coverGradient: 'from-cyan-600/20 via-blue-500/10 to-emerald-600/20',
      rulesUrl: 'https://github.com/example/rules',
      detailsUrl: 'https://github.com/example/details',
      prizePool: '$50,000+',
      submissionSchema: {
        fields: [
          { id: 'title', label: 'Project Name', type: 'text', required: true, placeholder: 'e.g. Nova Copilot' },
          { id: 'oneLiner', label: 'One Liner', type: 'text', required: true, placeholder: 'What does your project do?' },
          { id: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Problem, solution, and value' },
          { id: 'repoUrl', label: 'Repository URL', type: 'url', required: true, placeholder: 'https://github.com/...' },
        ],
      },
      scoringCriteria: {
        create: [
          { id: 'sc-innovation', name: 'Innovation', maxScore: 30, sortOrder: 1 },
          { id: 'sc-technology', name: 'Technology', maxScore: 30, sortOrder: 2 },
          { id: 'sc-design', name: 'Design & UX', maxScore: 20, sortOrder: 3 },
          { id: 'sc-completion', name: 'Completion', maxScore: 20, sortOrder: 4 },
        ],
      },
    },
    include: { scoringCriteria: true },
  })
  console.log(`Created hackathon: ${hackathon.title}`)

  const judgeUsers = users.filter((user) => user.role === 'judge')
  await prisma.hackathonJudge.createMany({
    data: judgeUsers.map((judge) => ({
      hackathonId: HACKATHON_ID,
      userId: judge.id,
    })),
    skipDuplicates: true,
  })
  console.log(`Registered ${judgeUsers.length} judges in ${hackathon.id}`)

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        id: 'pj-nova-copilot',
        hackathonId: HACKATHON_ID,
        submitterEmail: 'team-nova@example.com',
        submitterName: 'Team Nova',
        title: 'Nova Copilot',
        oneLiner: 'AI assistant for customer support operations.',
        description: 'Nova Copilot drafts replies, summarizes tickets, and recommends next best actions.',
        tags: ['AI', 'Support', 'SaaS'],
        repoUrl: 'https://github.com/example/nova-copilot',
        status: 'submitted',
      },
    }),
    prisma.project.create({
      data: {
        id: 'pj-doc-flow',
        hackathonId: HACKATHON_ID,
        submitterEmail: 'docflow@example.com',
        submitterName: 'DocFlow Team',
        title: 'DocFlow',
        oneLiner: 'Automatic document workflow extraction and routing.',
        description: 'DocFlow parses incoming files and routes them to the right reviewers automatically.',
        tags: ['Workflow', 'AI', 'Automation'],
        demoUrl: 'https://docflow.demo',
        status: 'submitted',
      },
    }),
    prisma.project.create({
      data: {
        id: 'pj-code-lens',
        hackathonId: HACKATHON_ID,
        submitterEmail: 'codelens@example.com',
        submitterName: 'CodeLens Labs',
        title: 'CodeLens',
        oneLiner: 'Repository-level risk and quality analyzer.',
        description: 'CodeLens scores codebases for maintainability, security, and architecture drift.',
        tags: ['DevTools', 'Security', 'AI'],
        repoUrl: 'https://github.com/example/code-lens',
        status: 'submitted',
      },
    }),
    prisma.project.create({
      data: {
        id: 'pj-voice-ops',
        hackathonId: HACKATHON_ID,
        submitterEmail: 'voiceops@example.com',
        submitterName: 'VoiceOps',
        title: 'VoiceOps',
        oneLiner: 'Voice-driven operations dashboard for teams.',
        description: 'VoiceOps turns spoken commands into actionable operations and records audit logs.',
        tags: ['Voice', 'Ops', 'Automation'],
        status: 'submitted',
      },
    }),
    prisma.project.create({
      data: {
        id: 'pj-lab-notes',
        hackathonId: HACKATHON_ID,
        submitterEmail: 'labnotes@example.com',
        submitterName: 'LabNotes Team',
        title: 'LabNotes AI',
        oneLiner: 'Research note summarization with citation traces.',
        description: 'LabNotes AI creates concise summaries while preserving citation references.',
        tags: ['Research', 'NLP', 'Productivity'],
        status: 'submitted',
      },
    }),
  ])
  console.log(`Created ${projects.length} projects`)

  const assignments: AssignmentSeed[] = [
    {
      id: 'as-1',
      projectId: 'pj-nova-copilot',
      judgeId: 'usr-judge-alice',
      status: 'completed',
      totalScore: 91,
      comment: 'Strong product-market fit and polished UX.',
      scores: { 'sc-innovation': 28, 'sc-technology': 29, 'sc-design': 18, 'sc-completion': 16 },
    },
    {
      id: 'as-2',
      projectId: 'pj-doc-flow',
      judgeId: 'usr-judge-bob',
      status: 'completed',
      totalScore: 87,
      comment: 'Great ops impact, needs stronger edge-case handling.',
      scores: { 'sc-innovation': 26, 'sc-technology': 27, 'sc-design': 16, 'sc-completion': 18 },
    },
    {
      id: 'as-3',
      projectId: 'pj-code-lens',
      judgeId: 'usr-judge-charlie',
      status: 'in_progress',
    },
    {
      id: 'as-4',
      projectId: 'pj-voice-ops',
      judgeId: 'usr-judge-diana',
      status: 'pending',
    },
    {
      id: 'as-5',
      projectId: 'pj-lab-notes',
      judgeId: 'usr-judge-evan',
      status: 'pending',
    },
  ]
  await Promise.all(assignments.map((seed) => createAssignment(seed)))
  console.log(`Created ${assignments.length} assignments`)

  console.log('Single-hackathon seed completed.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
