<div align="center">

# OpenHackathon
> 开源黑客松管理平台 · Open Source Hackathon Management Platform

![OpenHackathon Home](./docs/assets/home.png)

![Version](https://img.shields.io/badge/Version-2.0-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-154%20passed-2ea44f?style=flat-square)
![i18n](https://img.shields.io/badge/i18n-English%20%7C%20中文-9cf?style=flat-square)

[核心能力](#-核心能力) • [界面总览](#-界面总览) • [架构](#-架构) • [快速开始](#-快速开始) • [部署](#-部署) • [测试](#-测试)

__简体中文__ | [English](./README_EN.md)

---
</div>

## 📖 项目简介
OpenHackathon 是一个面向黑客松主办方、评委与参赛团队的**全流程管理平台**：
- **主办方**：管理活动、赛程、评审标准、项目分配、晋级与榜单
- **评委**：在统一界面查看任务、打分、提交评语
- **参赛者**：公开提交项目并在排行榜中查看结果

支持中英文双语、深浅主题切换、移动端适配。

---

## ✨ 核心能力

### 1. 公开首页与项目提交

公开首页展示赛事信息、状态徽章、倒计时、奖金池，支持一键跳转到项目提交和赛事详情。

![Landing Page](./docs/assets/home.png)

项目提交页为左右分栏设计：左侧引导流程，右侧动态表单。表单字段完全由主办方在后台配置，支持 text / textarea / URL / select 类型，可设置必填和占位符。提交后自动生成回执号并可发送确认邮件。

![Submit Project](./docs/assets/submit.png)

### 2. 管理员仪表盘

登录后进入管理后台，总览当前赛事的项目数、评委数、待审数，并给出下一步行动建议。侧边栏展示当前赛事名称与时间范围，导航按功能域分组。

![Admin Dashboard](./docs/assets/dashboard.png)

### 3. 项目管理

项目列表支持搜索、状态筛选、平均分展示。每个项目可查看详情、查看评分、编辑、删除。

![Projects](./docs/assets/projects.png)

### 4. 评审分配与管理

评审管理页聚合了分配、进度、评分全流程：
- **统计概览**：总项目数、平均分、完成率、评委数
- **列表/矩阵双视图**：列表视图紧凑高效，矩阵视图适合批量操作
- **智能分配**：支持均衡随机分配和手动指定分配（点击 `+` 按钮）
- **状态筛选**：Pending / In Progress / Completed
- **导出**：一键导出评审数据为 CSV

![Review Management](./docs/assets/assignments.png)

### 5. 评委管理

评委采用「账号全局、按赛事注册」的机制。管理页展示当前赛事已注册的评委，支持注册/取消注册、创建新评委账号。

![Judge Management](./docs/assets/judges.png)

### 6. 赛事配置（三标签页）

赛事设置分为三个标签页：
- **General Info**：名称、标语、日期、赛事详情文档（外链 URL 或本地 MD/PDF 上传）、提交成功提示与二维码
- **Submission Form**：拖拽式表单字段构建器，支持 text/textarea/URL/select 类型、必填/可选、筛选标记
- **Scoring Criteria**：评分标准配置（名称 + 最高分），总分必须恰好 100 分

赛事启动后设置自动锁定，防止误改。

![Hackathon Settings](./docs/assets/settings.png)

### 7. 评委工作台

评委端采用左右分栏布局：左侧任务列表按状态分组（Pending / Completed），右侧展示项目详情和评分表单。评分按标准分项打分，实时汇总总分，支持评语。

![Judge Workspace](./docs/assets/judging.png)

### 8. 操作日志

全操作审计日志，记录项目提交、评分、分配、登录等所有操作。支持按操作类型、对象类型、操作人三维筛选。

![Activity Log](./docs/assets/activity.png)

### 9. 排行榜

管理员手动配置排名和奖项后发布。公开页面展示最终排行榜，未发布前显示空状态。

![Leaderboard](./docs/assets/leaderboard.png)

### 10. 更多能力

| 能力 | 说明 |
|---|---|
| **多轮赛程** | 初赛/复赛/决赛统一抽象为 session，支持赛区（region）维度 |
| **晋级决策** | 支持 advanced/eliminated/pending，晋级后自动生成下一轮评审任务 |
| **品牌白标** | 站点名、Logo、Favicon、SEO 标题/描述、Powered by 均可配置 |
| **邮件通知** | 提交回执邮件，支持 SMTP 配置（Gmail/Outlook/Zoho 预设） |
| **Setup Wizard** | 首次使用引导创建管理员账号和初始赛事 |
| **i18n 双语** | 英文/中文实时切换，覆盖所有页面 |
| **深浅主题** | 一键切换 Light/Dark 模式 |
| **系统重置** | 支持赛事重置和工厂重置 |

---

## 🖼️ 界面总览

| 首页 | 项目提交 | 管理员登录 |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Submit](./docs/assets/submit.png) | ![Login](./docs/assets/login.png) |

| 管理仪表盘 | 项目管理 | 评审分配 |
|---|---|---|
| ![Dashboard](./docs/assets/dashboard.png) | ![Projects](./docs/assets/projects.png) | ![Assignments](./docs/assets/assignments.png) |

| 赛事设置 | 评委管理 | 评委工作台 |
|---|---|---|
| ![Settings](./docs/assets/settings.png) | ![Judges](./docs/assets/judges.png) | ![Judging](./docs/assets/judging.png) |

| 操作日志 | 排行榜 |
|---|---|
| ![Activity](./docs/assets/activity.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

---

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
按领域拆分为 16 个路由模块和 7 个工具模块：

```
api/
├── server.ts          # Express 应用入口与中间件配置
├── config.ts          # 环境变量与常量集中管理
├── middleware.ts       # JWT 认证、角色鉴权中间件
├── types.ts           # 共享 TypeScript 类型
├── routes/            # 路由模块（16 个）
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
└── utils/             # 工具模块（7 个）
    ├── validation.ts  #   输入校验与安全过滤
    ├── hackathon.ts   #   活动业务逻辑
    ├── email.ts       #   邮件发送
    ├── crypto.ts      #   加密工具
    ├── activity.ts    #   操作日志记录
    ├── documents.ts   #   文件处理
    └── formatting.ts  #   格式化工具
```

### 安全机制
- **JWT 认证**：admin/judge 独立令牌，支持 issuer/audience 校验
- **输入校验**：全字段白名单 + 长度限制 + SQL 注入/XSS 过滤
- **速率限制**：全局 API 限流 + 登录/提交接口独立限流
- **CORS**：按域名白名单配置
- **文件上传**：类型白名单 + 大小限制 + 文件名安全过滤

---

## 🚀 快速开始

### 环境要求
- Node.js 20+
- Docker + Docker Compose

### 一键启动
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install
npm run dev:up
```

自动完成：启动 PostgreSQL → 同步数据库 → 启动前后端开发服务。首次进入通过 Setup Wizard 创建管理员。

常用命令：
```bash
npm run dev:up:seed    # 初始化演示数据
npm run dev:down       # 关闭数据库容器
npm run db:reset       # 重置到初始状态
npm run db:reset:seed  # 重置并写入演示数据
```

### 默认账号（seed）
| 角色 | 邮箱 | 密码 |
|---|---|---|
| 管理员 | `admin@openhackathon.com` | `password` |
| 备用管理员 | `ops@openhackathon.com` | `password` |
| 评委 | `alice@techgiants.com` | `password` |
| 空评委 | `judge1@openhackathon.com` | `password` |

完整 seed 包含 **10** 个账号、**7** 场 hackathon、**32** 个项目、**44** 条评审任务，覆盖 active/upcoming/draft/judging/completed 五类状态。

---

## 🧪 测试

```bash
npm run test:unit    # 单元测试（111 passed）
npm run test:api     # API 集成测试（43 passed）
npm run test:e2e     # E2E 端到端测试
npm run lint         # ESLint（0 errors）
npx tsc --noEmit     # TypeScript 类型检查
```

---

## 🏗️ 部署

### 在线演示
> **体验地址：http://49.234.25.35**（腾讯云，国内可直接访问）

### 一键部署（Ubuntu）
```bash
curl -fsSL https://raw.githubusercontent.com/frankfika/openhackathon/main/scripts/deploy-server.sh | bash
```

### 自动部署（CI/CD）
推送到 `main` 分支后 GitHub Actions 自动部署（约 2 分钟）：
```bash
git push origin main
```

### Docker Compose
```bash
docker compose up -d --build
```

默认端口：`5173`（Web）、`3001`（API）、`5432`（PostgreSQL）、`8080`（Adminer）

---

## 📧 邮件与安全配置

<details>
<summary>提交回执邮件</summary>

```bash
SUBMISSION_EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SUBMISSION_RECEIPT_FROM="OpenHackathon <no-reply@example.com>"
SUBMISSION_RECEIPT_SUBJECT="[{{hackathonTitle}}] Submission Receipt {{receiptId}}"
```
</details>

<details>
<summary>安全变量</summary>

```bash
JWT_SECRET=your_strong_random_secret
JWT_ISSUER=openhackathon
JWT_AUDIENCE=openhackathon-clients
CORS_ORIGINS=https://your-domain.com
CORS_ALLOW_ALL=false
TRUST_PROXY=1
API_RATE_LIMIT_MAX=1200
AUTH_RATE_LIMIT_MAX=20
SUBMISSION_RATE_LIMIT_MAX=30
```

> 生产环境务必设置强随机 `JWT_SECRET`，完整示例见 `.env.example`。
</details>

---

## 📄 License
MIT
