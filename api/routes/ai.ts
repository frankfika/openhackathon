import type { Express, Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { getAIService } from '../services/ai'
import { logActivity } from '../utils/activity'
import { asString } from '../config'
import {
  buildPrompt,
  type Language,
  type PromptName,
  type Tone,
} from '../services/ai/prompts'

interface AIError extends Error {
  code?: string;
}

function readLanguage(input: unknown): Language {
  const value = asString(input);
  if (value === 'zh' || value === 'en' || value === 'both') return value;
  return 'both';
}

function readTone(input: unknown): Tone {
  const value = asString(input);
  if (value === 'professional' || value === 'casual' || value === 'academic' || value === 'tech-evangelist') {
    return value;
  }
  return 'professional';
}

const descriptionRequestSchema = z.object({
  theme: z.string().min(1).max(500).optional(),
  tracks: z.array(z.string().min(1).max(60)).max(5).optional(),
  prizePool: z.string().max(200).optional(),
  submissionDeadline: z.string().max(40).optional(),
  tone: z.string().max(40).optional(),
  language: z.string().max(10).optional(),
});

const newsRequestSchema = z.object({
  tone: z.string().max(40).optional(),
  language: z.string().max(10).optional(),
  includeRunnerUps: z.boolean().optional(),
});

const criteriaRequestSchema = z.object({
  theme: z.string().min(1).max(500).optional(),
  focus: z.string().max(500).optional(),
  criterionCount: z.number().int().min(5).max(7).optional(),
});

export function registerAIRoutes(
  app: Express,
  prisma: PrismaClient,
  {
    requireAuth,
    requireAdmin,
    aiGenRateLimiter,
  }: {
    requireAuth: RequestHandler;
    requireAdmin: RequestHandler;
    aiGenRateLimiter: RequestHandler;
  },
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
   *
   * Block 3 §3.5.3: writes a real AIBatchTask row and returns its id;
   * a separate GET endpoint lets callers poll status.
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

      const actorId = req.authUser?.id || '';
      const task = await prisma.aIBatchTask.create({
        data: {
          actorId,
          hackathonId: hackathonId || null,
          kind: 'analyze-projects',
          status: 'pending',
          total: ids.length,
          metadata: { projectIds: ids } as Prisma.InputJsonValue,
        },
      });

      res.json({
        taskId: task.id,
        status: task.status,
        total: task.total,
      });

      // 异步处理
      setImmediate(async () => {
        const aiService = getAIService();
        await prisma.aIBatchTask.update({
          where: { id: task.id },
          data: { status: 'running' },
        });
        let completed = 0;
        let failed = 0;
        for (const pid of ids) {
          try {
            const project = await prisma.project.findUnique({
              where: { id: pid },
            });
            if (!project) continue;

            const assessment = await aiService.analyzeProject({
              title: project.title,
              description: project.description || '',
              repoURL: project.repoUrl || undefined,
              demoURL: project.demoUrl || undefined,
            });

            await prisma.aIAssessment.create({
              data: {
                projectId: pid,
                type: 'quality_assessment',
                result: assessment as unknown as Prisma.InputJsonValue,
              },
            });
            completed += 1;
          } catch (err) {
            failed += 1;
            console.error(`Failed to analyze project ${pid}:`, err);
          }
        }
        await prisma.aIBatchTask.update({
          where: { id: task.id },
          data: {
            status: failed === ids.length ? 'failed' : 'completed',
            completed,
            failed,
            completedAt: new Date(),
          },
        });
        console.log(`Completed batch analysis of ${ids.length} projects (task ${task.id})`);
      });
    } catch (error) {
      console.error('Batch analysis error:', error);
      res.status(500).json({ error: 'Batch analysis failed' });
    }
  });

  app.get('/api/ai/batch-tasks/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const task = await prisma.aIBatchTask.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: 'Batch task not found' });
    res.json(task);
  });

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
   *
   * Block 3 §3.6 V3.10: now requires auth. Previously this endpoint
   * was unauthenticated.
   */
  app.post('/api/ai/optimize-description', requireAuth, requireAdmin, async (req: Request, res: Response) => {
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
   *
   * Block 3 §3.6 V3.10: now requires admin auth.
   */
  app.post('/api/ai/moderate-content', requireAuth, requireAdmin, async (req: Request, res: Response) => {
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

  // ==================== AI 文档生成 (Block 3) ====================

  async function runHackathonGeneration(
    req: Request,
    res: Response,
    args: {
      promptName: PromptName;
      type: 'description' | 'news' | 'criteria';
      buildContext: (hackathon: {
        id: string;
        title: string;
        tagline: string;
        city: string | null;
        startAt: Date;
        endAt: Date;
        prizePool: string | null;
        theme: string | null;
        tracks: string[];
      }) => Record<string, unknown>;
    },
  ) {
    try {
      const hackathonId = asString(req.params.id);
      if (!hackathonId) return res.status(400).json({ error: 'hackathonId is required' });

      const hackathon = await prisma.hackathon.findUnique({
        where: { id: hackathonId },
        select: {
          id: true,
          title: true,
          tagline: true,
          city: true,
          startAt: true,
          endAt: true,
          prizePool: true,
          theme: true,
          tracks: true,
        },
      });
      if (!hackathon) return res.status(404).json({ error: 'Hackathon not found' });

      const actorId = req.authUser?.id;
      if (!actorId) return res.status(401).json({ error: 'Unauthorized' });

      const aiService = getAIService();
      const ctxArgs = args.buildContext(hackathon);
      const started = Date.now();

      let result;
      try {
        result = await aiService.callStructured(args.promptName, ctxArgs as never);
      } catch (err) {
        const e = err as AIError;
        const code = e.code || 'LLM_FAILED';
        const status = code === 'LLM_INVALID_KEY' ? 500 : 502;
        await prisma.aIGenerationLog.create({
          data: {
            actorId,
            hackathonId,
            type: args.type,
            language: typeof ctxArgs.language === 'string' ? ctxArgs.language : 'both',
            promptHash: 'error',
            model: 'unknown',
            tokensIn: 0,
            tokensOut: 0,
            latencyMs: Date.now() - started,
            status: 'failed',
            errorCode: code,
          },
        });
        return res.status(status).json({ error: e.message || 'LLM call failed', code });
      }

      await prisma.aIGenerationLog.create({
        data: {
          actorId,
          hackathonId,
          type: args.type,
          language: typeof ctxArgs.language === 'string' ? ctxArgs.language : 'both',
          promptHash: result.promptHash,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: result.latencyMs,
          status: 'success',
        },
      });

      res.json({
        data: result.data,
        model: result.model,
        tokensUsed: result.tokensIn + result.tokensOut,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs: result.latencyMs,
        promptVersion: buildPrompt(args.promptName, ctxArgs as never).version,
      });
    } catch (error) {
      console.error(`AI ${args.type} generation error:`, error);
      res.status(500).json({ error: 'AI generation failed' });
    }
  }

  // Endpoint 1: generate hackathon description
  app.post(
    '/api/ai/hackathons/:id/generate-description',
    requireAuth,
    requireAdmin,
    aiGenRateLimiter,
    async (req, res) => {
      const parsed = descriptionRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
      }
      await runHackathonGeneration(req, res, {
        promptName: 'hackathon-description',
        type: 'description',
        buildContext: (h) => ({
          hackathon: h,
          language: readLanguage(parsed.data.language),
          tone: readTone(parsed.data.tone),
          theme: parsed.data.theme,
          tracks: parsed.data.tracks,
          submissionDeadline: parsed.data.submissionDeadline,
          prizePool: parsed.data.prizePool,
        }),
      });
    },
  );

  // Endpoint 2: generate award news
  app.post(
    '/api/ai/hackathons/:id/generate-news',
    requireAuth,
    requireAdmin,
    aiGenRateLimiter,
    async (req, res) => {
      const parsed = newsRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
      }
      const includeRunnerUps = parsed.data.includeRunnerUps === true;
      // Pull curated leaderboard data + project metadata
      const hackathon = await prisma.hackathon.findUnique({
        where: { id: asString(req.params.id) || '' },
        select: {
          id: true,
          title: true,
          tagline: true,
          city: true,
          startAt: true,
          endAt: true,
          prizePool: true,
          theme: true,
          tracks: true,
          leaderboardData: true,
        },
      });
      if (!hackathon) return res.status(404).json({ error: 'Hackathon not found' });

      const entries = Array.isArray(hackathon.leaderboardData)
        ? (hackathon.leaderboardData as Array<{ projectId: string; rank: number; award: string }>)
        : [];
      const filtered = entries
        .filter((e) => typeof e?.rank === 'number' && e.rank >= 1)
        .filter((e) => (includeRunnerUps ? e.rank <= 10 : e.rank <= 3))
        .sort((a, b) => a.rank - b.rank);
      const projectIds = filtered.map((e) => e.projectId).filter(Boolean);
      const projects = projectIds.length
        ? await prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, title: true, description: true, tags: true, submitterName: true },
          })
        : [];
      const byId = new Map(projects.map((p) => [p.id, p]));
      const projectInputs = filtered
        .map((e) => {
          const p = byId.get(e.projectId);
          if (!p) return null;
          return {
            rank: e.rank,
            award: e.award,
            title: p.title,
            submitterName: p.submitterName || 'Team',
            description: p.description,
            tags: p.tags,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      await runHackathonGeneration(req, res, {
        promptName: 'hackathon-news',
        type: 'news',
        buildContext: (h) => ({
          hackathon: h,
          language: readLanguage(parsed.data.language),
          tone: readTone(parsed.data.tone),
          projects: projectInputs,
        }),
      });
    },
  );

  // Endpoint 3: suggest scoring criteria
  app.post(
    '/api/ai/hackathons/:id/suggest-criteria',
    requireAuth,
    requireAdmin,
    aiGenRateLimiter,
    async (req, res) => {
      const parsed = criteriaRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
      }
      await runHackathonGeneration(req, res, {
        promptName: 'hackathon-criteria',
        type: 'criteria',
        buildContext: (h) => ({
          hackathon: h,
          language: 'en',
          tone: 'professional',
          theme: parsed.data.theme,
          focus: parsed.data.focus,
          criterionCount: parsed.data.criterionCount ?? 6,
        }),
      });
    },
  );

  // Endpoint 4: Auto-fill hackathon from URL / text
  app.post(
    '/api/ai/auto-fill-hackathon',
    requireAuth,
    requireAdmin,
    aiGenRateLimiter,
    async (req, res) => {
      try {
        const { input, inputType = 'text' } = req.body;
        if (!input || typeof input !== 'string') {
          return res.status(400).json({ error: 'input is required and must be a string' });
        }

        let content = input;
        if (inputType === 'url') {
          try {
            const url = new URL(input);
            if (!['http:', 'https:'].includes(url.protocol)) {
              return res.status(400).json({ error: 'Invalid URL protocol' });
            }
            const response = await fetch(input, { redirect: 'follow' });
            if (!response.ok) {
              return res.status(400).json({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` });
            }
            const html = await response.text();
            // Simple HTML-to-text extraction: strip script/style tags and all HTML tags
            content = html
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (content.length > 15000) {
              content = content.slice(0, 15000);
            }
          } catch (fetchErr: any) {
            return res.status(400).json({ error: 'Failed to fetch URL', message: fetchErr.message });
          }
        }

        const aiService = getAIService();
        const started = Date.now();
        let result;
        try {
          result = await aiService.callStructured('hackathon-auto-fill', {
            content: content.substring(0, 15000),
            language: 'both',
            tone: 'professional',
          } as never);
        } catch (err) {
          const e = err as AIError;
          const code = e.code || 'LLM_FAILED';
          const status = code === 'LLM_INVALID_KEY' ? 500 : 502;
          return res.status(status).json({ error: e.message || 'LLM call failed', code });
        }

        // Normalize dates
        const data = result.data as Record<string, unknown>;
        if (data.startAt && typeof data.startAt === 'string') {
          const parsed = new Date(data.startAt);
          if (!Number.isNaN(parsed.getTime())) {
            data.startAt = parsed.toISOString().split('T')[0];
          }
        }
        if (data.endAt && typeof data.endAt === 'string') {
          const parsed = new Date(data.endAt);
          if (!Number.isNaN(parsed.getTime())) {
            data.endAt = parsed.toISOString().split('T')[0];
          }
        }

        // Default source to 'external' if not specified
        if (!data.source || typeof data.source !== 'string') {
          data.source = 'external';
        }
        // Default organizer from source or generic
        if (!data.organizer || typeof data.organizer !== 'string') {
          const src = String(data.source);
          data.organizer = src === 'custom' || src === 'external' ? 'Unknown' : src;
        }

        // Log AI generation
        const actorId = req.authUser?.id;
        if (actorId) {
          await prisma.aIGenerationLog.create({
            data: {
              actorId,
              type: 'auto-fill',
              language: 'both',
              promptHash: result.promptHash,
              model: result.model,
              tokensIn: result.tokensIn,
              tokensOut: result.tokensOut,
              latencyMs: Date.now() - started,
              status: 'success',
            },
          });
        }

        res.json({
          success: true,
          data,
          rawExtractedText: content.slice(0, 3000),
          model: result.model,
          tokensUsed: result.tokensIn + result.tokensOut,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: result.latencyMs,
          promptVersion: buildPrompt('hackathon-auto-fill', { content: '', language: 'both', tone: 'professional' } as never).version,
        });
      } catch (error) {
        console.error('Auto-fill error:', error);
        res.status(500).json({ error: 'Auto-fill failed', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
  );

  // Endpoint 5 (Block 3 §3.6 V3.12): aggregated AI cost
  app.get('/api/admin/ai-cost', requireAuth, requireAdmin, async (req, res) => {
    const month = asString(req.query.month); // e.g. "2026-07"
    let start: Date;
    let end: Date;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const m = Number(monthStr);
      start = new Date(Date.UTC(year, m - 1, 1));
      end = new Date(Date.UTC(year, m, 1));
    } else {
      const now = new Date();
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    }
    const logs = await prisma.aIGenerationLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { type: true, tokensIn: true, tokensOut: true, costUsd: true, status: true },
    });
    const byType: Record<string, { count: number; tokensIn: number; tokensOut: number; costUsd: number }> = {};
    for (const log of logs) {
      const bucket = (byType[log.type] ||= { count: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 });
      bucket.count += 1;
      bucket.tokensIn += log.tokensIn;
      bucket.tokensOut += log.tokensOut;
      bucket.costUsd += log.costUsd ?? 0;
    }
    const totalTokensIn = logs.reduce((s, l) => s + l.tokensIn, 0);
    const totalTokensOut = logs.reduce((s, l) => s + l.tokensOut, 0);
    const totalCost = logs.reduce((s, l) => s + (l.costUsd ?? 0), 0);
    res.json({
      month: `${start.toISOString().slice(0, 7)}`,
      totalCalls: logs.length,
      totalTokensIn,
      totalTokensOut,
      costUsd: totalCost,
      byType,
    });
  });
}
