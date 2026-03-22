# Admin UX Simplification Plan

## Problem
管理员登录后不知道该怎么操作。侧边栏 8 个平铺的导航项没有分组，页面之间的关系不清晰，术语不统一（"活动" vs "黑客松"）。

## Core Changes

### 1. Sidebar: 分组 + 精简
**现状**: Dashboard / 项目展示 / 评审分配 / 晋级管理 / 评审报告 / 排行榜 / 赛事设置 / 站点设置 — 8项平铺
**改为**: 分成 3 个逻辑组，用小标题分隔

```
[黑客松切换器]

── 总览 ──
  工作台

── 赛事管理 ──
  项目管理
  评审中心          ← 合并：评审分配 + 评审管理 + 晋级管理 + 评审报告
  排行榜

── 设置 ──
  赛事设置
  站点设置
```

关键改动：把「评审分配」「晋级管理」「评审报告」合并到「评审中心」页面里，用 Tab 切换。侧边栏从 8 项减到 5 项。

### 2. 评审中心页 (Judging Hub)
在 `/admin/judging` 路由下，用顶部 Tab 切换：
- **分配** (原 AssignmentManager)
- **评审进度** (原 Judging)
- **晋级** (原 PromotionManager)
- **报告** (原 ScoringReport)

路由结构：
```
/admin/judging              → 默认显示「评审进度」tab
/admin/judging?tab=assign   → 分配 tab
/admin/judging?tab=promote  → 晋级 tab
/admin/judging?tab=report   → 报告 tab
/admin/judging/:id          → 评审详情 (保持不变)
```

旧路由 `/admin/assignments`、`/admin/promotions`、`/admin/reports` 加 redirect。

### 3. Dashboard: 引导式工作台
根据黑客松当前状态显示不同的「下一步」提示：
- **draft**: "完成赛事配置" → 引导去 Setup Wizard
- **active**: "查看已提交的项目" + "分配评审任务"
- **judging**: "查看评审进度" + "晋级管理"
- **completed**: "发布排行榜"

去掉 6 个 Quick Action 卡片（跟侧边栏重复），改为 2-3 个上下文相关的操作按钮。

### 4. 术语统一
zh.json 里所有 "活动" 改为 "黑客松"：
- "创建活动" → "创建黑客松"
- "活动列表" → "黑客松列表"
- "活动设置" → "赛事设置" (保持)
- "活动标语" → "标语"
- etc.

### 5. 去掉 Hackathons 列表页
`/admin/hackathons` 页面跟侧边栏的 HackathonSwitcher 功能重复。把它从侧边栏去掉，只保留 HackathonSwitcher 里的 "管理所有黑客松" 链接。HackathonSwitcher 已经能创建和切换黑客松。

## Files to Change

| File | Change |
|------|--------|
| `src/components/DashboardLayout.tsx` | 侧边栏分组、精简导航项 |
| `src/pages/JudgingHub.tsx` **(new)** | 评审中心：Tab 容器，内嵌 4 个子组件 |
| `src/App.tsx` | 路由调整：`/admin/judging` 指向 JudgingHub，旧路由 redirect |
| `src/components/dashboard/AdminDashboard.tsx` | 引导式工作台，去掉 Quick Actions |
| `src/lib/locales/zh.json` | 术语统一 |
| `src/lib/locales/en.json` | 对应英文更新 |

## Out of Scope (后续单独做)
- Initial setup wizard (首次安装引导)
- 超级管理员权限体系
- 评审详情页 UI 改进
