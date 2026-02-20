import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const hashedPassword = bcrypt.hashSync('password', 10)

async function main() {
  console.log('Start seeding...')

  // Clean existing data
  await prisma.score.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.project.deleteMany()
  await prisma.session.deleteMany()
  await prisma.scoringCriterion.deleteMany()
  await prisma.hackathon.deleteMany()
  await prisma.user.deleteMany()

  console.log('Cleaned existing data')

  // ========== Create Users ==========
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: 'usr-admin',
        email: 'admin@openhackathon.com',
        name: 'Sarah Admin',
        role: 'admin',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'usr-judge-alice',
        email: 'alice@techgiants.com',
        name: 'Alice Chen',
        role: 'judge',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'usr-judge-bob',
        email: 'bob@venturecap.com',
        name: 'Bob Li',
        role: 'judge',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'usr-judge-charlie',
        email: 'charlie@designstudio.io',
        name: 'Charlie Kim',
        role: 'judge',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'usr-judge-diana',
        email: 'diana@aifund.com',
        name: 'Diana Wang',
        role: 'judge',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'usr-judge-evan',
        email: 'evan@dev.tools',
        name: 'Evan Zhang',
        role: 'judge',
        password: hashedPassword,
      },
    }),
  ])
  console.log(`Created ${users.length} users`)

  // ========== Create Hackathons ==========
  const hackathons = await Promise.all([
    // Global AI Challenge
    prisma.hackathon.create({
      data: {
        id: 'hk-global-ai-2026',
        title: 'Global AI Challenge 2026',
        tagline: 'Redefining the future with Generative AI.',
        city: 'San Francisco',
        startAt: new Date('2026-03-15'),
        endAt: new Date('2026-03-17'),
        status: 'active',
        coverGradient: 'from-violet-600/20 via-fuchsia-500/10 to-indigo-600/20',
        rulesUrl: 'https://github.com/example/rules',
        detailsUrl: 'https://github.com/example/details',
        gitbookUrl: 'https://yamfarm.gitbook.io/hashkeyns-user-guide/',
        prizePool: '$50,000+',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true, placeholder: 'e.g. MindMeld' },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true, placeholder: 'Describe your project in one sentence' },
            { id: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Detailed description...' },
            { id: 'model_used', label: 'AI Model Used', type: 'text', required: true, placeholder: 'e.g. GPT-4, Llama 3' },
            { id: 'repoUrl', label: 'Repository URL', type: 'url', required: true, placeholder: 'https://github.com/...' },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-ai-innovation', name: 'Innovation', maxScore: 30, sortOrder: 1 },
            { id: 'sc-ai-technology', name: 'Technology', maxScore: 30, sortOrder: 2 },
            { id: 'sc-ai-design', name: 'Design & UX', maxScore: 20, sortOrder: 3 },
            { id: 'sc-ai-completion', name: 'Completion', maxScore: 20, sortOrder: 4 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-ai-prelim', name: 'Preliminary Round', type: 'preliminary', status: 'active', startAt: new Date('2026-03-15'), endAt: new Date('2026-03-16') },
            { id: 'ss-ai-final', name: 'Final Round', type: 'final', status: 'draft', startAt: new Date('2026-03-17'), endAt: new Date('2026-03-17') },
          ],
        },
      },
    }),
    // FinTech Asia
    prisma.hackathon.create({
      data: {
        id: 'hk-fintech-asia',
        title: 'FinTech Asia Summit',
        tagline: 'Innovating financial services for the next billion users.',
        city: 'Singapore',
        startAt: new Date('2026-04-10'),
        endAt: new Date('2026-04-12'),
        status: 'upcoming',
        coverGradient: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/20',
        prizePool: '$100,000',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea', required: true },
            { id: 'compliance', label: 'Regulatory Compliance Note', type: 'textarea', required: true },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-ft-innovation', name: 'Innovation', maxScore: 25, sortOrder: 1 },
            { id: 'sc-ft-technology', name: 'Technology', maxScore: 25, sortOrder: 2 },
            { id: 'sc-ft-business', name: 'Business Model', maxScore: 25, sortOrder: 3 },
            { id: 'sc-ft-compliance', name: 'Compliance', maxScore: 25, sortOrder: 4 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-fintech-idea', name: 'Ideation Phase', type: 'preliminary', status: 'draft', startAt: new Date('2026-04-10'), endAt: new Date('2026-04-11') },
            { id: 'ss-fintech-final', name: 'Final Pitch', type: 'final', status: 'draft', startAt: new Date('2026-04-12'), endAt: new Date('2026-04-12') },
          ],
        },
      },
    }),
    // Green Earth
    prisma.hackathon.create({
      data: {
        id: 'hk-green-earth',
        title: 'Green Earth Hackathon',
        tagline: 'Sustainable solutions for a better planet.',
        city: 'Berlin',
        startAt: new Date('2026-05-20'),
        endAt: new Date('2026-05-22'),
        status: 'draft',
        coverGradient: 'from-green-500/20 via-lime-500/10 to-emerald-600/20',
        prizePool: '$30,000',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea', required: true },
            { id: 'impact', label: 'Environmental Impact', type: 'textarea', required: true },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-ge-innovation', name: 'Innovation', maxScore: 30, sortOrder: 1 },
            { id: 'sc-ge-impact', name: 'Environmental Impact', maxScore: 40, sortOrder: 2 },
            { id: 'sc-ge-feasibility', name: 'Feasibility', maxScore: 30, sortOrder: 3 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-green-idea', name: 'Ideation', type: 'preliminary', status: 'draft', startAt: new Date('2026-05-20'), endAt: new Date('2026-05-21') },
          ],
        },
      },
    }),
    // Web3 World
    prisma.hackathon.create({
      data: {
        id: 'hk-web3-world',
        title: 'Web3 World Championship',
        tagline: 'Decentralize everything.',
        city: 'Dubai',
        startAt: new Date('2026-01-10'),
        endAt: new Date('2026-01-12'),
        status: 'completed',
        coverGradient: 'from-orange-500/20 via-amber-500/10 to-yellow-500/20',
        prizePool: '$200,000',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea', required: true },
            { id: 'contract', label: 'Smart Contract Address', type: 'text', required: false },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-w3-innovation', name: 'Innovation', maxScore: 30, sortOrder: 1 },
            { id: 'sc-w3-technology', name: 'Technology', maxScore: 30, sortOrder: 2 },
            { id: 'sc-w3-security', name: 'Security', maxScore: 20, sortOrder: 3 },
            { id: 'sc-w3-ux', name: 'User Experience', maxScore: 20, sortOrder: 4 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-web3-hack', name: 'Hackathon Phase', type: 'preliminary', status: 'completed', startAt: new Date('2026-01-10'), endAt: new Date('2026-01-11') },
            { id: 'ss-web3-demo', name: 'Demo Day', type: 'final', status: 'completed', startAt: new Date('2026-01-12'), endAt: new Date('2026-01-12') },
          ],
        },
      },
    }),
    // EdTech Remote
    prisma.hackathon.create({
      data: {
        id: 'hk-edtech-remote',
        title: 'EdTech Remote Jam',
        tagline: 'Building the classroom of tomorrow, today.',
        city: 'Remote',
        startAt: new Date('2026-03-01'),
        endAt: new Date('2026-03-03'),
        status: 'judging',
        coverGradient: 'from-blue-500/20 via-sky-500/10 to-indigo-500/20',
        prizePool: '$25,000',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea', required: true },
            { id: 'target_audience', label: 'Target Audience', type: 'text', required: true },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-ed-innovation', name: 'Innovation', maxScore: 25, sortOrder: 1 },
            { id: 'sc-ed-education', name: 'Educational Value', maxScore: 35, sortOrder: 2 },
            { id: 'sc-ed-ux', name: 'User Experience', maxScore: 25, sortOrder: 3 },
            { id: 'sc-ed-accessibility', name: 'Accessibility', maxScore: 15, sortOrder: 4 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-edtech-final', name: 'Final Demo Day', type: 'final', status: 'judging', startAt: new Date('2026-03-03'), endAt: new Date('2026-03-03') },
          ],
        },
      },
    }),
    // Health Innovation
    prisma.hackathon.create({
      data: {
        id: 'hk-health-innovation',
        title: 'Health Innovation Summit',
        tagline: 'Transforming healthcare through technology.',
        city: 'Boston',
        startAt: new Date('2026-06-15'),
        endAt: new Date('2026-06-17'),
        status: 'upcoming',
        coverGradient: 'from-rose-500/20 via-pink-500/10 to-red-500/20',
        prizePool: '$75,000',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea', required: true },
            { id: 'fda_status', label: 'FDA Approval Status (if applicable)', type: 'text', required: false },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-hi-innovation', name: 'Innovation', maxScore: 25, sortOrder: 1 },
            { id: 'sc-hi-medical', name: 'Medical Impact', maxScore: 35, sortOrder: 2 },
            { id: 'sc-hi-technology', name: 'Technology', maxScore: 20, sortOrder: 3 },
            { id: 'sc-hi-safety', name: 'Safety & Compliance', maxScore: 20, sortOrder: 4 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-health-prelim', name: 'Preliminary Round', type: 'preliminary', status: 'draft', startAt: new Date('2026-06-15'), endAt: new Date('2026-06-16') },
            { id: 'ss-health-final', name: 'Final Showcase', type: 'final', status: 'draft', startAt: new Date('2026-06-17'), endAt: new Date('2026-06-17') },
          ],
        },
      },
    }),
    // CyberSecurity
    prisma.hackathon.create({
      data: {
        id: 'hk-cybersecurity',
        title: 'CyberSec Challenge 2026',
        tagline: 'Defending the digital frontier.',
        city: 'Tel Aviv',
        startAt: new Date('2026-02-20'),
        endAt: new Date('2026-02-22'),
        status: 'judging',
        coverGradient: 'from-slate-600/20 via-gray-500/10 to-zinc-600/20',
        prizePool: '$60,000',
        submissionSchema: {
          fields: [
            { id: 'title', label: 'Project Name', type: 'text', required: true },
            { id: 'oneLiner', label: 'One Liner', type: 'text', required: true },
            { id: 'description', label: 'Description', type: 'textarea', required: true },
            { id: 'vulnerability', label: 'Vulnerability Addressed', type: 'textarea', required: true },
          ],
        },
        scoringCriteria: {
          create: [
            { id: 'sc-cs-innovation', name: 'Innovation', maxScore: 25, sortOrder: 1 },
            { id: 'sc-cs-security', name: 'Security Impact', maxScore: 40, sortOrder: 2 },
            { id: 'sc-cs-implementation', name: 'Implementation', maxScore: 35, sortOrder: 3 },
          ],
        },
        sessions: {
          create: [
            { id: 'ss-cyber-ctf', name: 'CTF Competition', type: 'preliminary', status: 'judging', startAt: new Date('2026-02-20'), endAt: new Date('2026-02-21') },
            { id: 'ss-cyber-demo', name: 'Solution Demo', type: 'final', status: 'judging', startAt: new Date('2026-02-22'), endAt: new Date('2026-02-22') },
          ],
        },
      },
    }),
  ])
  console.log(`Created ${hackathons.length} hackathons`)

  // ========== Create Projects ==========
  // Global AI Challenge Projects (12)
  const aiProjects = await Promise.all([
    prisma.project.create({
      data: { id: 'pj-smart-doc', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'dave@indiehacker.com', submitterName: 'Dave Builder', title: 'SmartDoc Assistant', oneLiner: 'AI-powered medical documentation for busy doctors.', description: 'SmartDoc listens to patient consultations and automatically generates structured medical notes, prescriptions, and follow-up recommendations. It integrates with existing EHR systems and ensures HIPAA compliance.', tags: ['Healthcare', 'AI', 'Productivity'], repoUrl: 'https://github.com/example/smart-doc', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-code-genie', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'eve@student.edu', submitterName: 'Eve Coder', title: 'CodeGenie', oneLiner: 'Turn Figma designs into production-ready React code instantly.', description: 'CodeGenie analyzes Figma nodes and generates clean, accessible React components using Tailwind CSS. It understands design tokens and auto-generates responsive layouts.', tags: ['DevTools', 'AI', 'Design'], repoUrl: 'https://github.com/example/code-genie', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-legal-eagle', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'frank@startup.io', submitterName: 'Frank Founder', title: 'LegalEagle', oneLiner: 'Automated contract review and risk analysis.', description: 'LegalEagle uses NLP to analyze contracts, identify risky clauses, and suggest modifications. It compares against standard templates and flags deviations.', tags: ['Legal', 'AI', 'SaaS'], repoUrl: 'https://github.com/example/legal-eagle', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-voice-clone', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'alex@creator.com', submitterName: 'Alex Creator', title: 'VoiceClone', oneLiner: 'Real-time voice changing for content creators.', description: 'VoiceClone uses deep learning to transform voices in real-time while preserving emotional nuances. Perfect for podcasters and streamers.', tags: ['Audio', 'AI', 'Creator'], repoUrl: 'https://github.com/example/voice-clone', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-meeting-mind', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'sam@productivity.co', submitterName: 'Sam Organizer', title: 'MeetingMind', oneLiner: 'AI meeting assistant that extracts action items automatically.', description: 'MeetingMind joins your calls, transcribes conversations, identifies action items, assigns owners, and syncs to your project management tools.', tags: ['Productivity', 'AI', 'SaaS'], repoUrl: 'https://github.com/example/meeting-mind', demoUrl: 'https://meetingmind.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-code-reviewer', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'dev@codeassist.ai', submitterName: 'DevAssist Team', title: 'CodeReviewer AI', oneLiner: 'Automated code review with security vulnerability detection.', description: 'CodeReviewer analyzes pull requests for code quality, security issues, and performance bottlenecks. It learns from your team\'s coding standards.', tags: ['DevTools', 'AI', 'Security'], repoUrl: 'https://github.com/example/code-reviewer', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-image-restorer', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'photo@restore.app', submitterName: 'PhotoMaster Inc', title: 'ImageRestorer Pro', oneLiner: 'Restore old photos with AI-powered damage repair.', description: 'ImageRestorer uses GANs to repair damaged photos, remove scratches, enhance colors, and upscale resolution while preserving original character.', tags: ['Image', 'AI', 'Creative'], demoUrl: 'https://imagerestorer.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-write-buddy', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'write@content.ai', submitterName: 'ContentFlow Team', title: 'WriteBuddy', oneLiner: 'AI writing companion with style adaptation.', description: 'WriteBuddy learns your writing style and helps you draft content faster. It maintains consistency across all your communications.', tags: ['Writing', 'AI', 'Productivity'], repoUrl: 'https://github.com/example/write-buddy', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-data-visualizer', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'data@viz.ai', submitterName: 'DataViz Labs', title: 'DataViz AI', oneLiner: 'Turn complex datasets into beautiful visualizations.', description: 'DataViz AI understands your data structure and recommends the best visualization types. It generates interactive charts with natural language queries.', tags: ['Data', 'AI', 'Visualization'], repoUrl: 'https://github.com/example/dataviz-ai', demoUrl: 'https://dataviz.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-interview-prep', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'prep@interview.ai', submitterName: 'InterviewReady', title: 'InterviewPrep AI', oneLiner: 'Personalized technical interview coaching.', description: 'InterviewPrep creates personalized study plans, conducts mock interviews, and provides detailed feedback on your coding and system design skills.', tags: ['Education', 'AI', 'Career'], repoUrl: 'https://github.com/example/interview-prep', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-music-composer', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'music@compose.ai', submitterName: 'MusicAI Studio', title: 'MusicComposer AI', oneLiner: 'Generate original music in any style.', description: 'MusicComposer creates original compositions in any genre. It understands music theory and produces professional-quality tracks for content creators.', tags: ['Music', 'AI', 'Creative'], repoUrl: 'https://github.com/example/music-composer', demoUrl: 'https://musiccomposer.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-fitness-coach', hackathonId: 'hk-global-ai-2026', sessionId: 'ss-ai-prelim', submitterEmail: 'fit@ai.coach', submitterName: 'FitAI Team', title: 'FitnessCoach AI', oneLiner: 'Personal AI trainer with computer vision form correction.', description: 'FitnessCoach uses your camera to analyze exercise form in real-time, providing corrections and personalized workout plans based on your progress.', tags: ['Fitness', 'AI', 'Health'], repoUrl: 'https://github.com/example/fitness-coach', status: 'submitted' },
    }),
  ])
  console.log(`Created ${aiProjects.length} AI Challenge projects`)

  // EdTech Projects (6)
  const edtechProjects = await Promise.all([
    prisma.project.create({
      data: { id: 'pj-class-vr', hackathonId: 'hk-edtech-remote', sessionId: 'ss-edtech-final', submitterEmail: 'vr@team.com', submitterName: 'VR Team', title: 'ClassroomVR', oneLiner: 'Immersive history lessons in Virtual Reality.', description: 'Students can walk through ancient Rome or visit the moon landing. ClassroomVR brings textbooks to life with interactive 3D experiences.', tags: ['VR', 'Education', 'History'], demoUrl: 'https://classroomvr.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-math-buddy', hackathonId: 'hk-edtech-remote', sessionId: 'ss-edtech-final', submitterEmail: 'math@buddy.ai', submitterName: 'Math Buddy Team', title: 'MathBuddy', oneLiner: 'Personalized math tutoring with adaptive learning paths.', description: 'MathBuddy identifies knowledge gaps and creates personalized learning paths. It uses game mechanics to keep students engaged.', tags: ['Education', 'AI', 'Math'], repoUrl: 'https://github.com/example/math-buddy', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-language-lab', hackathonId: 'hk-edtech-remote', sessionId: 'ss-edtech-final', submitterEmail: 'lang@lab.edu', submitterName: 'LanguageLab Inc', title: 'LanguageLab', oneLiner: 'Practice conversations with AI language partners.', description: 'LanguageLab provides realistic conversations with AI tutors in 50+ languages. It corrects pronunciation and explains grammar in context.', tags: ['Education', 'AI', 'Language'], demoUrl: 'https://languagelab.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-science-sim', hackathonId: 'hk-edtech-remote', sessionId: 'ss-edtech-final', submitterEmail: 'sci@sim.io', submitterName: 'ScienceSim Team', title: 'ScienceSimulator', oneLiner: 'Virtual science experiments without the lab setup.', description: 'ScienceSimulator lets students run chemistry, physics, and biology experiments safely. No expensive equipment needed.', tags: ['Education', 'Science', 'Simulation'], repoUrl: 'https://github.com/example/science-sim', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-study-group', hackathonId: 'hk-edtech-remote', sessionId: 'ss-edtech-final', submitterEmail: 'study@group.app', submitterName: 'StudyTogether', title: 'StudyGroup Match', oneLiner: 'AI-matched study groups based on learning styles.', description: 'StudyGroup analyzes your learning style and matches you with compatible study partners. It schedules sessions and tracks progress.', tags: ['Education', 'Social', 'Productivity'], repoUrl: 'https://github.com/example/study-group', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-code-kids', hackathonId: 'hk-edtech-remote', sessionId: 'ss-edtech-final', submitterEmail: 'kids@code.academy', submitterName: 'CodeKids Academy', title: 'CodeKids', oneLiner: 'Learn programming through interactive storytelling.', description: 'CodeKids teaches children programming concepts through engaging stories and puzzles. No prior experience needed.', tags: ['Education', 'Coding', 'Kids'], demoUrl: 'https://codekids.demo', status: 'submitted' },
    }),
  ])
  console.log(`Created ${edtechProjects.length} EdTech projects`)

  // Web3 Projects (8)
  const web3Projects = await Promise.all([
    prisma.project.create({
      data: { id: 'pj-defi-yield', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'defi@yield.io', submitterName: 'DeFi Yield Team', title: 'YieldOptimizer', oneLiner: 'Automated yield farming across multiple chains.', description: 'YieldOptimizer automatically finds and allocates funds to the highest-yielding DeFi protocols across Ethereum, Solana, and Polygon.', tags: ['DeFi', 'Web3', 'Finance'], repoUrl: 'https://github.com/example/yield-optimizer', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-nft-market', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'nft@market.io', submitterName: 'NFT Marketplace Team', title: 'NFTMarket Pro', oneLiner: 'Zero-fee NFT marketplace with creator royalties.', description: 'NFTMarket Pro eliminates trading fees while ensuring creators receive perpetual royalties. Built on Layer 2 for low gas costs.', tags: ['NFT', 'Web3', 'Marketplace'], demoUrl: 'https://nftmarket.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-dao-governance', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'dao@gov.io', submitterName: 'DAO Tools Team', title: 'DAOGovernance', oneLiner: 'Streamlined DAO proposal and voting system.', description: 'DAOGovernance makes it easy for communities to create proposals, discuss, and vote. Supports quadratic voting and delegation.', tags: ['DAO', 'Governance', 'Web3'], repoUrl: 'https://github.com/example/dao-governance', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-wallet-unified', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'wallet@unified.io', submitterName: 'Unified Wallet Team', title: 'UnifiedWallet', oneLiner: 'One wallet for all chains with social recovery.', description: 'UnifiedWallet supports 50+ chains with a single interface. Social recovery ensures you never lose access to your funds.', tags: ['Wallet', 'Web3', 'Security'], demoUrl: 'https://unifiedwallet.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-chain-analytics', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'analytics@chain.io', submitterName: 'ChainAnalytics', title: 'ChainAnalytics', oneLiner: 'On-chain data analysis and visualization platform.', description: 'ChainAnalytics provides real-time insights into blockchain activity. Track whales, detect trends, and make informed decisions.', tags: ['Analytics', 'Web3', 'Data'], repoUrl: 'https://github.com/example/chain-analytics', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-game-fi', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'game@fi.io', submitterName: 'GameFi Studios', title: 'GameFi Platform', oneLiner: 'Play-to-earn gaming ecosystem with asset interoperability.', description: 'GameFi Platform allows players to own and trade in-game assets across different games. True ownership of your gaming items.', tags: ['GameFi', 'Web3', 'Gaming'], demoUrl: 'https://gamefi.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-identity', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'id@web3.io', submitterName: 'Web3 Identity Team', title: 'Web3Identity', oneLiner: 'Decentralized identity with selective disclosure.', description: 'Web3Identity gives you control over your digital identity. Share only what\'s necessary with zero-knowledge proofs.', tags: ['Identity', 'Web3', 'Privacy'], repoUrl: 'https://github.com/example/web3-identity', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-cross-chain', hackathonId: 'hk-web3-world', sessionId: 'ss-web3-demo', submitterEmail: 'bridge@cross.io', submitterName: 'CrossChain Labs', title: 'CrossChain Bridge', oneLiner: 'Secure cross-chain asset transfers in seconds.', description: 'CrossChain Bridge enables instant, secure transfers between any blockchain. No wrapped tokens, no complex UI.', tags: ['Bridge', 'Web3', 'Infrastructure'], demoUrl: 'https://crosschain.demo', status: 'submitted' },
    }),
  ])
  console.log(`Created ${web3Projects.length} Web3 projects`)

  // CyberSec Projects (6)
  const cyberProjects = await Promise.all([
    prisma.project.create({
      data: { id: 'pj-threat-detector', hackathonId: 'hk-cybersecurity', sessionId: 'ss-cyber-demo', submitterEmail: 'threat@detect.io', submitterName: 'ThreatDetect Inc', title: 'ThreatDetector AI', oneLiner: 'AI-powered network threat detection and response.', description: 'ThreatDetector uses machine learning to identify anomalous network behavior and automatically responds to threats in real-time.', tags: ['Security', 'AI', 'Network'], repoUrl: 'https://github.com/example/threat-detector', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-vuln-scanner', hackathonId: 'hk-cybersecurity', sessionId: 'ss-cyber-demo', submitterEmail: 'scan@vuln.io', submitterName: 'VulnScanner Team', title: 'VulnScanner Pro', oneLiner: 'Comprehensive security scanner for web applications.', description: 'VulnScanner identifies OWASP Top 10 vulnerabilities, misconfigurations, and dependency issues in your web applications.', tags: ['Security', 'Scanner', 'Web'], demoUrl: 'https://vulnscanner.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-passwordless', hackathonId: 'hk-cybersecurity', sessionId: 'ss-cyber-demo', submitterEmail: 'auth@passless.io', submitterName: 'Passwordless Auth', title: 'PasswordlessAuth', oneLiner: 'Biometric-based authentication for web apps.', description: 'PasswordlessAuth replaces passwords with secure biometric authentication. No more password resets or credential stuffing.', tags: ['Security', 'Authentication', 'Biometrics'], repoUrl: 'https://github.com/example/passwordless-auth', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-forensics', hackathonId: 'hk-cybersecurity', sessionId: 'ss-cyber-demo', submitterEmail: 'forensics@digital.io', submitterName: 'Digital Forensics Lab', title: 'DigitalForensics', oneLiner: 'Automated digital forensics investigation platform.', description: 'DigitalForensics automates the collection and analysis of digital evidence. Supports disk imaging, log analysis, and timeline reconstruction.', tags: ['Security', 'Forensics', 'Investigation'], repoUrl: 'https://github.com/example/digital-forensics', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-secure-comms', hackathonId: 'hk-cybersecurity', sessionId: 'ss-cyber-demo', submitterEmail: 'secure@comms.io', submitterName: 'SecureComms Team', title: 'SecureCommunicator', oneLiner: 'End-to-end encrypted team communication.', description: 'SecureCommunicator provides military-grade encryption for team chats, calls, and file sharing. Zero-knowledge architecture.', tags: ['Security', 'Communication', 'Privacy'], demoUrl: 'https://securecomms.demo', status: 'submitted' },
    }),
    prisma.project.create({
      data: { id: 'pj-cloud-guard', hackathonId: 'hk-cybersecurity', sessionId: 'ss-cyber-demo', submitterEmail: 'guard@cloud.io', submitterName: 'CloudGuard Inc', title: 'CloudGuard', oneLiner: 'Cloud security posture management with auto-remediation.', description: 'CloudGuard continuously monitors your cloud infrastructure for misconfigurations and automatically fixes issues before they become breaches.', tags: ['Security', 'Cloud', 'DevOps'], repoUrl: 'https://github.com/example/cloud-guard', status: 'submitted' },
    }),
  ])
  console.log(`Created ${cyberProjects.length} CyberSec projects`)

  // ========== Create Assignments ==========
  // Helper to create assignment with optional scores
  async function createAssignment(
    id: string,
    sessionId: string,
    projectId: string,
    judgeId: string,
    status: 'pending' | 'in_progress' | 'completed',
    scores?: Record<string, number>,
    totalScore?: number,
    comment?: string
  ) {
    const assignment = await prisma.assignment.create({
      data: {
        id,
        sessionId,
        projectId,
        judgeId,
        status,
        totalScore,
        comment,
      },
    })

    if (scores && Object.keys(scores).length > 0) {
      await Promise.all(
        Object.entries(scores).map(([criterionId, score]) =>
          prisma.score.create({
            data: {
              assignmentId: assignment.id,
              criterionId,
              score,
            },
          })
        )
      )
    }

    return assignment
  }

  // AI Challenge Assignments
  const aiAssignments = await Promise.all([
    // Alice
    createAssignment('as-ai-1', 'ss-ai-prelim', 'pj-smart-doc', 'usr-judge-alice', 'completed', { 'sc-ai-innovation': 28, 'sc-ai-technology': 25, 'sc-ai-design': 18, 'sc-ai-completion': 18 }, 89, 'Excellent healthcare solution with strong AI integration.'),
    createAssignment('as-ai-2', 'ss-ai-prelim', 'pj-code-genie', 'usr-judge-alice', 'completed', { 'sc-ai-innovation': 27, 'sc-ai-technology': 28, 'sc-ai-design': 19, 'sc-ai-completion': 19 }, 93, 'Impressive technical execution.'),
    createAssignment('as-ai-3', 'ss-ai-prelim', 'pj-meeting-mind', 'usr-judge-alice', 'in_progress'),
    createAssignment('as-ai-4', 'ss-ai-prelim', 'pj-write-buddy', 'usr-judge-alice', 'pending'),
    createAssignment('as-ai-5', 'ss-ai-prelim', 'pj-data-visualizer', 'usr-judge-alice', 'pending'),
    // Bob
    createAssignment('as-ai-6', 'ss-ai-prelim', 'pj-code-genie', 'usr-judge-bob', 'completed', { 'sc-ai-innovation': 25, 'sc-ai-technology': 27, 'sc-ai-design': 17, 'sc-ai-completion': 18 }, 87, 'Strong technical foundation.'),
    createAssignment('as-ai-7', 'ss-ai-prelim', 'pj-legal-eagle', 'usr-judge-bob', 'completed', { 'sc-ai-innovation': 22, 'sc-ai-technology': 23, 'sc-ai-design': 15, 'sc-ai-completion': 16 }, 76, 'Good concept but needs more polish.'),
    createAssignment('as-ai-8', 'ss-ai-prelim', 'pj-smart-doc', 'usr-judge-bob', 'completed', { 'sc-ai-innovation': 26, 'sc-ai-technology': 26, 'sc-ai-design': 16, 'sc-ai-completion': 17 }, 85, 'Great healthcare application.'),
    createAssignment('as-ai-9', 'ss-ai-prelim', 'pj-code-reviewer', 'usr-judge-bob', 'in_progress'),
    createAssignment('as-ai-10', 'ss-ai-prelim', 'pj-interview-prep', 'usr-judge-bob', 'pending'),
    // Charlie
    createAssignment('as-ai-11', 'ss-ai-prelim', 'pj-voice-clone', 'usr-judge-charlie', 'completed', { 'sc-ai-innovation': 26, 'sc-ai-technology': 24, 'sc-ai-design': 19, 'sc-ai-completion': 17 }, 86, 'Great UX for content creators.'),
    createAssignment('as-ai-12', 'ss-ai-prelim', 'pj-image-restorer', 'usr-judge-charlie', 'in_progress'),
    createAssignment('as-ai-13', 'ss-ai-prelim', 'pj-music-composer', 'usr-judge-charlie', 'pending'),
    createAssignment('as-ai-14', 'ss-ai-prelim', 'pj-fitness-coach', 'usr-judge-charlie', 'pending'),
    // Diana
    createAssignment('as-ai-15', 'ss-ai-prelim', 'pj-smart-doc', 'usr-judge-diana', 'completed', { 'sc-ai-innovation': 29, 'sc-ai-technology': 27, 'sc-ai-design': 17, 'sc-ai-completion': 18 }, 91, 'Excellent use of transformer models.'),
    createAssignment('as-ai-16', 'ss-ai-prelim', 'pj-legal-eagle', 'usr-judge-diana', 'completed', { 'sc-ai-innovation': 24, 'sc-ai-technology': 25, 'sc-ai-design': 16, 'sc-ai-completion': 15 }, 80, 'Good approach to legal NLP.'),
    createAssignment('as-ai-17', 'ss-ai-prelim', 'pj-meeting-mind', 'usr-judge-diana', 'in_progress'),
    createAssignment('as-ai-18', 'ss-ai-prelim', 'pj-code-reviewer', 'usr-judge-diana', 'pending'),
    // Evan
    createAssignment('as-ai-19', 'ss-ai-prelim', 'pj-code-genie', 'usr-judge-evan', 'completed', { 'sc-ai-innovation': 28, 'sc-ai-technology': 29, 'sc-ai-design': 18, 'sc-ai-completion': 18 }, 93, 'This is exactly what developers need.'),
    createAssignment('as-ai-20', 'ss-ai-prelim', 'pj-write-buddy', 'usr-judge-evan', 'in_progress'),
    createAssignment('as-ai-21', 'ss-ai-prelim', 'pj-interview-prep', 'usr-judge-evan', 'pending'),
  ])
  console.log(`Created ${aiAssignments.length} AI Challenge assignments`)

  // EdTech Assignments
  const edtechAssignments = await Promise.all([
    createAssignment('as-ed-1', 'ss-edtech-final', 'pj-class-vr', 'usr-judge-alice', 'pending'),
    createAssignment('as-ed-2', 'ss-edtech-final', 'pj-math-buddy', 'usr-judge-alice', 'in_progress'),
    createAssignment('as-ed-3', 'ss-edtech-final', 'pj-language-lab', 'usr-judge-alice', 'pending'),
    createAssignment('as-ed-4', 'ss-edtech-final', 'pj-class-vr', 'usr-judge-charlie', 'in_progress'),
    createAssignment('as-ed-5', 'ss-edtech-final', 'pj-science-sim', 'usr-judge-charlie', 'pending'),
    createAssignment('as-ed-6', 'ss-edtech-final', 'pj-math-buddy', 'usr-judge-diana', 'completed', { 'sc-ed-innovation': 23, 'sc-ed-education': 32, 'sc-ed-ux': 22, 'sc-ed-accessibility': 14 }, 91, 'The adaptive learning algorithm is well-designed.'),
    createAssignment('as-ed-7', 'ss-edtech-final', 'pj-code-kids', 'usr-judge-evan', 'pending'),
  ])
  console.log(`Created ${edtechAssignments.length} EdTech assignments`)

  // Web3 Assignments (completed)
  const web3Assignments = await Promise.all([
    createAssignment('as-w3-1', 'ss-web3-demo', 'pj-defi-yield', 'usr-judge-alice', 'completed', { 'sc-w3-innovation': 28, 'sc-w3-technology': 27, 'sc-w3-security': 18, 'sc-w3-ux': 17 }, 90, 'Excellent DeFi product.'),
    createAssignment('as-w3-2', 'ss-web3-demo', 'pj-nft-market', 'usr-judge-alice', 'completed', { 'sc-w3-innovation': 25, 'sc-w3-technology': 26, 'sc-w3-security': 17, 'sc-w3-ux': 19 }, 87, 'Great UX for NFT trading.'),
    createAssignment('as-w3-3', 'ss-web3-demo', 'pj-defi-yield', 'usr-judge-bob', 'completed', { 'sc-w3-innovation': 26, 'sc-w3-technology': 28, 'sc-w3-security': 19, 'sc-w3-ux': 16 }, 89, 'Solid smart contract architecture.'),
    createAssignment('as-w3-4', 'ss-web3-demo', 'pj-dao-governance', 'usr-judge-bob', 'completed', { 'sc-w3-innovation': 27, 'sc-w3-technology': 25, 'sc-w3-security': 18, 'sc-w3-ux': 17 }, 87, 'The quadratic voting implementation is well done.'),
    createAssignment('as-w3-5', 'ss-web3-demo', 'pj-cross-chain', 'usr-judge-bob', 'completed', { 'sc-w3-innovation': 29, 'sc-w3-technology': 28, 'sc-w3-security': 17, 'sc-w3-ux': 18 }, 92, 'Impressive technical achievement.'),
    createAssignment('as-w3-6', 'ss-web3-demo', 'pj-wallet-unified', 'usr-judge-charlie', 'completed', { 'sc-w3-innovation': 24, 'sc-w3-technology': 25, 'sc-w3-security': 19, 'sc-w3-ux': 19 }, 87, 'Beautiful interface.'),
    createAssignment('as-w3-7', 'ss-web3-demo', 'pj-game-fi', 'usr-judge-charlie', 'completed', { 'sc-w3-innovation': 26, 'sc-w3-technology': 24, 'sc-w3-security': 18, 'sc-w3-ux': 18 }, 86, 'Great gaming experience.'),
    createAssignment('as-w3-8', 'ss-web3-demo', 'pj-chain-analytics', 'usr-judge-diana', 'completed', { 'sc-w3-innovation': 27, 'sc-w3-technology': 28, 'sc-w3-security': 16, 'sc-w3-ux': 18 }, 89, 'The data analysis capabilities are impressive.'),
    createAssignment('as-w3-9', 'ss-web3-demo', 'pj-identity', 'usr-judge-diana', 'completed', { 'sc-w3-innovation': 28, 'sc-w3-technology': 26, 'sc-w3-security': 19, 'sc-w3-ux': 17 }, 90, 'Zero-knowledge implementation is solid.'),
  ])
  console.log(`Created ${web3Assignments.length} Web3 assignments`)

  // CyberSec Assignments
  const cyberAssignments = await Promise.all([
    createAssignment('as-cs-1', 'ss-cyber-demo', 'pj-threat-detector', 'usr-judge-bob', 'completed', { 'sc-cs-innovation': 24, 'sc-cs-security': 38, 'sc-cs-implementation': 32 }, 94, 'Outstanding security solution.'),
    createAssignment('as-cs-2', 'ss-cyber-demo', 'pj-vuln-scanner', 'usr-judge-bob', 'in_progress'),
    createAssignment('as-cs-3', 'ss-cyber-demo', 'pj-passwordless', 'usr-judge-bob', 'pending'),
    createAssignment('as-cs-4', 'ss-cyber-demo', 'pj-threat-detector', 'usr-judge-diana', 'completed', { 'sc-cs-innovation': 23, 'sc-cs-security': 37, 'sc-cs-implementation': 31 }, 91, 'Well-architected ML pipeline.'),
    createAssignment('as-cs-5', 'ss-cyber-demo', 'pj-cloud-guard', 'usr-judge-diana', 'in_progress'),
    createAssignment('as-cs-6', 'ss-cyber-demo', 'pj-forensics', 'usr-judge-evan', 'pending'),
    createAssignment('as-cs-7', 'ss-cyber-demo', 'pj-secure-comms', 'usr-judge-evan', 'pending'),
  ])
  console.log(`Created ${cyberAssignments.length} CyberSec assignments`)

  console.log('\nSeeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })