# 上线前综合 synthesis（修复方案 + 执行顺序）— 2026-08-06

> 输入：`audit-launch-2026-08-06.md` 13 条缺口
> 目标：把项目推到**可公网 URL 上线**标准（投资人/海外参赛者直链可用 + admin/judge/AI 主流程无卡住场景）
> 风格：每条标**前置依赖 / 改动范围 / 风险 / 验证手段**，不重复 audit 已写的行号
> 总评估：P0 (3) 1 个会话可清 + P1 (5) 2 个会话；P2 (5) 排 v2.4

---

## 总体策略

3 段执行：

**Sprint 1 (本次会话, ~1h)** — 3 条 P0 + 1 条 P1 死代码清理
**Sprint 2 (下次会话, ~1.5h)** — 4 条 P1（demo 路由 tree-shake / AI 限速 / console 聚合 / 监控接入）
**Sprint 3 (v2.4 排期)** — 5 条 P2（dead deps 清 / i18n key 改名 / Dockerfile 升 node 20 / factory audit log / httpOnly cookie 迁移）

每条 P0 完成后必须跑：① `npm run check` ② `npm run test:api` ③ `npm run test:unit` ④ `npm run build` ⑤ 手测受影响路径。

---

## Sprint 1 (本次)

### 1. ErrorBoundary i18n 化 (P0-1)

- **文件**：`src/components/ErrorBoundary.tsx:1-68` + `src/lib/locales/{en,zh}.json` 加 `error_boundary.{title, description, retry, go_home}`
- **改动**：把 `class` 改成 `function` + `useTranslation`，4 处 hardcode 字符串换成 `t('error_boundary.xxx')`；`this.state.error?.message` 保留（dev mode 排错有用）。
- **风险**：低（无逻辑改动）。`ErrorBoundary` 是 class 组件，要保留 lifecycle。
- **验证**：手测 en 模式触发（dev tools 里 throw 一下）→ 文案切英文；`npm run check` 必过。
- **预计**：15 分钟。

### 2. Auth state 改 useLocation 响应 (P0-2)

- **文件**：`src/lib/auth.tsx:86-156`
- **改动**：
  ```tsx
  import { useLocation } from 'react-router-dom'

  export function AuthProvider({ children }) {
    const location = useLocation()  // 改这一行
    const [user, setUser] = useState(...)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
      migrateLegacyAuth()
      setUser(getStoredUser())  // 改：location.pathname 变了就读对应 role 的 user
      setIsLoading(false)
    }, [location.pathname])  // 改：依赖 pathname

    // 删掉 popstate 那段 useEffect
    ...
  }
  ```
- **风险**：低，但要跑 3 套测试 + 手测 admin ↔ judge 切换。
- **验证**：
  1. 单元测试 `src/__tests__/lib/auth.test.tsx` 加 1 个新 case：render with admin user at `/admin`，rerender with `MemoryRouter` 切到 `/judge`，`useAuth().user` 应切到 judge user。
  2. 手测：先 admin 登录 → 直链 `/judge` → 应被 redirect 到 `/judge/login`；登出 admin → 用 judge 邮箱登录 → 跳回 `/judge` → `useAuth().user` 是 judge；再直链 `/admin/projects` → 应被 redirect 到 admin login。
- **预计**：30 分钟（含测试）。

### 3. 404 NotFoundPage (P0-3)

- **文件**：新建 `src/pages/NotFound.tsx`（~40 行）+ `src/App.tsx:289` 改 `path="*"` 路由 + i18n key `not_found.{title, description, go_home}`。
- **设计**：
  - 跟 ErrorBoundary 同款视觉（`AlertTriangle` 图标 + 双按钮）
  - 主按钮"返回首页"（→ `/`），次按钮"查看文档"（→ `/docs`）
  - 保留"页面不存在"的氛围文案（en/zh 各 1 行）
- **风险**：0（新增 route 不动现有路径）。
- **验证**：手测 `/foo/bar` / `/admin/typo` / `/judge/typo` 三个拼错路径 → 全显示 NotFound。
- **预计**：20 分钟。

### 4. Dead code 删除 (P1-6 半数)

- **文件**：
  - 删 `src/components/Empty.tsx`（8 行）
  - 删 `src/lib/ai-service.ts`（34 行，含 `console.log`）
  - 删 `src/lib/supabase.ts`（11 行）
- **降级**：`package.json` 顺手卸 `@supabase/supabase-js` 一并 commit；solana 5 个包等 Sprint 3 统一清（避免改 lockfile 太大本会话打架）。
- **验证**：`grep -rn "Empty\|AIService\|supabase" src/` 全 0 命中（除了 `Empty` 是 React reserved export 名会撞，改为 grep `"@/components/Empty"\|new AIService\|ai-service"`）；`npm run build` 后 `dist/assets/` 无新 chunk 变。
- **预计**：10 分钟。

**Sprint 1 总计**：~75 分钟。

---

## Sprint 2 (下次)

### 5. Prod demo 路由 tree-shake (P1-4)

- **文件**：`vite.config.ts` 加 `define: { 'import.meta.env.DEV': mode === 'production' ? 'false' : 'true' }`；`src/App.tsx` 已有 `...(import.meta.env.DEV ? [demoRoutes] : [])` spread 写法。
- **同款事故**：2026-08-04 OpenCSG Academy prod build 出 demo 路由（Vite `import.meta.env.DEV` 在 spread+JSX 不 tree-shake 已知问题）。
- **验证**：`npm run build` 后 `grep "demo\|design-system" dist/assets/index-*.js` 应 0 命中。
- **预计**：10 分钟。

### 6. AI 限速分层 (P1-7)

- **文件**：`api/middleware.ts:170-185` + `api/services/ai.ts` 4 个端点加 `req.user?.id` 维度限速。
- **设计**：
  - 已有 `AI_RATE_LIMIT_MAX=30` 全局，改成 per-user-id 30/min
  - LLM 5xx / 网络错 → 返 503（不是 500），前端 `classifyApiError` 加 `'service_unavailable'` 分类
  - 配额耗尽 → 返 429 + Retry-After header
- **验证**：跑 `api/__tests__/ai.test.ts` 加新 case（同一 user 31 次第 31 次 429）；手测：judge A 30 次后 judge B 仍能调。
- **预计**：45 分钟。

### 7. API 结构化日志 (P1-6 后半)

- **文件**：`api/server.ts` 加 `pino` logger（轻量、零 config），`api/services/*.ts` 9 处 `console.error` 改 `logger.error({ err, ctx }, 'msg')`。
- **设计**：不接 Sentry，先用 pino + JSON 输出到 stdout，部署平台（Render / Docker log driver）收；接 Sentry 是 P2 升级。
- **验证**：`npm run test:api` 全过；`tsc` 干净。
- **预计**：30 分钟。

### 8. 监控接入 (P2 升级 P1-6)

- 等 Frank 选平台（Sentry / DataDog / Axiom），本次不出方案。

---

## Sprint 3 (v2.4)

### 9. dead deps + Dockerfile + factory audit log + i18n key 改名 + httpOnly cookie 迁移

5 条按依赖关系排：
1. dead deps 卸（@solana × 4 + @supabase + @solana/web3.js）— 改 `package.json` + 重 `npm install`
2. `Dockerfile.api` / `Dockerfile.web` 升 `node:20-alpine`
3. `src/lib/locales/{en,zh}.json` 把 `gitbook` 命名空间改名 `event_details`（grep 改 6 处 key + `Docs.tsx:71` 一处使用）
4. `api/routes/system-reset.ts:50-62` factory 模式加 `activityLog.create({...})`
5. JWT → httpOnly Secure SameSite=Strict cookie + CSRF double-submit token（最大改动，单独一个 sprint）

**Sprint 3 总计**：~4h，分 2-3 个会话做。

---

## Sprint 1 验证矩阵（写完 4 条后必跑）

| 检查 | 命令 | 期望 |
|---|---|---|
| 类型 | `npm run check` | exit 0 |
| API 测试 | `npm run test:api` | 18 文件 / 283+ passed |
| 单元测试 | `npm run test:unit` | 22 文件 / 136+ passed |
| 构建 | `npm run build` | 0 error, 0 new warning |
| 死代码残留 | `grep -rn "from '@/components/Empty'\|ai-service\|AIService" src/` | 0 命中 |
| en 触发 ErrorBoundary | 手测 | 显示英文 "Something went wrong" |
| 切角色 | 手测 | user 状态对位更新 |
| 拼错 URL | 手测 | NotFound 页 |

---

## 不做的事（明确）

- **httpOnly cookie 迁移**：Sprint 3 单独做，session 内不动 — 涉及 CSRF strategy + refresh token rotation，改坏面太大。
- **Sentry / DataDog 接入**：Sprint 2-3 边界，等 Frank 选平台。
- **bcrypt rounds 升 12**：2026-07-24 audit P1-7 列了，本次**不动**（sprint 4+，需全 user 重置密码）。
- **/uploads immutable cache 改 auth-gated**：P1-6 同类，sprint 3+。
- **Babel 6 个 controller 顺序重构**：跟 launch 无关，等 v2.4 清理。

---

**字数**：~860 字。
**优先级排序原则**：P0 = 公网 URL 必现体验断点；P1 = 上线后 1 周内大概率踩的运营问题；P2 = 长期 hygiene。
