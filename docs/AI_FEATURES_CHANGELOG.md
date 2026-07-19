# AI 功能改动历史（CHANGELOG）

> 涵盖 openhackathon v2.1 (2026-06-17) 上线后所有 AI 相关改动。
> 配合 `AI_FEATURES_UX.md`（UX 设计）+ `AI_FEATURES_API.md`（API 端点）阅读。

## v2.2 — 持续优化（2026-07-19）

**目标**：修复 v2.1 上线时埋的真 bug + UX 全面重做 + 测试覆盖

### 修复的真 bug

| 文件 | 严重度 | 说明 |
|---|---|---|
| `api/services/ai.ts:435 zodToJsonSchema` | 🔴 P0 | zod v3→v4 升级后 `_def.shape()` API 变了，**v2.1 schema 模式 100% 静默 fallback**。`analyzeProject` 永远返回默认 50 分、`moderateContent` 永远返回"需要 review"，AI 检测 v2.1 实际上没真跑过。**重写完整支持 v4 API（Optional / Nullable / Nested Object / min-max）** |
| `api/routes/ai.ts:178,212,253 batch errors` | 🔴 P0 | `err.message` 通过 batch-status endpoint 直接外泄给 admin。改用脱敏消息（"AI service error" / "Per-project analysis failed"），原始错误仍 console.error |

### 后端改进

- ✅ **fetch 超时**（30s，本地模型 60s）— `api/services/ai.ts:71-86 withTimeout` 用 AbortController。之前一个上游 hang 能拖死整个 server
- ✅ **错误脱敏** `safeErrorMessage` — `api/services/ai.ts:99-105`，把第三方 API 内部错误映射成 5 类用户友好消息
- ✅ **大输入截断** `truncateForPrompt` — `api/services/ai.ts:115-122`，10K 字符上限（头 70% + 尾 20%），防恶意 payload 烧 token
- ✅ **相似度解析健壮化** `parseSimilarityScore` — `api/services/ai.ts:131-141`，老代码 `text.match(/\d+/)?.[0]` 会取到 "token 1500" 的 1500；新代码 regex 提取所有数字，pick 第一个 [0,100] 范围
- ✅ **并发执行**：
  - `analyzeScoringConsistency` 串行→并发（10 评委从 30s 降到 ~3s）
  - `check-plagiarism` pairwise 串行→并发
  - `batch-analyze` 改并发池（5 并发，避免爆 provider rate limit）
- ✅ **batch 任务状态跟踪** — `BATCH_TASKS` in-memory Map + TTL 1h + setInterval 清理
  - 新 endpoint `GET /api/ai/batch-status/:taskId` 查进度（含 %、errors slice、status）
  - 新 endpoint `GET /api/ai/metrics` 看 AI 健康度（按 provider 分类的 calls/errors/avgDurationMs）
- ✅ **AIMetrics** in-memory counter — 监控 AI provider 健康度

### 前端 UX 改造（最大块）

- ✅ **i18n 化** — 21 个 page 里唯一缺失 `useTranslation` 的 AIFeatures 现在补齐（`src/lib/locales/zh.json` + `en.json` 加 `ai_features` section，约 100 个 key）
- ✅ **6 个 tab 覆盖全部 AI 能力**：
  - 项目分析（带 force-refresh switch + batch 进度跟踪）
  - 评分一致性（loading skeleton + error state + empty state）
  - 内容审核（3 个样例快捷填充 + 截断提示 + 5 类错误分类）
  - 内容生成（type/language/style 6×2×4=48 种组合 + 复制按钮）
  - 抄袭检测（相似度 0-100% 进度条 + 高/中/低风险标签）
  - AI 运行状态（按 provider 分类的 calls/errors/duration）
- ✅ **错误分类** `classifyError` — 把 axios 错误 / fetch 错误 / 普通错误统一映射到 5 类（network / unauthorized / forbidden / server / timeout），不暴露后端原文
- ✅ **Loading skeleton / Empty state / Error state** — 4 个 tab 全部覆盖
- ✅ **生成结果可一键复制** — `CopyButton` 组件
- ✅ **样例快捷填充** — Tab 3 moderation 3 个样例按钮（spam / clean / sensitive）
- ✅ **batch 进度跟踪** — mutation 存 taskId，轮询 `batch-status` endpoint（2s 间隔），任务完成自动停轮询，进度条 + 失败项目列表
- ✅ **force-refresh** — Tab 1 加 Switch，触发 `analyzeProject(projectId, force=true)` 跳过 24h 缓存

### API 兼容性

所有新字段都是 additive（`cached` / `total` / `checkedCount` / `metrics`），旧 client 忽略即可，无破坏。

### lib/api.ts 补全

- `getBatchStatus(taskId)` — 之前缺
- `getAIMetrics()` — 之前缺
- `analyzeProject(projectId, force)` — 加 force 参数透传

### 测试

- ✅ **24 个单测**（`api/__tests__/ai.test.ts`）：
  - `parseSimilarityScore` 9 个 case（整数 / % / 范围 / 小数 / 无 / 空 / 越界 / 文本 / 越界跳过）
  - `truncateForPrompt` 5 个 case
  - `AIMetrics` 3 个 case
  - `withTimeout` 3 个 case（**P0 修复**：从 circular 改为真测 30s 触发的 abort 路径）
  - `detectSimilarity` 1 个（mock fetch 验证截断）
  - `moderateContent` 1 个（mock fetch 验证 schema 模式 + 截断）
  - `analyzeScoringConsistency` 1 个（mock fetch 验证并发，maxInflight > 1）
  - `zodToJsonSchema` 1 个（v4 schema 正确性）
- ✅ **e2e** `e2e/ai-features.spec.ts`（新增，需 dev server 运行）：覆盖 6 个 tab 端到端流程

### 文件改动清单

| 文件 | 改动 |
|---|---|
| `api/services/ai.ts` | +222/-44（fetch 超时 / 脱敏 / truncate / parseSimilarity / AIMetrics / zod v4 / 并发） |
| `api/routes/ai.ts` | +106/-22（batch 状态表 / progress / 并发池 / metrics endpoint / 错误脱敏） |
| `api/__tests__/ai.test.ts` | 新增 470 行 / 24 测试 |
| `src/lib/api.ts` | +5 行（getBatchStatus / getAIMetrics / analyzeProject force 参数） |
| `src/pages/AIFeatures.tsx` | 重写 750 行（i18n + 6 tabs + 进度跟踪 + onError + 错误分类） |
| `src/lib/locales/zh.json` | +100 行（ai_features section） |
| `src/lib/locales/en.json` | +100 行（ai_features section） |
| `e2e/ai-features.spec.ts` | 新增（端到端覆盖 6 tabs） |
| `docs/AI_FEATURES_CHANGELOG.md` | 本文档 |
| `docs/AI_FEATURES_UX.md` | UX 设计说明 |
| `docs/AI_FEATURES_API.md` | API 端点文档 |

---

## v2.1 — 初次发布（2026-06-17, commit 057474b）

> 原始 PR：feat: Add complete AI enhancement system (v2.1)

- 6 个 AI 能力：项目质量评估、评分一致性分析、内容审核、抄袭检测、智能内容生成、评委智能助手
- 8 个 RESTful API 端点
- 4 个 React 组件（AIAnalysisPanel / AIScoreBadge / AIFeatures / Tooltip）
- 多 provider 支持：Claude / OpenAI / DeepSeek / Ollama
- 数据库迁移：`AIAssessment` model
- 详细文档（42K 字，8 docs）+ 8 完整用例
- README 引入 AI 特性

### 已知问题（v2.2 修复）

- 🔴 zod v3→v4 schema 转换 API 用错 → v2.2 修复
- 🟡 串行 AI call → v2.2 改并发
- 🟡 无限 fetch hang → v2.2 加超时
- 🟡 AIFeatures 无 i18n / 无 error state / 无 loading / 无 progress → v2.2 全部补齐
- 🟡 batch-analyze 返回的 taskId 是孤儿（无地方查） → v2.2 加 batch-status endpoint
