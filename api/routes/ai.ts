import type { Express, Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { RequestHandler } from 'express'
import { getAIService } from '../services/ai'
import { logActivity } from '../utils/activity'

export function registerAIRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAuth, requireAdmin }: { requireAuth: RequestHandler; requireAdmin: RequestHandler },
) {
  // ==================== 项目质量评估 ====================

  /**
   * POST /api/ai/analyze-project/:projectId
   * 分析项目质量并返回AI评估
   */
  app.post('/api/ai/analyze-project/:projectId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params
      const userId = req.authUser?.id || ''

      // 获取项目信息
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { hackathon: true },
      })

      if (!project) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // 检查是否已有缓存的评估结果
      const cached = await prisma.aIAssessment.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      })

      // 如果缓存未过期（24小时内），直接返回
      if (cached && Date.now() - cached.createdAt.getTime() < 24 * 60 * 60 * 1000) {
        return res.json(cached.result)
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
        metadata: { score: assessment.overallScore },
      })

      res.json(assessment)
    } catch (error) {
      console.error('AI analysis error:', error)
      res.status(500).json({ error: 'AI analysis failed', message: error instanceof Error ? error.message : 'Unknown error' })
    }
  })

  /**
   * POST /api/ai/batch-analyze
   * 批量分析项目（异步任务）
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

      // 创建后台任务（实际生产环境应使用消息队列如 Bull）
      res.json({
        message: `Started analyzing ${ids.length} projects`,
        taskId: `task-${Date.now()}`,
        status: 'processing',
      })

      // 异步处理
      setImmediate(async () => {
        const aiService = getAIService()
        for (const pid of ids) {
          try {
            const project = await prisma.project.findUnique({
              where: { id: pid },
            })
            if (!project) continue

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
          } catch (err) {
            console.error(`Failed to analyze project ${pid}:`, err)
          }
        }

        console.log(`Completed batch analysis of ${ids.length} projects`)
      })
    } catch (error) {
      console.error('Batch analysis error:', error)
      res.status(500).json({ error: 'Batch analysis failed' })
    }
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
          judge: true,
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
  app.post('/api/ai/generate-content', requireAuth, async (req: Request, res: Response) => {
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
  app.post('/api/ai/optimize-description', async (req: Request, res: Response) => {
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
  app.post('/api/ai/moderate-content', async (req: Request, res: Response) => {
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
      const otherProjects = await prisma.project.findMany({
        where: {
          hackathonId: project.hackathonId,
          id: { not: projectId },
        },
      })

      const aiService = getAIService()
      const similarities: Array<{ projectId: string; title: string; similarity: number }> = []

      // 逐一比较
      for (const other of otherProjects) {
        const similarity = await aiService.detectSimilarity(
          project.description || '',
          other.description || ''
        )
        if (similarity > 30) {
          // 相似度超过30%才记录
          similarities.push({
            projectId: other.id,
            title: other.title,
            similarity,
          })
        }
      }

      // 按相似度降序排序
      similarities.sort((a, b) => b.similarity - a.similarity)

      res.json({
        projectId,
        title: project.title,
        suspectedPlagiarism: similarities.length > 0 && similarities[0].similarity > 70,
        similarProjects: similarities.slice(0, 5), // 最多返回5个相似项目
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
  app.get('/api/ai/judge-suggestions/:assignmentId', requireAuth, async (req: Request, res: Response) => {
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
          judge: true,
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
}
