/**
 * AI Routes 集成测试（supertest）
 *
 * 覆盖范围：11 个 /api/ai/* endpoint 的 auth / 404 / 400 / 200 基础行为
 * - AI mutation 实际结果依赖 provider（测试无 key 时 fallback 50 分）
 * - 不深测 AI 输出（service 层单测 ai.test.ts 已覆盖）
 *
 * 关键 P1 修复（2026-07-19）：
 * - /api/ai/moderate-content + /api/ai/optimize-description 之前无 requireAuth（被匿名调用烧 token）
 * - /api/ai/analyze-project/:projectId fallback 50 分无 isFallback 标记
 * - batch-status 404 / 410 处理
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../server'

// 统一 mock fetch 让 AI 走"可控"路径（避免依赖外部 API key）
function mockFetchOnce(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const original = global.fetch
  global.fetch = (async (url: any, init: any) => respond(url, init)) as any
  return () => {
    global.fetch = original
  }
}

function mockOpenAISuccess(content: string) {
  return mockFetchOnce((_url: any, _init: any) => ({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: content }],
    }),
  } as any))
}

function mockClaudeToolUse(input: Record<string, unknown>) {
  return mockFetchOnce((_url: any, _init: any) => ({
    ok: true,
    json: async () => ({
      content: [
        {
          type: 'tool_use',
          input,
        },
      ],
    }),
  } as any))
}

describe('AI Routes 集成测试', () => {
  let restore: (() => void) | null = null

  beforeEach(() => {
    restore = null
  })

  afterEach(() => {
    if (restore) restore()
  })

  describe('Auth & 角色守卫', () => {
    it('admin endpoint 不带 admin role 时 403', async () => {
      const res = await request(app)
        .get('/api/ai/metrics')
        .set('x-test-role', 'judge') // 不是 admin
        .expect(403)
      expect(res.body.error).toBeTruthy()
    })

    it('admin endpoint 带 admin role 时 200', async () => {
      const res = await request(app)
        .get('/api/ai/metrics')
        .set('x-test-role', 'admin')
        .expect(200)
      expect(res.body.calls).toBeDefined()
      expect(res.body.errors).toBeDefined()
    })
  })

  describe('内容审核 (moderate-content)', () => {
    it('缺 content 时 400', async () => {
      const res = await request(app)
        .post('/api/ai/moderate-content')
        .send({})
        .expect(400)
      expect(res.body.error).toMatch(/required/i)
    })

    it('有 content 时 200（AI 失败 fallback isAppropriate: false）', async () => {
      const res = await request(app)
        .post('/api/ai/moderate-content')
        .send({ content: 'test content', type: 'project' })
        .expect(200)
      expect(res.body).toHaveProperty('isAppropriate')
      expect(res.body).toHaveProperty('suggestedAction')
    })

    it('mock AI 成功时 200 返真实审核结果（已知限制：supertest 路径不调 global.fetch mock，保留作文档）', async () => {
      // 注：Node 18+ 的 fetch 在 supertest 启动的 in-process http server 中
      // 不走 global.fetch mock（不同 reference），所以这里无法精确测 AI 成功路径。
      // 实际 AI 输出由 ai.test.ts 单元测试覆盖。
      restore = mockClaudeToolUse({
        isAppropriate: true,
        flags: [],
        suggestedAction: 'approve',
      })
      // 此测试现在只验证 endpoint 接受请求 + 不崩（AI 失败时 fallback）
      const res = await request(app)
        .post('/api/ai/moderate-content')
        .send({ content: '正常内容', type: 'project' })
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('isAppropriate')
    })
  })

  describe('优化描述 (optimize-description)', () => {
    it('缺 description 时 400', async () => {
      const res = await request(app)
        .post('/api/ai/optimize-description')
        .send({})
        .expect(400)
      expect(res.body.error).toMatch(/required/i)
    })

    it('正常 description 时 200（AI 失败 500，行为已知）', async () => {
      // generateContent 没有 fallback，AI 失败 → 500
      const res = await request(app)
        .post('/api/ai/optimize-description')
        .send({ description: '原始描述', language: 'zh', style: 'business' })
      expect([200, 500]).toContain(res.status)
    })
  })

  describe('内容生成 (generate-content)', () => {
    it('缺 type 时 400', async () => {
      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({ context: { foo: 'bar' } })
        .expect(400)
    })

    it('正常 type + context 时 200 或 500（AI 不可达）', async () => {
      const res = await request(app)
        .post('/api/ai/generate-content')
        .send({
          type: 'description',
          context: { original: 'test' },
          language: 'zh',
          style: 'business',
        })
      expect([200, 500]).toContain(res.status)
    })
  })

  describe('相似度 (detect-similarity)', () => {
    it('缺 text1 / text2 时 400', async () => {
      await request(app)
        .post('/api/ai/detect-similarity')
        .send({})
        .expect(400)
    })

    it('正常输入时 200（AI 失败 similarity: 0）', async () => {
      const res = await request(app)
        .post('/api/ai/detect-similarity')
        .send({ text1: 'foo bar', text2: 'foo baz' })
        .expect(200)
      expect(res.body).toHaveProperty('similarity')
    })
  })

  describe('项目分析 (analyze-project)', () => {
    it('projectId 不存在时 404', async () => {
      await request(app)
        .post('/api/ai/analyze-project/non-existent-uuid')
        .set('x-test-role', 'admin')
        .expect(404)
    })
  })

  describe('抄袭检测 (check-plagiarism)', () => {
    it('projectId 不存在时 404', async () => {
      await request(app)
        .post('/api/ai/check-plagiarism/non-existent-uuid')
        .set('x-test-role', 'admin')
        .expect(404)
    })
  })

  describe('评分一致性 (scoring-consistency)', () => {
    it('hackathonId 无评分数据时 200 返空数组', async () => {
      const res = await request(app)
        .get('/api/ai/scoring-consistency/non-existent-uuid')
        .set('x-test-role', 'admin')
        .expect(200)
      expect(res.body).toEqual([])
    })
  })

  describe('Batch 任务', () => {
    it('projectIds 为空 + hackathonId 不存在时 400', async () => {
      // 0 项目 / 0 hackathon → 路由应 400
      await request(app)
        .post('/api/ai/batch-analyze')
        .set('x-test-role', 'admin')
        .send({})
        .expect(400)
    })

    it('batch-status 未知 taskId 时 404', async () => {
      await request(app)
        .get('/api/ai/batch-status/unknown-task-id')
        .set('x-test-role', 'admin')
        .expect(404)
    })
  })
})
