<div align="center">

# OpenHackathon
> 开源黑客松管理平台 · Open Source Hackathon Management Platform

![OpenHackathon Home](./docs/assets/home.png)

![Version](https://img.shields.io/badge/Version-2.0-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-154%20passed-2ea44f?style=flat-square)

[核心能力](#-核心能力) • [界面截图](#-界面截图) • [架构](#-架构) • [快速开始](#-快速开始) • [部署](#-部署) • [测试](#-测试) • [发布](#-发布)

__简体中文__ | [English](./README_EN.md)

---
</div>

## 📖 项目简介
OpenHackathon 是一个面向黑客松主办方、评委与参赛团队的全流程平台：
- **主办方**可以管理活动、赛程、评审标准、项目分配、晋级与榜单。
- **评委**可以在统一界面查看任务、打分、提交评语。
- **参赛者**可以公开提交项目并在排行榜中查看结果。

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

### 5. 评审管理优化
- **列表/矩阵双视图**：评审管理页面支持列表视图（紧凑，适合项目多评委少的场景）和矩阵视图（完整交叉表，适合批量操作）。
- **指定分配优化**：列表视图每行只显示已分配评委，点击 `+` 按钮弹出选择器指定分配新评委。
- **操作日志**：新增操作日志页面，记录项目提交、评分、分配等所有操作，支持按操作类型、对象类型、操作人筛选。

### 6. Admin 评审运营架构（v2）
- Admin 评审运营已彻底拆分为独立页面：`reviews`、`assignments`、`promotions`、`reports`、`judges`。
- `adminBasePath` 可在 Site Settings 中配置，用于统一控制后台入口路径。
- 评委采用"账号全局、参赛季注册"的机制；只有注册到当前 hackathon 的评委才能参与分配与晋级后的自动派发。
- 初赛/复赛/决赛与赛区统一抽象为 session 维度；各页面通过 `sessionId` URL 参数保持同一上下文。
- 赛程时间线有强校验（前后端双重）：禁止开始时间晚于结束时间，阻止下游轮次时间早于上游轮次。
- 晋级默认按赛区优先匹配下游场次，并允许逐项目手动调整。
- 详细规则见：[Admin Review Architecture v2](./docs/admin-review-architecture.md)。

### 7. 评委工作台
- **左右分栏布局**：左侧任务列表，右侧项目详情和评分表单，无需跳转即可完成评审。
- **状态筛选**：快速切换待评审/评审中/已完成任务。
- **实时评分**：滑块控件实时计算总分，已评分项目显示完成状态和分数。

### 8. 赛事详情统一入口
- 前台统一使用「赛事详情」入口，不再拆分成重复的"规则"和"文档"菜单。
- 后台设置中，**外链 URL** 与**本地文档上传**合并展示为同一功能的两种方式。
- 优先级：本地文档（MD/PDF）> 外链 URL。

### 9. 公开提交回执与邮件通知
- `/submit` 页面仅强制邮箱，提交后后端自动生成回执号（如 `SUB-20260228-ABC123`）。
- 后端可通过 SMTP 自动发送回执邮件，支持管理员手动重发。

## 🖼️ 界面截图
| 首页 | 项目页 | 排行榜 |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Projects](./docs/assets/projects.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

| 评审页 | 设置页 | 晋级管理 |
|---|---|---|
| ![Judging](./docs/assets/judging.png) | ![Settings](./docs/assets/settings.png) | ![Promotions](./docs/assets/promotions.png) |

## 🏛️ 架构

### 技术栈
| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite + TailwindCSS + shadcn/ui + React Query + react-i18next |
| 后端 | Express.js + Prisma ORM + JWT 认证 |
| 数据库 | PostgreSQL |
| 测试 | Vitest（单元 + API 集成）+ Playwright（E2E）|
| 部署 | GitHub Actions → PM2 + Nginx |

### 后端模块化架构
后端采用模块化设计，按领域拆分为独立路由和工具模块：

```
api/
├── server.ts          # Express 应用入口与中间件配置
├── config.ts          # 环境变量与常量集中管理
├── middleware.ts       # JWT 认证、角色鉴权中间件
├── types.ts           # 共享 TypeScript 类型
├── routes/            # 按领域拆分的路由模块（16 个）
│   ├── auth.ts        #   登录/注册
│   ├── hackathons.ts  #   活动管理
│   ├── projects.ts    #   项目提交与管理
│   ├── assignments.ts #   评审分配
│   ├── scores.ts      #   评分
│   ├── judges.ts      #   评委管理
│   ├── promotions.ts  #   晋级决策
│   ├── reports.ts     #   评审报表
│   ├── site-settings.ts # 站点设置与图片上传
│   ├── users.ts       #   用户管理
│   ├── activity-logs.ts # 操作日志
│   ├── leaderboard.ts #   排行榜
│   ├── dashboard.ts   #   仪表盘统计
│   ├── setup.ts       #   初始化向导
│   ├── health.ts      #   健康检查
│   └── system-reset.ts #  系统重置
└── utils/             # 工具模块
    ├── validation.ts  #   输入校验与安全过滤
    ├── hackathon.ts   #   活动业务逻辑
    ├── email.ts       #   邮件发送
    ├── crypto.ts      #   加密工具
    ├── activity.ts    #   操作日志记录
    ├── documents.ts   #   文件处理
    └── formatting.ts  #   格式化工具
```

### 安全机制
- **JWT 认证**：支持 `issuer`/`audience` 校验，admin 和 judge 独立令牌
- **输入校验**：全字段白名单校验 + 长度限制 + SQL 注入/XSS 过滤
- **速率限制**：全局 API 限流 + 登录接口独立限流 + 提交接口独立限流
- **CORS 控制**：支持按域名白名单配置
- **文件上传**：类型白名单 + 大小限制 + 文件名安全过滤

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
- 启动前端和 API 开发进程（`npm run dev`）

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

# 手动模式：如果你自己管理 PostgreSQL
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
| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@openhackathon.com` | `password` |
| 备用管理员 | `ops@openhackathon.com` | `password` |
| 评委 | `alice@techgiants.com` | `password` |
| 空评委 | `judge1@openhackathon.com` | `password` |

### 🌱 Seed 数据说明
完整 seed 包含：**10** 个账号、**7** 场 hackathon、**32** 个项目、**44** 条评审任务。

覆盖 `active`、`upcoming`、`draft`、`judging`、`completed` 五类活动状态，题材覆盖 AI、FinTech、Climate、Web3、EdTech、Health、CyberSecurity。

## 🧪 测试

```bash
npm run test:unit    # 单元测试（111 passed）
npm run test:api     # API 集成测试（43 passed）
npm run test:e2e     # E2E 端到端测试
npm run lint         # ESLint 检查（0 errors）
npx tsc --noEmit     # TypeScript 类型检查
```

## 📧 提交回执邮件配置
在 `.env` 中配置（完整示例见 `.env.example`）：

```bash
SUBMISSION_EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SUBMISSION_RECEIPT_FROM="OpenHackathon <no-reply@example.com>"
SUBMISSION_RECEIPT_SUBJECT="[{{hackathonTitle}}] Submission Receipt {{receiptId}}"
```

## 🔐 安全配置
在 `.env` 中补充以下安全变量（完整示例见 `.env.example`）：

```bash
JWT_SECRET=your_strong_random_secret
JWT_ISSUER=openhackathon
JWT_AUDIENCE=openhackathon-clients
CORS_ORIGINS=https://your-domain.com
CORS_ALLOW_ALL=false
TRUST_PROXY=1
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX=1200
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
SUBMISSION_RATE_LIMIT_WINDOW_MS=600000
SUBMISSION_RATE_LIMIT_MAX=30
```

> 生产环境务必设置强随机 `JWT_SECRET`，且不要开启 `AUTH_DISABLED`。

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

默认端口：`5173`（Web）、`3001`（API）、`5432`（PostgreSQL）、`8080`（Adminer）

## 📦 发布
- Releases: https://github.com/frankfika/openhackathon/releases
- 建议使用语义化版本（`vX.Y.Z`）并附带变更说明。

## 📄 License
MIT
