# AI 功能 API 文档（v2.2）

> 所有 AI 相关 endpoint 的完整文档：路径、auth、请求、响应、错误。
> 配合 `AI_FEATURES_CHANGELOG.md`（改动历史）+ `AI_FEATURES_UX.md`（UX 设计）阅读。

## 端点总览

| 端点 | Method | Auth | 说明 |
|---|---|---|---|
| `/api/ai/analyze-project/:projectId` | POST | admin | 单项目质量评估（24h 缓存） |
| `/api/ai/batch-analyze` | POST | admin | 批量项目分析（异步任务，5 并发） |
| `/api/ai/batch-status/:taskId` | GET | admin | 查 batch 任务进度 |
| `/api/ai/scoring-consistency/:hackathonId` | GET | admin | 评委评分一致性分析 |
| `/api/ai/generate-content` | POST | user | 通用内容生成（README / pitch / news / email / criteria） |
| `/api/ai/optimize-description` | POST | user | 优化项目描述 |
| `/api/ai/moderate-content` | POST | user | 内容安全审核 |
| `/api/ai/detect-similarity` | POST | admin | 两段文本相似度 |
| `/api/ai/check-plagiarism/:projectId` | POST | admin | 项目抄袭检测（pairwise 并发） |
| `/api/ai/judge-suggestions/:assignmentId` | GET | admin/assigned-judge | 评委智能建议 |
| `/api/ai/metrics` | GET | admin | AI 运行状态 metrics |

> Auth 列：`admin` = `requireAuth + requireAdmin`，`user` = `requireAuth`，`admin/assigned-judge` = 任一即可。

---

## 1. `POST /api/ai/analyze-project/:projectId`

分析单项目质量，返回 0-100 评分 + 4 维度详情。

**请求**：
- Path: `projectId` (string, required)
- Body: `{ force?: boolean }` (optional, 跳过 24h 缓存)

**响应 200**：
```json
{
  "overallScore": 78,
  "dimensions": {
    "completeness": { "score": 80, "reasoning": "..." },
    "innovation": { "score": 75, "reasoning": "..." },
    "technicalDepth": { "score": 82, "reasoning": "..." },
    "presentation": { "score": 70, "reasoning": "..." }
  },
  "highlights": ["亮点 1", "亮点 2"],
  "concerns": ["潜在问题 1"],
  "suggestedPriority": "high" | "medium" | "low",
  "technicalTags": ["React", "PostgreSQL"],
  "estimatedComplexity": "beginner" | "intermediate" | "advanced" | "expert",
  "cached": false
}
```

**错误**：
- 404: Project not found
- 500: `{ error: "AI analysis failed" }` （脱敏，不暴露内部信息）

**Notes**：
- 缓存：DB 存 `AIAssessment` 表，24h 内的 `quality_assessment` 记录直接返回，附 `cached: true`
- 失败 fallback：AI 调用失败时返回 50 分 + 默认维度，DB 不写入
- v2.2 修复：zod v4 schema 转换 bug 后，**这是真 AI 评分**（v2.1 永远返回 fallback）

---

## 2. `POST /api/ai/batch-analyze`

批量分析（异步），返回 taskId，client 轮询 `/batch-status/:taskId` 查进度。

**请求**：
```json
{
  "projectIds": ["uuid1", "uuid2"],  // 可选
  "hackathonId": "uuid"               // 可选，如果没 projectIds 则分析该 hackathon 所有项目
}
```

**响应 200（立即返回）**：
```json
{
  "message": "Started analyzing 50 projects",
  "taskId": "task-1721400000000-abc123",
  "status": "processing",
  "total": 50
}
```

**行为**：
- 创建 `BATCH_TASKS` Map entry（TTL 1h 自动清理）
- 异步启动 5 个并发 worker，每个 worker cursor 轮询
- 任务 status: `processing` → `completed` | `failed`
- 任务结束（`finishedAt` 记录）后保留 1h，过期被 `setInterval` 清理

**错误**：
- 400: `No projects to analyze` (projectIds 空且 hackathonId 无项目)
- 500: `{ error: "Batch analysis failed" }`

---

## 3. `GET /api/ai/batch-status/:taskId`

查批量任务进度。

**响应 200**：
```json
{
  "taskId": "task-1721400000000-abc123",
  "status": "processing" | "completed" | "failed",
  "total": 50,
  "completed": 30,
  "failed": 2,
  "progress": 64,  // 百分比
  "startedAt": 1721400000000,
  "finishedAt": 1721400050000,  // 可选
  "errors": [  // 最多 20 条，消息已脱敏
    { "projectId": "uuid", "message": "Per-project analysis failed" }
  ]
}
```

**错误**：
- 404: `{ error: "Task not found or expired" }`

---

## 4. `GET /api/ai/scoring-consistency/:hackathonId`

评委评分一致性分析。

**响应 200**：
```json
[
  {
    "judgeId": "uuid",
    "judgeName": "张三",
    "avgScore": 75.5,
    "stdDeviation": 8.2,
    "bias": "balanced" | "too_strict" | "too_lenient",
    "biasScore": 0.5,  // -50 ~ +50
    "suggestion": "评委评分稳定，建议保持当前标准"
  }
]
```

**v2.2 优化**：所有评委的 AI suggestion 调用从串行改为 `Promise.all` 并发，10 评委从 30s 降到 ~3s

---

## 5. `POST /api/ai/generate-content`

通用内容生成。

**请求**：
```json
{
  "type": "readme" | "description" | "pitch" | "news" | "email" | "criteria",
  "context": { /* 自由 */ },
  "language": "zh" | "en",  // default "zh"
  "style": "academic" | "business" | "casual" | "technical"  // default "business"
}
```

**响应 200**：
```json
{ "content": "生成的文本..." }
```

**Context 按 type 字段约定**（v2.2 AIFeatures.tsx parseGenerateInput）：
- `description`: `{ original: string }`
- `readme`: `{ title, description, techStack: string[] }`
- `pitch`: `{ title, description, goal }`
- `news`: `{ title, award, description }`
- `email`: `{ subject, recipient, scenario }`
- `criteria`: `{ theme, focus }`

**v2.2 安全**：所有 context 字段经 `truncateForPrompt` 截断（title 200 / description 2000 / scenario 1000 等）

---

## 6. `POST /api/ai/optimize-description`

简化版：只调 description 类型生成。

**请求**：
```json
{ "description": "原描述", "language": "zh", "style": "business" }
```

**响应 200**：
```json
{ "optimized": "优化后的描述..." }
```

---

## 7. `POST /api/ai/moderate-content`

内容安全审核。

**请求**：
```json
{ "content": "待审核文本", "type": "project" | "comment" | "profile" }
```

**响应 200**：
```json
{
  "isAppropriate": true,
  "flags": [
    { "type": "sensitive" | "spam" | "plagiarism" | "inappropriate" | "violence" | "hate",
      "severity": "low" | "medium" | "high",
      "description": "..." }
  ],
  "suggestedAction": "approve" | "review" | "reject"
}
```

**失败 fallback**（AI 不可达时）：
```json
{
  "isAppropriate": false,
  "flags": [{ "type": "spam", "severity": "low", "description": "AI moderation unavailable, manual review needed" }],
  "suggestedAction": "review"
}
```

**v2.2 安全**：长输入自动截断到 10K 字符

---

## 8. `POST /api/ai/detect-similarity`

两段文本相似度（0-100%）。

**请求**：
```json
{ "text1": "...", "text2": "..." }
```

**响应 200**：
```json
{ "similarity": 75 }
```

**v2.2 改进**：
- 长输入自动截断（每段 2K）
- `parseSimilarityScore` 健壮解析（老代码会取到 "token 1500" 的 1500）

---

## 9. `POST /api/ai/check-plagiarism/:projectId`

项目抄袭检测（项目 vs 同赛事其他项目）。

**响应 200**：
```json
{
  "projectId": "uuid",
  "title": "项目名",
  "suspectedPlagiarism": true,  // 最高相似度 > 70%
  "checkedCount": 49,  // v2.2 新增：对比了多少个项目
  "similarProjects": [
    { "projectId": "uuid", "title": "...", "similarity": 82 }
  ]
}
```

**v2.2 优化**：
- pairwise AI call 从串行改为 `Promise.all` 并发
- 0 项目短路（hackathon 只有一个项目时直接返回空，不打 AI）
- 失败 per-project fallback（单个失败不影响其他）

---

## 10. `GET /api/ai/judge-suggestions/:assignmentId`

评委评分建议。

**Auth**：admin 或分配了该 assignment 的评委

**响应 200**（有 AI 评估时）：
```json
{
  "summary": "该项目综合得分 78/100，推荐优先评审",
  "highlights": ["亮点 1", "亮点 2"],
  "concerns": ["潜在问题"],
  "technicalTags": ["React", "TypeScript"],
  "complexity": "intermediate",
  "dimensions": { /* AI 评估的 4 维度 */ }
}
```

**响应 200**（无评估时）：
```json
{ "message": "No AI assessment available yet" }
```

---

## 11. `GET /api/ai/metrics`（v2.2 新增）

AI 运行状态 metrics。

**响应 200**：
```json
{
  "calls": { "claude": 152, "openai": 0, "local": 0 },
  "errors": { "claude": 3, "openai": 0, "local": 0, "timeout": 1 },
  "avgDurationMs": 2340
}
```

**Notes**：
- in-memory 计数器（重启清零）
- errors.timeout 单独统计 AbortError 触发的超时
- errors.{provider} 统计其他所有错误（HTTP 4xx/5xx / 网络 / 解析失败）

---

## 错误脱敏原则

所有 AI 端点的 5xx 响应统一返回脱敏后消息，**不暴露**：
- 第三方 API 内部错误细节（如 `Invalid API key: sk-ant-...`）
- 完整 stack trace
- provider 内部错误码

原始错误仍 `console.error` 便于后端排查，但响应只给 category：
- `"AI service timeout"` — AbortError（>30s）
- `"AI service unreachable"` — 网络错误
- `"AI service misconfigured"` — API key 问题
- `"AI service error"` — 其他
- `"Batch analysis failed"` / `"AI analysis failed"` / etc. — 路由级 category

详细 `safeErrorMessage` 见 `api/services/ai.ts:99-105`。

---

## Provider 配置

通过 `.env`：
```
AI_PROVIDER=claude          # claude | openai | local
AI_API_KEY=sk-ant-your-key
AI_MODEL=claude-sonnet-4-20250514  # 可选，per-provider 默认值
AI_BASE_URL=                 # 可选，per-provider 默认值
```

- `claude`: base URL = `https://api.anthropic.com/v1`, model = `claude-sonnet-4-20250514`
- `openai`: base URL = `https://api.openai.com/v1`, model = `gpt-4o`
- `local`: base URL = `http://localhost:11434/v1` (Ollama), model = `llama3.1:8b`, timeout 60s

切 provider 需重启进程（`getAIService` 单例，dev 期间限制）。
