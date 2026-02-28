<div align="center">

# OpenHackathon
> 开源黑客松管理平台 · Open Source Hackathon Management Platform

![OpenHackathon Home](./docs/assets/home.png)

![Version](https://img.shields.io/badge/Version-1.1.0-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

[核心能力](#-核心能力) • [界面截图](#-界面截图) • [快速开始](#-快速开始) • [部署](#-部署) • [发布](#-发布)

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

## 🖼️ 界面截图
| 首页 | 项目页 | 排行榜 |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Projects](./docs/assets/projects.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

| 评审页 | 设置页 | 晋级管理 |
|---|---|---|
| ![Judging](./docs/assets/judging.png) | ![Settings](./docs/assets/settings.png) | ![Promotions](./docs/assets/promotions.png) |

## 🚀 快速开始
### 环境要求
- Node.js 20+（推荐）
- PostgreSQL 15+

### 本地开发
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install

# 初始化数据库
npx prisma db push
npm run db:seed

# 启动前后端
npm run dev
```

默认账号（seed）：
- 管理员：`admin@openhackathon.com` / `password`
- 评委：`alice@techgiants.com` / `password`

### 测试
```bash
npm run test:unit
npm run test:api
npm run test:e2e
```

## 🏗️ 部署
### Docker Compose
```bash
docker compose up -d --build
```

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
