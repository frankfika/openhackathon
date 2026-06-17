/**
 * AI 路由 - 提供AI增强功能的API接口
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authenticateToken, isAdmin, isJudge } from '../middleware'
import { getAIService, ProjectAssessmentSchema } from '../services/ai'
import { prisma } from '../config'
import { logActivity } from '../utils/activity'

const router = Router()

// ==================== 项目质量评估 ====================

/**
 * POST /api/ai/analyze-project/:projectId
 * 分析项目质量并返回AI评估
 */
router.post('/analyze-project/:projectId', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = (req as any).user.id

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
      repoURL: project.repoURL || undefined,
      demoURL: project.demoURL || undefined,
      tags: project.tags || undefined,
      submissionData: project.submissionData as any,
    })

    // 保存评估结果到数据库
    await prisma.aIAssessment.create({
      data: {
        projectId,
        type: 'quality_assessment',
        result: assessment as any,
      },
    })

    // 记录操作日志
    await logActivity({
      action: 'ai_analyze',
      objectType: 'project',
      objectId: projectId,
      userId,
      metadata: { score: assessment.overallScore },
    })

    res.json(assessment)
  } catch (error: any) {
    console.error('AI analysis error:', error)
    res.status(500).json({ error: 'AI analysis failed', message: error.message })
  }
})

/**
 * POST /api/ai/batch-analyze
 * 批量分析项目（异步任务）
 */
router.post('/batch-analyze', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { projectIds, hackathonId } = req.body
    const userId = (req as any).user.id

    let ids = projectIds

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
      for (const projectId of ids) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
          })
          if (!project) continue

          const assessment = await aiService.analyzeProject({
            title: project.title,
            description: project.description || '',
            repoURL: project.repoURL || undefined,
            demoURL: project.demoURL || undefined,
          })

          await prisma.aIAssessment.create({
            data: {
              projectId,
              type: 'quality_assessment',
              result: assessment as any,
            },
          })
        } catch (err) {
          console.error(`Failed to analyze project ${projectId}:`, err)
        }
      }

      console.log(`Completed batch analysis of ${ids.length} projects`)
    })
  } catch (error: any) {
    console.error('Batch analysis error:', error)
    res.status(500).json({ error: 'Batch analysis failed' })
  }
})

// ==================== 评分一致性分析 ====================

/**
 * GET /api/ai/scoring-consistency/:hackathonId
 * 分析评委评分一致性
 */
router.get('/scoring-consistency/:hackathonId', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { hackathonId } = req.params

    // 获取所有评分数据
    const scores = await prisma.score.findMany({
      where: {
        assignment: {
          project: { hackathonId },
        },
      },
      include: {
        assignment: {
          include: {
            judge: true,
          },
        },
      },
    })

    if (scores.length === 0) {
      return res.json([])
    }

    // 计算全局平均分
    const allScores = scores.map((s) => s.total)
    const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length

    // 按评委分组
    const judgeScoresMap = new Map<string, { judgeId: string; judgeName: string; scores: number[] }>()

    for (const score of scores) {
      const judgeId = score.assignment.judgeId
      const judgeName = score.assignment.judge.name
      if (!judgeScoresMap.has(judgeId)) {
        judgeScoresMap.set(judgeId, { judgeId, judgeName, scores: [] })
      }
      judgeScoresMap.get(judgeId)!.scores.push(score.total)
    }

    const judgeScores = Array.from(judgeScoresMap.values())

    // 调用AI分析
    const aiService = getAIService()
    const consistencyAnalysis = await aiService.analyzeScoringConsistency(judgeScores, avgScore)

    res.json(consistencyAnalysis)
  } catch (error: any) {
    console.error('Consistency analysis error:', error)
    res.status(500).json({ error: 'Consistency analysis failed' })
  }
})

// ==================== 内容生成 ====================

/**
 * POST /api/ai/generate-content
 * 生成各类内容（README、描述、新闻稿等）
 */
router.post('/generate-content', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type, context, language, style } = req.body

    if (!type || !context) {
      return res.status(400).json({ error: 'Missing required fields: type, context' })
    }

    const aiService = getAIService()
    const content = await aiService.generateContent({ type, context, language, style })

    res.json({ content })
  } catch (error: any) {
    console.error('Content generation error:', error)
    res.status(500).json({ error: 'Content generation failed' })
  }
})

/**
 * POST /api/ai/optimize-description
 * 优化项目描述
 */
router.post('/optimize-description', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Description optimization error:', error)
    res.status(500).json({ error: 'Optimization failed' })
  }
})

// ==================== 内容审核 ====================

/**
 * POST /api/ai/moderate-content
 * 审核内容是否合规
 */
router.post('/moderate-content', async (req: Request, res: Response) => {
  try {
    const { content, type = 'project' } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Content is required' })
    }

    const aiService = getAIService()
    const moderation = await aiService.moderateContent(content, type)

    res.json(moderation)
  } catch (error: any) {
    console.error('Content moderation error:', error)
    res.status(500).json({ error: 'Moderation failed' })
  }
})

// ==================== 相似度检测 ====================

/**
 * POST /api/ai/detect-similarity
 * 检测两段文本的相似度（抄袭检测）
 */
router.post('/detect-similarity', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { text1, text2 } = req.body

    if (!text1 || !text2) {
      return res.status(400).json({ error: 'Both text1 and text2 are required' })
    }

    const aiService = getAIService()
    const similarity = await aiService.detectSimilarity(text1, text2)

    res.json({ similarity })
  } catch (error: any) {
    console.error('Similarity detection error:', error)
    res.status(500).json({ error: 'Similarity detection failed' })
  }
})

/**
 * POST /api/ai/check-plagiarism/:projectId
 * 检查项目是否存在抄袭
 */
router.post('/check-plagiarism/:projectId', authenticateToken, isAdmin, async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('Plagiarism check error:', error)
    res.status(500).json({ error: 'Plagiarism check failed' })
  }
})

// ==================== AI建议 ====================

/**
 * GET /api/ai/judge-suggestions/:assignmentId
 * 为评委提供评分建议
 */
router.get('/judge-suggestions/:assignmentId', authenticateToken, isJudge, async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        project: true,
      },
    })

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    // 获取AI评估结果
    const assessment = await prisma.aIAssessment.findFirst({
      where: { projectId: assignment.projectId },
      orderBy: { createdAt: 'desc' },
    })

    if (!assessment) {
      return res.json({ message: 'No AI assessment available yet' })
    }

    const result = assessment.result as any

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
  } catch (error: any) {
    console.error('Judge suggestions error:', error)
    res.status(500).json({ error: 'Failed to get suggestions' })
  }
})

export default router
