/**
 * AI Service - 统一AI能力接口
 * 支持多模型提供商：Claude (Anthropic)、OpenAI、本地模型
 *
 * 设计要点：
 * - 所有 AI 调用走 withTimeout，避免上游 hang 拖死 server
 * - 错误脱敏（safeErrorMessage）避免把第三方 API 内部错误透传给客户端
 * - 大输入截断（MAX_INPUT_CHARS）防止恶意 payload 烧 token
 * - AI 内部 metrics 走 AIMetrics 模块，独立可观测
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod'

// ==================== 常量 ====================

/** 单次 AI 调用的最大等待时间。Claude/OpenAI 99% 请求 < 20s，留 10s buffer */
const FETCH_TIMEOUT_MS = 30_000

/** 任何送进 prompt 的文本最大字符数。超过会被截断（保留头尾语义最关键的部分） */
const MAX_INPUT_CHARS = 10_000

/** 相似度解析匹配模式：从 AI 自由文本里提取 0-100 之间的数字 */
const SIMILARITY_REGEX = /\b(\d{1,3})\b/g

// ==================== 工具函数 ====================

/**
 * 包装 fetch，加上超时（AbortController）。
 * 这是所有 AI provider 调用的统一入口。
 */
export async function withTimeout(
  fn: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 错误脱敏：把任意上游错误转换为对客户端安全的简短消息。
 * 原始错误保留在 console.error 便于排查，响应里只给 category。
 */
function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'AI service timeout'
    if (err.message.includes('fetch failed')) return 'AI service unreachable'
    if (err.message.includes('API key')) return 'AI service misconfigured'
  }
  return 'AI service error'
}

/**
 * 截断长文本，保留头尾。中心思想：黑客松项目描述的"是什么"通常在前 1/3，"实现细节"通常在后 1/3。
 */
export function truncateForPrompt(text: string, maxChars: number = MAX_INPUT_CHARS): string {
  if (!text) return ''
  if (text.length <= maxChars) return text
  const head = text.slice(0, Math.floor(maxChars * 0.7))
  const tail = text.slice(-Math.floor(maxChars * 0.2))
  return `${head}\n\n[...truncated ${text.length - maxChars} chars...]\n\n${tail}`
}

/**
 * 从 AI 返回的自由文本中提取相似度数字。优先找 0-100 范围内的、靠前的那个数字。
 * - "约 75%" → 75
 * - "相似度 30.5%" → 30
 * - "75-80 之间" → 75
 * - "无明显相似" → 0
 */
export function parseSimilarityScore(raw: unknown): number {
  const text = String(raw ?? '')
  // 优先尝试从整个响应中匹配所有 0-100 范围的数字
  const matches = text.match(SIMILARITY_REGEX) || []
  for (const m of matches) {
    const n = parseInt(m, 10)
    if (n >= 0 && n <= 100) return n
  }
  return 0
}

// ==================== Metrics ====================

/**
 * AI 调用 metrics（in-memory 计数器）。
 * 用于：1) 监控 AI provider 健康度 2) 排查"为啥 admin 面板慢" 3) 后续接 Prometheus
 */
export const AIMetrics = {
  calls: { claude: 0, openai: 0, local: 0 },
  errors: { claude: 0, openai: 0, local: 0, timeout: 0 },
  totalDurationMs: 0,
  reset(): void {
    this.calls = { claude: 0, openai: 0, local: 0 }
    this.errors = { claude: 0, openai: 0, local: 0, timeout: 0 }
    this.totalDurationMs = 0
  },
  snapshot(): {
    calls: Record<string, number>
    errors: Record<string, number>
    avgDurationMs: number
  } {
    const totalCalls = this.calls.claude + this.calls.openai + this.calls.local
    return {
      calls: { ...this.calls },
      errors: { ...this.errors },
      avgDurationMs: totalCalls > 0 ? Math.round(this.totalDurationMs / totalCalls) : 0,
    }
  },
}

// ==================== 类型定义 ====================

export interface AIConfig {
  provider: 'claude' | 'openai' | 'local'
  apiKey?: string
  baseURL?: string
  model?: string
  maxTokens?: number
  temperature?: number
}

// 项目质量评估结果
export const ProjectAssessmentSchema = z.object({
  overallScore: z.number().min(0).max(100).describe('综合评分 0-100'),
  dimensions: z.object({
    completeness: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string().describe('评分理由'),
    }),
    innovation: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string().describe('创新性分析'),
    }),
    technicalDepth: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string().describe('技术深度评估'),
    }),
    presentation: z.object({
      score: z.number().min(0).max(100),
      reasoning: z.string().describe('呈现质量'),
    }),
  }),
  highlights: z.array(z.string()).describe('项目亮点列表'),
  concerns: z.array(z.string()).describe('潜在问题或风险'),
  suggestedPriority: z.enum(['high', 'medium', 'low']).describe('推荐评审优先级'),
  technicalTags: z.array(z.string()).describe('识别的技术标签'),
  estimatedComplexity: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
})

export type ProjectAssessment = z.infer<typeof ProjectAssessmentSchema>

// 评分一致性分析
export const ScoringConsistencySchema = z.object({
  judgeId: z.string(),
  judgeName: z.string(),
  avgScore: z.number(),
  stdDeviation: z.number().describe('评分标准差'),
  bias: z.enum(['too_strict', 'too_lenient', 'balanced']),
  biasScore: z.number().describe('偏差程度 -50到+50，0为平衡'),
  suggestion: z.string().describe('给评委的建议'),
})

export type ScoringConsistency = z.infer<typeof ScoringConsistencySchema>

// 内容审核结果
export const ModerationResultSchema = z.object({
  isAppropriate: z.boolean(),
  flags: z.array(
    z.object({
      type: z.enum(['sensitive', 'spam', 'plagiarism', 'inappropriate', 'violence', 'hate']),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string(),
    })
  ),
  suggestedAction: z.enum(['approve', 'review', 'reject']),
})

export type ModerationResult = z.infer<typeof ModerationResultSchema>

// 内容生成请求
export interface ContentGenerationRequest {
  type: 'readme' | 'description' | 'pitch' | 'news' | 'email' | 'criteria'
  context: Record<string, any>
  language?: 'en' | 'zh'
  style?: 'academic' | 'business' | 'casual' | 'technical'
}

// ==================== AI Service 实现 ====================

class AIService {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = {
      provider: config.provider || 'claude',
      baseURL: config.baseURL || this.getDefaultBaseURL(config.provider),
      model: config.model || this.getDefaultModel(config.provider),
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      ...config,
    }
  }

  private getDefaultBaseURL(provider: string): string {
    switch (provider) {
      case 'claude':
        return 'https://api.anthropic.com/v1'
      case 'openai':
        return 'https://api.openai.com/v1'
      case 'local':
        return 'http://localhost:11434/v1' // Ollama
      default:
        return 'https://api.anthropic.com/v1'
    }
  }

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'claude':
        return 'claude-sonnet-4-20250514'
      case 'openai':
        return 'gpt-4o'
      case 'local':
        return 'llama3.1:8b'
      default:
        return 'claude-sonnet-4-20250514'
    }
  }

  /**
   * 通用AI调用接口
   */
  private async callAI(prompt: string, schema?: z.ZodSchema): Promise<any> {
    const { provider, apiKey } = this.config

    if (!apiKey && provider !== 'local') {
      throw new Error(`API key is required for provider: ${provider}`)
    }

    const start = Date.now()
    try {
      let result: any
      if (provider === 'claude') {
        result = await this.callClaude(prompt, schema)
      } else if (provider === 'openai') {
        result = await this.callOpenAI(prompt, schema)
      } else {
        result = await this.callLocal(prompt, schema)
      }
      AIMetrics.calls[provider] += 1
      return result
    } catch (error) {
      // 分类错误类型，便于 metrics 区分
      if (error instanceof Error && error.name === 'AbortError') {
        AIMetrics.errors.timeout += 1
      } else {
        AIMetrics.errors[provider] += 1
      }
      console.error('AI call failed:', error)
      throw new Error(safeErrorMessage(error))
    } finally {
      AIMetrics.totalDurationMs += Date.now() - start
    }
  }

  /**
   * 调用 Claude API
   */
  private async callClaude(prompt: string, schema?: z.ZodSchema): Promise<any> {
    const { apiKey, baseURL, model, maxTokens, temperature } = this.config

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey!,
      'anthropic-version': '2023-06-01',
    }

    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    }

    // 如果提供了schema，使用工具调用模式
    if (schema) {
      body.tools = [
        {
          name: 'structured_output',
          description: 'Return structured data according to the schema',
          input_schema: this.zodToJsonSchema(schema),
        },
      ]
      body.tool_choice = { type: 'tool', name: 'structured_output' }
    }

    const response = await withTimeout(
      (signal) =>
        fetch(`${baseURL}/messages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        }),
      FETCH_TIMEOUT_MS,
    )

    if (!response.ok) {
      // 错误脱敏：只透出 status，不透出 response body（可能含 API 内部信息）
      throw new Error(`Claude API ${response.status}`)
    }

    const data = await response.json()

    // 解析响应
    if (schema && data.content?.[0]?.type === 'tool_use') {
      return data.content[0].input
    } else {
      return data.content?.[0]?.text || ''
    }
  }

  /**
   * 调用 OpenAI API
   */
  private async callOpenAI(prompt: string, schema?: z.ZodSchema): Promise<any> {
    const { apiKey, baseURL, model, maxTokens, temperature } = this.config

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    const body: any = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    }

    // OpenAI 的 response_format 参数（需要 gpt-4o 或更新）
    if (schema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          schema: this.zodToJsonSchema(schema),
          strict: true,
        },
      }
    }

    const response = await withTimeout(
      (signal) =>
        fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        }),
      FETCH_TIMEOUT_MS,
    )

    if (!response.ok) {
      throw new Error(`OpenAI API ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    if (schema) {
      return JSON.parse(content)
    }
    return content
  }

  /**
   * 调用本地模型（Ollama）
   */
  private async callLocal(prompt: string, schema?: z.ZodSchema): Promise<any> {
    const { baseURL, model, maxTokens, temperature } = this.config

    const body = {
      model,
      prompt,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    }

    const response = await withTimeout(
      (signal) =>
        fetch(`${baseURL}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        }),
      // 本地模型给更长一些的 timeout
      FETCH_TIMEOUT_MS * 2,
    )

    if (!response.ok) {
      throw new Error(`Local model ${response.status}`)
    }

    const data = await response.json()
    const content = data.response || ''

    if (schema) {
      // 尝试从文本中提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      throw new Error('Local model returned no JSON')
    }

    return content
  }

  /**
   * 将 Zod Schema 转换为 JSON Schema
   * 适配 zod v4：v3 用 _def.typeName，v4 用 _def.type
   * 同时支持：Object / String / Number / Boolean / Array / Enum / Optional / Nullable
   */
  private zodToJsonSchema(schema: z.ZodSchema): any {
    const def = (schema as any)._def
    if (!def) return {}

    // ZodObject
    if (def.type === 'object') {
      const shape = def.shape
      if (!shape || typeof shape !== 'object') return { type: 'object' }

      const properties: any = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(shape)) {
        const field = value as z.ZodSchema
        const { jsonSchema, optional } = this.zodFieldToJsonSchema(field)
        properties[key] = jsonSchema
        if (!optional) required.push(key)
      }

      return {
        type: 'object',
        properties,
        required,
      }
    }

    // 非 Object 顶层 schema
    const { jsonSchema } = this.zodFieldToJsonSchema(schema as any)
    return jsonSchema
  }

  /**
   * 单个 field → JSON Schema
   * 返回 { jsonSchema, optional }，optional 用于父级决定是否加入 required
   */
  private zodFieldToJsonSchema(field: z.ZodSchema): { jsonSchema: any; optional: boolean } {
    const def = (field as any)._def
    if (!def) return { jsonSchema: { type: 'string' }, optional: false }

    const type = def.type

    // Optional 包装：递归处理 innerType
    if (type === 'optional' || type === 'ZodOptional') {
      const inner = this.zodFieldToJsonSchema(def.innerType)
      return { jsonSchema: inner.jsonSchema, optional: true }
    }
    if (type === 'nullable' || type === 'ZodNullable') {
      const inner = this.zodFieldToJsonSchema(def.innerType)
      return { jsonSchema: { ...inner.jsonSchema, nullable: true }, optional: false }
    }

    // 基础类型
    if (type === 'string' || type === 'ZodString') {
      return {
        jsonSchema: { type: 'string', description: def.description },
        optional: false,
      }
    }
    if (type === 'number' || type === 'ZodNumber') {
      const result: any = { type: 'number', description: def.description }
      if (def.minValue !== undefined) result.minimum = def.minValue
      if (def.maxValue !== undefined) result.maximum = def.maxValue
      return { jsonSchema: result, optional: false }
    }
    if (type === 'boolean' || type === 'ZodBoolean') {
      return { jsonSchema: { type: 'boolean' }, optional: false }
    }

    // Array
    if (type === 'array' || type === 'ZodArray') {
      const inner = this.zodFieldToJsonSchema(def.element || def.type)
      return {
        jsonSchema: { type: 'array', items: inner.jsonSchema },
        optional: false,
      }
    }

    // Enum
    if (type === 'enum' || type === 'ZodEnum') {
      // v4: entries 是 object；v3 fallback: values 是 array
      const enumValues = def.entries
        ? Object.values(def.entries)
        : Array.isArray(def.values)
          ? def.values
          : []
      return {
        jsonSchema: { type: 'string', enum: enumValues },
        optional: false,
      }
    }

    // 嵌套 Object
    if (type === 'object' || type === 'ZodObject') {
      return { jsonSchema: this.zodToJsonSchema(field), optional: false }
    }

    // Fallback
    return { jsonSchema: { type: 'string' }, optional: false }
  }

  // ==================== 核心AI能力 ====================

  /**
   * 分析项目质量
   */
  async analyzeProject(project: {
    title: string
    description: string
    repoURL?: string
    demoURL?: string
    tags?: string[]
    submissionData?: Record<string, any>
  }): Promise<ProjectAssessment> {
    const prompt = `你是一位资深的黑客松评委，请评估以下项目：

项目名称：${project.title}
项目描述：${project.description}
${project.repoURL ? `代码仓库：${project.repoURL}` : ''}
${project.demoURL ? `演示地址：${project.demoURL}` : ''}
${project.tags ? `标签：${project.tags.join(', ')}` : ''}

请从以下维度进行评估（每项0-100分）：

1. **完整性 (Completeness)**：项目描述是否清晰、是否有代码仓库和Demo、文档是否完善
2. **创新性 (Innovation)**：解决方案是否新颖、是否有独特的技术或商业视角
3. **技术深度 (Technical Depth)**：技术实现的复杂度、代码质量、技术栈的合理性
4. **呈现质量 (Presentation)**：项目展示是否专业、README质量、界面设计

同时请：
- 列出3-5个项目亮点
- 指出潜在的问题或改进空间
- 推荐评审优先级（high/medium/low）
- 识别使用的技术标签
- 评估项目复杂度（beginner/intermediate/advanced/expert）

请给出综合评分和详细分析。`

    try {
      const result = await this.callAI(prompt, ProjectAssessmentSchema)
      return ProjectAssessmentSchema.parse(result)
    } catch (error: any) {
      console.error('Project analysis failed:', error)
      // 返回默认值，避免阻塞流程
      return {
        overallScore: 50,
        dimensions: {
          completeness: { score: 50, reasoning: 'Analysis unavailable' },
          innovation: { score: 50, reasoning: 'Analysis unavailable' },
          technicalDepth: { score: 50, reasoning: 'Analysis unavailable' },
          presentation: { score: 50, reasoning: 'Analysis unavailable' },
        },
        highlights: ['Analysis currently unavailable'],
        concerns: ['AI analysis failed, manual review recommended'],
        suggestedPriority: 'medium',
        technicalTags: [],
        estimatedComplexity: 'intermediate',
      }
    }
  }

  /**
   * 分析评委评分一致性
   * 关键优化：所有评委的 AI suggestion 调用并发执行，避免 1 个慢请求阻塞整批
   */
  async analyzeScoringConsistency(
    judgeScores: Array<{
      judgeId: string
      judgeName: string
      scores: number[]
    }>,
    avgScore: number
  ): Promise<ScoringConsistency[]> {
    // 1. 纯数学部分（均值/标准差/偏差）先并行计算（map 是同步的但表达清晰）
    const computed = judgeScores.map((judge) => {
      const judgeAvg = judge.scores.reduce((a, b) => a + b, 0) / judge.scores.length
      const variance = judge.scores.reduce((sum, score) => sum + Math.pow(score - judgeAvg, 2), 0) / judge.scores.length
      const stdDev = Math.sqrt(variance)
      const biasScore = judgeAvg - avgScore
      let bias: 'too_strict' | 'too_lenient' | 'balanced' = 'balanced'
      if (biasScore < -10) bias = 'too_strict'
      else if (biasScore > 10) bias = 'too_lenient'
      return { judge, judgeAvg, stdDev, biasScore, bias }
    })

    // 2. AI suggestion 调用全部并行（之前是串行，N 评委要 N 倍延迟）
    const suggestions = await Promise.all(
      computed.map(({ judge, judgeAvg, stdDev, biasScore, bias }) => {
        const prompt = `评委 ${judge.judgeName} 的评分数据：
- 平均分：${judgeAvg.toFixed(1)}（全体平均：${avgScore.toFixed(1)}）
- 标准差：${stdDev.toFixed(1)}
- 偏差：${biasScore.toFixed(1)}分（${bias}）

请为该评委提供简短的评分建议（1-2句话，中文）。`
        return this.callAI(prompt).catch((err) => {
          // 单个评委失败不影响其他人，记 log 返回默认值
          console.error(`Scoring consistency suggestion failed for judge ${judge.judgeId}:`, err)
          return 'AI suggestion unavailable'
        })
      }),
    )

    return computed.map((c, i) => ({
      judgeId: c.judge.judgeId,
      judgeName: c.judge.judgeName,
      avgScore: c.judgeAvg,
      stdDeviation: c.stdDev,
      bias: c.bias,
      biasScore: c.biasScore,
      suggestion: typeof suggestions[i] === 'string' ? (suggestions[i] as string) : '建议保持当前评分标准',
    }))
  }

  /**
   * 内容审核
   */
  async moderateContent(content: string, type: 'project' | 'comment' | 'profile'): Promise<ModerationResult> {
    // 安全：长文本截断，防止用户塞 100K 字符爆 token 烧钱
    const safeContent = truncateForPrompt(content, MAX_INPUT_CHARS)

    const prompt = `请审核以下${type === 'project' ? '项目内容' : type === 'comment' ? '评论' : '用户资料'}是否合适：

内容：${safeContent}

检查以下方面：
1. 是否包含敏感词汇（政治、暴力、色情等）
2. 是否为垃圾信息或广告
3. 是否疑似抄袭或侵权
4. 是否包含仇恨言论
5. 整体是否适合在黑客松平台展示

请判断内容是否合适，列出具体问题（如有），并建议操作（approve/review/reject）。`

    try {
      const result = await this.callAI(prompt, ModerationResultSchema)
      return ModerationResultSchema.parse(result)
    } catch (err) {
      // 保守策略：AI失败时标记为需要审核
      console.error('Moderation failed, fallback to manual review:', err)
      return {
        isAppropriate: false,
        flags: [{ type: 'spam', severity: 'low', description: 'AI moderation unavailable, manual review needed' }],
        suggestedAction: 'review',
      }
    }
  }

  /**
   * 生成内容
   */
  async generateContent(request: ContentGenerationRequest): Promise<string> {
    const { type, context, language = 'zh', style = 'business' } = request

    // 安全：截断长字段，防止恶意 payload 烧 token
    const safe = {
      ...context,
      title: truncateForPrompt(String(context.title ?? ''), 200),
      description: truncateForPrompt(String(context.description ?? ''), 2000),
      original: truncateForPrompt(String(context.original ?? ''), 2000),
      subject: truncateForPrompt(String(context.subject ?? ''), 200),
      scenario: truncateForPrompt(String(context.scenario ?? ''), 1000),
      goal: truncateForPrompt(String(context.goal ?? ''), 500),
      award: truncateForPrompt(String(context.award ?? ''), 200),
      theme: truncateForPrompt(String(context.theme ?? ''), 200),
      focus: truncateForPrompt(String(context.focus ?? ''), 500),
      recipient: truncateForPrompt(String(context.recipient ?? ''), 200),
    }

    const prompts: Record<string, string> = {
      readme: `请为以下项目生成一个完整的README.md文档：
项目名称：${safe.title}
项目描述：${safe.description}
技术栈：${context.techStack?.join(', ') || '未知'}

README应包含：简介、功能特性、技术架构、安装说明、使用示例、贡献指南、许可证。
语言：${language === 'zh' ? '中文' : 'English'}`,

      description: `请优化以下项目描述，使其更专业、清晰、吸引人：
原描述：${safe.original}

目标风格：${style}
语言：${language === 'zh' ? '中文' : 'English'}
字数：200-300字`,

      pitch: `请为以下项目生成一份Pitch Deck大纲（8-10页）：
项目：${safe.title}
描述：${safe.description}
目标：${safe.goal || '参加黑客松比赛'}

大纲应包含：封面、问题陈述、解决方案、技术亮点、Demo展示、团队介绍、未来规划。
语言：${language === 'zh' ? '中文' : 'English'}`,

      news: `请为获奖项目撰写一篇新闻稿：
项目：${safe.title}
奖项：${safe.award}
简介：${safe.description}

新闻稿应包含：标题、导语、项目介绍、评委评价、影响与展望。
语言：${language === 'zh' ? '中文' : 'English'}
字数：500-800字`,

      email: `请撰写一封${safe.subject}的邮件：
收件人：${safe.recipient}
场景：${safe.scenario}

邮件应包含：称呼、正文、行动号召、结尾。
语气：${style}
语言：${language === 'zh' ? '中文' : 'English'}`,

      criteria: `请为主题为"${safe.theme}"的黑客松设计评分标准：
赛事重点：${safe.focus || '技术创新、实用性、完整度'}

请推荐5-7个评分维度，每个维度包含：
- 维度名称
- 权重（总和=100）
- 评分说明

语言：${language === 'zh' ? '中文' : 'English'}`,
    }

    const prompt = prompts[type] || (context.customPrompt ? truncateForPrompt(String(context.customPrompt), MAX_INPUT_CHARS) : undefined)

    if (!prompt) {
      throw new Error(`Unknown content generation type: ${type}`)
    }

    return await this.callAI(prompt)
  }

  /**
   * 检测文本相似度（用于抄袭检测）
   */
  async detectSimilarity(text1: string, text2: string): Promise<number> {
    // 截断大文本：截到 2K 给 prompt（保留头尾 70/20 比例，跟 moderateContent 一致）
    const t1 = truncateForPrompt(text1, 2000)
    const t2 = truncateForPrompt(text2, 2000)

    const prompt = `请比较以下两段文本的相似度（0-100%）：

文本1：
${t1}

文本2：
${t2}

只需返回一个数字（0-100），表示相似度百分比。`

    try {
      const result = await this.callAI(prompt)
      return parseSimilarityScore(result)
    } catch (error) {
      console.error('Similarity detection failed:', error)
      return 0
    }
  }
}

// ==================== 导出 ====================

export { AIService }

// 单例模式
let aiServiceInstance: AIService | null = null

export function getAIService(config?: AIConfig): AIService {
  if (!aiServiceInstance) {
    const defaultConfig: AIConfig = {
      provider: (process.env.AI_PROVIDER as 'claude' | 'openai' | 'local') || 'claude',
      apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
    }
    aiServiceInstance = new AIService({ ...defaultConfig, ...config })
  }
  return aiServiceInstance
}
