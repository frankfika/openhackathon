# Sprint 3.5 progress + design (JWT → httpOnly cookie + CSRF) — 2026-08-06

> 输入：`audit-launch-2026-08-06.md` P1-8 + `synthesis-launch-2026-08-06.md` Sprint 3.5
> 现状：Sprint 1-3.3 已完成并推 main（commits 92bb71c / 5d82f7b / d2e6080），Sprint 3.4 (factory audit log) 已 N/A（2026-07-24 security follow-on 已修），Sprint 3.5 JWT 迁移是这次 launch 唯一未完成的 P1
> 目标：把 JWT 从 localStorage 迁到 httpOnly Secure SameSite=Strict cookie + CSRF double-submit token，消除 XSS 拿 token 风险

---

## 1. Sprint 1-3 已完成 (3 commits pushed)

| Commit | 范围 |
|---|---|
| `92bb71c` fix(launch): clear 3 P0 launch blockers + dead code cleanup | ErrorBoundary i18n / auth.tsx pushState 响应 / NotFound 页面 / 3 dead file 删除 / @supabase 卸 |
| `5d82f7b` fix(launch): Sprint 2 — AI rate-limit per user, structured logger, AIAnalysisPanel i18n | aiRateLimitKey 改 per user-id / 5 LLM 端点扩限 / api/logger.ts / 14 个 console.error 替换 / AIAnalysisPanel 20+ 硬编码 i18n |
| `d2e6080` fix(launch): Sprint 3.1-3.3 — dead deps, Dockerfile bump, i18n key rename | @solana ×5 卸 (-593 packages) / Dockerfile node 20 / landing.gitbook → landing.event_details 改名 |

**全验证通过**：tsc clean / 291 api + 137 unit tests (1 skipped) / vite build ✓

## 2. Sprint 3.5 设计 (JWT cookie + CSRF)

### 2.1 目标

- JWT 不再存 localStorage (XSS 即读，7 天有效)
- 改存 `__Host-session` httpOnly cookie，Secure (prod), SameSite=Strict
- 加 `__Host-csrf` cookie + 同步 meta tag 走 double-submit 模式防 CSRF
- `Authorization: Bearer` 头继续支持 (e2e + curl + test 仍可工作)，cookie 作为主通道

### 2.2 改的文件清单 (预估)

| 文件 | 改动 |
|---|---|
| `api/server.ts` | 加 `cookie-parser` 中间件 + `Set-Cookie` 响应头 (login / logout) |
| `api/routes/auth.ts` | login 返 cookie + CSRF token；logout 清 cookie |
| `api/routes/web3-auth.ts` | SIWE 成功同样 set cookie |
| `api/middleware.ts` | `getAuthUserFromRequest` 优先读 cookie → 退回 Authorization header (兼容 e2e) |
| `api/config.ts` | 加 `COOKIE_SECRET` env (32+ char) + `COOKIE_SECURE` (dev false / prod true) + `COOKIE_DOMAIN` |
| `api/middleware.ts` (新) | `requireCsrf` 中间件：mutating 请求 (POST/PUT/PATCH/DELETE) 校验 `x-csrf-token` header == cookie 值 (constant-time compare) |
| `src/lib/api.ts` | axios `withCredentials: true` + 不再 `localStorage` 存 token；保留 401 清理逻辑 (但清的是 CSRF 失效标志，不是 token) |
| `src/lib/auth.tsx` | 拿 CSRF token 从 `/api/auth/csrf` 端点，存 zustand / React Query (非 localStorage)；mutating fetch 加 `x-csrf-token` header |
| `src/pages/Login.tsx` / `src/pages/JudgeLogin.tsx` | 不再 localStorage 写 token；等待 cookie 由 server set |
| `src/components/dashboard/AdminDashboard.tsx` 等 fetch 调用 | mutating fetch 全部加 `x-csrf-token` |
| `.env.example` | 加 `COOKIE_SECRET=__GENERATE_WITH_openssl_rand_hex_32__` + `COOKIE_SECURE=true` (生产强制) |
| `e2e/auth.spec.ts` | 加 CSRF + cookie 端到端测试 |

### 2.3 CSRF 模式 (double-submit cookie)

```
登录响应:
  Set-Cookie: __Host-session=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
  Set-Cookie: __Host-csrf=<random>; Secure; SameSite=Strict; Path=/; Max-Age=604800
  Body: { user, csrfToken: <random> }  ← 前端存到 in-memory (zot state) 或 non-httpOnly "shadow" cookie (react useState)

Mutating 请求 (POST /api/ai/...):
  Cookie 自动带 __Host-session + __Host-csrf
  Header: x-csrf-token: <random>  ← 来自登录响应的 csrfToken
  服务端校验: req.cookies['__Host-csrf'] === req.headers['x-csrf-token'] (timingSafeEqual)

GET 请求: 不需要 CSRF
```

### 2.4 兼容性

- `Authorization: Bearer <token>` 仍然被 `getAuthUserFromRequest` 接受 — 现有 e2e + supertest 不变
- e2e 测试需要发新 cookie，可加 `test.beforeEach` 模拟登录响应
- React 18 + Vite 6 + Cookie 一起工作良好

### 2.5 风险 + 回滚

- **风险 1**：现有 localStorage 用户会被服务端 401 踢出（因为新代码不读 localStorage）→ 部署后第一波用户会看到 "session expired"，**需要公告**
- **风险 2**：CSRF token 丢失后 mutating 请求失败 → 前端在 403 时自动重新拉 `/api/auth/csrf`
- **风险 3**：CI / e2e 没跟上 → 严格 e2e suite 第一遍需要重写
- **回滚**：保留 `Authorization` header fallback，旧 client 仍能跑；新 client 不发 header 也能跑

### 2.6 估计

- 2-3 个 session (3h+)，含 e2e 适配
- 必须 Frank 在场拍板：是否真要上 (有兼容风险)，还是 Sprint 4 再做

---

## 3. 下次会话 checklist

- [ ] 重读 `audit-launch-2026-08-06.md` 确认 P1-8 范围
- [ ] 重读 `synthesis-launch-2026-08-06.md` Sprint 3.5 设计
- [ ] 跟 Frank 确认：是 Sprint 4 推 JWT 迁移，还是延后到 v2.4
- [ ] 如确认推：从 §2.2 文件清单 + §2.3 CSRF 模式起手，先写 `cookie-parser` + `Set-Cookie` 后端，写测试
- [ ] e2e/auth.spec.ts 加 cookie 集成

## 4. 引用

- audit: `audit-launch-2026-08-06.md` (13 条缺口)
- synthesis: `synthesis-launch-2026-08-06.md` (3 sprint 排期)
- 上次 commit: `d2e6080`
- 工作目录基线：`/Users/fangchen/Baidu/GitHub/openhackathon`
