# 性能审计(纯观察 + 测量数据) — 2026-07-24

**范围**: `api/routes/*.ts`、`api/services/*.ts`、`prisma/schema.prisma`、`vite.config.ts`、`src/main.tsx`、`src/App.tsx`、`src/pages/*.tsx`、`src/lib/api.ts`、`package.json`、`src/hooks/`、`src/components/`
**测量**: `wc -l`、`grep -c prisma\.`、`grep -n findMany`、`grep -A 3 "model "`、`grep React.lazy`、`ls dist/`,`dist/` 不存在 (未 build) 已标注。
**不跑**: `npm run dev` / `npm run build`(避免端口冲突 + 42212 配额)

---

## 1. 用户故事断层

- **评委**在「我的评分任务」页(`/judge`) 想快速看到分配给自己的项目,实际是 `api/routes/dashboard.ts:38-48` 走 `assignment.findMany` 按 `judgeId` 过滤,`Assignment.judgeId` 在 `prisma/schema.prisma:125-142` **无 `@@index`**,全表扫;100 评委 × 1000 项目 = 10 万行扫描。
- **参赛者**在 `/leaderboard` 想看当前赛事排名,实际是 `api/routes/leaderboard.ts:157-167` 一次性 `project.findMany({ include: { assignments: { where: { status: 'completed' } } } })`,`Project.hackathonId` **无 `@@index`** (`schema.prisma:98-123`),500 项目 × M 评分 = 500M+ 行嵌套。
- **管理员**点「AI 抄袭检测」想看某项目疑似抄袭的同伴,实际是 `api/routes/ai.ts:441-446` 拉同一赛事下**所有其他项目** `findMany({ where: { hackathonId, id: { not: projectId } } })`,**无 `take`**,而且 `Project.hackathonId` 又**无 `@@index`**,1000 项目的赛事 = 1000 行 AI pairwise 比对 + 1 次全表扫。

## 2. 大文件 / 热点路径

| 文件 | 行数 | 入口 / 角色 |
|---|---|---|
| `src/pages/AIFeatures.tsx` | 1032 | `/admin/ai-features`,6 个 tab 同时挂载,11 个 useState,3 个 useQuery (含 2s 轮询 `batch-status`) |
| `api/services/ai.ts` | 812 | `withTimeout` + Claude/OpenAI 适配,所有 AI 调用必经 |
| `src/pages/ProjectDetail.tsx` | 652 | `/admin/projects/:id`,11 个 useMemo,5 个 useState,1 useQuery 嵌套 3 个 refetch |
| `api/routes/ai.ts` | 576 | batch 任务用 `BATCH_TASKS` in-memory Map (`ai.ts:24`),1h TTL |
| `api/routes/assignments.ts` | 374 | 列表端点 `include: { project: true, scores: true, judge: {...} }` (`assignments.ts:29-37, 44-51`),嵌套 3 层 |
| `src/pages/PublicSubmit.tsx` | 449 | 公共提交页,11 个表单字段 |
| `api/routes/leaderboard.ts` | 275 | 公共 leaderboard,无 take 全量返回 |
| `api/routes/projects.ts` | 414 | `Project.findMany` 列表,带 `take: pageSizeNum` 分页 OK,但 `lite=false` 分支 (`projects.ts:82-98`) **无分页** |

## 3. 测量数据

- **总代码量**: `api/routes + services + src/pages` 共 12,651 行
- **`prisma.*` 调用密度 top 3**: `api/services/identity.ts:13`、`api/routes/projects.ts:13`、`api/routes/ai.ts:11`
- **`findMany` 出现位置** 共 **30 处**,**14 处无 `take`**(`identity.ts:49, 107, 164`、`ai.ts:149, 278, 441`、`leaderboard.ts:114, 157`、`users.ts:16`、`reports.ts:14, 83`、`scores.ts:54`、`judges.ts:19, 77, 184, 218, 253`、`assignments.ts:22, 121, 127, 150, 182, 255`、`points.ts:135`)
- **`@@index` 覆盖率** (`prisma/schema.prisma` 11 个 model):
  - 有索引: User(2)、HackathonJudge(3)、ScoringCriterion(1)、Score(2)、ActivityLog(5)、AIAssessment(2)、WalletAddress(3)、CrossHackathonActivity(2) — 共 **20 条**
  - **完全无索引** model: `Hackathon` (44-69)、`Project` (98-123)、`Assignment` (125-142)、`SiteSetting` (157-182) — **4 个**
  - **User 缺索引**: `role` 在 `users.ts:18`、`dashboard.ts:28` 过滤 — `@@index([role])` 缺失
- **bundle 测量** (未 build,无法直接测 dist):
  - `vite.config.ts:31-53` manualChunks 划分 6 个 bucket: react-vendor / query-vendor / i18n-vendor / ui-vendor / validation-vendor / 其他
  - **不分 chunk**: `@rainbow-me/rainbowkit`、`@solana/*`、`wagmi`、`viem`、`recharts`
- **lazy load 覆盖**: `src/App.tsx:22-43` 共 **22 个 lazy route**(全部页面级已 lazy,`Suspense` 包裹在 `App.tsx:141`)
- **大依赖装入** (deps 95 条): `@rainbow-me/rainbowkit`、`@solana/*` (4 个包,代码侧**零引用**)、`@solana/web3.js`、`wagmi`、`viem`、`framer-motion`(只在 `Landing.tsx:3` 用)、`recharts`(只在 2 个 chart)、`@supabase/supabase-js`(代码侧**零引用**)
- **图片懒加载**: 全代码库仅 **2 处** `loading="lazy"`(`SubmitSuccess.tsx:110`、`Docs.tsx:175`);其余 8+ 个 `<img>`(logo / wallet icon)无 lazy
- **字体策略**: `src/index.css:1` `@import url('https://fonts.googleapis.com/css2?family=Geist...&family=Noto+Sans+SC...&display=swap')` 走 **CSS @import,渲染阻塞**;`index.html` **零** preconnect / preload 字体
- **缓存层**: 仅 `api/routes/ai.ts:24` `BATCH_TASKS = new Map<...>()` 1h TTL 跑批任务;**零** redis / lru-cache / node-cache
- **列表虚拟化**: 全代码库 `react-window` / `react-virtuoso` **零引用**(`grep` 0 命中)
- **react-query 配置** (`src/App.tsx:45-54`): `staleTime: 5min`、`gcTime: 10min`、`refetchOnWindowFocus: false`、`retry: 1` — 合理
- **queryKey 规范**: 分散在 `src/lib/api.ts` 周围 + 各 page,无统一 `queryKeys` factory;`['ai-assessment', projectId]`、`['assignments', 'judge', user?.id]`、`['project', id, 'detail']` 共 30+ key,手写字符串,无类型保护

## 4. 缺口列表

### P0(影响主流程性能)

- **P0-1** 4 个 model 完全无 `@@index`:`Hackathon` (44-69)、`Project` (98-123)、`Assignment` (125-142)、`SiteSetting` (157-182),直接造成项目列表/leaderboard/评委工作台全表扫
- **P0-2** `api/routes/ai.ts:441-446` 抄袭检测 `findMany` 拉同赛事**全部**项目(无 `take`),`Project.hackathonId` 又无索引
- **P0-3** `api/routes/leaderboard.ts:114-122` 和 `:157-167` 公共 leaderboard 无 `take`,`include: { assignments: ... }` 无 per-project 限制;`Assignment` 缺 `@@index([status])` + `@@index([hackathonId])` 也会拖累

### P1(可观测的次级瓶颈)

- **P1-1** `vite.config.ts:31-53` 6 个 manualChunks 不切 `@rainbow-me`、`@solana/*`、`wagmi`、`viem`、`recharts`,首屏把这些拉进 vendor 大包
- **P1-2** `src/pages/AIFeatures.tsx` 1032 行 + 6 tab 同时挂载,`/admin/ai-features` 进入即加载全页,无 tab 级 lazy
- **P1-3** `src/index.css:1` Google Fonts 走 CSS `@import` 阻塞渲染;`index.html` 无 preconnect
- **P1-4** `lucide-react` 46 个文件 named import,`vite.config.ts:46` 整包归 ui-vendor,treeshake 在 `0.511.0` 是 OK 的但 chunk 体积大
- **P1-5** 列表零虚拟化:`ActivityLog.tsx` 415 行渲染全部日志、`Projects.tsx` 363 行表格、`PublicSubmit.tsx` 449 行表单
- **P1-6** `User.role` 缺 `@@index`(`users.ts:18` 过滤)

### P2(边缘 / 远期)

- **P2-1** 零 redis / lru-cache,`site-branding` (`src/lib/site-branding.tsx:42`)、`active-hackathon` (`src/lib/active-hackathon.tsx:33`) 每次切页都重打 DB
- **P2-2** `src/lib/wagmi-config.ts:8` `WALLETCONNECT_PROJECT_ID` 是占位符 `'openhackathon-dev-placeholder'`,WalletConnect QR 直接失败
- **P2-3** `src/pages/ProjectDetail.tsx:53-66` 5 个 form `useState` + 11 个 `useMemo`,子组件 (Button / Card) 缺 `React.memo`,任何 onChange 都全子树重渲染
- **P2-4** `AIFeatures.tsx:188-195` batch-status 2s 轮询无最大时长,即使任务完成立即 `return false` 但 queryClient 缓存会保留 stale
- **P2-5** `@solana/wallet-adapter-*` 4 个包 + `@solana/web3.js` + `@supabase/supabase-js` 全量装入 `package.json` 但代码侧零引用,`npm install` 多花 ~5MB
- **P2-6** `queryKey` 全字符串手写分散在 30+ 文件,无 `queryKeys` factory,键冲突 / 失效面排查难

---

**字数**: 中文正文 ~780 字。
**最大性能风险**: P0-1 + P0-2 组合 — `Project` 缺 `@@index([hackathonId])` 叠加抄袭检测无 `take`,主流程 leaderboard / AI 检测在大赛事下退化为全表扫 + 全项目 pairwise 比对。
