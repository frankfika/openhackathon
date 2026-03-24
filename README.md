<div align="center">

# OpenHackathon
> 开源黑客松管理平台 · Open Source Hackathon Management Platform

![OpenHackathon Home](./docs/assets/home.png)

![Version](https://img.shields.io/badge/Version-1.3.0-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

[核心能力](#-核心能力) • [界面截图](#-界面截图) • [体验基线](#-体验基线) • [快速开始](#-快速开始) • [部署](#-部署) • [发布](#-发布)

__简体中文__ | [English](./README_EN.md)

---
</div>

## 📖 项目简介
OpenHackathon 是一个面向黑客松主办方、评委与参赛团队的全流程平台：
- 主办方可以管理活动、赛程、评审标准、项目分配、晋级与榜单。
- 评委可以在统一界面查看任务、打分、提交评语。
- 参赛者可以公开提交项目并在排行榜中查看结果。

## ✨ 核心能力
### 1. 活动与赛程管理
- 支持多活动（Hackathon）与多轮赛程（初赛/复赛/决赛）。
- **赛程管理**：独立标签页管理各轮次，支持设置赛区（region）进行多地区并行举办。
- 可配置评分标准、提交字段、活动状态。

![Dashboard](./docs/assets/dashboard.png)

### 2. 品牌与 SEO 白标能力
- 支持后台修改站点名、Logo、Tab 标题、SEO 标题/描述、Favicon。
- 默认品牌为 `OpenHackathon`，开箱即可用，也支持私有化改造。

![Settings](./docs/assets/settings.png)

### 3. 评审与评分流程
- 支持项目分配、评分提交、评论、状态流转。
- 报表可按项目/评委维度聚合评分与进度。

![Features](./docs/assets/features.png)

### 4. 晋级与多轮评审
- 支持项目晋级决策（advanced/eliminated/pending）。
- 晋级后可自动进入下一轮并生成新一轮评审任务。

![Promotions](./docs/assets/promotions.png)

### 4.1 评审管理优化（v1.3）
- **列表/矩阵双视图**：评审管理页面支持列表视图（紧凑，适合项目多评委少的场景）和矩阵视图（完整交叉表，适合批量操作）。
- **指定分配优化**：列表视图每行只显示已分配评委，点击 `+` 按钮弹出选择器指定分配新评委。
- **操作日志**：新增操作日志页面，记录项目提交、评分、分配等所有操作，支持按操作类型、对象类型、操作人筛选。

### 4.2 Admin 评审运营架构（v2）
- Admin 评审运营已彻底拆分为独立页面：`${adminBasePath}/reviews`、`${adminBasePath}/assignments`、`${adminBasePath}/promotions`、`${adminBasePath}/reports`、`${adminBasePath}/judges`（默认 `adminBasePath=/admin`）。
- `adminBasePath` 可在 Site Settings 中配置，用于统一控制后台入口路径，不改变评审业务流程本身。
- 评委采用“账号全局、参赛季（hackathon）注册”的机制；只有注册到当前 hackathon 的评委才能参与分配与晋级后的自动派发。
- 管理端侧边栏提供「黑客松列表」入口；并在侧栏明确显示“当前赛事名称 + 时间范围”，可一键切换赛事，避免“当前赛事”语义不清。
- 初赛/复赛/决赛与赛区统一抽象为 session 维度；各页面通过 `sessionId` URL 参数保持同一上下文。
- 一个项目支持分配给多位评委（同一场次下仅限制“同一项目-同一评委”不重复分配）。
- 赛程时间线有强校验（前后端双重）：禁止开始时间晚于结束时间，并阻止“下游轮次开始时间早于上游轮次”的错误配置。
- 晋级默认按赛区优先匹配下游场次（初赛→复赛/决赛、复赛→决赛均生效），并允许逐项目手动调整。
- 晋级页不会默认全选评委；仅当存在“晋级”决策时，才要求显式选择下一轮评委，避免误操作批量派发。
- 晋级页新增“搜索/赛区/决策筛选 + 对筛选结果批量设决策 + 自动补齐下一轮”，并在提交前阻止“已晋级但未选下一轮”的错误。
- 决赛场次不进入晋级操作列表，避免“决赛后继续晋级”的错误路径。
- 详细规则见：[Admin Review Architecture v2](./docs/admin-review-architecture.md)。

### 5. 评委工作台优化（v1.3）
- **左右分栏布局**：左侧任务列表，右侧项目详情和评分表单，无需跳转即可完成评审。
- **状态筛选**：快速切换待评审/评审中/已完成任务。
- **实时评分**：滑块控件实时计算总分，已评分项目显示完成状态和分数。

### 7. 赛事详情统一入口（规则/文档去重）
- 前台统一使用「赛事详情」入口，不再拆分成重复的”规则”和”文档”菜单。
- 后台设置中，**外链 URL** 与**本地文档上传**合并展示为同一功能的两种方式（用「或」分隔）。
- 优先级：本地文档（MD/PDF）> 外链 URL。本地文档上传后即优先展示，外链仅作为跳转备用；两者都未配置时显示空状态提示。

### 8. 公开提交回执与邮件通知
- `/submit` 页面仅强制邮箱，提交后后端自动生成回执号（如 `SUB-20260228-ABC123`）。
- 后端可通过 SMTP 自动发送回执邮件，并在回执中记录发送状态（`emailSent`/失败原因/最后尝试时间）。
- 支持管理员手动重发回执：`POST /api/projects/:id/receipt/resend`。

## 📧 提交回执邮件配置
在 `.env` 中配置以下变量（完整示例见 `.env.example`）：

```bash
SUBMISSION_RECEIPT_PREFIX=SUB
SUBMISSION_EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SUBMISSION_RECEIPT_FROM="OpenHackathon <no-reply@example.com>"
SUBMISSION_RECEIPT_REPLY_TO=ops@example.com
SUBMISSION_RECEIPT_SUBJECT="[{{hackathonTitle}}] Submission Receipt {{receiptId}}"
SUBMISSION_EMAIL_TIMEOUT_MS=10000
```

说明：
- `SUBMISSION_EMAIL_ENABLED=false` 时，不会发邮件，但仍会生成回执号并记录 `emailFailureReason=disabled`。
- `SUBMISSION_RECEIPT_SUBJECT` 支持模板变量：`{{hackathonTitle}}`、`{{receiptId}}`、`{{projectTitle}}`。
- 若 SMTP 短时异常，可在后台调用重发接口补发回执。

## 🔐 安全配置（建议）
在 `.env` 中补充以下安全变量（完整示例见 `.env.example`）：

```bash
AUTH_DISABLED=false
JWT_ISSUER=openhackathon
JWT_AUDIENCE=openhackathon-clients
CORS_ORIGINS=http://localhost:5173
CORS_ALLOW_ALL=false
TRUST_PROXY=
JSON_BODY_LIMIT=1mb
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=1200
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
SUBMISSION_RATE_LIMIT_WINDOW_MS=600000
SUBMISSION_RATE_LIMIT_MAX=30
```

说明：
- 生产环境务必设置强随机 `JWT_SECRET`，且不要开启 `AUTH_DISABLED`。
- 推荐在网关/反向代理后设置 `TRUST_PROXY`（如 `1`），确保限流与审计使用真实客户端 IP。
- JWT 已启用 `issuer/audience` 校验，`JWT_ISSUER` / `JWT_AUDIENCE` 需在签发与校验侧保持一致。
- `CORS_ORIGINS` 支持逗号分隔多个来源（如 `https://admin.example.com,https://app.example.com`）。
- 登录接口已启用单独限流，防止暴力破解。
- 公开提交接口（`POST /api/projects`）已启用独立限流，防止批量刷提交。
- API 暴露健康检查：`GET /api/health`。

## 🖼️ 界面截图
| 首页 | 项目页 | 排行榜 |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Projects](./docs/assets/projects.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

| 评审页 | 设置页 | 晋级管理 |
|---|---|---|
| ![Judging](./docs/assets/judging.png) | ![Settings](./docs/assets/settings.png) | ![Promotions](./docs/assets/promotions.png) |

## 🎨 体验基线
- 首页视觉与 README 截图 `docs/assets/home.png` 对齐，确保线上 UI 风格一致。
- 管理端与评委端共用同一套玻璃质感组件（按钮、卡片、输入、表格、弹窗、Tabs）。
- 所有关键列表页（项目、评分报表、晋级、设置）统一为“概览区 + 面板区 + 表格区”的层次结构。

## 🚀 快速开始
### 环境要求
- Node.js 20+（推荐）
- Docker + Docker Compose

### 一键启动开发栈
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install
npm run dev:up
```

这个入口会自动完成以下步骤：
- 读取 `.env`；如果本地没有 `.env`，则回退到 `.env.example`
- 使用 `docker compose` 启动 PostgreSQL
- 等待数据库就绪后执行 `npx prisma db push`
- 默认不创建管理员账号，首次进入通过 Setup Wizard 创建管理员
- 启动现有的前端和 API 开发进程（`npm run dev`）

常用命令：
```bash
# 首次初始化演示数据（会清空现有数据并重新写入 seed）
npm run dev:up:seed

# 仅补齐开发账号（不写入完整 seed）
./dev-stack.sh up --dev-users

# 关闭 Docker 中的数据库
npm run dev:down
```

### 本地开发
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install

# 手动模式：如果你自己管理 PostgreSQL，而不是使用一键脚本
npx prisma db push
npm run db:seed

# 重置到初始状态（无默认管理员，进入 Setup Wizard）
npm run db:reset

# 重置并写入演示数据（含默认管理员）
npm run db:reset:seed

# 启动前后端
npm run dev
```

默认账号（seed）：
- 管理员：`admin@openhackathon.com` / `password`
- 备用管理员：`ops@openhackathon.com` / `password`
- 评委：`alice@techgiants.com` / `password`
- 空评委账号：`judge1@openhackathon.com` / `password`
- 空评委账号：`judge2@openhackathon.com` / `password`
- 空评委账号：`judge3@openhackathon.com` / `password`

### 🌱 Seed 数据说明
当前完整 seed（`npm run dev:up:seed` / `npm run db:seed`）会创建：
- `10` 个内置账号
- `7` 场 hackathon
- `32` 个项目
- `44` 条评审任务

多样性：
- 覆盖 `active`、`upcoming`、`draft`、`judging`、`completed` 五类活动状态。
- 题材覆盖 AI、FinTech、Climate、Web3、EdTech、Health、CyberSecurity。
- 同时包含单轮/双轮配置、已评审/评审中/未开始、带 repo / 带 demo / 纯文本提交等不同数据形态。
- 既有“数据很满”的活动，也有“几乎空白”的活动，方便测试列表、报表、空状态和引导流程。

可用性建议：
- 看完整后台数据：用 `admin@openhackathon.com`。
- 看完整评委工作台：用 `alice@techgiants.com`、`bob@venturecap.com`、`charlie@designstudio.io`、`diana@aifund.com`、`evan@dev.tools`。
- 看空评委状态：用 `judge1@openhackathon.com`、`judge2@openhackathon.com`、`judge3@openhackathon.com`，这些账号不会绑定任何评审任务。
- 看干净管理员身份：用 `ops@openhackathon.com`，这个账号不会带额外的个人业务历史。
- 看 Setup Wizard：Wizard 主要由 hackathon 配置决定，不是由账号是否为空决定。登录任一管理员账号后，建议新建一个 hackathon，或者切换到 `Green Earth Hackathon` / `EdTech Remote Jam` 这类只有 `0-1` 个赛程的活动来观察引导效果。

### 🧪 测试场景对照表
| 场景 | 推荐账号 | 推荐 hackathon | 说明 |
|---|---|---|---|
| 看管理员满数据仪表盘 | `admin@openhackathon.com` | `Global AI Challenge 2026` | 当前默认 `active` 活动，项目、分配、评分、报表数据最完整。 |
| 看评委工作台有任务状态 | `alice@techgiants.com` | `Global AI Challenge 2026` | 同时包含 `completed`、`in_progress`、`pending` 三种任务状态。 |
| 看评委工作台空状态 | `judge1@openhackathon.com` | 任意 | 该账号没有任何 assignment，适合验证空列表、空面板、引导文案。 |
| 看排行榜/已完成赛事 | `admin@openhackathon.com` | `Web3 World Championship` | 赛事已完成，适合看已结束活动、历史成绩和完成态数据。 |
| 看评审中赛事 | `admin@openhackathon.com` | `EdTech Remote Jam` 或 `CyberSec Challenge 2026` | 都有进行中的评审任务，适合验证评审看板和进度统计。 |
| 看活动创建后较空的配置态 | `ops@openhackathon.com` | 新建 hackathon | 最适合验证刚建活动后的后台空状态和 onboarding。 |
| 看 Setup Wizard 自动提示 | `ops@openhackathon.com` | 新建 hackathon 或 `Green Earth Hackathon` | `Green Earth Hackathon` 只有 `1` 个 session，满足 wizard 建议条件。 |
| 看单 session 活动配置 | `admin@openhackathon.com` | `EdTech Remote Jam` | 只有一个 final session，适合测试 wizard 对已有单轮活动的处理。 |
| 看多轮活动配置 | `admin@openhackathon.com` | `Global AI Challenge 2026` / `CyberSec Challenge 2026` | 双轮赛程、标准 submission schema、已有评分标准。 |
| 看无项目无评审的活动 | `ops@openhackathon.com` | `FinTech Asia Summit` / `Health Innovation Summit` | 有完整基本配置，但没有项目和 assignment，适合测试列表空态。 |

注意：
- `npm run dev:up:seed` 和 `npm run db:seed` 都会删除当前数据库中的业务数据后重新写入演示数据。
- `npm run dev:up` 默认不会补齐内置开发账号；如需补齐请用 `./dev-stack.sh up --dev-users`。
- `Ctrl+C` 会停止前端和 API 进程；数据库容器可通过 `npm run dev:down` 关闭。
- 如果 `3001` 或 `5173` 端口已被占用，脚本会直接报错并打印占用进程，先释放端口再重跑即可。

### 测试
```bash
npm run test:unit
npm run test:api
npm run test:e2e
```

## 🏗️ 部署

### 在线演示
> **体验地址：http://49.234.25.35**（腾讯云，国内可直接访问）

### 一键部署到服务器（Ubuntu）
```bash
curl -fsSL https://raw.githubusercontent.com/frankfika/openhackathon/main/scripts/deploy-server.sh | bash
```
脚本自动完成：安装 Node.js / PostgreSQL / Nginx / PM2、克隆代码、构建前端、数据库迁移、启动服务、配置反向代理。

### 自动部署（CI/CD）
仓库已配置 GitHub Actions，推送到 `main` 分支后自动部署到服务器（约 2 分钟）：
```bash
git push origin main  # 即可触发自动部署
```

### Docker Compose
```bash
docker compose up -d --build
```

如果你希望前端、API、数据库都运行在容器里，继续使用这个方式；如果只是本地开发，优先使用 `npm run dev:up`。

默认端口：
- Web: `5173`
- API: `3001`
- PostgreSQL: `5432`
- Adminer: `8080`

## 🧰 文档截图脚本
README 截图来自真实运行站点（非模拟）：
```bash
BASE_URL=http://localhost:5173 node scripts/capture-screenshots.mjs
```

## 📦 发布
- Releases: https://github.com/frankfika/openhackathon/releases
- 建议使用语义化版本（`vX.Y.Z`）并附带变更说明。

## 📄 License
MIT
