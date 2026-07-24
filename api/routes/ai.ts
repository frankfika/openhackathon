import type { Express, Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { RequestHandler } from 'express'
import { getAIService, AIMetrics } from '../services/ai'
import { logActivity } from '../utils/activity'

// ==================== Batch Task 状态跟踪 ====================
// 之前 batch-analyze 返回 taskId 但没地方存，admin 永远看不到进度。
// 改造：in-memory Map 存任务状态，TTL 1h 自动清理。
// 生产环境应换成 Redis / Bull / Postgres 表，但 in-memory 够用且零依赖。

export interface BatchTask {
  id: string
  total: number
  completed: number
  failed: number
  status: 'processing' | 'completed' | 'failed'
  startedAt: number
  finishedAt?: number
  errors: Array<{ projectId: string; message: string }>
}

const BATCH_TASKS = new Map<string, BatchTask>()
const BATCH_TASK_TTL_MS = 60 * 60 * 1000 // 1h

function createBatchTask(total: number): BatchTask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    total,
    completed: 0,
    failed: 0,
    status: 'processing',
    startedAt: Date.now(),
    errors: [],
  }
}

function updateBatchTask(id: string, patch: Partial<BatchTask>): void {
  const task = BATCH_TASKS.get(id)
  if (task) BATCH_TASKS.set(id, { ...task, ...patch })
}

/** 定期清理过期 task（防止 in-memory 无限增长） */
setInterval(() => {
  const now = Date.now()
  for (const [id, task] of BATCH_TASKS) {
    if (task.finishedAt && now - task.finishedAt > BATCH_TASK_TTL_MS) {
      BATCH_TASKS.delete(id)
    } else if (!task.finishedAt && now - task.startedAt > BATCH_TASK_TTL_MS * 2) {
      // 超过 2h 还在 processing 视为孤儿，强制清理
      BATCH_TASKS.delete(id)
    }
  }
}, 10 * 60 * 1000).unref() // 不阻止进程退出

export function registerAIRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAuth, requireAdmin, aiRateLimiter }: { requireAuth: RequestHandler; requireAdmin: RequestHandler; aiRateLimiter: RequestHandler },
) {
  // ==================== 项目质量评估 ====================

  /**
   * POST /api/ai/analyze-project/:projectId
   * 分析项目质量并返回AI评估
   * Query: ?force=true 跳过缓存重新评估
   */
  app.post('/api/ai/analyze-project/:projectId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params
      const userId = req.authUser?.id || ''
      const force = req.query.force === 'true' || req.body?.force === true

      // 获取项目信息
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { hackathon: true },
      })

      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // 检查是否已有缓存的评估结果（除非 force）
      if (!force) {
        const cached = await prisma.aIAssessment.findFirst({
          where: { projectId, type: 'quality_assessment' },
          orderBy: { createdAt: 'desc' },
        })

        // 如果缓存未过期（24小时内），直接返回
        if (cached && Date.now() - cached.createdAt.getTime() < 24 * 60 * 60 * 1000) {
          return res.json({ ...(cached.result as Record<string, unknown>), cached: true })
        }
      }

      // 调用AI服务分析
      const aiService = getAIService()
      const assessment = await aiService.analyzeProject({
        title: project.title,
        description: project.description || '',
        repoURL: project.repoUrl || undefined,
        demoURL: project.demoUrl || undefined,
        tags: project.tags || undefined,
        submissionData: project.submissionData as Record<string, unknown>,
      })

      // 保存评估结果到数据库
      await prisma.aIAssessment.create({
        data: {
          projectId,
          type: 'quality_assessment',
          result: assessment as unknown as Prisma.InputJsonValue,
        },
      })

      // 记录操作日志
      await logActivity(prisma, {
        action: 'ai_analyze',
        entityType: 'project',
        entityId: projectId,
        actorId: userId,
        actorRole: 'admin',
        actorName: req.authUser?.name || 'Unknown',
        metadata: { score: assessment.overallScore, force },
      })

      res.json({ ...assessment, cached: false })
    } catch (error) {
      console.error('AI analysis error:', error)
      // 错误脱敏：不透出内部 error.message
      res.status(500).json({ error: 'AI analysis failed' })
    }
  })

  /**
   * POST /api/ai/batch-analyze
   * 批量分析项目（异步任务，可通过 taskId 查进度）
   */
  app.post('/api/ai/batch-analyze', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { projectIds, hackathonId } = req.body

      let ids: string[] = projectIds

      // 如果未提供projectIds，则分析指定hackathon的所有项目
      if (!ids && hackathonId) {
        const projects = await prisma.project.findMany({
          where: { hackathonId },
          select: { id: true },
        })
        ids = projects.map((p) => p.id)
      }

      if (!ids || ids.length === 0) {
        return res.status(400).json({ error: 'No projects to analyze' })
      }

      // 创建 task（先建后异步执行，保证 taskId 立即可查）
      const task = createBatchTask(ids.length)
      BATCH_TASKS.set(task.id, task)

      res.json({
        message: `Started analyzing ${ids.length} projects`,
        taskId: task.id,
        status: task.status,
        total: task.total,
      })

      // 异步处理：用并发池（限速 5 并发）避免一次性塞爆 AI provider
      setImmediate(async () => {
        const aiService = getAIService()
        const CONCURRENCY = 5
        let cursor = 0
        let completed = 0
        let failed = 0
        const errors: BatchTask['errors'] = []

        async function worker(): Promise<void> {
          while (cursor < ids!.length) {
            const idx = cursor++
            const pid = ids![idx]
            try {
              const project = await prisma.project.findUnique({ where: { id: pid } })
              if (!project) {
                completed++
                continue
              }
              const assessment = await aiService.analyzeProject({
                title: project.title,
                description: project.description || '',
                repoURL: project.repoUrl || undefined,
                demoURL: project.demoUrl || undefined,
              })
              await prisma.aIAssessment.create({
                data: {
                  projectId: pid,
                  type: 'quality_assessment',
                  result: assessment as unknown as Prisma.InputJsonValue,
                },
              })
              completed++
            } catch (err) {
              failed++
              // 错误脱敏：admin 不需要看 AI provider 内部 stack / API key 痕迹
              // 原始错误已 console.error 在 service 层，安全消息走 safeErrorMessage
              const safeMessage =
                err instanceof Error
                  ? err.message.startsWith('AI service')
                    ? err.message // 已经是 safeErrorMessage 脱敏后的
                    : 'Per-project analysis failed'
                  : 'Per-project analysis failed'
              errors.push({
                projectId: pid,
                message: safeMessage,
              })
            }
            // 实时更新进度
            updateBatchTask(task.id, { completed, failed, errors })
          }
        }

        try {
          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()))
          updateBatchTask(task.id, {
            status: failed === ids.length ? 'failed' : 'completed',
            finishedAt: Date.now(),
            completed,
            failed,
            errors,
          })
          console.log(`Batch ${task.id} done: ${completed} ok, ${failed} failed`)
        } catch (err) {
          console.error(`Batch ${task.id} crashed:`, err)
          updateBatchTask(task.id, { status: 'failed', finishedAt: Date.now() })
        }
      })
    } catch (error) {
      console.error('Batch analysis error:', error)
      res.status(500).json({ error: 'Batch analysis failed' })
    }
  })

  /**
   * GET /api/ai/batch-status/:taskId
   * 查询批量分析任务进度
   */
  app.get('/api/ai/batch-status/:taskId', requireAuth, requireAdmin, (req: Request, res: Response) => {
    const task = BATCH_TASKS.get(req.params.taskId)
    if (!task) {
      return res.status(404).json({ error: 'Task not found or expired' })
    }
    res.json({
      taskId: task.id,
      status: task.status,
      total: task.total,
      completed: task.completed,
      failed: task.failed,
      progress: task.total > 0 ? Math.round((task.completed + task.failed) / task.total * 100) : 0,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      errors: task.errors.slice(0, 20), // 最多返回前 20 条错误
    })
  })

  // ==================== 评分一致性分析 ====================

  /**
   * GET /api/ai/scoring-consistency/:hackathonId
   * 分析评委评分一致性
   */
  app.get('/api/ai/scoring-consistency/:hackathonId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { hackathonId } = req.params

      // 获取所有已评分的assignment数据
      const assignments = await prisma.assignment.findMany({
        where: {
          project: { hackathonId },
          totalScore: { not: null },
        },
        include: {
          // Don't include `judge: true` — that returns the full user row
          // including the password hash. This endpoint is admin-only but the
          // password still shouldn't be on the wire.
          judge: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true } },
        },
      })

      if (assignments.length === 0) {
        return res.json([])
      }

      // 计算全局平均分
      const allScores = assignments.map((a) => a.totalScore!)
      const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length

      // 按评委分组
      const judgeScoresMap = new Map<string, { judgeId: string; judgeName: string; scores: number[] }>()

      for (const assignment of assignments) {
        const judgeId = assignment.judgeId
        const judgeName = assignment.judge.name
        if (!judgeScoresMap.has(judgeId)) {
          judgeScoresMap.set(judgeId, { judgeId, judgeName, scores: [] })
        }
        judgeScoresMap.get(judgeId)!.scores.push(assignment.totalScore!)
      }

      const judgeScores = Array.from(judgeScoresMap.values())

      // 调用AI分析
      const aiService = getAIService()
      const consistencyAnalysis = await aiService.analyzeScoringConsistency(judgeScores, avgScore)

      res.json(consistencyAnalysis)
    } catch (error) {
      console.error('Consistency analysis error:', error)
      res.status(500).json({ error: 'Consistency analysis failed' })
    }
  })

  // ==================== 内容生成 ====================

  /**
   * POST /api/ai/generate-content
   * 生成各类内容（README、描述、新闻稿等）
   */
  app.post('/api/ai/generate-content', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const { type, context, language, style } = req.body

      if (!type || !context) {
        return res.status(400).json({ error: 'Missing required fields: type, context' })
      }

      const aiService = getAIService()
      const content = await aiService.generateContent({ type, context, language, style })

      res.json({ content })
    } catch (error) {
      console.error('Content generation error:', error)
      res.status(500).json({ error: 'Content generation failed' })
    }
  })

  /**
   * POST /api/ai/optimize-description
   * 优化项目描述
   */
  app.post('/api/ai/optimize-description', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const { description, language = 'zh', style = 'business' } = req.body

      if (!description) {
        return res.status(400).json({ error: 'Description is required' })
      }

      const aiService = getAIService()
      const optimized = await aiService.generateContent({
        type: 'description',
        context: { original: description },
        language,
        style,
      })

      res.json({ optimized })
    } catch (error) {
      console.error('Description optimization error:', error)
      res.status(500).json({ error: 'Optimization failed' })
    }
  })

  // ==================== 内容审核 ====================

  /**
   * POST /api/ai/moderate-content
   * 审核内容是否合规
   */
  app.post('/api/ai/moderate-content', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const { content, type = 'project' } = req.body

      if (!content) {
        return res.status(400).json({ error: 'Content is required' })
      }

      const aiService = getAIService()
      const moderation = await aiService.moderateContent(content, type)

      res.json(moderation)
    } catch (error) {
      console.error('Content moderation error:', error)
      res.status(500).json({ error: 'Moderation failed' })
    }
  })

  // ==================== 相似度检测 ====================

  /**
   * POST /api/ai/detect-similarity
   * 检测两段文本的相似度（抄袭检测）
   */
  app.post('/api/ai/detect-similarity', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { text1, text2 } = req.body

      if (!text1 || !text2) {
        return res.status(400).json({ error: 'Both text1 and text2 are required' })
      }

      const aiService = getAIService()
      const similarity = await aiService.detectSimilarity(text1, text2)

      res.json({ similarity })
    } catch (error) {
      console.error('Similarity detection error:', error)
      res.status(500).json({ error: 'Similarity detection failed' })
    }
  })

  /**
   * POST /api/ai/check-plagiarism/:projectId
   * 检查项目是否存在抄袭
   * 关键优化：所有 pairwise AI call 并发执行（之前串行，N 项目要 N 倍延迟）
   */
  app.post('/api/ai/check-plagiarism/:projectId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      })

      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // 查找同一赛事下的其他项目
      // PERFORMANCE: cap at 100 candidates to bound the pairwise LLM cost.
      // 100 candidates × 1 detection ≈ 100 LLM calls per request; we order by
      // recent submissions so the most-likely matches are checked first.
      const otherProjects = await prisma.project.findMany({
        where: {
          hackathonId: project.hackathonId,
          id: { not: projectId },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      })

      if (otherProjects.length === 0) {
        return res.json({
          projectId,
          title: project.title,
          suspectedPlagiarism: false,
          similarProjects: [],
        })
      }

      const aiService = getAIService()

      // 全部 pairwise 并发执行
      const rawResults = await Promise.all(
        otherProjects.map(async (other) => {
          try {
            const similarity = await aiService.detectSimilarity(
              project.description || '',
              other.description || ''
            )
            return { projectId: other.id, title: other.title, similarity }
          } catch (err) {
            // 单项目失败不影响其他，写日志返回 0
            console.error(`Similarity check failed for ${other.id}:`, err)
            return { projectId: other.id, title: other.title, similarity: 0 }
          }
        }),
      )

      // 相似度 > 30% 才记录
      const similarities = rawResults.filter((r) => r.similarity > 30)
      similarities.sort((a, b) => b.similarity - a.similarity)

      res.json({
        projectId,
        title: project.title,
        suspectedPlagiarism: similarities.length > 0 && similarities[0].similarity > 70,
        similarProjects: similarities.slice(0, 5), // 最多返回5个相似项目
        checkedCount: otherProjects.length,
      })
    } catch (error) {
      console.error('Plagiarism check error:', error)
      res.status(500).json({ error: 'Plagiarism check failed' })
    }
  })

  // ==================== AI建议 ====================

  /**
   * GET /api/ai/judge-suggestions/:assignmentId
   * 为评委提供评分建议
   */
  app.get('/api/ai/judge-suggestions/:assignmentId', requireAuth, aiRateLimiter, async (req: Request, res: Response) => {
    try {
      const { assignmentId } = req.params
      const authUser = req.authUser

      if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      // 检查用户是否是该assignment的评委或管理员
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          project: true,
          // `judge: true` would leak the judge's password hash to whoever
          // queries this endpoint (admin sees any judge, assigned judge
          // sees themselves). Strip the password column explicitly.
          judge: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true } },
        },
      })

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found' })
      }

      const isAdmin = authUser.role === 'admin'
      const isAssignedJudge = authUser.id === assignment.judgeId

      if (!isAdmin && !isAssignedJudge) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // 获取AI评估结果
      const assessment = await prisma.aIAssessment.findFirst({
        where: { projectId: assignment.projectId },
        orderBy: { createdAt: 'desc' },
      })

      if (!assessment) {
        return res.json({ message: 'No AI assessment available yet' })
      }

      const result = assessment.result as Record<string, unknown>

      // 生成评分建议
      const suggestions = {
        summary: `该项目综合得分 ${result.overallScore}/100，${
          result.suggestedPriority === 'high'
            ? '推荐优先评审'
            : result.suggestedPriority === 'low'
            ? '可后续评审'
            : '建议按计划评审'
        }`,
        highlights: result.highlights || [],
        concerns: result.concerns || [],
        technicalTags: result.technicalTags || [],
        complexity: result.estimatedComplexity || 'intermediate',
        dimensions: result.dimensions,
      }

      res.json(suggestions)
    } catch (error) {
      console.error('Judge suggestions error:', error)
      res.status(500).json({ error: 'Failed to get suggestions' })
    }
  })

  // ==================== AI Metrics ====================

  /**
   * GET /api/ai/metrics
   * 查看 AI 调用 metrics（admin only）
   * 用途：监控 AI provider 健康度、排查慢请求、计算成本
   */
  app.get('/api/ai/metrics', requireAuth, requireAdmin, (_req: Request, res: Response) => {
    res.json(AIMetrics.snapshot())
  })
}
