## 1. 架构设计

### 1.1 多租户SaaS架构

```mermaid
graph TD
  A[用户浏览器] --> B[CDN + 负载均衡]
  B --> C[前端应用层]
  C --> D[API网关]
  D --> E[租户识别中间件]
  E --> F[业务服务层]
  F --> G[数据访问层]
  G --> H[多租户数据库]
  
  subgraph "前端应用层"
    C1[React 18 + TypeScript]
    C2[i18n国际化]
    C3[PWA离线支持]
  end
  
  subgraph "API网关层"
    D1[认证授权]
    D2[限流熔断]
    D3[API版本管理]
    D4[多租户路由]
  end
  
  subgraph "业务服务层"
    F1[活动管理服务]
    F2[评审服务]
    F3[AI服务]
    F4[计费服务]
    F5[通知服务]
  end
  
  subgraph "数据层"
    G1[租户数据隔离]
    G2[缓存层]
    G3[文件存储]
  end
  
  subgraph "基础设施"
    H1[PostgreSQL多租户]
    H2[Redis集群]
    H3[对象存储]
    H4[消息队列]
  end
  
  C --> C1
  C1 --> C2
  C1 --> C3
  
  D --> D1
  D --> D2
  D --> D3
  D --> D4
  
  F --> F1
  F --> F2
  F --> F3
  F --> F4
  F --> F5
  
  G --> G1
  G --> G2
  G --> G3
  
  H --> H1
  H --> H2
  H --> H3
  H --> H4
```

### 4.10 AI服务API

```typescript
// AI评委评分
POST /api/ai/judge/score

请求:
{
  projectId: string
  judgePersona: 'tech' | 'design' | 'product'
  criteria: {
    innovation: number
    technology: number
    completion: number
    presentation: number
  }
}

响应:
{
  scores: {
    innovation: number
    technology: number
    completion: number
    presentation: number
  }
  comments: string
  strengths: string[]
  weaknesses: string[]
  confidence: number
}
```

```typescript
// 智能队友匹配
POST /api/ai/team/match

请求:
{
  userId: string
  hackathonId: string
  skills: string[]
  preferences: {
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
    commitment: 'part-time' | 'full-time'
    teamSize: number
  }
}

响应:
{
  matches: {
    userId: string
    name: string
    skills: string[]
    matchScore: number
    reason: string
  }[]
}
```

```typescript
// 内容生成
POST /api/ai/content/generate

请求:
{
  type: 'hackathon-description' | 'judging-criteria' | 'prize-description'
  context: {
    theme: string
    duration: string
    targetAudience: string
    requirements: string[]
  }
}

响应:
{
  content: string
  suggestions: string[]
  metadata: {
    length: number
    tone: string
    keywords: string[]
  }
}
```

```typescript
// 抄袭检测
POST /api/ai/plagiarism/check

请求:
{
  projectId: string
  content: {
    code?: string
    description: string
    techStack: string[]
  }
}

响应:
{
  similarity: number
  sources: {
    url: string
    similarity: number
    type: 'code' | 'description' | 'idea'
  }[]
  riskLevel: 'low' | 'medium' | 'high'
  recommendations: string[]
}
```

```typescript
// 内容审核
POST /api/ai/moderation/check

请求:
{
  content: string
  type: 'project' | 'comment' | 'review'
  context?: string
}

响应:
{
  isSafe: boolean
  violations: {
    category: string
    severity: 'low' | 'medium' | 'high'
    description: string
  }[]
  suggestedEdits?: string[]
}
```mermaid
graph TD
  A[用户浏览器] --> B[React前端应用]
  B --> C[Supabase客户端SDK]
  C --> D[Supabase认证服务]
  C --> E[Supabase数据库]
  C --> F[Supabase存储服务]
  C --> G[Supabase实时功能]
  
  H[超级管理员后台] --> I[专用管理API]
  I --> J[权限管理系统]
  I --> K[项目分配引擎]
  I --> L[安全审计服务]
  
  M[评委移动端] --> N[PWA应用]
  N --> O[离线评审缓存]
  N --> P[实时同步服务]
  
  subgraph "前端应用层"
    B
    N
  end
  
  subgraph "Supabase服务层"
    D
    E
    F
    G
  end
  
  subgraph "管理服务平台"
    I
    J
    K
    L
  end
  
  subgraph "安全与监控"
    Q[数据加密服务]
    R[访问日志系统]
    S[异常检测引擎]
  end
  
  subgraph "AI服务层"
    T[AI服务API]
    U[任务队列]
    V[向量数据库]
    W[LLM集成]
  end
  
  B --> T
  T --> U
  U --> V
  T --> W
```

## 2. 技术描述

### 2.1 核心技术栈
- **前端框架**: React 18 + TypeScript + Vite
- **国际化**: react-i18next + i18next-browser-languagedetector
- **状态管理**: Zustand + React Query
- **UI组件**: 自定义Apple风格组件库 + Framer Motion动画
- **样式框架**: Tailwind CSS 3 + 玻璃拟态自定义样式
- **图标**: SF Symbols风格图标库 + Lucide React
- **移动端**: PWA + Workbox离线缓存
- **初始化工具**: vite-init

### 2.2 后端服务架构
- **API网关**: Kong + 自定义插件
- **认证授权**: Supabase Auth + JWT
- **多租户中间件**: 自定义租户识别与隔离
- **业务服务**: Node.js + Express + TypeScript
- **数据库**: PostgreSQL 15 (多租户架构)
- **缓存**: Redis集群 + CDN边缘缓存
- **文件存储**: Supabase Storage + S3兼容
- **消息队列**: Bull Queue + Redis
- **搜索引擎**: Elasticsearch (企业版)

### 2.3 AI服务架构
- **AI服务**: Vercel AI SDK + OpenAI API
- **向量数据库**: pgvector (PostgreSQL扩展)
- **任务队列**: Redis + Bull Queue
- **模型管理**: 支持多模型切换(GPT-4, Claude, Gemini)
- **AI配置**: 支持OpenAI兼容网关和私有化部署

- **前端框架**: React 18 + TypeScript + Vite
- **样式框架**: Tailwind CSS 3 + 玻璃拟态自定义样式
- **状态管理**: Zustand + React Query
- **UI组件**: 自定义Apple风格组件库 + Framer Motion动画
- **图标**: SF Symbols风格图标库 + Lucide React
- **初始化工具**: vite-init
- **移动端**: PWA + Workbox离线缓存
- **后端服务**: Supabase (认证、数据库、存储、实时)
- **安全服务**: 自研权限管理 + 数据加密服务
- **部署方式**: Docker + Kubernetes
- **数据库**: PostgreSQL 15 (通过Supabase)
- **缓存**: Redis集群 + CDN边缘缓存
- **文件存储**: Supabase Storage + 加密备份
- **监控服务**: 自研性能监控 + 异常检测
- **AI服务**: Vercel AI SDK + OpenAI API
- **任务队列**: Bull Queue + Redis
- **向量数据库**: pgvector (PostgreSQL扩展)

## 3. 国际化路由与配置

### 3.1 多语言路由配置

| 路由 | 用途 | 语言支持 |
|------|------|----------|
| / | 平台首页，自动检测语言 | zh-CN, en-US |
| /zh-CN/* | 中文版本路由 | 简体中文 |
| /en-US/* | 英文版本路由 | 英语 |
| /auth/login | 用户登录页面，支持语言切换 | 多语言 |
| /auth/register | 用户注册页面，支持社交登录 | 多语言 |
| /auth/forgot-password | 忘记密码页面 | 多语言 |
| /judge/register | 评委专用注册页面 | 多语言 |
| /judge/dashboard | 评委个人中心 | 多语言 |
| /judge/review | 在线评审系统 | 多语言 |
| /judge/assignments | 分配项目列表 | 多语言 |
| /sessions | 比赛Session管理 | 多语言 |
| /sessions/[id] | Session详情和项目分配 | 多语言 |
| /hackathons | 黑客松活动列表 | 多语言 |
| /hackathons/[id] | 对外报名官网（多语言） | zh-CN, en-US |
| /hackathons/[id]/register | 活动报名页面 | 多语言 |
| /dashboard | 用户个人中心 | 多语言 |
| /dashboard/profile | 个人资料编辑 | 多语言 |
| /dashboard/teams | 我的团队管理 | 多语言 |
| /dashboard/projects | 我的项目列表 | 多语言 |
| /projects/submit | 作品提交页面 | 多语言 |
| /projects/[id] | 项目详情页面 | 多语言 |
| /voting | 公开投票页面 | 多语言 |
| /results | 获奖结果页面 | 多语言 |
| /super-admin | 超级管理后台 | 多语言 |
| /super-admin/sessions | Session管理 | 多语言 |
| /super-admin/assignments | 项目分配管理 | 多语言 |
| /super-admin/judges | 评委管理 | 多语言 |
| /super-admin/security | 安全审计 | 多语言 |
| /admin | 主办方管理后台 | 多语言 |
| /admin/hackathons | 活动管理 | 多语言 |
| /admin/users | 用户管理 | 多语言 |
| /admin/judging | 评审管理 | 多语言 |
| /admin/analytics | 数据统计 | 多语言 |
| /billing | 计费中心 | 多语言 |
| /settings/language | 语言设置 | 多语言 |
| /api/i18n/* | 国际化API | JSON格式 |

### 3.2 国际化实现方案

```typescript
// i18n配置
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  'zh-CN': {
    translation: require('./locales/zh-CN/translation.json'),
    common: require('./locales/zh-CN/common.json'),
    auth: require('./locales/zh-CN/auth.json'),
    hackathon: require('./locales/zh-CN/hackathon.json'),
    judging: require('./locales/zh-CN/judging.json'),
    billing: require('./locales/zh-CN/billing.json'),
  },
  'en-US': {
    translation: require('./locales/en-US/translation.json'),
    common: require('./locales/en-US/common.json'),
    auth: require('./locales/en-US/auth.json'),
    hackathon: require('./locales/en-US/hackathon.json'),
    judging: require('./locales/en-US/judging.json'),
    billing: require('./locales/en-US/billing.json'),
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });
```

| 路由 | 用途 |
|------|------|
| / | 平台首页，现代化展示和评委注册入口 |
| /auth/login | 用户登录页面，Apple风格设计 |
| /auth/register | 用户注册页面，支持评委注册 |
| /auth/forgot-password | 忘记密码页面 |
| /judge/register | 评委专用注册页面 |
| /judge/dashboard | 评委个人中心 |
| /judge/review | 在线评审系统 |
| /judge/assignments | 分配项目列表 |
| /sessions | 比赛Session管理 |
| /sessions/[id] | Session详情和项目分配 |
| /hackathons | 黑客松活动列表 |
| /hackathons/[id] | 对外报名官网（活动官网页）：Banner/赛事说明/报名/日程/规则/FAQ |
| /hackathons/[id]/register | 活动报名页面 |
| /dashboard | 用户个人中心 |
| /dashboard/profile | 个人资料编辑 |
| /dashboard/teams | 我的团队管理 |
| /dashboard/projects | 我的项目列表 |
| /projects/submit | 作品提交页面 |
| /projects/[id] | 项目详情页面 |
| /voting | 公开投票页面 |
| /results | 获奖结果页面 |
| /super-admin | 超级管理后台 |
| /super-admin/sessions | Session管理 |
| /super-admin/assignments | 项目分配管理 |
| /super-admin/judges | 评委管理 |
| /super-admin/security | 安全审计 |
| /admin | 主办方管理后台 |
| /admin/hackathons | 活动管理 |
| /admin/users | 用户管理 |
| /admin/judging | 评审管理 |
| /admin/analytics | 数据统计 |
| /ai/judge-config | AI评委配置 | 配置AI评委角色和评分标准 |
| /ai/team-matcher | 智能匹配 | 基于技能的队友推荐系统 |
| /ai/content-generator | 内容生成 | 自动生成活动材料和评审标准 |
| /ai/plagiarism-check | 抄袭检测 | AI检测项目原创性和相似度 |
| /api/ai/* | AI服务API | 提供各种AI功能的API接口 |

## 4. API定义（多租户与国际化版本）

### 4.1 多租户认证相关API

```typescript
// 租户注册（SaaS）
POST /api/tenants/register

请求:
{
  name: string
  slug: string // 唯一标识
  email: string
  password: string
  plan: 'free' | 'pro' | 'enterprise'
  language: 'zh-CN' | 'en-US'
  timezone: string
  organization?: string
  contactInfo: {
    name: string
    phone?: string
    position?: string
  }
}

响应:
{
  tenant: Tenant
  user: User
  session: Session
  setupUrl: string
  message: string
}
```

```typescript
// 多租户用户登录
POST /api/:tenantSlug/auth/login

请求:
{
  email: string
  password: string
  rememberMe?: boolean
  language?: 'zh-CN' | 'en-US'
}

响应:
{
  user: User
  tenant: Tenant
  session: Session
  permissions: Permission[]
  i18n: {
    language: string
    translations: Record<string, any>
  }
  redirectUrl?: string
}
```

```typescript
// 切换租户
POST /api/tenants/switch

请求:
{
  tenantId: string
  userId: string
}

响应:
{
  tenant: Tenant
  session: Session
  permissions: Permission[]
  message: string
}
```

```typescript
// 用户注册
POST /api/auth/register

请求:
{
  email: string
  password: string
  name: string
  role: 'participant' | 'organizer'
  organization?: string
}

响应:
{
  user: User
  session: Session
  message: string
}
```

```typescript
// 用户登录
POST /api/auth/login

请求:
{
  email: string
  password: string
}

响应:
{
  user: User
  session: Session
  redirectUrl?: string
}
```

### 4.2 国际化活动管理API

```typescript
// 创建多语言活动
POST /api/:tenantSlug/hackathons

请求:
{
  translations: {
    'zh-CN': {
      title: string
      description: string
      requirements: string[]
      prizes: PrizeTranslation[]
    }
    'en-US': {
      title: string
      description: string
      requirements: string[]
      prizes: PrizeTranslation[]
    }
  }
  startDate: string
  endDate: string
  maxTeamSize: number
  settings: {
    allowInternationalTeams: boolean
    defaultLanguage: 'zh-CN' | 'en-US'
    timezone: string
    currency: 'CNY' | 'USD'
  }
}

响应:
{
  hackathon: Hackathon
  translations: Record<string, HackathonTranslation>
  message: string
}
```

```typescript
// 创建活动
POST /api/hackathons

请求:
{
  title: string
  description: string
  startDate: string
  endDate: string
  maxTeamSize: number
  prizes: Prize[]
  requirements: string[]
}

响应:
{
  hackathon: Hackathon
  message: string
}
```

```typescript
// 获取活动列表
GET /api/hackathons?page=1&limit=10&status=active

响应:
{
  hackathons: Hackathon[]
  total: number
  page: number
  limit: number
}
```

### 4.3 计费中心API

```typescript
// 获取计费信息
GET /api/:tenantSlug/billing/info

响应:
{
  plan: 'free' | 'pro' | 'enterprise'
  usage: {
    hackathons: { used: number, limit: number }
    participants: { used: number, limit: number }
    storage: { used: number, limit: number }
    aiCalls: { used: number, limit: number }
  }
  billingCycle: {
    startDate: string
    endDate: string
    nextBillingDate: string
  }
  paymentMethod?: {
    type: 'card' | 'paypal' | 'alipay' | 'wechat'
    last4?: string
    expiryDate?: string
  }
}
```

```typescript
// 升级套餐
POST /api/:tenantSlug/billing/upgrade

请求:
{
  plan: 'pro' | 'enterprise'
  paymentMethod: {
    type: 'card' | 'paypal' | 'alipay' | 'wechat'
    token: string
  }
  billingCycle: 'monthly' | 'yearly'
}

响应:
{
  subscription: Subscription
  invoice: Invoice
  message: string
}
```

```typescript
// 获取用量报告
GET /api/:tenantSlug/billing/usage?startDate=string&endDate=string

响应:
{
  usage: {
    hackathons: UsageRecord[]
    participants: UsageRecord[]
    storage: UsageRecord[]
    aiCalls: UsageRecord[]
  }
  totalCost: number
  currency: 'CNY' | 'USD'
}
```

```typescript
// 活动报名
POST /api/hackathons/[id]/register

请求:
{
  teamId?: string // 加入现有团队
  createTeam?: {
    name: string
    description: string
  }
  skills: string[]
  experience: string
}

响应:
{
  registration: Registration
  team?: Team
  message: string
}
```

### 4.4 项目管理API

```typescript
// 提交项目
POST /api/projects

请求:
{
  hackathonId: string
  title: string
  description: string
  techStack: string[]
  demoUrl?: string
  repositoryUrl?: string
  videoUrl?: string
  images: string[] // 上传的图片文件ID
}

响应:
{
  project: Project
  message: string
}
```

```typescript
// 更新项目
PUT /api/projects/[id]

请求:
{
  title?: string
  description?: string
  demoUrl?: string
  repositoryUrl?: string
  videoUrl?: string
}

响应:
{
  project: Project
  message: string
}
```

### 4.5 评审API

```typescript
// 提交评审
POST /api/judging

请求:
{
  projectId: string
  scores: {
    innovation: number // 1-10
    technology: number // 1-10
    completion: number // 1-10
    presentation: number // 1-10
  }
  comments: string
  strengths: string[]
  weaknesses: string[]
}

响应:
{
  review: Review
  message: string
}
```

### 4.6 Session管理API

```typescript
// 创建比赛Session
POST /api/sessions

请求:
{
  name: string
  type: 'preliminary' | 'semi_final' | 'final'
  hackathonId: string
  startDate: string
  endDate: string
  description?: string
}

响应:
{
  session: Session
  message: string
}
```

```typescript
// 分配项目给评委
POST /api/sessions/[id]/assignments

请求:
{
  judgeId: string
  projectIds: string[]
  assignmentType: 'auto' | 'manual'
}

响应:
{
  assignments: Assignment[]
  message: string
}
```

### 4.7 评委管理API

```typescript
// 评委注册
POST /api/judges/register

请求:
{
  email: string
  password: string
  name: string
  expertise: string[]
  experience: string
  credentials: string
}

响应:
{
  judge: Judge
  message: string
}
```

```typescript
// 审核评委
PUT /api/judges/[id]/approve

请求:
{
  status: 'approved' | 'rejected'
  reason?: string
}

响应:
{
  judge: Judge
  message: string
}
```

### 4.8 安全审计API

```typescript
// 获取审计日志
GET /api/audit/logs?userId=string&startDate=string&endDate=string

响应:
{
  logs: AuditLog[]
  total: number
  page: number
  limit: number
}
```

### 4.9 投票API

```typescript
// 提交投票
POST /api/voting

请求:
{
  projectId: string
  voterEmail?: string // 可选，匿名投票时不需要
  recaptchaToken?: string // 人机验证
}

响应:
{
  vote: Vote
  dailyLimit: number
  remainingVotes: number
  message: string
}
```

## 5. 多租户数据模型

### 5.1 多租户数据模型定义

```mermaid
erDiagram
  TENANTS ||--o{ USERS : has
  TENANTS ||--o{ HACKATHONS : hosts
  TENANTS ||--o{ SUBSCRIPTIONS : has
  TENANTS ||--o{ BILLING_RECORDS : generates
  
  USERS ||--o{ REGISTRATIONS : has
  USERS ||--o{ TEAMS : leads
  USERS ||--o{ PROJECTS : creates
  USERS ||--o{ REVIEWS : writes
  USERS ||--o{ VOTES : casts
  
  HACKATHONS ||--o{ REGISTRATIONS : has
  HACKATHONS ||--o{ PROJECTS : receives
  HACKATHONS ||--o{ PRIZES : offers
  HACKATHONS ||--o{ TRANSLATIONS : has
  
  TEAMS ||--o{ TEAM_MEMBERS : has
  TEAMS ||--o{ PROJECTS : submits
  
  PROJECTS ||--o{ REVIEWS : receives
  PROJECTS ||--o{ VOTES : receives
  PROJECTS ||--o{ PROJECT_IMAGES : has
  PROJECTS ||--o{ AI_REVIEWS : analyzed_by
  
  SUBSCRIPTIONS ||--o{ BILLING_RECORDS : generates
  SUBSCRIPTIONS }o--o{ PLANS : based_on
```

```mermaid
erDiagram
  USERS ||--o{ REGISTRATIONS : has
  USERS ||--o{ TEAMS : leads
  USERS ||--o{ PROJECTS : creates
  USERS ||--o{ REVIEWS : writes
  USERS ||--o{ VOTES : casts
  
  HACKATHONS ||--o{ REGISTRATIONS : has
  HACKATHONS ||--o{ PROJECTS : receives
  HACKATHONS ||--o{ PRIZES : offers
  
  TEAMS ||--o{ TEAM_MEMBERS : has
  TEAMS ||--o{ PROJECTS : submits
  
  PROJECTS ||--o{ REVIEWS : receives
  PROJECTS ||--o{ VOTES : receives
  PROJECTS ||--o{ PROJECT_IMAGES : has
  
  TENANTS {
    uuid id PK
    string slug UK
    string name
    string email UK
    string plan
    json settings
    string timezone
    string default_language
    boolean is_active
    timestamp created_at
    timestamp updated_at
  }
  
  SUBSCRIPTIONS {
    uuid id PK
    uuid tenant_id FK
    string plan
    json limits
    string status
    timestamp start_date
    timestamp end_date
    timestamp next_billing_date
    json payment_method
    timestamp created_at
    timestamp updated_at
  }
  
  BILLING_RECORDS {
    uuid id PK
    uuid tenant_id FK
    uuid subscription_id FK
    string type
    decimal amount
    string currency
    json usage
    string status
    timestamp billing_period_start
    timestamp billing_period_end
    timestamp created_at
  }
  
  TRANSLATIONS {
    uuid id PK
    uuid hackathon_id FK
    string language
    string title
    text description
    json requirements
    json prizes
    json metadata
    timestamp created_at
    timestamp updated_at
  }
  
  USERS {
    uuid id PK
    string email UK
    string password_hash
    string name
    string avatar_url
    string role
    string organization
    string[] skills
    json metadata
    boolean mfa_enabled
    string mfa_secret
    timestamp last_login_at
    timestamp created_at
    timestamp updated_at
  }
  
  HACKATHONS {
    uuid id PK
    string title
    text description
    timestamp start_date
    timestamp end_date
    string status
    integer max_team_size
    json settings
    uuid organizer_id FK
    timestamp created_at
    timestamp updated_at
  }
  
  REGISTRATIONS {
    uuid id PK
    uuid user_id FK
    uuid hackathon_id FK
    uuid team_id FK
    string status
    json additional_info
    timestamp registered_at
  }
  
  TEAMS {
    uuid id PK
    string name
    text description
    uuid leader_id FK
    uuid hackathon_id FK
    integer member_count
    timestamp created_at
  }
  
  TEAM_MEMBERS {
    uuid id PK
    uuid team_id FK
    uuid user_id FK
    string role
    timestamp joined_at
  }
  
  SESSIONS {
    uuid id PK
    string name
    string type
    uuid hackathon_id FK
    timestamp start_date
    timestamp end_date
    string status
    text description
    json settings
    timestamp created_at
    timestamp updated_at
  }
  
  ASSIGNMENTS {
    uuid id PK
    uuid session_id FK
    uuid judge_id FK
    uuid project_id FK
    string status
    timestamp assigned_at
    timestamp completed_at
    json metadata
  }
  
  JUDGES {
    uuid id PK
    uuid user_id FK
    string[] expertise
    string experience
    string credentials
    string status
    float rating
    integer review_count
    json metadata
    timestamp approved_at
    timestamp created_at
  }
  
  AUDIT_LOGS {
    uuid id PK
    uuid user_id FK
    string action
    string resource_type
    uuid resource_id
    json changes
    string ip_address
    string user_agent
    timestamp created_at
  }
  
  REVIEWS {
    uuid id PK
    uuid project_id FK
    uuid reviewer_id FK
    json scores
    text comments
    string[] strengths
    string[] weaknesses
    timestamp created_at
  }
  
  VOTES {
    uuid id PK
    uuid project_id FK
    uuid user_id FK
    string voter_email
    string ip_address
    timestamp voted_at
  }
  
  PRIZES {
    uuid id PK
    uuid hackathon_id FK
    string name
    text description
    integer position
    string prize_type
    json metadata
  }
```

### 8.2 AI相关数据模型

```mermaid
erDiagram
  AI_JUDGES ||--o{ AI_REVIEWS : generates
  AI_JUDGES ||--o{ AI_JUDGE_PERSONAS : has
  AI_REVIEWS ||--o{ AI_SCORES : contains
  PROJECTS ||--o{ AI_REVIEWS : analyzed_by
  USERS ||--o{ AI_MATCHES : receives
  AI_MATCHES }o--o{ USERS : recommends
  
  AI_JUDGES {
    uuid id PK
    string name
    string persona_type
    json capabilities
    boolean is_active
    timestamp created_at
  }
  
  AI_JUDGE_PERSONAS {
    uuid id PK
    uuid ai_judge_id FK
    string persona_name
    string description
    json scoring_criteria
    json personality_traits
  }
  
  AI_REVIEWS {
    uuid id PK
    uuid project_id FK
    uuid ai_judge_id FK
    json scores
    string feedback
    float confidence_score
    json reasoning
    timestamp created_at
  }
  
  AI_SCORES {
    uuid id PK
    uuid ai_review_id FK
    string criterion
    float score
    string justification
    json breakdown
  }
  
  AI_MATCHES {
    uuid id PK
    uuid user_id FK
    uuid recommended_user_id FK
    uuid hackathon_id FK
    float match_score
    json match_reasons
    string status
    timestamp created_at
  }
  
  GENERATED_CONTENTS {
    uuid id PK
    string content_type
    string content
    json context
    uuid generated_by FK
    json metadata
    timestamp created_at
  }
  
  PLAGIARISM_CHECKS {
    uuid id PK
    uuid project_id FK
    float similarity_score
    json detected_sources
    string risk_level
    json recommendations
    timestamp checked_at
  }
  
  CONTENT_MODERATIONS {
    uuid id PK
    string content_type
    string content
    boolean is_safe
    json violations
    json suggested_edits
    timestamp moderated_at
  }
  
  VECTOR_EMBEDDINGS {
    uuid id PK
    string content_type
    uuid content_id FK
    vector embedding
    json metadata
    timestamp created_at
  }
```

### 8.3 数据定义语言

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('participant', 'organizer', 'judge', 'super_admin', 'voter')),
  organization VARCHAR(255),
  skills TEXT[],
  metadata JSONB DEFAULT '{}',
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(32),
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 黑客松活动表
CREATE TABLE hackathons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'active', 'judging', 'completed')),
  max_team_size INTEGER DEFAULT 4,
  settings JSONB DEFAULT '{}',
  organizer_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 报名表
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  team_id UUID,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  additional_info JSONB DEFAULT '{}',
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, hackathon_id)
);

-- 团队表
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  leader_id UUID NOT NULL REFERENCES users(id),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 团队成员表
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  tech_stack TEXT[],
  demo_url TEXT,
  repository_url TEXT,
  video_url TEXT,
  vote_count INTEGER DEFAULT 0,
  average_score DECIMAL(3,2) DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 评审表
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  comments TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, reviewer_id)
);

-- 投票表
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  voter_email VARCHAR(255),
  ip_address INET,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 奖项表
CREATE TABLE prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position INTEGER,
  prize_type VARCHAR(50),
  metadata JSONB DEFAULT '{}'
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_hackathons_status ON hackathons(status);
CREATE INDEX idx_hackathons_dates ON hackathons(start_date, end_date);
CREATE INDEX idx_registrations_user_hackathon ON registrations(user_id, hackathon_id);
CREATE INDEX idx_registrations_hackathon ON registrations(hackathon_id);
CREATE INDEX idx_teams_hackathon ON teams(hackathon_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_projects_hackathon ON projects(hackathon_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_vote_count ON projects(vote_count DESC);
CREATE INDEX idx_projects_average_score ON projects(average_score DESC);
CREATE INDEX idx_reviews_project ON reviews(project_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_votes_project ON votes(project_id);
CREATE INDEX idx_votes_user_date ON votes(user_id, voted_at);
CREATE INDEX idx_prizes_hackathon ON prizes(hackathon_id);

-- AI相关表
-- AI评委表
CREATE TABLE ai_judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  persona_type VARCHAR(50) NOT NULL CHECK (persona_type IN ('tech', 'design', 'product', 'general')),
  capabilities JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI评委人格表
CREATE TABLE ai_judge_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_judge_id UUID NOT NULL REFERENCES ai_judges(id) ON DELETE CASCADE,
  persona_name VARCHAR(255) NOT NULL,
  description TEXT,
  scoring_criteria JSONB DEFAULT '{}',
  personality_traits JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI评审表
CREATE TABLE ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ai_judge_id UUID NOT NULL REFERENCES ai_judges(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  feedback TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  reasoning JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI评分表
CREATE TABLE ai_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_review_id UUID NOT NULL REFERENCES ai_reviews(id) ON DELETE CASCADE,
  criterion VARCHAR(50) NOT NULL,
  score DECIMAL(3,2) NOT NULL,
  justification TEXT,
  breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI匹配表
CREATE TABLE ai_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommended_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL,
  match_reasons JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, recommended_user_id, hackathon_id)
);

-- 生成内容表
CREATE TABLE generated_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 抄袭检测表
CREATE TABLE plagiarism_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  similarity_score DECIMAL(3,2) NOT NULL,
  detected_sources JSONB DEFAULT '{}',
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  recommendations JSONB DEFAULT '{}',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 内容审核表
CREATE TABLE content_moderations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  is_safe BOOLEAN NOT NULL,
  violations JSONB DEFAULT '{}',
  suggested_edits JSONB DEFAULT '{}',
  moderated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 向量嵌入表
CREATE TABLE vector_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content_id UUID NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建AI相关索引
CREATE INDEX idx_ai_judges_persona ON ai_judges(persona_type);
CREATE INDEX idx_ai_judges_active ON ai_judges(is_active);
CREATE INDEX idx_ai_reviews_project ON ai_reviews(project_id);
CREATE INDEX idx_ai_reviews_judge ON ai_reviews(ai_judge_id);
CREATE INDEX idx_ai_scores_review ON ai_scores(ai_review_id);
CREATE INDEX idx_ai_matches_user ON ai_matches(user_id);
CREATE INDEX idx_ai_matches_hackathon ON ai_matches(hackathon_id);
CREATE INDEX idx_ai_matches_score ON ai_matches(match_score DESC);
CREATE INDEX idx_generated_contents_type ON generated_contents(content_type);
CREATE INDEX idx_plagiarism_checks_project ON plagiarism_checks(project_id);
CREATE INDEX idx_plagiarism_checks_score ON plagiarism_checks(similarity_score DESC);
CREATE INDEX idx_content_moderations_type ON content_moderations(content_type);
CREATE INDEX idx_vector_embeddings_type ON vector_embeddings(content_type);
CREATE INDEX idx_vector_embeddings_content ON vector_embeddings(content_id);

-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- AI表RLS策略
-- AI评委表：超级管理员可管理
ALTER TABLE ai_judges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "超级管理员可管理AI评委" ON ai_judges FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- AI评审表：根据项目权限控制
ALTER TABLE ai_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开查看AI评审" ON ai_reviews FOR SELECT USING (true);
CREATE POLICY "超级管理员可管理AI评审" ON ai_reviews FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- AI匹配表：用户可查看自己的匹配
ALTER TABLE ai_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可查看自己的匹配" ON ai_matches FOR SELECT USING (
  user_id = auth.uid() OR recommended_user_id = auth.uid()
);
CREATE POLICY "用户可更新自己的匹配状态" ON ai_matches FOR UPDATE USING (
  user_id = auth.uid()
);

-- 生成内容表：根据内容类型和权限控制
ALTER TABLE generated_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开查看生成内容" ON generated_contents FOR SELECT USING (true);
CREATE POLICY "创建者可管理生成内容" ON generated_contents FOR ALL USING (
  generated_by = auth.uid()
);

-- 抄袭检测表：根据项目权限控制
ALTER TABLE plagiarism_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "项目所有者可查看抄袭检测" ON plagiarism_checks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN teams t ON p.team_id = t.id
    JOIN team_members tm ON t.id = tm.team_id
    WHERE p.id = project_id AND tm.user_id = auth.uid()
  )
);
CREATE POLICY "主办方可查看活动抄袭检测" ON plagiarism_checks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN hackathons h ON p.hackathon_id = h.id
    WHERE p.id = plagiarism_checks.project_id AND h.organizer_id = auth.uid()
  )
);

-- 内容审核表：超级管理员可查看
ALTER TABLE content_moderations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "超级管理员可查看内容审核" ON content_moderations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 向量嵌入表：超级管理员可管理
ALTER TABLE vector_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "超级管理员可管理向量嵌入" ON vector_embeddings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Supabase RLS策略
-- 用户表：允许用户查看和更新自己的资料
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可查看所有用户资料" ON users FOR SELECT USING (true);
CREATE POLICY "用户可更新自己的资料" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "超级管理员可管理所有用户" ON users FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 活动表：公开查看，主办方可管理
ALTER TABLE hackathons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开查看活动" ON hackathons FOR SELECT USING (status != 'draft');
CREATE POLICY "主办方可管理活动" ON hackathons FOR ALL USING (
  organizer_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);
CREATE POLICY "超级管理员可管理所有活动" ON hackathons FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Session表：权限控制
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "公开查看Session" ON sessions FOR SELECT USING (status != 'draft');
CREATE POLICY "主办方可管理Session" ON sessions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM hackathons 
    WHERE id = hackathon_id AND organizer_id = auth.uid()
  )
);
CREATE POLICY "超级管理员可管理所有Session" ON sessions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 项目分配表：评委只能看到自己的分配
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "评委可查看自己的分配" ON assignments FOR SELECT USING (judge_id = auth.uid());
CREATE POLICY "主办方可查看活动的分配" ON assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s
    JOIN hackathons h ON s.hackathon_id = h.id
    WHERE s.id = session_id AND h.organizer_id = auth.uid()
  )
);
CREATE POLICY "超级管理员可管理所有分配" ON assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 评委表：权限控制
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "评委可查看和更新自己的信息" ON judges FOR ALL USING (user_id = auth.uid());
CREATE POLICY "主办方可查看评委信息" ON judges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);
CREATE POLICY "超级管理员可管理所有评委" ON judges FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 审计日志：只有超级管理员可查看
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "超级管理员可查看审计日志" ON audit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 报名表：用户管理自己的报名
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可查看自己的报名" ON registrations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "用户可创建自己的报名" ON registrations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "主办方可查看活动报名" ON registrations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM hackathons 
    WHERE id = hackathon_id AND organizer_id = auth.uid()
  )
);

-- Session表
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('preliminary', 'semi_final', 'final')),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'judging', 'completed')),
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目分配表
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(session_id, judge_id, project_id)
);

-- 评委表
CREATE TABLE judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expertise TEXT[],
  experience TEXT,
  credentials TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 审计日志表
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  changes JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_sessions_hackathon ON sessions(hackathon_id);
CREATE INDEX idx_sessions_type ON sessions(type);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_assignments_session ON assignments(session_id);
CREATE INDEX idx_assignments_judge ON assignments(judge_id);
CREATE INDEX idx_assignments_project ON assignments(project_id);
CREATE INDEX idx_assignments_status ON assignments(status);
CREATE INDEX idx_judges_user ON judges(user_id);
CREATE INDEX idx_judges_status ON judges(status);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### 5.2 多租户数据库设计

```sql
-- 租户表
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
  default_language VARCHAR(10) DEFAULT 'zh-CN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 订阅表
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  limits JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  payment_method JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 计费记录表
CREATE TABLE billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  type VARCHAR(50) NOT NULL CHECK (type IN ('subscription', 'usage', 'overage')),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CNY' CHECK (currency IN ('CNY', 'USD')),
  usage JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 翻译表
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL CHECK (language IN ('zh-CN', 'en-US', 'zh-TW', 'ja-JP', 'ko-KR')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT[],
  prizes JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(hackathon_id, language)
);

-- 多租户RLS策略
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "租户可查看自己的信息" ON tenants FOR SELECT USING (id = current_setting('app.current_tenant')::uuid);
CREATE POLICY "超级管理员可管理所有租户" ON tenants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- 为所有业务表添加租户ID
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE hackathons ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE sessions ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- 创建复合索引
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_hackathons_tenant ON hackathons(tenant_id);
CREATE INDEX idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_billing_tenant ON billing_records(tenant_id);
CREATE INDEX idx_translations_hackathon ON translations(hackathon_id);
```

## 6. AI服务架构与配置

### 6.1 AI服务架构与OpenAI兼容配置

```mermaid
graph TD
  A[前端应用] --> B[AI服务API]
  B --> C[租户验证]
  C --> D[AI配额检查]
  D --> E[模型路由]
  E --> F[OpenAI兼容API]
  E --> G[Anthropic API]
  E --> H[Google AI API]
  
  subgraph "AI服务层"
    B
    C
    D
    E
    I[缓存层]
    J[任务队列]
  end
  
  subgraph "模型提供商"
    F
    G
    H
    K[私有化部署]
  end
  
  subgraph "AI功能模块"
    L[智能评审]
    M[内容生成]
    N[队友匹配]
    O[抄袭检测]
    P[内容审核]
  end
  
  B --> I
  B --> J
  F --> K
```

### 6.2 OpenAI兼容配置管理

```typescript
// AI服务配置接口
interface AIServiceConfig {
  baseUrl: string              // OpenAI兼容网关地址
  apiKey: string               // API密钥（服务端存储）
  model: string                // 模型名称
  maxTokens?: number          // 最大token数
  temperature?: number        // 温度参数
  timeout?: number            // 超时时间
  rateLimit?: {               // 速率限制
    requests: number
    interval: number
  }
}

// 租户AI配置
interface TenantAIConfig {
  tenantId: string
  enabled: boolean
  configs: {
    judge: AIServiceConfig      // 评审AI
    content: AIServiceConfig    // 内容生成
    match: AIServiceConfig      // 队友匹配
    plagiarism: AIServiceConfig // 抄袭检测
    moderation: AIServiceConfig // 内容审核
  }
  usageLimits: {
    monthlyCalls: number
    dailyCalls: number
    maxTokens: number
  }
  currentUsage: {
    monthlyCalls: number
    dailyCalls: number
    totalTokens: number
  }
}
```

### 6.3 AI服务配置API（多租户）

```typescript
// 获取租户AI配置
GET /api/:tenantSlug/ai/config

响应:
{
  enabled: boolean
  configs: {
    judge: AIServiceConfig
    content: AIServiceConfig
    match: AIServiceConfig
    plagiarism: AIServiceConfig
    moderation: AIServiceConfig
  }
  usageLimits: {
    monthlyCalls: number
    dailyCalls: number
    maxTokens: number
  }
  currentUsage: {
    monthlyCalls: number
    dailyCalls: number
    totalTokens: number
  }
}
```

```typescript
// 更新AI配置（管理员）
PUT /api/:tenantSlug/ai/config

请求:
{
  enabled?: boolean
  configs?: {
    judge?: AIServiceConfig
    content?: AIServiceConfig
    match?: AIServiceConfig
    plagiarism?: AIServiceConfig
    moderation?: AIServiceConfig
  }
  usageLimits?: {
    monthlyCalls?: number
    dailyCalls?: number
    maxTokens?: number
  }
}

响应:
{
  config: TenantAIConfig
  message: string
}
```

```typescript
// 获取AI使用统计
GET /api/:tenantSlug/ai/usage?startDate=string&endDate=string

响应:
{
  usage: {
    daily: {
      date: string
      calls: number
      tokens: number
      cost: number
    }[]
    monthly: {
      month: string
      calls: number
      tokens: number
      cost: number
    }[]
  }
  totalUsage: {
    calls: number
    tokens: number
    cost: number
  }
  quotaUsage: {
    monthly: number // 百分比
    daily: number   // 百分比
  }
}
```

## 7. 多租户环境变量配置

```mermaid
graph TD
  A[前端应用] --> B[AI服务API]
  B --> C[任务队列]
  B --> D[LLM集成]
  C --> E[AI处理引擎]
  E --> F[向量数据库]
  E --> G[结果缓存]
  
  subgraph "AI服务层"
    B
    C
    D
    E
    F
    G
  end
  
  subgraph "外部AI服务"
    H[OpenAI API]
    I[Anthropic Claude]
    J[Google Gemini]
  end
  
  D --> H
  D --> I
  D --> J
```

### 6.2 AI服务组件

- **AI服务API**: 提供统一的AI功能接口
- **任务队列**: 处理异步AI任务，支持批量处理
- **LLM集成**: 支持多个大语言模型
- **向量数据库**: 存储和检索语义向量
- **结果缓存**: 缓存AI处理结果，提高性能
- **AI处理引擎**: 核心业务逻辑处理

### 6.3 AI功能模块

```typescript
// AI评委模块
interface AIJudgeService {
  scoreProject(project: Project, persona: JudgePersona): Promise<AIJudgeResult>
  generateFeedback(project: Project, criteria: ScoringCriteria): Promise<string>
  analyzeCodeQuality(code: string): Promise<CodeAnalysis>
}

// 智能匹配模块
interface TeamMatcherService {
  findTeammates(user: User, hackathon: Hackathon): Promise<UserMatch[]>
  analyzeSkillsCompatibility(skills1: string[], skills2: string[]): Promise<number>
  generateTeamRecommendations(team: Team): Promise<TeamRecommendation[]>
}

// 内容生成模块
interface ContentGeneratorService {
  generateHackathonDescription(context: HackathonContext): Promise<string>
  generateJudgingCriteria(theme: string): Promise<JudgingCriteria[]>
  generatePrizeDescription(prize: Prize): Promise<string>
}

// 抄袭检测模块
interface PlagiarismDetectionService {
  checkCodeSimilarity(code: string): Promise<SimilarityResult>
  checkDescriptionSimilarity(description: string): Promise<SimilarityResult>
  checkIdeaOriginality(idea: string): Promise<OriginalityResult>
}

// 内容审核模块
interface ContentModerationService {
  moderateContent(content: string, type: ContentType): Promise<ModerationResult>
  detectInappropriateContent(content: string): Promise<Violation[]>
  suggestImprovements(content: string): Promise<string[]>
}
```

## 7. 部署配置

### 7.1 Docker配置

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 7.2 Docker Compose配置

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL:-redis://redis:6379}
    depends_on:
      - redis
    volumes:
      - ./uploads:/app/uploads

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### 7.3 环境变量配置

```bash
# .env.example
# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/hackathon_platform

# Redis配置
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER_URL=redis://cluster.local:6379

# 邮件服务配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
ENCRYPTION_KEY=your-encryption-key

# 安全配置
JWT_SECRET=your-jwt-secret
MFA_ISSUER=黑客松评审平台
RECAPTCHA_SECRET_KEY=your-recaptcha-secret

# 平台配置
PLATFORM_NAME=开源黑客松平台
PLATFORM_URL=https://your-domain.com
ADMIN_EMAIL=admin@your-domain.com

# PWA配置
PWA_ENABLED=true
OFFLINE_CACHE_SIZE=50

# 监控配置
SENTRY_DSN=https://your-sentry-dsn
ANALYTICS_ID=your-analytics-id

# CDN配置
CDN_URL=https://cdn.your-domain.com
CDN_ENABLED=true
```

### 7.1 多租户环境变量配置

```bash
# 多租户配置
MULTI_TENANT_ENABLED=true
DEFAULT_TENANT_PLAN=free
TENANT_ISOLATION_LEVEL=schema  # schema, database, or row
MAX_TENANTS_PER_USER=10

# 国际化配置
DEFAULT_LANGUAGE=zh-CN
SUPPORTED_LANGUAGES=zh-CN,en-US,zh-TW,ja-JP,ko-KR
RTL_LANGUAGES=ar,he
CURRENCY_DEFAULT=CNY
CURRENCY_SUPPORTED=CNY,USD

# SaaS计费配置
BILLING_ENABLED=true
BILLING_PROVIDER=stripe  # stripe, paddle, or custom
BILLING_CYCLE=monthly
FREE_PLAN_LIMITS='{"hackathons":3,"participants":100,"storage":1073741824,"aiCalls":100}'
PRO_PLAN_LIMITS='{"hackathons":-1,"participants":1000,"storage":10737418240,"aiCalls":10000}'
ENTERPRISE_PLAN_LIMITS='{"hackathons":-1,"participants":-1,"storage":-1,"aiCalls":-1}'

# 支付配置
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_secret
ALIPAY_APP_ID=your_alipay_app_id
WECHAT_PAY_MCH_ID=your_wechat_mch_id

# 发票配置
INVOICE_ENABLED=true
INVOICE_PROVIDER=taxjar  # taxjar, avalara, or custom
TAX_RATES='{"CN":0.06,"US":0.08,"EU":0.20}'
```

### 7.2 AI服务环境变量（多租户OpenAI兼容版本）

```bash
# OpenAI 兼容配置（支持多租户）
AI_SERVICE_ENABLED=true
AI_MULTI_TENANT=true
AI_USAGE_TRACKING=true

# 默认AI配置（回退配置）
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-default-api-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=4096
OPENAI_TEMPERATURE=0.7
OPENAI_TIMEOUT=30000

# 多模型支持
ANTHROPIC_API_KEY=sk-your-default-anthropic-key
ANTHROPIC_MODEL=claude-3-haiku-20240307
ANTHROPIC_MAX_TOKENS=4096

GOOGLE_AI_API_KEY=your-default-google-ai-key
GOOGLE_AI_MODEL=gemini-pro
GOOGLE_AI_MAX_TOKENS=4096

# AI功能开关（可按租户配置）
AI_JUDGE_ENABLED=true
AI_TEAM_MATCHER_ENABLED=true
AI_CONTENT_GENERATOR_ENABLED=true
AI_PLAGIARISM_CHECK_ENABLED=true
AI_MODERATION_ENABLED=true

# AI配额限制（默认）
AI_FREE_DAILY_CALLS=100
AI_FREE_MONTHLY_CALLS=1000
AI_FREE_MAX_TOKENS=100000

AI_PRO_DAILY_CALLS=1000
AI_PRO_MONTHLY_CALLS=10000
AI_PRO_MAX_TOKENS=1000000

AI_ENTERPRISE_DAILY_CALLS=-1  # 无限制
AI_ENTERPRISE_MONTHLY_CALLS=-1  # 无限制
AI_ENTERPRISE_MAX_TOKENS=-1  # 无限制

# AI缓存配置
AI_CACHE_ENABLED=true
AI_CACHE_TTL=3600
AI_RESULT_CACHE_TTL=86400
AI_SIMILARITY_CACHE_TTL=604800

# 向量数据库配置
PGVECTOR_DIMENSION=1536
VECTOR_SEARCH_THRESHOLD=0.8
VECTOR_INDEX_TYPE=ivfflat
VECTOR_LISTS=100

# AI任务队列
AI_TASK_QUEUE=ai_tasks
AI_TASK_TIMEOUT=300000
AI_MAX_CONCURRENT_TASKS=10
AI_RETRY_ATTEMPTS=3
AI_RETRY_DELAY=5000
```

### 7.3 现代视觉风格技术实现

```typescript
// 设计系统配置
export const designSystem = {
  // 色彩系统（Apple风格）
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      500: '#0071e3', // Apple蓝
      600: '#0051a2',
      900: '#001f3f',
    },
    neutral: {
      50: '#ffffff',   // 纯白背景
      100: '#f5f5f7', // Apple灰
      200: '#e8e8ed',
      300: '#d2d2d7',
      500: '#86868b', // 中等灰
      700: '#515154',
      800: '#1d1d1f', // 深空灰
      900: '#000000',
    },
    semantic: {
      success: '#34d399', // 成功绿
      warning: '#fbbf24', // 警告黄
      error: '#ef4444',   // 错误红
      info: '#3b82f6',    // 信息蓝
    }
  },
  
  // 玻璃拟态效果
  glassmorphism: {
    background: 'rgba(255, 255, 255, 0.25)',
    backdropBlur: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  },
  
  // 圆角系统
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  
  // 阴影系统
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  
  // 字体系统
  typography: {
    fontFamily: {
      sans: ['SF Pro Display', 'SF Pro Text', 'PingFang SC', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      mono: ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px',
      '5xl': '48px',
      '6xl': '60px',
    },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  
  // 间距系统（4px网格）
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
    32: '128px',
    40: '160px',
    48: '192px',
    56: '224px',
    64: '256px',
  },
  
  // 动画系统
  animation: {
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '350ms',
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    },
  },
  
  // 响应式断点
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // 可访问性配置
  accessibility: {
    minTouchTarget: '44px',
    maxAnimationDuration: '5000ms',
    colorContrast: '4.5:1',
    focusRing: {
      width: '2px',
      offset: '2px',
      color: '#0071e3',
    },
  },
};

// 国际化样式适配
export const i18nStyles = {
  // RTL语言支持
  rtl: {
    direction: 'rtl',
    textAlign: 'right',
  },
  // 中日韩字体优化
  cjk: {
    fontFamily: 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif',
    lineHeight: '1.75',
  },
  // 等宽数字（表格、计时器等）
  tabularNums: {
    fontVariantNumeric: 'tabular-nums',
  },
};

// 玻璃拟态组件样式
export const glassmorphismStyles = {
  card: {
    background: 'rgba(255, 255, 255, 0.25)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  hover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.45)',
  },
  active: {
    transform: 'translateY(0)',
    boxShadow: '0 4px 20px 0 rgba(31, 38, 135, 0.3)',
  },
};
```

## 8. 部署与运维

### 8.1 多租户部署架构

```mermaid
graph TD
  A[全球CDN] --> B[区域负载均衡]
  B --> C[应用集群]
  C --> D[数据库集群]
  C --> E[缓存集群]
  C --> F[AI服务集群]
  
  subgraph "全球基础设施"
    A
    B1[亚太区域]
    B2[美洲区域]
    B3[欧洲区域]
  end
  
  subgraph "应用服务层"
    C1[前端服务]
    C2[API网关]
    C3[业务服务]
    C4[AI服务]
  end
  
  subgraph "数据存储层"
    D1[主数据库]
    D2[只读副本]
    D3[备份存储]
  end
  
  subgraph "缓存与队列"
    E1[Redis集群]
    E2[消息队列]
    E3[文件存储]
  end
  
  B --> B1
  B --> B2
  B --> B3
  
  C --> C1
  C --> C2
  C --> C3
  C --> C4
  
  D --> D1
  D --> D2
  D --> D3
  
  E --> E1
  E --> E2
  E --> E3
```

### 8.2 监控与告警配置

```bash
# 监控配置
MONITORING_ENABLED=true
PROMETHEUS_ENDPOINT=http://prometheus:9090
GRAFANA_ENDPOINT=http://grafana:3000
ALERTMANAGER_ENDPOINT=http://alertmanager:9093

# 业务指标
METRICS_TENANT_COUNT=true
METRICS_ACTIVE_USERS=true
METRICS_AI_USAGE=true
METRICS_BILLING_EVENTS=true

# 告警规则
ALERT_TENANT_QUOTA_THRESHOLD=0.8
ALERT_AI_ERROR_RATE_THRESHOLD=0.1
ALERT_DATABASE_CONNECTION_THRESHOLD=0.8
ALERT_RESPONSE_TIME_THRESHOLD=5000

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
LOG_RETENTION_DAYS=30
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=365
```

### 8.3 自动化运维脚本

```bash
#!/bin/bash
# multi-tenant-deploy.sh

set -e

echo "🚀 开始多租户SaaS平台部署..."

# 1. 环境检查
echo "🔍 检查部署环境..."
docker --version
kubectl cluster-info

# 2. 创建命名空间
echo "📋 创建命名空间..."
kubectl create namespace hackathon-platform || true
kubectl create namespace monitoring || true

# 3. 部署基础设施
echo "🏗️  部署基础设施..."
kubectl apply -f k8s/postgres-cluster.yaml
kubectl apply -f k8s/redis-cluster.yaml
kubectl apply -f k8s/storage.yaml

# 4. 等待基础设施就绪
echo "⏳ 等待基础设施就绪..."
kubectl wait --for=condition=ready pod -l app=postgres -n hackathon-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n hackathon-platform --timeout=300s

# 5. 部署应用服务
echo "📦 部署应用服务..."
kubectl apply -f k8s/api-gateway.yaml
kubectl apply -f k8s/tenant-service.yaml
kubectl apply -f k8s/ai-service.yaml
kubectl apply -f k8s/billing-service.yaml

# 6. 部署前端应用
echo "🌐 部署前端应用..."
kubectl apply -f k8s/frontend.yaml

# 7. 配置监控
echo "📊 配置监控告警..."
kubectl apply -f k8s/monitoring/

# 8. 配置多租户
echo "🏢 配置多租户系统..."
kubectl apply -f k8s/tenant-isolation.yaml

# 9. 执行数据库迁移
echo "🗄️  执行数据库迁移..."
kubectl exec -it deployment/tenant-service -- npm run db:migrate

# 10. 初始化超级管理员
echo "👨‍💼 初始化超级管理员..."
kubectl exec -it deployment/tenant-service -- npm run init:super-admin

# 11. 健康检查
echo "🏥 执行健康检查..."
kubectl apply -f k8s/health-checks.yaml

# 12. 配置自动扩缩容
echo "⚡ 配置自动扩缩容..."
kubectl apply -f k8s/hpa.yaml

echo "✅ 多租户SaaS平台部署完成！"
echo "🔗 访问地址: https://your-domain.com"
echo "🔐 超级管理员: admin@your-domain.com"
echo "📊 监控面板: https://grafana.your-domain.com"
echo "🤖 AI服务状态: https://your-domain.com/api/health/ai"
echo "💰 计费中心: https://your-domain.com/billing"
echo "🌍 多语言支持: /zh-CN, /en-US"
echo "🏢 租户注册: https://your-domain.com/tenants/register"
```

> 说明：为支持 OpenAI 兼容网关/私有化模型，这里以 `baseUrl/apiKey/model` 三要素为核心；`apiKey` 必须只在服务端使用与存储。

```bash
# OpenAI 兼容配置（三要素）
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# 可选：其他模型厂商
ANTHROPIC_API_KEY=sk-your-anthropic-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key

# AI服务开关
AI_SERVICE_ENABLED=true
AI_JUDGE_ENABLED=true
AI_TEAM_MATCHER_ENABLED=true
AI_CONTENT_GENERATOR_ENABLED=true
AI_PLAGIARISM_CHECK_ENABLED=true
AI_MODERATION_ENABLED=true

# 任务队列配置
REDIS_AI_QUEUE_URL=redis://redis:6380
AI_TASK_TIMEOUT=300000
AI_MAX_CONCURRENT_TASKS=10

# 向量数据库配置
PGVECTOR_DIMENSION=1536
VECTOR_SEARCH_THRESHOLD=0.8

# AI缓存配置
AI_RESULT_CACHE_TTL=3600
AI_SIMILARITY_CACHE_TTL=86400
```

TypeScript 配置对象（用于管理员后台“AI配置”表单与服务端读取）：
```ts
export type OpenAICompatibleConfig = {
  baseUrl: string
  apiKey: string
  model: string
}
```

### 7.5 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 开始部署黑客松评审平台..."

# 1. 克隆代码
echo "📥 克隆代码仓库..."
git clone https://github.com/your-org/hackathon-platform.git
cd hackathon-platform

# 2. 配置环境变量
echo "⚙️  配置环境变量..."
cp .env.example .env
# 自动生成加密密钥
openssl rand -base64 32 > .encryption_key
echo "ENCRYPTION_KEY=$(cat .encryption_key)" >> .env

# 3. 安装依赖
echo "📦 安装依赖..."
npm install

# 4. 数据库迁移
echo "🗄️  执行数据库迁移..."
npm run db:migrate

# 5. 初始化数据
echo "📝 初始化基础数据..."
npm run db:seed

# 6. 构建PWA应用
echo "🏗️  构建PWA应用..."
npm run build:pwa

# 7. 构建主应用
echo "🏗️  构建主应用..."
npm run build

# 8. 启动服务
echo "🐳 启动Docker服务..."
docker-compose -f docker-compose.prod.yml up -d

# 9. 健康检查
echo "🏥 执行健康检查..."
sleep 10
curl -f http://localhost:3000/health || exit 1

# 10. 配置监控
echo "📊 配置监控告警..."
npm run setup:monitoring

echo "✅ 部署完成！"
echo "🌐 平台地址: https://your-domain.com"
echo "🔐 超级管理员: admin@your-domain.com"
echo "📱 PWA已启用，支持离线评审"
echo "🔒 安全审计: https://your-domain.com/super-admin/security"
echo "🤖 AI服务已部署，支持智能评审"
echo "⚡ AI功能状态: https://your-domain.com/ai/status"
## 9. Local Development & Demo Mode

To support offline development and demonstration without external dependencies (Supabase, OpenAI), the platform supports a "Local Mode".

### 9.1 Configuration
- **Supabase**: If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing, the app automatically falls back to `src/lib/mock-data.ts`.
- **AI Services**: If AI keys are missing, AI features (judging, content gen) will either be disabled or use mock responses.
- **Storage**: File uploads will be simulated in browser memory or local storage.

### 9.2 Mock Data Strategy
- **Location**: `src/lib/mock-data.ts` contains static mock data for Hackathons, Projects, Sessions, Judges, and Assignments.
- **State**: The application uses React state and Context to manage data modifications during the session (changes are lost on refresh in pure demo mode, or persisted to `localStorage`).

### 9.3 Switching Modes
- **Demo Mode**: Clear `.env` file or remove Supabase keys.
- **SaaS Mode**: Configure `.env` with valid Supabase and OpenAI credentials.
