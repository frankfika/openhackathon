/**
 * AI Service 单元测试
 *
 * 覆盖：
 * - parseSimilarityScore: AI 自由文本相似度数字提取
 * - truncateForPrompt: 大输入截断（保留头尾语义）
 * - safeErrorMessage: 错误脱敏（不暴露内部 API 错误）
 * - AIMetrics: 计数器行为
 *
 * 这些 helper 都是同步纯函数，测试不需要 prisma / fetch。
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { describe, it, expect, beforeEach } from 'vitest'

// 重要：必须在 import 之前设置 ANTHROPIC_API_KEY，否则 getAIService 构造会失败
// （我们这里只测 helper，不需要 AI provider，但 getAIService 单例可能被其它测试触发）
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-for-unit-tests'

import { truncateForPrompt, parseSimilarityScore, AIMetrics } from '../services/ai'

describe('parseSimilarityScore', () => {
  it('extracts plain integer', () => {
    expect(parseSimilarityScore('75')).toBe(75)
  })

  it('extracts from "X%" format', () => {
    expect(parseSimilarityScore('约 75%')).toBe(75)
    expect(parseSimilarityScore('相似度：30%')).toBe(30)
  })

  it('handles "X-Y 范围" format (returns lower bound)', () => {
    // 老逻辑只会取第一个数字 75，新逻辑也取 75（因为下一个 80 在 [0,100] 内，但取第一个匹配的）
    // 实际上两个都在范围内，但我们要看 regex 行为
    expect(parseSimilarityScore('相似度 75-80 之间')).toBe(75)
  })

  it('handles decimal percentages by taking integer part', () => {
    expect(parseSimilarityScore('30.5%')).toBe(30)
    expect(parseSimilarityScore('similarity: 45.8%')).toBe(45)
  })

  it('returns 0 for no numbers', () => {
    expect(parseSimilarityScore('无明显相似')).toBe(0)
    expect(parseSimilarityScore('这两段文本完全不同')).toBe(0)
  })

  it('returns 0 for empty input', () => {
    expect(parseSimilarityScore('')).toBe(0)
    expect(parseSimilarityScore(null)).toBe(0)
    expect(parseSimilarityScore(undefined)).toBe(0)
  })

  it('ignores out-of-range numbers', () => {
    // 200 不在 0-100 范围，应该被跳过
    expect(parseSimilarityScore('状态码 200 相似度 45')).toBe(45)
  })

  it('handles numbers with surrounding text', () => {
    expect(parseSimilarityScore('The similarity score is 82 out of 100')).toBe(82)
  })

  it('regression: original buggy code took first digit', () => {
    // 老代码: text.match(/\d+/)?.[0]
    // 新代码: regex 提取所有数字，pick 第一个 [0,100] 范围
    // 这个 case: 第一个数字是 1500（API token 数），不是相似度
    // 新代码会跳过 1500（>100）取 75
    expect(parseSimilarityScore('token 1500 similarity 75')).toBe(75)
  })
})

describe('truncateForPrompt', () => {
  it('returns empty for empty input', () => {
    expect(truncateForPrompt('')).toBe('')
  })

  it('returns unchanged for short input', () => {
    const short = 'Hello world'
    expect(truncateForPrompt(short)).toBe(short)
  })

  it('truncates long input and adds marker', () => {
    const long = 'a'.repeat(2000)
    const result = truncateForPrompt(long, 1000)
    expect(result).toContain('[...truncated')
    expect(result.length).toBeLessThan(long.length)
    // 头尾保留：开头 a 应该出现，结尾 a 也应该出现
    expect(result.startsWith('aaa')).toBe(true)
    expect(result.endsWith('aaa')).toBe(true)
  })

  it('truncates default to 10K', () => {
    const long = 'x'.repeat(15000)
    const result = truncateForPrompt(long)
    expect(result.length).toBeLessThan(long.length)
    expect(result).toContain('[...truncated 5000 chars...]')
  })

  it('handles null/undefined gracefully', () => {
    expect(truncateForPrompt(null as any)).toBe('')
    expect(truncateForPrompt(undefined as any)).toBe('')
  })
})

describe('AIMetrics', () => {
  beforeEach(() => {
    AIMetrics.reset()
  })

  it('starts at zero', () => {
    const snap = AIMetrics.snapshot()
    expect(snap.calls.claude).toBe(0)
    expect(snap.calls.openai).toBe(0)
    expect(snap.calls.local).toBe(0)
    expect(snap.avgDurationMs).toBe(0)
  })

  it('snapshot is independent of internal state', () => {
    // snapshot 应该返回拷贝，避免外部修改影响内部状态
    const snap = AIMetrics.snapshot()
    snap.calls.claude = 999
    expect(AIMetrics.snapshot().calls.claude).toBe(0)
  })

  it('reset clears all counters', () => {
    AIMetrics.calls.claude = 5
    AIMetrics.errors.timeout = 3
    AIMetrics.totalDurationMs = 1000
    AIMetrics.reset()
    expect(AIMetrics.calls.claude).toBe(0)
    expect(AIMetrics.errors.timeout).toBe(0)
    expect(AIMetrics.totalDurationMs).toBe(0)
  })
})

describe('AI Service 集成行为（mock fetch）', () => {
  it('detectSimilarity 走 truncateForPrompt 路径', async () => {
    // 验证大输入不会爆 token
    const originalFetch = global.fetch
    let fetchCalled = false
    let capturedBody: any = null

    global.fetch = (async (_url: any, init: any) => {
      fetchCalled = true
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '42' }],
        }),
      } as any
    }) as any

    try {
      const { getAIService } = await import('../services/ai')
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      const longText = 'x'.repeat(5000)
      const similarity = await service.detectSimilarity(longText, longText)
      expect(fetchCalled).toBe(true)
      expect(similarity).toBe(42)
      // 输入被截断到 2K * 0.7 = 1.4K 头 + 2K * 0.2 = 400 尾 + marker
      expect(capturedBody.messages[0].content.length).toBeLessThan(5000)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('moderateContent 长文本被截断（不会爆 token）', async () => {
    const originalFetch = global.fetch
    let capturedBody: any = null

    global.fetch = (async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'tool_use',
              input: {
                isAppropriate: true,
                flags: [],
                suggestedAction: 'approve',
              },
            },
          ],
        }),
      } as any
    }) as any

    try {
      const { getAIService } = await import('../services/ai')
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      const longText = 'y'.repeat(50000)
      const result = await service.moderateContent(longText, 'project')
      expect(result.isAppropriate).toBe(true)
      expect(result.suggestedAction).toBe('approve')
      // 50K 输入应被截断
      expect(capturedBody.messages[0].content.length).toBeLessThan(50000)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('fetch 超时抛 AbortError，被分类为 timeout metric', async () => {
    // P0 fix (verifier 2026-07-19)：这个测试之前是 circular — 用了
    // setImmediate(reject(AbortError)) 模拟，但 withTimeout 的 30s setTimeout
    // 根本来不及触发就 reject 了，跟 timer 触发 abort 没关系。
    //
    // 现在改用 withTimeout 直接测：传 timeoutMs=50，模拟 fetch 永远 hang
    // （never resolve 的 promise），证明 50ms 后 timer 真的触发 abort。
    const { withTimeout } = await import('../services/ai')

    AIMetrics.reset()

    // 模拟 hang 的 fetch：返回的 promise 永远不 resolve，但监听 signal
    // signal 一旦 abort，立即 reject 一个 AbortError
    const hangingFetch = (signal: AbortSignal) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'))
        })
        // 故意不挂任何 resolve / setTimeout
      })

    const start = Date.now()
    let caughtError: Error | null = null
    try {
      await withTimeout(hangingFetch, 50)
    } catch (err) {
      caughtError = err as Error
    }
    const elapsed = Date.now() - start

    // 核心断言：
    // 1. 真抛了 AbortError（不是 timeout，是 abort 路径）
    expect(caughtError).not.toBeNull()
    expect(caughtError!.name).toBe('AbortError')

    // 2. 真的等了 ≥ 50ms 才 abort（证明 timer 触发了，不是 setImmediate 立即 reject）
    // 留 10ms buffer 给 setTimeout 调度
    expect(elapsed).toBeGreaterThanOrEqual(45)
    expect(elapsed).toBeLessThan(500) // 远小于 withTimeout 默认 30s
  })

  it('withTimeout 在 fetch 提前返回时正常返回（不误 abort）', async () => {
    const { withTimeout } = await import('../services/ai')

    // 模拟 10ms 完成的 fetch
    const quickFetch = async (_signal: AbortSignal) => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    } as Response)

    const result = await withTimeout(quickFetch, 1000)
    expect(result.ok).toBe(true)
  })

  it('callAI 真超时路径 → metrics.errors.timeout +1', async () => {
    // 集成测试：mock fetch 模拟 hang，callAI 走真 withTimeout（30s）会
    // 抛 AbortError，被 catch 分到 timeout 分类。
    // 用 1s timeout 加速（覆盖 default FETCH_TIMEOUT_MS=30s）
    const { getAIService, withTimeout: wt } = await import('../services/ai')
    // 重写 module-level const 的替代：直接构造一个 callClaude 路径很难
    // 改测更直接：metrics 在 AbortError 时 +1 timeout。
    // 这里通过 AIService 的 callAI 间接验证。
    AIMetrics.reset()

    const originalFetch = global.fetch
    global.fetch = ((url: any, init: any) => {
      // 模拟 hang：监听 abort signal，触发后 reject
      return wt((signal) => {
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
      }, 50) // 50ms 超时，足够 abort 触发
    }) as any

    try {
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      try {
        await (service as any).callAI('test prompt')
      } catch {
        // 预期抛
      }
      const snap = AIMetrics.snapshot()
      expect(snap.errors.timeout).toBeGreaterThanOrEqual(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('analyzeScoringConsistency 并行执行（不串行等待）', async () => {
    const originalFetch = global.fetch
    AIMetrics.reset()

    let inflightCount = 0
    let maxInflight = 0
    let callCount = 0

    global.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(init.body)
      // 跳过 structure 化的 tools call（schema mode），只处理纯文本 suggestion
      if (body.tools) {
        // schema 化请求，返回合规的 result（用 tool_use 格式）
        return {
          ok: true,
          json: async () => ({
            content: [
              {
                type: 'tool_use',
                input: {
                  overallScore: 70,
                  dimensions: {
                    completeness: { score: 70, reasoning: 'ok' },
                    innovation: { score: 70, reasoning: 'ok' },
                    technicalDepth: { score: 70, reasoning: 'ok' },
                    presentation: { score: 70, reasoning: 'ok' },
                  },
                  highlights: [],
                  concerns: [],
                  suggestedPriority: 'medium',
                  technicalTags: [],
                  estimatedComplexity: 'intermediate',
                },
              },
            ],
          }),
        } as any
      }

      // 纯文本 suggestion 请求 - 模拟 100ms 延迟
      inflightCount++
      maxInflight = Math.max(maxInflight, inflightCount)
      callCount++
      await new Promise((r) => setTimeout(r, 100))
      inflightCount--
      return {
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: `建议${callCount}` }],
        }),
      } as any
    }) as any

    try {
      const { getAIService } = await import('../services/ai')
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })

      // 5 个评委，串行需要 500ms，并行应该 ≤ 200ms
      const judgeScores = Array.from({ length: 5 }, (_, i) => ({
        judgeId: `j${i}`,
        judgeName: `Judge ${i}`,
        scores: [70, 80, 75, 85, 90],
      }))

      const start = Date.now()
      const result = await service.analyzeScoringConsistency(judgeScores, 80)
      const elapsed = Date.now() - start

      expect(result).toHaveLength(5)
      // 串行要 500ms，并行 < 250ms 是合理阈值
      expect(elapsed).toBeLessThan(450)
      // 关键：确实有并发了（maxInflight > 1）
      expect(maxInflight).toBeGreaterThan(1)
    } finally {
      global.fetch = originalFetch
    }
  })

  it('zodToJsonSchema 支持 zod v4 API（修复 v3→v4 升级遗留 bug）', async () => {
    // 这个 bug 关键：v3 用 _def.typeName，v4 用 _def.type；v3 shape() 是 function，v4 shape 是 object。
    // 之前 v2.1 AI 系统在 zod v4 下 schema 模式 100% 失败，默默 fallback。
    const { getAIService } = await import('../services/ai')
    const service = getAIService({ provider: 'claude', apiKey: 'test-key' })

    // 通过间接路径触发：调 moderateContent，会走 schema mode
    const originalFetch = global.fetch
    let capturedBody: any = null
    global.fetch = (async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'tool_use',
              input: {
                isAppropriate: true,
                flags: [{ type: 'spam', severity: 'low', description: 'test' }],
                suggestedAction: 'approve',
              },
            },
          ],
        }),
      } as any
    }) as any

    try {
      const result = await (service as any).moderateContent('some content', 'project')
      // 如果 zodToJsonSchema 失败，result 会是 fallback (isAppropriate: false)
      expect(result.isAppropriate).toBe(true)
      // 关键：body.tools 必须有合法的 input_schema（zodToJsonSchema 没崩才传进去）
      expect(capturedBody.tools).toBeDefined()
      expect(capturedBody.tools[0].input_schema).toBeDefined()
      // ModerationResultSchema 有 flags 数组 + nested object
      const schema = capturedBody.tools[0].input_schema
      expect(schema.type).toBe('object')
      expect(schema.properties.flags).toBeDefined()
      expect(schema.properties.flags.type).toBe('array')
      expect(schema.properties.suggestedAction).toBeDefined()
      // enum 在 v4 下应该正确展开
      expect(schema.properties.suggestedAction.enum).toEqual(['approve', 'review', 'reject'])
    } finally {
      global.fetch = originalFetch
    }
  })
})

// ==================== P1 补充测试 ====================
// 覆盖 verifier (2026-07-19) 标记的边界 case

describe('parseSimilarityScore 边界（verifier P1 补充）', () => {
  it('闭区间上限 100', () => {
    expect(parseSimilarityScore('100')).toBe(100)
    expect(parseSimilarityScore('100%')).toBe(100)
  })

  it('闭区间下限 0', () => {
    expect(parseSimilarityScore('0')).toBe(0)
    expect(parseSimilarityScore('0%')).toBe(0)
  })

  it('101 越界（应被跳过）', () => {
    // 101 不在 [0,100]，pick 第一个匹配的
    expect(parseSimilarityScore('101')).toBe(0) // 唯一数字 101 越界，return 0
  })

  it('多负数（应返回第一个匹配 [0,100] 的）', () => {
    // "-50% 75%" — regex \b 配 "50"（不在负号后），50 在 [0,100] → return 50
    expect(parseSimilarityScore('-50% 75%')).toBe(50)
  })

  it('200 状态码 + 45 相似度 → 跳 200 取 45', () => {
    expect(parseSimilarityScore('HTTP 200, similarity 45%')).toBe(45)
  })
})

describe('truncateForPrompt 边界（verifier P1 补充）', () => {
  it('maxChars=0 不应崩', () => {
    // Math.floor(0 * 0.7) = 0, slice(0, 0) = "", slice(-0) = slice(0) = ""
    // 但 text.length - maxChars = 100 - 0 = 100，会显示 "[...truncated 100 chars...]"
    const result = truncateForPrompt('a'.repeat(100), 0)
    // 实际行为：返回 "[...truncated 100 chars...]"（head/tail 都是空）
    expect(result).toContain('[...truncated 100 chars...]')
  })

  it('maxChars 负数会显示 "truncated" 信息（不崩）', () => {
    // Math.floor(-1 * 0.7) = -1（实际是 -0.7 向下取整 = -1）
    // slice(0, -1) 拿掉最后一个字符
    // slice(-Math.floor(-1 * 0.2)) = slice(-Math.floor(-0.2)) = slice(0) = ""
    // text.length - maxChars = 100 - (-1) = 101
    const result = truncateForPrompt('a'.repeat(100), -1)
    // 关键：不能崩
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('safeErrorMessage 4 分支（verifier P1 补充）', () => {
  // safeErrorMessage 是 module-private，需要通过 callAI 间接测
  it('AbortError → "AI service timeout"', async () => {
    const { getAIService } = await import('../services/ai')
    const originalFetch = global.fetch
    global.fetch = (() =>
      new Promise<Response>((_resolve, reject) => {
        // 立即 reject 一个 AbortError（不挂 timer，绕过 withTimeout）
        setImmediate(() => reject(new DOMException('Aborted', 'AbortError')))
      })) as any

    try {
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      try {
        await (service as any).callAI('test')
        expect.fail('should have thrown')
      } catch (err: any) {
        expect(err.message).toBe('AI service timeout')
      }
    } finally {
      global.fetch = originalFetch
    }
  })

  it('fetch failed → "AI service unreachable"', async () => {
    const { getAIService } = await import('../services/ai')
    const originalFetch = global.fetch
    global.fetch = (() => Promise.reject(new TypeError('fetch failed'))) as any

    try {
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      try {
        await (service as any).callAI('test')
        expect.fail('should have thrown')
      } catch (err: any) {
        expect(err.message).toBe('AI service unreachable')
      }
    } finally {
      global.fetch = originalFetch
    }
  })

  it('API key missing → "AI service misconfigured"', async () => {
    // 测法：mock fetch reject 一个含 "API key" 的错误，
    // safeErrorMessage 看到 "API key" → 映射到 "AI service misconfigured"
    const { getAIService } = await import('../services/ai')
    const originalFetch = global.fetch
    global.fetch = (() => Promise.reject(new Error('Invalid API key: sk-ant-...'))) as any

    try {
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      try {
        await (service as any).callAI('test')
        expect.fail('should have thrown')
      } catch (err: any) {
        expect(err.message).toBe('AI service misconfigured')
      }
    } finally {
      global.fetch = originalFetch
    }
  })

  it('其他错误 → "AI service error"', async () => {
    const { getAIService } = await import('../services/ai')
    const originalFetch = global.fetch
    global.fetch = (() => Promise.reject(new Error('some other random failure'))) as any

    try {
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      try {
        await (service as any).callAI('test')
        expect.fail('should have thrown')
      } catch (err: any) {
        expect(err.message).toBe('AI service error')
      }
    } finally {
      global.fetch = originalFetch
    }
  })
})

describe('zodToJsonSchema 嵌套 + enum + array（verifier P1 补充）', () => {
  it('ProjectAssessmentSchema 包含 technicalTags 数组 + estimatedComplexity enum', async () => {
    // 测法：通过 analyzeProject mock fetch，捕获 input_schema 验证
    const { getAIService, ProjectAssessmentSchema } = await import('../services/ai')
    const originalFetch = global.fetch
    let capturedBody: any = null
    global.fetch = (async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'tool_use',
              input: {
                overallScore: 80,
                dimensions: {
                  completeness: { score: 80, reasoning: 'r' },
                  innovation: { score: 80, reasoning: 'r' },
                  technicalDepth: { score: 80, reasoning: 'r' },
                  presentation: { score: 80, reasoning: 'r' },
                },
                highlights: [],
                concerns: [],
                suggestedPriority: 'high',
                technicalTags: ['React', 'TypeScript'],
                estimatedComplexity: 'intermediate',
              },
            },
          ],
        }),
      } as any
    }) as any

    try {
      const service = getAIService({ provider: 'claude', apiKey: 'test-key' })
      await (service as any).analyzeProject({
        title: 'Test',
        description: 'Test project',
      })
      // 验证 ProjectAssessmentSchema 转换正确
      const schema = capturedBody.tools[0].input_schema
      expect(schema.properties.technicalTags).toBeDefined()
      expect(schema.properties.technicalTags.type).toBe('array')
      expect(schema.properties.technicalTags.items).toBeDefined()
      expect(schema.properties.technicalTags.items.type).toBe('string')
      // enum estimatedComplexity
      expect(schema.properties.estimatedComplexity.enum).toEqual([
        'beginner',
        'intermediate',
        'advanced',
        'expert',
      ])
      // 嵌套 object dimensions
      expect(schema.properties.dimensions.type).toBe('object')
      expect(schema.properties.dimensions.properties.completeness).toBeDefined()
    } finally {
      global.fetch = originalFetch
    }
    // 防止 ProjectAssessmentSchema 引用未使用警告
    void ProjectAssessmentSchema
  })
})
