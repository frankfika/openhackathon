# AI 功能 UX 审计（纯观察 + 缺口）— 2026-07-19

> 范围：`src/pages/AIFeatures.tsx`（315 行） + `src/lib/api.ts:439-469` AI client
> 风格：纯观察，不给实施建议；下轮 synthesis 阶段再设计修复

## 1. 用户故事断层（4 个角色，4 个场景）

- **A 管理员小赵** 在场景"批量分析 50 个项目质量"想做"开始任务后看到进度条 / 失败列表"，实际是：`AIFeatures.tsx:39-50` mutation onSuccess 只 toast 一句"已开始批量AI分析，请稍后刷新"，taskId 拿不到、没进度可看、失败列表查不到。
- **B 评委小周** 在场景"判断某个项目是否被抄袭"想做"粘两个项目描述点相似度"，实际是：AIFeatures.tsx 没有"抄袭检测"tab（README.md:7-8 提到此能力），`lib/api.ts:467-470` `checkPlagiarism` 已实现但前端没入口；`detectSimilarity` 同理。
- **C admin 老钱** 在场景"AI 这周跑得好不好"想做"看总调用次数 / 失败率 / 慢请求"，实际是：`api/routes/ai.ts:553-562` 我已加 `GET /api/ai/metrics` 但前端无 tab、无 client；admin 完全看不到。
- **D en 模式用户 Tom** 在场景"切到英文想用 AI 功能"想做"全 UI 切到英文"，实际是：AIFeatures.tsx 是 21 个 page 里**唯一**没 `import { useTranslation } from 'react-i18next'` 的页面（已 grep 验证 `0` 命中 vs 其他 20 个页面都有）。

## 2. 重复信息 / 提示缺位

- `AIFeatures.tsx:288-305` 配置说明 card 重复展示了 `.env` 变量，但没提示"现在有没有配对？"、`AI_API_KEY` 缺了时用户调任何 AI 接口会 500，但 UI 看到的就是普通 "审核失败"。
- `AIFeatures.tsx:106-108` "分析中..." 文字不准确：batch mutation 立即返回，状态是"任务已入队"不是"分析中"，给用户错觉会立刻拿到结果。
- 4 个 mutation 全部缺 onError：`L49-51 batchAnalyze`、`L88-94 moderate`、`L96-103 optimize` 失败都只 toast "失败"，没透出 reason（虽然后端做了脱敏，但 toast 里连"moderation 失败 / AI 不可达"这种 category 都没）。

## 3. 卡住场景（用户点完会卡死的几处）

- **Tab 1 项目分析**：`L74-87` 触发后没有 force-refresh 选项（`POST /api/ai/analyze-project/:id?force=true` API 已支持），用户想"AI 升级后再评一次"做不到。
- **Tab 2 评分一致性**：`L67-75` query enabled: false 手动 refetch，`L78-87` 按钮没错误态；refetch 失败时无任何提示，admin 以为成功了。
- **Tab 3 内容审核**：`L240-262` 审核结果区只展示 flags，**不显示输入长度 / 是否被截断**；用户塞 100K 字符（service 端 truncate 10K）不会感知。
- **Tab 4 内容生成**：
  - `L96-103` 写死 `language='zh', style='business'`，**没暴露这俩参数 UI**；后端 `ai.ts:493-494` 支持 `language/style`，`generateContent` 6 种 type 也只暴露了 description。
  - `L107-109` 优化结果只显示在 Card，**没复制按钮** — admin 还得手选文本。
  - `L96-103` 缺 onError。
- **整体**：4 个 tab 全部无 loading skeleton、无空态（"暂无评分数据"）、无重试按钮；任何一个 AI 请求挂 30s 时 UI 看着就是 spinner 转，没有任何 progress 反馈。

## 4. 其他 UX 入口断层

- `lib/api.ts:439-469` AI client 缺 `getBatchStatus(taskId)` 和 `getAIMetrics()` — 我后端加了 endpoint，前端调不到，等于没加。
- 无"AI 调用样例"快捷输入按钮（用户第一次进 AIFeatures 不知道试什么，textarea 空白）。
- 无 `analyze-project/:projectId` 单项目入口（虽然 `lib/api.ts:439-441` 有，但 AIFeatures 没用；项目详情页也不调）。
- 无 `judge-suggestions/:assignmentId` UI 入口（`lib/api.ts:472-474` 有，但 Judging.tsx 没用 — 评委评分时拿不到 AI 建议，看 README v2.1 提到这能力）。
- `AIFeatures.tsx` 路由路径未确认，**未在 Router 入口对非 admin 隐藏**（虽然后端 requireAdmin，但前端不该让普通用户看到 admin 页面）。
