# 安全审计(纯观察 + 缺口) — 2026-07-24

**范围**: api/{middleware,server,config}.ts, api/routes/{auth,web3-auth,identity,ai,projects,users,system-reset,hackathons,site-settings,setup}.ts, api/services/{identity,ai}.ts, api/utils/{crypto,siwe,validation,documents,email}.ts, prisma/schema.prisma, .env.example, vite.config.ts, src/lib/api.ts, src/pages/{Login,JudgeLogin}.tsx。

## 1. 用户故事断层

- **攻击者** 在场景"dev/staging 误配置"想做"用测试头提权", 实际是 `api/middleware.ts:21-29` 在 `AUTH_DISABLED=true` 时信任 `x-test-role` / `x-test-user-id`, `server.ts:56-58` 仅 production throw, 非生产零兜底。
- **攻击者** 在场景"借 XSS 偷 admin"想做"读 JWT", 实际是 `src/lib/api.ts:20-23` 把 JWT 存 `localStorage`(非 httpOnly cookie), 配合 `server.ts:115` 显式关 CSP, 任一 XSS 拿 `openhackathon_admin_token`, 7 天有效(`config.ts:40`)。
- **管理员** 在场景"复刻 .env.example 部署 staging"想做"默认安全", 实际是 `.env.example:6` 写 `JWT_SECRET=openhackathon-change-this-secret`, 跟 `config.ts:38-39` 的 `DEFAULT_JWT_SECRET` **同字符串**; staging 不挡默认 secret, GitHub 搜得到即可签发合法 JWT。
- **web3 用户** 在场景"对外公开链上身份"想做"被任意人查到积分 / 活动", 实际是 `api/routes/identity.ts:23` `/api/identity/:address` **无 auth**, 任何人用 `0xabc...` 枚举拿全球积分 / 跨场活动 / 链上 tx。

## 2. 重复信息 / 提示缺位

- `auth.ts:57` / `web3-auth.ts:60,130,193,243` / `users.ts:59` / `system-reset.ts:64` 全部 `console.error('xxx error:', error)` 直打, 不脱敏, 无聚合; grep 无 SECRET/KEY 命中, 但 stack 进 stdout 运维不可观测。
- `Login.tsx:23-69` 与 `JudgeLogin.tsx:21-50` 共用 zod schema, `api.ts:21-23` 各自 localStorage key, 同浏览器先后 admin / judge 登录**token 不互清**, 切角色后看到旧 user 缓存。
- `server.ts:56-62` 两个生产 throw 文案不引导运维如何生成强 secret / 必改 env。

## 3. 卡住场景 / 死路径

- `siwe.ts:15` nonceStore 进程内 Map, 多实例 / 重启 = 已发 nonce 丢; `web3-auth.ts:91-93` 旧消息体里 `Nonce: xxx` 还在, 用户只能重走一遍 nonce 流程。
- `documents.ts:5-7` `sanitizePathSegment` 保留 `.`, 配合 `documents.ts:59` `path.join(HACKATHON_DOCS_ROOT, sanitizePathSegment(hackathonId))`, admin 调 `PUT /api/hackathons/..%2F..%2F/markdown-doc`(`hackathons.ts:406`)可**跳出 `HACKATHON_DOCS_ROOT`**。`sanitizeFileStem`(line 9-12) 单文件安全, 目录段不安全。
- `crypto.ts:6-8` `getEmailSettingsCipherKey` 用 `sha256(EMAIL_SETTINGS_SECRET)`, `config.ts:69` 链到 `JWT_SECRET`, 改 JWT 即**所有已加密 SMTP 密码作废**, 无 re-encrypt 流程。
- `ai.ts:330,352,381,499` 4 个 `requireAuth`(非 admin) 端点: generate-content / optimize-description / moderate-content / judge-suggestions, judge 可调且**无限速**, 可刷爆 LLM 配额。
- `system-reset.ts:50-62` `factory` 模式 `user.deleteMany({})` + `siteSetting.deleteMany`, **没写 activityLog**(hackathon 模式 line 35-45 写了), 审计追踪缺口。

## 4. 缺口列表

### P0 — 立即可利用
1. **`AUTH_DISABLED` 非生产无兜底**(`middleware.ts:21-29` / `server.ts:56-58`): dev/staging 误开 = `x-test-role: admin` 全员提权。
2. **默认 JWT_SECRET 印 .env.example**(`config.ts:38-39` / `.env.example:6`): 与源码同字符串, staging 不挡。
3. **JWT 存 localStorage + CSP 关闭**(`api.ts:20-23` / `server.ts:115`): XSS 即读 admin token。
4. **目录段路径穿越**(`documents.ts:5-7` + `hackathons.ts:406`): 保留 `.`, admin markdown-doc 跳出 HACKATHON_DOCS_ROOT。
5. **公开 web3 identity 端点**(`routes/identity.ts:23`): 无 auth, 枚举钱包拉积分 / 链上 tx。

### P1 — 需条件
6. **`/uploads` 静态 + 1 年 immutable cache + 无 auth**(`server.ts:121-129`): admin 误传敏感截图, 永久公开。
7. **bcrypt rounds = 10**(`users.ts:47` / `setup.ts:62`): 行业基线 12, 易离线爆破。
8. **AI 4 端点 judge 可调无限速**(`ai.ts:330,352,381,499`): 可刷 LLM 配额。
9. **CORS dev 默认 allow-all**(`server.ts:91-94`): staging 误用跨站读 API。
10. **`.env.example:71` 仍写 `WEB3_DEFAULT_ROLE=judge`**(`identity.ts:46-51` 有兜底但示例诱导): 历史 P0 修复, 新人 copy-paste 出问题。
11. **submissionRateLimiter key 依赖 `req.body?.submitterEmail`**(`middleware.ts:149-152`): 改名即 fall back 到 IP 失效, 待核验 submit route 实际挂载。

### P2 — 加固
12. **HSTS 默认关**(`server.ts:114-118` 未传 `hsts`): helmet v8 默认不强制。
13. **`/admin` 路径硬编码 fallback**(`config.ts:68` / `src/lib/admin-routing.ts:6`): brute-force 目标。
14. **`factory` reset 不写 audit log**(`system-reset.ts:50-62`): 删全 user 无 activityLog。
15. **图片上传错误直返 `getErrorMessage`**(`validation.ts:41-49` + `site-settings.ts:306`): 透回 `ENOENT` / 路径信息。
