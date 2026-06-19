/**
 * AI Service - 统一AI能力接口
 * 支持多模型提供商：Claude (Anthropic)、OpenAI、本地模型
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod'

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

    try {
      if (provider === 'claude') {
        return await this.callClaude(prompt, schema)
      } else if (provider === 'openai') {
        return await this.callOpenAI(prompt, schema)
      } else {
        return await this.callLocal(prompt, schema)
      }
    } catch (error: any) {
      console.error('AI call failed:', error)
      throw new Error(`AI service error: ${error.message}`)
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

    const response = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API error: ${response.status} ${error}`)
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

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
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

    const response = await fetch(`${baseURL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Local model error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.response || ''

    if (schema) {
      // 尝试从文本中提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      throw new Error('Failed to extract JSON from local model response')
    }

    return content
  }

  /**
   * 将 Zod Schema 转换为 JSON Schema
   */
  private zodToJsonSchema(schema: z.ZodSchema): any {
    // 简化版本，生产环境建议使用 zod-to-json-schema 库
    const shape = (schema as any)._def?.shape?.()
    if (!shape) return {}

    const properties: any = {}
    const required: string[] = []

    for (const [key, value] of Object.entries(shape)) {
      const field = value as z.ZodSchema
      properties[key] = this.zodFieldToJsonSchema(field)
      if (!field.isOptional()) {
        required.push(key)
      }
    }

    return {
      type: 'object',
      properties,
      required,
    }
  }

  private zodFieldToJsonSchema(field: z.ZodSchema): any {
    const typeName = (field as any)._def?.typeName

    if (typeName === 'ZodString') {
      return { type: 'string', description: (field as any)._def?.description }
    }
    if (typeName === 'ZodNumber') {
      return { type: 'number', description: (field as any)._def?.description }
    }
    if (typeName === 'ZodBoolean') {
      return { type: 'boolean' }
    }
    if (typeName === 'ZodArray') {
      return {
        type: 'array',
        items: this.zodFieldToJsonSchema((field as any)._def?.type),
      }
    }
    if (typeName === 'ZodEnum') {
      return { type: 'string', enum: (field as any)._def?.values }
    }
    if (typeName === 'ZodObject') {
      return this.zodToJsonSchema(field)
    }

    return { type: 'string' }
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
   */
  async analyzeScoringConsistency(
    judgeScores: Array<{
      judgeId: string
      judgeName: string
      scores: number[]
    }>,
    avgScore: number
  ): Promise<ScoringConsistency[]> {
    const analyses: ScoringConsistency[] = []

    for (const judge of judgeScores) {
      const judgeAvg = judge.scores.reduce((a, b) => a + b, 0) / judge.scores.length
      const variance = judge.scores.reduce((sum, score) => sum + Math.pow(score - judgeAvg, 2), 0) / judge.scores.length
      const stdDev = Math.sqrt(variance)

      const biasScore = judgeAvg - avgScore
      let bias: 'too_strict' | 'too_lenient' | 'balanced' = 'balanced'
      if (biasScore < -10) bias = 'too_strict'
      else if (biasScore > 10) bias = 'too_lenient'

      const prompt = `评委 ${judge.judgeName} 的评分数据：
- 平均分：${judgeAvg.toFixed(1)}（全体平均：${avgScore.toFixed(1)}）
- 标准差：${stdDev.toFixed(1)}
- 偏差：${biasScore.toFixed(1)}分（${bias}）

请为该评委提供简短的评分建议（1-2句话，中文）。`

      const suggestion = await this.callAI(prompt)

      analyses.push({
        judgeId: judge.judgeId,
        judgeName: judge.judgeName,
        avgScore: judgeAvg,
        stdDeviation: stdDev,
        bias,
        biasScore,
        suggestion: typeof suggestion === 'string' ? suggestion : '建议保持当前评分标准',
      })
    }

    return analyses
  }

  /**
   * 内容审核
   */
  async moderateContent(content: string, type: 'project' | 'comment' | 'profile'): Promise<ModerationResult> {
    const prompt = `请审核以下${type === 'project' ? '项目内容' : type === 'comment' ? '评论' : '用户资料'}是否合适：

内容：${content}

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
    } catch {
      // 保守策略：AI失败时标记为需要审核
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

    const prompts: Record<string, string> = {
      readme: `请为以下项目生成一个完整的README.md文档：
项目名称：${context.title}
项目描述：${context.description}
技术栈：${context.techStack?.join(', ') || '未知'}

README应包含：简介、功能特性、技术架构、安装说明、使用示例、贡献指南、许可证。
语言：${language === 'zh' ? '中文' : 'English'}`,

      description: `请优化以下项目描述，使其更专业、清晰、吸引人：
原描述：${context.original}

目标风格：${style}
语言：${language === 'zh' ? '中文' : 'English'}
字数：200-300字`,

      pitch: `请为以下项目生成一份Pitch Deck大纲（8-10页）：
项目：${context.title}
描述：${context.description}
目标：${context.goal || '参加黑客松比赛'}

大纲应包含：封面、问题陈述、解决方案、技术亮点、Demo展示、团队介绍、未来规划。
语言：${language === 'zh' ? '中文' : 'English'}`,

      news: `请为获奖项目撰写一篇新闻稿：
项目：${context.title}
奖项：${context.award}
简介：${context.description}

新闻稿应包含：标题、导语、项目介绍、评委评价、影响与展望。
语言：${language === 'zh' ? '中文' : 'English'}
字数：500-800字`,

      email: `请撰写一封${context.subject}的邮件：
收件人：${context.recipient}
场景：${context.scenario}

邮件应包含：称呼、正文、行动号召、结尾。
语气：${style}
语言：${language === 'zh' ? '中文' : 'English'}`,

      criteria: `请为主题为"${context.theme}"的黑客松设计评分标准：
赛事重点：${context.focus || '技术创新、实用性、完整度'}

请推荐5-7个评分维度，每个维度包含：
- 维度名称
- 权重（总和=100）
- 评分说明

语言：${language === 'zh' ? '中文' : 'English'}`,
    }

    const prompt = prompts[type] || context.customPrompt

    if (!prompt) {
      throw new Error(`Unknown content generation type: ${type}`)
    }

    return await this.callAI(prompt)
  }

  /**
   * 检测文本相似度（用于抄袭检测）
   */
  async detectSimilarity(text1: string, text2: string): Promise<number> {
    const prompt = `请比较以下两段文本的相似度（0-100%）：

文本1：
${text1.substring(0, 1000)}

文本2：
${text2.substring(0, 1000)}

只需返回一个数字（0-100），表示相似度百分比。`

    try {
      const result = await this.callAI(prompt)
      const similarity = parseInt(result.toString().match(/\d+/)?.[0] || '0')
      return Math.min(100, Math.max(0, similarity))
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
