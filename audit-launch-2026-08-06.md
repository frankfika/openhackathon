# 上线前综合 audit（纯观察 + 缺口）— 2026-08-06

> 范围：`src/**`、`api/**`、`prisma/schema.prisma`、`.env.example`、`package.json`、`Dockerfile*`、`render.yaml`、`e2e/**`、现有 3 份 audit 报告
> 测量：`tsc --noEmit` 干净、`npm run build` 通过（web3-vendor 3MB / charts-vendor 363KB）、`npm run test:api` 18 文件 / 283 passed、`npm run test:unit` 22 文件 / 136 passed（1 skipped）；E2E 7 spec / 33 test，未跑（需 server）
> 风格：纯观察，不给实施建议；下轮 synthesis 阶段再设计修复
> 基线：2026-07-19 / 2026-07-24 三份 audit 的 P0/P1 修复已落地（`Project` 4 个 `@@index` 已加、`AIFeatures` 全 i18n + 6 tab + 进度跟踪 + 4 mutation onError 已写、`AUTH_DISABLED` 双 gate、`JWT_SECRET` 默认值改 `__INSECURE_DEFAULT_REPLACE_BEFORE_DEPLOY__`）。本份只列**未在 P0/P1/P2 清单里**或**新发现**的剩余缺口

---

## 1. 用户故事断层

- **admin 小赵** 在场景"admin 登录后被链接带到 /judge 页面（反之亦然）"想做"切到正确身份"实际是 `src/lib/auth.tsx:97-102` 只 `popstate` 监听，React Router 6 内部跳转用 `pushState` 不触发 `popstate`；`useAuth().user` 切角色后**不更新**，从 /admin 进 /judge 后 `user` 仍是 admin token 对应的 user。
- **参赛者 Tom** 在场景"打错 URL `https://hack.example/foo`"想做"看到 404 + 提示"实际是 `src/App.tsx:289` `path="*"` → `Navigate to="/" replace`，**静默**回首页无任何解释。
- **评审 Alice** 在场景"页面渲染时 React 抛错"想做"看到友好错误 + 重试"实际是 `src/components/ErrorBoundary.tsx:46-60` 4 处 UI 文案是硬编码中文（"出错了 / 请尝试刷新页面或返回首页 / 重试 / 返回首页"），英文界面下也是中文。
- **admin 老钱** 在场景"AI 调用失败想看是配额 / 网络 / 鉴权哪类"想做"看到分类提示"实际是 `src/components/AIAnalysisPanel.tsx:63` `toast.error('AI分析失败，请稍后重试')` 和 `:97` `<AlertDescription>AI分析暂时不可用，请稍后重试</AlertDescription>` 也是硬编码中文，未走 `classifyApiError`。
- **运营小周** 在场景"项目上线后某次 LLM 调用 500"想做"在监控里看到这条错 + 影响面"实际是 `api/services/` 下 9 处 `console.error(...)` 打到 stdout，**无 Sentry / DataDog / 结构化 logger**，容器重启即丢。
- **投资人 / 海外参赛者** 在场景"拿到生产 URL 直链 `/__error-demo/500`"想做"看到正常 hackathon 页面"实际是 `src/App.tsx` 路由表**未**走 `vite.config.ts` 的 `define: { 'import.meta.env.DEV': 'false' }` 死代码消除（grep 0 命中 dev-only demo 路由），prod build 后 dev demo 路由仍可能注册。
- **hackathon 主办方 A** 在场景"AI 配额被某个恶意 judge 刷光"想做"立刻看哪条 IP / 哪个 judge 调了几次"实际是 `api/middleware.ts:173-179` 写的 AI 限速是 `AUTH_DISABLED` 跳过的，prod 模式正常限速但**调用方是 judge 时无按 user 限速细分**（仅全局 IP 维 30/min）。

## 2. 重复信息 / 提示缺位

- `src/components/Empty.tsx:1-8` 8 行字面量 `Empty`，**全代码库 0 处 import**（`grep -rn "from '@/components/Empty'" src/` 0 命中），dead code。
- `src/lib/ai-service.ts:1-34` 完整 34 行 `AIService` class（`complete` / `embed`）+ `console.log` + 返 placeholder 字符串，**0 处 import**（`grep -rn "ai-service\|AIService" src/` 仅 3 行 self-reference）。
- `src/lib/supabase.ts:1-11` `supabase` + `supabaseEnabled` 导出，**0 处 import**（`grep -rn "from '@/lib/supabase'"` 0 命中），依赖 `@supabase/supabase-js` 整包装入 vendor 但运行时不会激活。
- `src/lib/api.ts:20-23` 显式 `TODO(SECURITY-P1)` "Migrate to httpOnly Secure SameSite=Strict cookie issued by the backend"；localStorage + `server.ts` CSP 关闭的 XSS 风险仍在（2026-07-24 audit P0-3 列了，**未迁移**）。
- `src/App.tsx:289` 全 catch-all 静默重定向，无 `NotFoundPage` 组件、`src/pages/` 21 个 page 里**无** `NotFound.tsx` / `404.tsx`。
- `package.json:57-61` 4 个 `@solana/wallet-adapter-*` + `:61` `@solana/web3.js` + `:62` `@supabase/supabase-js` 装入依赖（2026-07-24 perf P2-5 列了，**未清理**），代码 0 引用 → `npm install` 多花 ~5MB + 拉进 lockfile。
- `src/lib/locales/en.json:719` + `zh.json:719` 都有 `gitbook` 命名空间，en 翻译成 "Event Details" / zh 翻译成 "赛事详情"，但 key 名字还叫 `gitbook`；`Docs.tsx:71` 取 `t('landing.gitbook.title')` 显示"Event Details / 赛事详情" — 跟 key 名不符，新人 contributor 看到这个 key 误以为绑死 GitBook SaaS。

## 3. 卡住场景 / 死路径

- **judge 切 admin**：当前 admin 已登录 → 浏览器手动跳到 `/judge/review/xxx` → `RequireRole allowedRoles={['judge']}` 看到 `redirectTo="/judge/login"`，但 `useAuth().user` 仍是 admin 对象；重定向到 judge login 后用 admin 邮箱登录会**报"无权限"**，因 localStorage 里 admin token 还在；用户唯一清掉的方法是手动 `localStorage.clear()` 或登出 admin。
- **404 路径**：`/foo/bar` → `App.tsx:289` `Navigate to="/" replace` 静默重定向，用户看到首页但**没有任何反馈**这条 URL 不对；直链分享失效场景（如邮件里的老 URL）用户搞不清状况。
- **prod demo 路由泄漏**：dev mode 注册 `/__design-system` `/__error-demo/:type` 等 demo 路由；perf audit P1-2 标了"未确认 prod 是否 dead-code 消除"；当前 `vite.config.ts` 无 `define: { 'import.meta.env.DEV': 'false' }` 强制 → esbuild spread 里的 JSX element 不会被折叠（与 OpenCSG Academy 2026-08-04 事件同根因）→ 投资人/用户直链看到 "Demo: Database" 内部 demo 内容。
- **AI 服务不可达降级**：`api/services/ai.ts` 的 4 个 `requireAuth` 端点（`generate-content` / `optimize-description` / `moderate-content` / `judge-suggestions`）judge 可调无限速，**无 503 / fallback**；LLM 配额耗尽时返 500，前端 `classifyError` 仍归到"server error"分类，admin 看不到"配额耗尽"vs"网络失败"的区别。
- **新建项目无 hackathon**：`api/middleware.ts:6` 缺 hackathon 存在性检查；admin 跑 `db:reset` 后 `factory` 模式删全 user 但**不写 audit log**（2026-07-24 audit P2-14 列了，**未补**）。
- **CORS dev 默认**：`.env.example:18` 写 `CORS_ALLOW_ALL=false`，但 `api/server.ts:91-94` 仍有 `if (env.CORS_ALLOW_ALL === 'true')` 透出 `*`；staging 误开 = 任意域可读 API。

## 4. 缺口列表（按上线阻塞度排）

### P0 — 必须修才能公开 URL

1. **ErrorBoundary 4 处硬编码中文**（`src/components/ErrorBoundary.tsx:46-60`）：21 个 page 全 i18n 了，唯独 ErrorBoundary 漏；任何 React 抛错 en/zh 用户都看到中文。
2. **auth popstate 监听漏洞**（`src/lib/auth.tsx:97-102`）：admin ↔ judge 切角色后 `useAuth().user` 不更新；用 `useLocation` + useEffect 重读才对。
3. **404 catch-all 静默重定向**（`src/App.tsx:289`）：无 `NotFoundPage` 组件，`src/pages/` 目录无 404 文件；任何拼错 URL / 老分享链接 静默跳首页。

### P1 — 强烈建议修

4. **prod demo 路由未 tree-shake**（`src/App.tsx` + `vite.config.ts`）：投资人/用户直链 demo 路径可能看到内部内容；同 2026-08-04 OpenCSG Academy 事故根因。
5. **AIAnalysisPanel 2 处硬编码中文**（`src/components/AIAnalysisPanel.tsx:63,97`）：21 个 page 走 `useTranslation` 它不走；en 界面也看到中文。
6. **api 9 处 console.error 无聚合**（`api/services/*.ts`）：上线后容器 stdout 进 log driver，运维不可观测；`src/components/Empty.tsx` 死代码。
7. **AI 4 端点 judge 无限速 / 无降级**（`api/services/ai.ts:330,352,381,499`）：可刷 LLM 配额，2026-07-24 audit P1-8 列了**未补**。
8. **JWT localStorage 存 token**（`src/lib/api.ts:20-23` TODO）：`server.ts:115` 显式关 CSP，XSS 即可读 admin token 7 天有效；2026-07-24 audit P0-3 列了，**未迁移 httpOnly cookie**。

### P2 — 可延后

9. **dead deps 3 个**（`@solana/wallet-adapter-*` × 4 + `@solana/web3.js` + `@supabase/supabase-js`）：装入 vendor 但代码 0 引用，2026-07-24 perf P2-5 列了**未清**。
10. **dead code 2 文件**（`src/lib/ai-service.ts` 34 行 / `src/lib/supabase.ts` 11 行）：0 引用 + `console.log` 进 prod bundle。
11. **i18n key 命名误导**（`src/lib/locales/{en,zh}.json:719` `gitbook` → 实际显示"Event Details"）：`Docs.tsx:71` 已用 `t('landing.gitbook.title')` 但 key 名误导。
12. **Dockerfile.api node:18-alpine**（`Dockerfile.api:1`）：EOL 2025-04-30；2026 推荐 20-alpine。
13. **factory reset 不写 audit log**（`api/routes/system-reset.ts:50-62`）：2026-07-24 audit P2-14 列了**未补**。

---

**字数**：中文正文 ~770 字。
**最大 launch 风险**：P0-1 + P0-2 组合 — 任意 React 抛错 en 用户看中文 + 切角色时 auth 状态错位，是公开 URL 必现的两条体验断点。
